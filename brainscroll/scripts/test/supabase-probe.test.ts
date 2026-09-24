import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeProject } from '../lib/supabase-probe';

type Route = (path: string, init?: { method?: string; headers?: Record<string, string> }) => { status: number; body?: unknown };
const stub = (route: Route) => async (url: string, init?: { method?: string; headers?: Record<string, string> }) => {
  const r = route(new URL(url).pathname + new URL(url).search, init);
  return { status: r.status, text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) };
};
const healthy: Route = (path) => {
  if (path === '/auth/v1/settings') return { status: 200, body: { external: { anonymous_users: true, email: true } } };
  if (path.startsWith('/rest/v1/levels')) return { status: 200, body: [{ id: 'level.science.astronomy.001' }] };
  if (path.startsWith('/rest/v1/rpc/')) return { status: 401, body: { code: '42501', message: 'not authenticated' } };
  if (path.startsWith('/rest/v1/')) return { status: 200, body: [] };
  return { status: 404 };
};
const statuses = (rs: { check: string; status: string }[]) => Object.fromEntries(rs.map((r) => [r.check, r.status]));

test('a correctly set-up project passes every probe', async () => {
  const rs = await probeProject('https://x.supabase.co/', 'sb_publishable_x', stub(healthy));
  assert.ok(rs.every((r) => r.status === 'ok'), JSON.stringify(rs));
});

test('sends a legacy anon JWT as bearer too, but a publishable key only as apikey', async () => {
  const seen: Record<string, string>[] = [];
  const spy: Route = (p, init) => { seen.push(init?.headers ?? {}); return healthy(p); };
  const anon = ['{"alg":"HS256"}', '{"role":"anon"}'].map((s) => Buffer.from(s).toString('base64url')).join('.') + '.sig';
  await probeProject('https://x.supabase.co', anon, stub(spy));
  assert.equal(seen[0]!.authorization, `Bearer ${anon}`);
  seen.length = 0;
  await probeProject('https://x.supabase.co', 'sb_publishable_x', stub(spy));
  assert.equal(seen[0]!.authorization, undefined);
});

test('flags disabled anonymous sign-ins, missing migrations, no content and missing functions', async () => {
  const broken: Route = (path) => {
    if (path === '/auth/v1/settings') return { status: 200, body: { external: { anonymous_users: false, email: true } } };
    if (path.startsWith('/rest/v1/app_settings')) return { status: 200, body: [] };
    if (path.startsWith('/rest/v1/user_review_attempts')) return { status: 404, body: { code: 'PGRST205', message: 'not found' } };
    if (path.startsWith('/rest/v1/levels')) return { status: 200, body: [] };
    if (path.startsWith('/rest/v1/rpc/')) return { status: 404, body: { code: 'PGRST202', message: 'no function' } };
    return { status: 404 };
  };
  const s = statuses(await probeProject('https://x.supabase.co', 'sb_publishable_x', stub(broken)));
  assert.equal(s['anonymous sign-ins'], 'fail');
  assert.equal(s['latest migration applied'], 'fail');
  assert.equal(s['published content'], 'warn');
  assert.equal(s['server functions'], 'fail');
});

test('stops early when the key is rejected or the host is unreachable', async () => {
  const rejected = await probeProject('https://x.supabase.co', 'bad', stub(() => ({ status: 401 })));
  assert.deepEqual(statuses(rejected), { 'auth settings': 'fail' });
  const down = await probeProject('https://x.supabase.co', 'k', async () => { throw new Error('ECONNREFUSED'); });
  assert.deepEqual(statuses(down), { 'reach project': 'fail' });
});
