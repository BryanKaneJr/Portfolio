/**
 * Sends the app's JavaScript and images to the store builds as an instant
 * update (EAS Update, docs/release.md): no new build, no App Review. A phone
 * downloads it the next time the app opens and runs it the time after.
 *
 *   npm run app:update -- "Fix the order question drag"
 *   npm run app:update -- --dry-run      (bundle and check, publish nothing)
 *
 * It bundles with exactly the public values the store build carries
 * (app/eas.json, build.production.env), never with this shell's EXPO_PUBLIC_
 * values or a .env file, checks the bundle talks to Supabase, and only then
 * publishes to the production channel. A plain `eas update` bundles without
 * the eas.json values, so it would send every phone the offline test harness:
 * always use this.
 *
 * Native changes (a new native package, a plugin, an app.json setting) can't
 * travel this way: they need a new build with a higher "version" in app.json.
 * The runtime version follows "version", so an update only reaches builds
 * that can run it.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
const dryRun = process.argv.includes('--dry-run');
const message = process.argv.slice(2).filter((a) => a !== '--dry-run').join(' ').trim();
if (!dryRun && !message) {
  console.error('Say what changed, e.g. npm run app:update -- "Fix the order question drag"');
  process.exit(1);
}

const eas = JSON.parse(readFileSync(join(app, 'eas.json'), 'utf8')) as {
  build: Record<string, { channel?: string; env?: Record<string, string> }>;
};
const { channel, env: store = {} } = eas.build.production!;
if (!channel || !store.EXPO_PUBLIC_SUPABASE_URL || !store.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('app/eas.json build.production needs a channel and the Supabase URL and key in env.');
}
const env: NodeJS.ProcessEnv = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('EXPO_PUBLIC_'))),
  ...store,
  EXPO_NO_DOTENV: '1',
};

// Node runs both tools directly (no shell), so the message reaches them whole on Windows too.
const run = (args: string[]) => {
  const r = spawnSync(process.execPath, args, { cwd: app, env, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const dist = join(app, 'dist');
rmSync(dist, { recursive: true, force: true });
const expo = createRequire(join(app, 'package.json')).resolve('expo/bin/cli');
// The same export `eas update` runs, for the platforms it publishes.
run([expo, 'export', '--output-dir', 'dist', '--dump-assetmap', '--platform', 'ios', '--platform', 'android', '--clear']);

for (const platform of ['ios', 'android']) {
  const dir = join(dist, '_expo', 'static', 'js', platform);
  const bundle = readdirSync(dir).filter((f) => f.endsWith('.hbc') || f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'latin1')).join('');
  for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const) {
    if (!bundle.includes(store[name]!)) throw new Error(`The ${platform} bundle doesn't carry ${name}; nothing was published.`);
  }
}
console.log('Checked: both bundles carry the store build\'s Supabase settings.');

// EAS refuses an update of more than 1,000 files per platform, after uploading the bundles.
const EAS_ASSET_LIMIT = 1000;
const meta = JSON.parse(readFileSync(join(dist, 'metadata.json'), 'utf8')) as { fileMetadata: Record<string, { assets: unknown[] }> };
const counts = Object.entries(meta.fileMetadata).map(([platform, m]) => [platform, m.assets.length] as const);
console.log(`Files: ${counts.map(([p, n]) => `${p} ${n}`).join(', ')} (EAS takes up to ${EAS_ASSET_LIMIT} each).`);
const over = counts.filter(([, n]) => n > EAS_ASSET_LIMIT);
if (over.length) {
  console.error(`Too many files for one update (${over.map(([p, n]) => `${p} ${n}`).join(', ')}); nothing was published. Level art goes through npm run art:sync, four images to a file; look for other new images or fonts.`);
  process.exit(1);
}
if (dryRun) process.exit(0);

// npm sets npm_execpath to npm-cli.js; npx-cli.js sits beside it.
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this through npm: npm run app:update -- "what changed"');
run([join(dirname(npmCli), 'npx-cli.js'), '--yes', 'eas-cli@latest', 'update', '--channel', channel, '--environment', 'production', '--skip-bundler', '--input-dir', 'dist', '--message', message, '--non-interactive']);
