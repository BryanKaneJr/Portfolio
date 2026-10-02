/**
 * Builds the invite site into site/dist (docs/invite-links.md).
 *
 *   APPLE_TEAM_ID=… ANDROID_CERT_SHA256=… APP_STORE_URL=… PLAY_STORE_URL=… \
 *   SITE_OPERATOR=… SITE_ADDRESS=… SITE_CONTACT_EMAIL=… SITE_EFFECTIVE_DATE=… npm run site:build
 *
 * None is a secret. Set them in the host's environment (Cloudflare Pages),
 * not in the repo: the last four are the owner's details for the privacy
 * policy. The host builds site/dist on every push.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite, siteConfigFromEnv, siteWarnings } from './lib/site';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(readFileSync(join(repo, 'app', 'app.json'), 'utf8')) as { expo: { ios: { bundleIdentifier: string }; android: { package: string } } };
if (app.expo.ios.bundleIdentifier !== app.expo.android.package) throw new Error('The iOS bundle id and Android package differ: update scripts/lib/site.ts to take both.');
const config = siteConfigFromEnv(process.env, app.expo.ios.bundleIdentifier);
const written = buildSite(join(repo, 'site', 'src'), join(repo, 'site', 'dist'), config, readFileSync(join(repo, 'docs', 'privacy-policy.md'), 'utf8'));
for (const w of siteWarnings(config)) console.warn(`warning  ${w}`);
console.log(`Built site/dist: ${written.join(', ')}`);
