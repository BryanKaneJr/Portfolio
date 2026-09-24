import { classifySupabaseKey } from '@brainscroll/core';

/**
 * Read-only probes of a Supabase project with the app's public key: is auth
 * reachable with anonymous sign-ins OFF and the sign-in methods on (Apple,
 * Google, phone, email), are the migrations applied, is content
 * published, do the server functions exist? Nothing here writes.
 */
export interface ProbeResult {
  check: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; text(): Promise<string> }>;

/** The sign-in methods BrainScroll offers, as /auth/v1/settings reports them under `external`. */
export const SIGN_IN_PROVIDERS = [
  { key: 'apple', label: 'Apple', fix: 'Authentication → Sign In / Providers → Apple' },
  { key: 'google', label: 'Google', fix: 'Authentication → Sign In / Providers → Google' },
  { key: 'phone', label: 'phone', fix: 'Authentication → Sign In / Providers → Phone, with an SMS provider' },
  { key: 'email', label: 'email', fix: 'Authentication → Sign In / Providers → Email' },
] as const;

/** Newest table from the last migration; bump when adding a migration that the app needs. */
export const LATEST_MIGRATION_TABLE = 'user_review_attempts';

export async function probeProject(baseUrl: string, key: string, fetchImpl: Fetch = fetch as unknown as Fetch): Promise<ProbeResult[]> {
  const base = baseUrl.replace(/\/+$/, '');
  // New publishable keys go only in `apikey`; legacy JWT keys also work as a bearer token.
  const headers: Record<string, string> = { apikey: key, 'content-type': 'application/json' };
  if (classifySupabaseKey(key) === 'anon_jwt') headers.authorization = `Bearer ${key}`;
  const out: ProbeResult[] = [];
  const get = async (path: string, init?: { method?: string; body?: string }) => {
    try {
      const r = await fetchImpl(base + path, { method: init?.method ?? 'GET', headers, body: init?.body });
      const text = await r.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        /* not JSON */
      }
      return { status: r.status, json };
    } catch (e) {
      return { status: 0, json: { message: (e as Error).message } };
    }
  };
  const msg = (j: unknown) => (j && typeof j === 'object' && 'message' in j ? String((j as { message: unknown }).message) : JSON.stringify(j));

  const auth = await get('/auth/v1/settings');
  if (auth.status === 0) {
    out.push({ check: 'reach project', status: 'fail', detail: `could not connect: ${msg(auth.json)}` });
    return out;
  }
  if (auth.status === 401 || auth.status === 403) {
    out.push({ check: 'auth settings', status: 'fail', detail: `the key was rejected (${auth.status}); is it this project's anon/publishable key?` });
    return out;
  }
  const external = (auth.json as { external?: Record<string, unknown> } | null)?.external ?? {};
  if (auth.status !== 200) out.push({ check: 'auth settings', status: 'warn', detail: `unexpected status ${auth.status}` });
  else if (external.anonymous_users === false) out.push({ check: 'anonymous sign-ins', status: 'ok', detail: 'disabled (accounts are required)' });
  else if (external.anonymous_users === true)
    out.push({ check: 'anonymous sign-ins', status: 'fail', detail: 'enabled: turn off Authentication → Sign In / Providers → Anonymous sign-ins (BrainScroll has no guest mode; the database refuses anonymous users)' });
  else out.push({ check: 'anonymous sign-ins', status: 'warn', detail: 'could not confirm from /auth/v1/settings; check the dashboard' });
  if (auth.status === 200) {
    const methods = SIGN_IN_PROVIDERS.filter((p) => external[p.key] === true);
    for (const p of SIGN_IN_PROVIDERS)
      out.push(
        external[p.key] === true
          ? { check: `sign-in: ${p.label}`, status: 'ok', detail: 'enabled' }
          : { check: `sign-in: ${p.label}`, status: 'warn', detail: `not enabled yet; the app hides this option until it is (${p.fix})` },
      );
    if (methods.length === 0) out.push({ check: 'sign-in methods', status: 'fail', detail: 'no sign-in method is enabled, so nobody can create an account' });
  }

  const table = async (name: string, check: string, fix: string) => {
    const r = await get(`/rest/v1/${name}?select=*&limit=1`);
    if (r.status === 200) out.push({ check, status: 'ok', detail: `${name} exists` });
    else out.push({ check, status: 'fail', detail: `${name}: ${r.status} ${msg(r.json)}. Fix: ${fix}` });
    return r.status === 200;
  };
  const base_ok = await table('app_settings', 'migrations applied', 'run `supabase db push` from brainscroll/backend');
  if (base_ok) await table(LATEST_MIGRATION_TABLE, 'latest migration applied', 'run `supabase db push` to apply newer migrations');

  if (base_ok) {
    const names = await get('/rest/v1/analytics_event_names?select=name&name=eq.sign_in_started');
    if (names.status === 200 && Array.isArray(names.json))
      out.push(
        names.json.length > 0
          ? { check: 'accounts-required migration', status: 'ok', detail: 'applied (sign-in analytics present)' }
          : { check: 'accounts-required migration', status: 'fail', detail: 'not applied: run `supabase db push` to apply 20261001000000_accounts_required.sql' },
      );
  }

  const levels = await get('/rest/v1/levels?select=id&status=eq.published');
  if (levels.status === 200 && Array.isArray(levels.json))
    out.push(
      levels.json.length > 0
        ? { check: 'published content', status: 'ok', detail: `${levels.json.length} published levels` }
        : { check: 'published content', status: 'warn', detail: 'no published levels: run `npm run content:import` (staging: add --publish-drafts)' },
    );

  const rpc = await get('/rest/v1/rpc/get_daily_status', { method: 'POST', body: '{}' });
  const code = (rpc.json as { code?: string } | null)?.code;
  if (rpc.status === 404 && code === 'PGRST202') out.push({ check: 'server functions', status: 'fail', detail: 'get_daily_status not found: apply the migrations' });
  else out.push({ check: 'server functions', status: 'ok', detail: `get_daily_status responds (${rpc.status}${code ? ` ${code}` : ''}; an auth error without a session is expected)` });
  return out;
}
