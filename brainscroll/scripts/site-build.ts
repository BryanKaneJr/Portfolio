/**
 * Builds the invite site into site/dist (docs/invite-links.md).
 *
 *   APPLE_TEAM_ID=… ANDROID_CERT_SHA256=… APP_STORE_URL=… PLAY_STORE_URL=… \
 *   SITE_OPERATOR=… SITE_ADDRESS=… SITE_CONTACT_EMAIL=… SITE_EFFECTIVE_DATE=… npm run site:build
 *
 * None is a secret. Set them in the host's environment (Cloudflare Pages),
 * not in the repo: the last four are the owner's details for the privacy
 * policy. The host builds site/dist on every push. The Apple team id has a
 * default below, since it's printed in every signed build anyway.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSite, siteConfigFromEnv, siteWarnings } from './lib/site';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = JSON.parse(readFileSync(join(repo, 'app', 'app.json'), 'utf8')) as { expo: { ios: { bundleIdentifier: string }; android: { package: string } } };
if (app.expo.ios.bundleIdentifier !== app.expo.android.package) throw new Error('The iOS bundle id and Android package differ: update scripts/lib/site.ts to take both.');
// The Apple team that signs BrainScroll (from the TestFlight build's provisioning profile, 2026-10-09). It's public:
// every signed build and the apple-app-site-association file carry it. APPLE_TEAM_ID in the host's environment wins.
const APPLE_TEAM_ID = 'X3837877NX';
// The store listings, public too. Each stays empty until the app is live in that store, so the page shows
// "coming soon" rather than a link to a listing that isn't up yet; the badge appears once it's set.
// iPhone, on release day: https://apps.apple.com/app/id6818598156 (Apple ID from App Store Connect).
// Android, once it's on Google Play: https://play.google.com/store/apps/details?id=app.brainscroll
// The host's environment (APP_STORE_URL, PLAY_STORE_URL) wins.
const STORE_URLS = { APP_STORE_URL: '', PLAY_STORE_URL: '' };
const config = siteConfigFromEnv({ APPLE_TEAM_ID, ...STORE_URLS, ...process.env }, app.expo.ios.bundleIdentifier);
const written = buildSite(join(repo, 'site', 'src'), join(repo, 'site', 'dist'), config, readFileSync(join(repo, 'docs', 'privacy-policy.md'), 'utf8'));
for (const w of siteWarnings(config)) console.warn(`warning  ${w}`);
console.log(`Built site/dist: ${written.join(', ')}`);
