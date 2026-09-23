// A minimal stand-in for Supabase's Auth (GoTrue) and PostgREST RPC endpoints,
// backed by the throwaway test Postgres. TESTS ONLY — it doesn't verify
// signatures. It lets the real app + real supabase-js talk to the real SQL
// functions without Docker or a hosted project.
//
//   PGHOST=<socket dir> PGPORT=<port> PGDATABASE=<db> PORT=54400 node fake-supabase.mjs
//
// Implements: POST /auth/v1/signup (anonymous), POST /auth/v1/token?grant_type=refresh_token,
// GET /auth/v1/user, POST /auth/v1/logout, POST /rest/v1/rpc/<fn>.
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import pg from 'pg';

const pool = new pg.Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT), database: process.env.PGDATABASE, user: 'postgres' });
const port = Number(process.env.PORT ?? 54400);

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

function user(id) {
  const t = new Date().toISOString();
  return { id, aud: 'authenticated', role: 'authenticated', is_anonymous: true, email: '', phone: '',
    app_metadata: { provider: 'anonymous', providers: ['anonymous'] }, user_metadata: {}, identities: [], created_at: t, updated_at: t };
}

function session(id) {
  return {
    access_token: makeJwt({ sub: id, role: 'authenticated', aud: 'authenticated', is_anonymous: true, session_id: randomUUID() }),
    token_type: 'bearer', expires_in: 3600, expires_at: now() + 3600, refresh_token: `rt.${id}`, user: user(id),
  };
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
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
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
      return send(200, session(rows[0].id));
    }
    if (req.method === 'POST' && url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const id = String(body.refresh_token ?? '').replace(/^rt\./, '');
      return send(200, session(id));
    }
    if (req.method === 'GET' && url.pathname === '/auth/v1/user') {
      const { sub } = claimsOf(req);
      return sub ? send(200, user(sub)) : send(401, { message: 'not signed in' });
    }
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
