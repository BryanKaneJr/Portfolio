// A minimal stand-in for Supabase's Auth (GoTrue) and PostgREST RPC endpoints,
// backed by the throwaway test Postgres. TESTS ONLY: it doesn't verify
// signatures. It lets the real app + real supabase-js talk to the real SQL
// functions without Docker or a hosted project.
//
//   PGHOST=<socket dir> PGPORT=<port> PGDATABASE=<db> PORT=54400 node fake-supabase.mjs
//
// Accounts are required, so there is no anonymous sign-up. Implements:
//   POST /auth/v1/otp                         email or phone code (creates the account on first use)
//   POST /auth/v1/verify                      type email | sms
//   POST /auth/v1/token?grant_type=id_token   native Apple/Google (the id_token payload is trusted)
//   GET  /auth/v1/authorize?provider=…        web Apple/Google: redirects straight back with a PKCE code
//   POST /auth/v1/token?grant_type=pkce       exchanges that code for a session
//   POST /auth/v1/token?grant_type=refresh_token, GET /auth/v1/user, POST /auth/v1/logout
//   GET  /auth/v1/settings                    which sign-in methods are on
//   POST /auth/v1/signup                      always refused (anonymous_provider_disabled)
//   POST /rest/v1/rpc/<fn>
//   POST /functions/v1/revenuecat-webhook       like the real function: bearer FAKE_WEBHOOK_SECRET, then apply_revenuecat_event
//   POST /functions/v1/sync-entitlement         signed in: returns get_entitlement (no RevenueCat to ask here)
// Every one-time code is FAKE_OTP (default 123456). OAuth signs in as
// FAKE_OAUTH_EMAIL (default <provider>.learner@example.com).
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import pg from 'pg';

const pool = new pg.Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT), database: process.env.PGDATABASE, user: 'postgres' });
const port = Number(process.env.PORT ?? 54400);
const FAKE_OTP = process.env.FAKE_OTP ?? '123456';
const FAKE_WEBHOOK_SECRET = process.env.FAKE_WEBHOOK_SECRET ?? 'test-webhook-secret';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

export function makeJwt(claims) {
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iat: now(), exp: now() + 3600, ...claims })}.test-signature`;
}

function decodeJwt(token) {
  try {
    return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString());
  } catch {
    return {};
  }
}

const claimsOf = (req) => decodeJwt((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));

async function userRow(id) {
  const { rows } = await pool.query('select id, email, phone, is_anonymous, raw_app_meta_data from auth.users where id = $1', [id]);
  return rows[0] ?? null;
}

function user(row) {
  const t = new Date().toISOString();
  const provider = row.raw_app_meta_data?.provider ?? 'email';
  return { id: row.id, aud: 'authenticated', role: 'authenticated', is_anonymous: row.is_anonymous, email: row.email ?? '',
    phone: row.phone ?? '', app_metadata: { provider, providers: [provider] }, user_metadata: {}, identities: [],
    created_at: t, updated_at: t };
}

async function session(id) {
  const row = await userRow(id);
  return {
    access_token: makeJwt({ sub: id, role: 'authenticated', aud: 'authenticated', is_anonymous: false, email: row.email ?? '', phone: row.phone ?? '', session_id: randomUUID() }),
    token_type: 'bearer', expires_in: 3600, expires_at: now() + 3600, refresh_token: `rt.${id}`, user: user(row),
  };
}

/** Finds the account for this identity, or creates it: signing in is signing up. */
async function findOrCreate(column, value, provider) {
  const found = await pool.query(`select id from auth.users where ${column} = $1`, [value]);
  if (found.rows.length) return found.rows[0].id;
  const { rows } = await pool.query(`insert into auth.users (${column}, raw_app_meta_data) values ($1, $2) returning id`, [value, { provider }]);
  return rows[0].id;
}

const normEmail = (e) => String(e ?? '').trim().toLowerCase();
const normPhone = (p) => String(p ?? '').replace(/[^\d]/g, ''); // GoTrue stores E.164 without the "+"

// GoTrue-style error body; supabase-js reads error_code into AuthApiError.code.
const authError = (status, code, msg) => ({ status, body: { code: status, error_code: code, msg } });
const badCode = () => authError(403, 'otp_expired', 'Token has expired or is invalid');

const oauthCodes = new Map(); // PKCE auth code → user id

async function authRoute(method, url, body, claims) {
  const path = url.pathname;
  const grant = url.searchParams.get('grant_type');
  if (method === 'GET' && path === '/auth/v1/user') {
    const row = claims.sub && (await userRow(claims.sub));
    return row ? { status: 200, body: user(row) } : { status: 401, body: { message: 'not signed in' } };
  }
  if (method === 'GET' && path === '/auth/v1/settings') {
    // What a correctly set-up project reports: every BrainScroll method on, anonymous sign-ins off.
    // FAKE_METHODS=phone,email narrows it (e.g. to test a project without Apple/Google credentials yet).
    const on = new Set((process.env.FAKE_METHODS ?? 'apple,google,phone,email').split(','));
    return { status: 200, body: { external: { anonymous_users: false, apple: on.has('apple'), google: on.has('google'), phone: on.has('phone'), email: on.has('email') } } };
  }
  if (method === 'POST' && path === '/auth/v1/signup') {
    // No guest mode: an empty (anonymous) sign-up is what the real project refuses too.
    return authError(422, 'anonymous_provider_disabled', 'Anonymous sign-ins are disabled');
  }
  if (method === 'POST' && path === '/auth/v1/otp') {
    if (body.phone ? normPhone(body.phone).length < 8 : !normEmail(body.email).includes('@')) return authError(400, 'validation_failed', 'invalid target');
    return { status: 200, body: {} }; // "sends" FAKE_OTP by email or SMS
  }
  if (method === 'POST' && path === '/auth/v1/verify') {
    if (String(body.token) !== FAKE_OTP) return badCode();
    if (body.type === 'sms') return { status: 200, body: await session(await findOrCreate('phone', normPhone(body.phone), 'phone')) };
    if (body.type === 'email') return { status: 200, body: await session(await findOrCreate('email', normEmail(body.email), 'email')) };
    return authError(400, 'validation_failed', `unsupported verify type ${body.type}`);
  }
  if (method === 'POST' && path === '/auth/v1/token' && grant === 'id_token') {
    const provider = String(body.provider ?? '');
    if (!['apple', 'google'].includes(provider)) return authError(400, 'validation_failed', `unsupported provider ${provider}`);
    const email = normEmail(decodeJwt(body.id_token).email);
    if (!email) return authError(400, 'bad_jwt', 'id_token has no email');
    return { status: 200, body: await session(await findOrCreate('email', email, provider)) };
  }
  if (method === 'GET' && path === '/auth/v1/authorize') {
    const provider = url.searchParams.get('provider') ?? '';
    if (!['apple', 'google'].includes(provider)) return authError(400, 'validation_failed', `unsupported provider ${provider}`);
    const id = await findOrCreate('email', process.env.FAKE_OAUTH_EMAIL ?? `${provider}.learner@example.com`, provider);
    const code = randomUUID();
    oauthCodes.set(code, id);
    const back = new URL(url.searchParams.get('redirect_to') ?? 'http://localhost/');
    back.searchParams.set('code', code);
    return { status: 302, headers: { Location: back.toString() } };
  }
  if (method === 'POST' && path === '/auth/v1/token' && grant === 'pkce') {
    const id = oauthCodes.get(String(body.auth_code));
    oauthCodes.delete(String(body.auth_code));
    return id ? { status: 200, body: await session(id) } : authError(400, 'flow_state_not_found', 'invalid flow state');
  }
  return null;
}

const argTypes = new Map();
async function rpcSignature(fn) {
  if (!argTypes.has(fn)) {
    const { rows } = await pool.query(
      `select coalesce(p.proargnames, '{}') as names, array(select format_type(t, null) from unnest(p.proargtypes) t) as types
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [fn]);
    if (rows.length !== 1) return null;
    argTypes.set(fn, rows[0].names.map((name, i) => ({ name, type: rows[0].types[i] })));
  }
  return argTypes.get(fn);
}

