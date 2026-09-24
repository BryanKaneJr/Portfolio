/**
 * Checks the two values the app needs to talk to Supabase
 * (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY) before anything
 * uses them. Shared by the app (refuses to start with a secret key) and
 * `npm run supabase:check`. Pure: no network, no Node or RN APIs.
 */

export type SupabaseKeyKind =
  | 'anon_jwt' // legacy anon key (JWT, role "anon"): safe to ship
  | 'publishable' // sb_publishable_…: safe to ship
  | 'service_role_jwt' // legacy service_role JWT: a secret
  | 'secret' // sb_secret_…: a secret
  | 'unknown';

export interface ConfigProblem {
  severity: 'error' | 'warning';
  message: string;
}

/** base64url → string without atob/Buffer, so it runs everywhere. */
function base64UrlDecode(input: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of input.replace(/=+$/, '')) {
    const i = alphabet.indexOf(ch === '+' ? '-' : ch === '/' ? '_' : ch);
    if (i < 0) throw new Error('not base64url');
    value = (value << 6) | i;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join(''));
}

export function classifySupabaseKey(key: string): SupabaseKeyKind {
  const k = key.trim();
  if (k.startsWith('sb_publishable_')) return 'publishable';
  if (k.startsWith('sb_secret_')) return 'secret';
  const parts = k.split('.');
  if (parts.length !== 3) return 'unknown';
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]!)) as { role?: unknown };
    if (payload.role === 'anon') return 'anon_jwt';
    if (payload.role === 'service_role') return 'service_role_jwt';
  } catch {
    return 'unknown';
  }
  return 'unknown';
}

export const isSecretSupabaseKey = (key: string) => {
  const kind = classifySupabaseKey(key);
  return kind === 'secret' || kind === 'service_role_jwt';
};

/**
 * Problems with the app's client config. Both values missing is fine (the
 * app plays offline); one missing, a malformed URL, or a secret key is not.
 */
export function checkClientConfig(url: string | undefined, key: string | undefined): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  const u = url?.trim();
  const k = key?.trim();
  if (!u && !k) return problems;
  if (!u) problems.push({ severity: 'error', message: 'EXPO_PUBLIC_SUPABASE_ANON_KEY is set but EXPO_PUBLIC_SUPABASE_URL is not' });
  if (!k) problems.push({ severity: 'error', message: 'EXPO_PUBLIC_SUPABASE_URL is set but EXPO_PUBLIC_SUPABASE_ANON_KEY is not' });

  if (u) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(u);
    } catch {
      problems.push({ severity: 'error', message: `EXPO_PUBLIC_SUPABASE_URL is not a URL: ${u}` });
    }
    if (parsed) {
      const local = ['localhost', '127.0.0.1', '10.0.2.2'].includes(parsed.hostname);
      if (parsed.protocol !== 'https:' && !local)
        problems.push({ severity: 'error', message: 'EXPO_PUBLIC_SUPABASE_URL must use https (http is only for a local stack)' });
      if (parsed.pathname !== '/' && parsed.pathname !== '')
        problems.push({ severity: 'error', message: 'EXPO_PUBLIC_SUPABASE_URL must be the project root (no /rest/v1 or other path)' });
      if (!local && !/\.supabase\.co$/.test(parsed.hostname))
        problems.push({ severity: 'warning', message: `EXPO_PUBLIC_SUPABASE_URL host ${parsed.hostname} is not *.supabase.co (fine for a custom domain)` });
    }
  }

  if (k) {
    const kind = classifySupabaseKey(k);
    if (kind === 'secret' || kind === 'service_role_jwt')
      problems.push({
        severity: 'error',
        message: 'EXPO_PUBLIC_SUPABASE_ANON_KEY is a SECRET (service_role/sb_secret) key. It bypasses Row Level Security and must never ship in the app. Use the anon/publishable key, and rotate the secret if it was ever committed or built.',
      });
    else if (kind === 'unknown')
      problems.push({ severity: 'warning', message: 'EXPO_PUBLIC_SUPABASE_ANON_KEY is neither an anon JWT nor an sb_publishable_ key; double-check it' });
  }
  return problems;
}
