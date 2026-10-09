import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * #17 (static audit) — the app must work with networking disabled.
 * Fails if app source contains network calls or remote URLs.
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

test('#17 no network calls or remote assets in app source', () => {
  const offenders: string[] = [];
  for (const file of walk(join(__dirname, '..', 'src'))) {
    const src = readFileSync(file, 'utf8');
    if (/\bfetch\s*\(|XMLHttpRequest|WebSocket|axios|https?:\/\/(?!localhost)/.test(src)) offenders.push(file);
  }
  expect(offenders).toEqual([]);
});

test('no backend / auth / payments / tracking SDKs in dependencies', () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ');
  expect(deps).not.toMatch(/firebase|supabase|amplify|auth0|revenuecat|purchases|stripe|analytics|sentry|segment|mixpanel|amplitude/i);
});