async function callRpc(fn, args, claims) {
  const sig = await rpcSignature(fn);
  if (!sig) return { status: 404, body: { code: 'PGRST202', message: `Could not find the function public.${fn}` } };
  const params = [];
  const named = [];
  for (const { name, type } of sig) {
    if (!(name in args)) continue; // use the SQL default
    const v = args[name];
    params.push(type === 'jsonb' || type === 'json' ? JSON.stringify(v) : v);
    named.push(`${name} => $${params.length}::${type}`);
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [claims.sub ?? '']);
    await client.query(`set local role ${claims.role === 'service_role' ? 'service_role' : claims.sub ? 'authenticated' : 'anon'}`);
    const { rows } = await client.query(`select public.${fn}(${named.join(', ')}) as r`, params);
    await client.query('commit');
    return { status: 200, body: rows[0].r ?? null };
  } catch (e) {
    await client.query('rollback').catch(() => {});
    return { status: 400, body: { code: e.code, message: e.message, details: e.detail ?? null, hint: e.hint ?? null } };
  } finally {
    client.release();
  }
}

const server = http.createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  if (req.method === 'OPTIONS') return send(204);
  const url = new URL(req.url, 'http://x');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};

  try {
    if (req.method === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const id = String(body.refresh_token ?? '').replace(/^rt\./, '');
      return (await userRow(id)) ? send(200, await session(id)) : send(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
    }
    const auth = await authRoute(req.method, url, body, claimsOf(req));
    if (auth?.status === 302) {
      res.writeHead(302, { ...auth.headers, 'Access-Control-Allow-Origin': '*' });
      return res.end();
    }
    if (auth) return send(auth.status, auth.body);
    if (req.method === 'POST' && url.pathname === '/auth/v1/logout') return send(204);
    if (req.method === 'POST' && url.pathname === '/functions/v1/revenuecat-webhook') {
      if (req.headers.authorization !== `Bearer ${FAKE_WEBHOOK_SECRET}`) return send(401, { error: 'unauthorized' });
      const r = await callRpc('apply_revenuecat_event_checked', { p_event: body.event }, { role: 'service_role' });
      return send(r.status, r.body);
    }
    if (req.method === 'POST' && url.pathname === '/functions/v1/sync-entitlement') {
      if (!claimsOf(req).sub) return send(401, { error: 'NOT_AUTHENTICATED' });
      const r = await callRpc('get_entitlement', {}, claimsOf(req));
      return send(r.status, r.body);
    }
    const m = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
    if (req.method === 'POST' && m) {
      const r = await callRpc(m[1], body, claimsOf(req));
      return send(r.status, r.body);
    }
    send(404, { message: `fake-supabase: no route for ${req.method} ${url.pathname}` });
  } catch (e) {
    send(500, { message: String(e) });
  }
});

server.listen(port, () => console.log(`fake-supabase listening on :${port}`));
