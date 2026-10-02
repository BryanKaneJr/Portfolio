import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Builds the invite site (site/src → site/dist; docs/invite-links.md): the
 * landing page, the invite page for https://<domain>/invite/CODE, and the two
 * files that let the phone open BrainScroll for those links instead of the
 * page (iOS Universal Links, Android App Links). Nothing secret goes in: an
 * Apple Team ID and a signing certificate's SHA-256 fingerprint are public.
 */
export interface SiteConfig {
  /** Apple Developer Team ID (10 characters), for apple-app-site-association. */
  appleTeamId?: string;
  /** SHA-256 fingerprints of the Android app signing certificate(s), for assetlinks.json. */
  androidSha256?: string[];
  appStoreUrl?: string;
  playStoreUrl?: string;
  /** The app's bundle id / package name (app.json). */
  bundleId: string;
}

export function siteConfigFromEnv(env: NodeJS.ProcessEnv, bundleId: string): SiteConfig {
  return {
    bundleId,
    appleTeamId: env.APPLE_TEAM_ID || undefined,
    androidSha256: (env.ANDROID_CERT_SHA256 ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
    appStoreUrl: env.APP_STORE_URL || undefined,
    playStoreUrl: env.PLAY_STORE_URL || undefined,
  };
}

/** Problems that would stop the links verifying; the site still builds without them, as plain pages. */
export function siteWarnings(c: SiteConfig): string[] {
  const w: string[] = [];
  if (!c.appleTeamId) w.push('APPLE_TEAM_ID is not set: iPhones will show the page instead of opening the app.');
  else if (!/^[A-Z0-9]{10}$/.test(c.appleTeamId)) w.push(`APPLE_TEAM_ID "${c.appleTeamId}" should be 10 letters and digits.`);
  if (!c.androidSha256?.length) w.push('ANDROID_CERT_SHA256 is not set: Android phones will show the page instead of opening the app.');
  for (const f of c.androidSha256 ?? []) if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f)) w.push(`ANDROID_CERT_SHA256 "${f}" should be 32 hex pairs joined by colons.`);
  for (const [k, v] of [['APP_STORE_URL', c.appStoreUrl], ['PLAY_STORE_URL', c.playStoreUrl]] as const)
    if (v && !/^https:\/\//.test(v)) w.push(`${k} should start with https://.`);
  return w;
}

export function appleAppSiteAssociation(c: SiteConfig) {
  const appID = `${c.appleTeamId}.${c.bundleId}`;
  // `components` for iOS 13+, `appID` and `paths` for older versions.
  return { applinks: { apps: [], details: [{ appIDs: [appID], appID, components: [{ '/': '/invite/*' }], paths: ['/invite/*'] }] } };
}

export function assetLinks(c: SiteConfig) {
  return [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: c.bundleId, sha256_cert_fingerprints: c.androidSha256 ?? [] } }];
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function buildSite(srcDir: string, outDir: string, c: SiteConfig): string[] {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(srcDir)) {
    if (f.endsWith('.html')) {
      const html = readFileSync(join(srcDir, f), 'utf8')
        .replaceAll('{{APP_STORE_URL}}', escapeAttr(c.appStoreUrl ?? ''))
        .replaceAll('{{PLAY_STORE_URL}}', escapeAttr(c.playStoreUrl ?? ''));
      writeFileSync(join(outDir, f), html);
    } else cpSync(join(srcDir, f), join(outDir, f));
  }
  const wk = join(outDir, '.well-known');
  mkdirSync(wk, { recursive: true });
  const written = ['index.html', 'invite.html'];
  if (c.appleTeamId) {
    // No file extension, served as JSON (_headers), and never behind a redirect.
    writeFileSync(join(wk, 'apple-app-site-association'), JSON.stringify(appleAppSiteAssociation(c), null, 2) + '\n');
    written.push('.well-known/apple-app-site-association');
  }
  if (c.androidSha256?.length) {
    writeFileSync(join(wk, 'assetlinks.json'), JSON.stringify(assetLinks(c), null, 2) + '\n');
    written.push('.well-known/assetlinks.json');
  }
  // Cloudflare Pages and Netlify read these two: every /invite/CODE serves the invite page.
  writeFileSync(join(outDir, '_redirects'), '/invite/*  /invite.html  200\n');
  writeFileSync(
    join(outDir, '_headers'),
    [
      '/.well-known/apple-app-site-association',
      '  Content-Type: application/json',
      '/*',
      '  X-Content-Type-Options: nosniff',
      '  Referrer-Policy: no-referrer',
      "  Content-Security-Policy: default-src 'self'; script-src 'unsafe-inline'; style-src 'self'; img-src 'self'",
      '',
    ].join('\n'),
  );
  return written;
}
