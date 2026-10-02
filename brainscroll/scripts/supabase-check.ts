/**
 * Checks the Supabase configuration before you rely on it.
 *
 *   npm run supabase:check              # config + read-only probes of the project
 *   npm run supabase:check -- --offline # config only (no network)
 *
 * Reads app/.env.local and app/.env (process env wins), exactly the values
 * Expo bakes into the app. Also checks SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
 * for the importer if they're set. Exits 1 on any failure.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkClientConfig, classifySupabaseKey } from '@brainscroll/core';
import { probeProject, type ProbeResult } from './lib/supabase-probe';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const offline = process.argv.includes('--offline');

function readEnvFile(p: string): Record<string, string> {
  if (!existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trimStart().startsWith('#')) out[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}
const env = { ...readEnvFile(join(repo, 'app', '.env')), ...readEnvFile(join(repo, 'app', '.env.local')), ...process.env } as Record<string, string | undefined>;
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const results: ProbeResult[] = [];
if (!url && !key) {
  console.log('No EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY: the app will play offline. See app/.env.example and docs/supabase-setup.md.');
} else {
  for (const p of checkClientConfig(url, key)) results.push({ check: 'app config', status: p.severity === 'error' ? 'fail' : 'warn', detail: p.message });
  if (!results.some((r) => r.status === 'fail')) results.push({ check: 'app config', status: 'ok', detail: `${url} with a ${classifySupabaseKey(key!)} key` });
}

// .env.local must never be committed.
try {
  execFileSync('git', ['check-ignore', '-q', join(repo, 'app', '.env.local')], { cwd: repo });
  results.push({ check: 'secrets hygiene', status: 'ok', detail: 'app/.env.local is gitignored' });
} catch {
  results.push({ check: 'secrets hygiene', status: 'fail', detail: 'app/.env.local is NOT gitignored' });
}
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (service) {
  const kind = classifySupabaseKey(service);
  results.push(
    kind === 'secret' || kind === 'service_role_jwt'
      ? { check: 'importer key', status: 'ok', detail: 'SUPABASE_SERVICE_ROLE_KEY is a secret key (keep it out of the app and git)' }
      : { check: 'importer key', status: 'fail', detail: `SUPABASE_SERVICE_ROLE_KEY looks like a ${kind} key; the importer needs the service_role / sb_secret key` },
  );
  if (env.SUPABASE_URL && url && env.SUPABASE_URL.replace(/\/+$/, '') !== url.replace(/\/+$/, ''))
    results.push({ check: 'importer URL', status: 'warn', detail: 'SUPABASE_URL differs from EXPO_PUBLIC_SUPABASE_URL: importing into a different project?' });
}

if (url && key && !offline && !results.some((r) => r.status === 'fail')) results.push(...(await probeProject(url, key)));

const icon = { ok: '✔', warn: '⚠', fail: '✖' } as const;
for (const r of results) console.log(`${icon[r.status]} ${r.check}: ${r.detail}`);
process.exit(results.some((r) => r.status === 'fail') ? 1 : 0);
