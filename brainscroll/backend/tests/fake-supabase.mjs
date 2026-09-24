// A minimal stand-in for Supabase's Auth (GoTrue) and PostgREST RPC endpoints,
// backed by the throwaway test Postgres. TESTS ONLY — it doesn't verify
// signatures. It lets the real app + real supabase-js talk to the real SQL
// functions without Docker or a hosted project.
//
//   PGHOST=<socket dir> PGPORT=<port> PGDATABASE=<db> PORT=54400 node fake-supabase.mjs
//
// Implements: POST /auth/v1/signup (anonymous), POST /auth/v1/token?grant_type=refresh_token,
// GET/PUT /auth/v1/user (PUT attaches an email to an anonymous user), POST /auth/v1/otp (sign-in
// code, never creates users), POST /auth/v1/verify (email_change | email), POST /auth/v1/logout,
// POST /rest/v1/rpc/<fn>. Every emailed one-time code is FAKE_OTP (default 123456).
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import pg from 'pg';

const pool = new pg.Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT), database: process.env.PGDATABASE, user: 'postgres' });
const port = Number(process.env.PORT ?? 54400);
const FAKE_OTP = process.env.FAKE_OTP ?? '123456';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

export function makeJwt(claims) {
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iat: now(), exp: now() + 3600, ...claims })}.test-signature`;
}

function claimsOf(req) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  } catch {
    return {};
  }
}

async function userRow(id) {
  const { rows } = await pool.query('select id, email, is_anonymous, email_change from auth.users where id = $1', [id]);
  return rows[0] ?? null;
}

function user(row) {
  const t = new Date().toISOString();
  const provider = row.is_anonymous ? 'anonymous' : 'email';
  return { id: row.id, aud: 'authenticated', role: 'authenticated', is_anonymous: row.is_anonymous, email: row.email ?? '',
    new_email: row.email_change ?? undefined, phone: '', app_metadata: { provider, providers: [provider] }, user_metadata: {}, identities: [],
    created_at: t, updated_at: t };
}

async function session(id) {
  const row = await userRow(id);
  return {
    access_token: makeJwt({ sub: id, role: 'authenticated', aud: 'authenticated', is_anonymous: row.is_anonymous, email: row.email ?? '', session_id: randomUUID() }),
    token_type: 'bearer', expires_in: 3600, expires_at: now() + 3600, refresh_token: `rt.${id}`, user: user(row),
  };
}

// GoTrue-style error body; supabase-js reads error_code into AuthApiError.code.
const authError = (status, code, msg) => ({ status, body: { code: status, error_code: code, msg } });

async function authRoute(method, path, body, claims) {
  if (method === 'GET' && path === '/auth/v1/user') {
    const row = claims.sub && (await userRow(claims.sub));
    return row ? { status: 200, body: user(row) } : { status: 401, body: { message: 'not signed in' } };
  }
  if (method === 'PUT' && path === '/auth/v1/user') {
    const row = claims.sub && (await userRow(claims.sub));
    if (!row) return { status: 401, body: { message: 'not signed in' } };
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) return { status: 200, body: user(row) };
    const { rows } = await pool.query('select 1 from auth.users where email = $1 and id <> $2', [email, row.id]);
    if (rows.length) return authError(422, 'email_exists', 'A user with this email address has already been registered');
    await pool.query('update auth.users set email_change = $2 where id = $1', [row.id, email]); // "sends" FAKE_OTP
    return { status: 200, body: user(await userRow(row.id)) };
  }
  if (method === 'POST' && path === '/auth/v1/otp') {
    const email = String(body.email ?? '').trim().toLowerCase();
    const { rows } = await pool.query('select 1 from auth.users where email = $1 and not is_anonymous', [email]);
    if (!rows.length && body.create_user === false) return authError(422, 'otp_disabled', 'Signups not allowed for otp');
    return { status: 200, body: {} }; // "sends" FAKE_OTP
  }
  if (method === 'POST' && path === '/auth/v1/verify') {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (body.token !== FAKE_OTP) return authError(403, 'otp_expired', 'Token has expired or is invalid');
    if (body.type === 'email_change') {
      const { rows } = await pool.query(
        `update auth.users set email = email_change, email_change = null, is_anonymous = false where email_change = $1 returning id`, [email]);
      return rows.length ? { status: 200, body: await session(rows[0].id) } : authError(403, 'otp_expired', 'Token has expired or is invalid');
    }
    if (body.type === 'email') {
      const { rows } = await pool.query('select id from auth.users where email = $1 and not is_anonymous', [email]);
      return rows.length ? { status: 200, body: await session(rows[0].id) } : authError(403, 'otp_expired', 'Token has expired or is invalid');
    }
    return authError(400, 'validation_failed', `unsupported verify type ${body.type}`);
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
    await client.query(`set local role ${claims.sub ? 'authenticated' : 'anon'}`);
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
    if (req.method === 'POST' && url.pathname === '/auth/v1/signup') {
      const { rows } = await pool.query('insert into auth.users default values returning id');
      return send(200, await session(rows[0].id));
    }
    if (req.method === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const id = String(body.refresh_token ?? '').replace(/^rt\./, '');
      return send(200, await session(id));
    }
    const auth = await authRoute(req.method, url.pathname, body, claimsOf(req));
    if (auth) return send(auth.status, auth.body);
    if (req.method === 'POST' && url.pathname === '/auth/v1/logout') return send(204);
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
