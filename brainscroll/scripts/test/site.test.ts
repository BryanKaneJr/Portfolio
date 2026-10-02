import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite, siteConfigFromEnv, siteWarnings } from '../lib/site';

const src = join(import.meta.dirname, '..', '..', 'site', 'src');
const FP = Array.from({ length: 32 }, () => 'AB').join(':');

test('builds the invite site with both verification files and the store links', () => {
  const out = mkdtempSync(join(tmpdir(), 'bs-site-'));
  try {
    const c = siteConfigFromEnv({ APPLE_TEAM_ID: 'ABCDE12345', ANDROID_CERT_SHA256: FP.toLowerCase(), APP_STORE_URL: 'https://apps.apple.com/app/id1', PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=app.brainscroll' }, 'app.brainscroll');
    assert.deepEqual(siteWarnings(c).filter((w) => !w.startsWith('SITE_')), []);
    buildSite(src, out, c);
    const aasa = JSON.parse(readFileSync(join(out, '.well-known', 'apple-app-site-association'), 'utf8'));
    assert.deepEqual(aasa.applinks.details[0].appIDs, ['ABCDE12345.app.brainscroll']);
    assert.deepEqual(aasa.applinks.details[0].components, [{ '/': '/invite/*' }]);
    const links = JSON.parse(readFileSync(join(out, '.well-known', 'assetlinks.json'), 'utf8'));
    assert.equal(links[0].target.package_name, 'app.brainscroll');
    assert.deepEqual(links[0].target.sha256_cert_fingerprints, [FP], 'fingerprints are uppercased');
    const invite = readFileSync(join(out, 'invite.html'), 'utf8');
    assert.ok(invite.includes('href="https://apps.apple.com/app/id1"') && invite.includes('details?id=app.brainscroll'));
    assert.ok(!invite.includes('{{'), 'every placeholder is filled');
    assert.match(readFileSync(join(out, '_redirects'), 'utf8'), /^\/invite\/\*\s+\/invite\.html\s+200$/m);
    assert.match(readFileSync(join(out, '_headers'), 'utf8'), /apple-app-site-association\n\s+Content-Type: application\/json/);
    assert.ok(existsSync(join(out, 'dr-scroll.webp')) && existsSync(join(out, 'style.css')));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('without the IDs it still builds plain pages, and says what is missing', () => {
  const out = mkdtempSync(join(tmpdir(), 'bs-site-'));
  try {
    const c = siteConfigFromEnv({}, 'app.brainscroll');
    assert.equal(siteWarnings(c).filter((w) => !w.startsWith('SITE_')).length, 2);
    buildSite(src, out, c);
    assert.ok(!existsSync(join(out, '.well-known', 'apple-app-site-association')) && !existsSync(join(out, '.well-known', 'assetlinks.json')));
    assert.ok(readFileSync(join(out, 'invite.html'), 'utf8').includes('href=""'), 'store buttons stay hidden');
    assert.ok(siteWarnings({ bundleId: 'x', appleTeamId: 'nope', androidSha256: ['12:34'] }).length >= 2, 'malformed IDs are caught');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the invite page loads nothing from anywhere else', () => {
  for (const f of ['invite.html', 'index.html']) {
    const html = readFileSync(join(src, f), 'utf8');
    const external = [...html.matchAll(/(?:src|href)="(https?:[^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(external, [], `${f} loads ${external.join(', ')}`);
  }
});

test('publishes the privacy policy and the deletion page, with the owner details from the environment only', () => {
  const out = mkdtempSync(join(tmpdir(), 'bs-site-'));
  const policy = readFileSync(join(import.meta.dirname, '..', '..', 'docs', 'privacy-policy.md'), 'utf8');
  try {
    const c = siteConfigFromEnv({ SITE_OPERATOR: 'Test Co', SITE_ADDRESS: '1 Test St', SITE_CONTACT_EMAIL: 'privacy@example.com', SITE_EFFECTIVE_DATE: 'October 10, 2026' }, 'app.brainscroll');
    buildSite(src, out, c, policy);
    const privacy = readFileSync(join(out, 'privacy.html'), 'utf8');
    assert.match(privacy, /<h1>BrainScroll Privacy Policy<\/h1>/, 'the title loses "(draft)"');
    assert.ok(!privacy.includes('Draft for the owner'), "the editor's note isn't published");
    assert.ok(privacy.includes('operated by Test Co, 1 Test St') && privacy.includes('href="mailto:privacy@example.com"') && privacy.includes('October 10, 2026'));
    assert.ok(!privacy.includes('{{'), 'every placeholder is filled');
    assert.match(privacy, /<h2>What we collect<\/h2>/);
    const del = readFileSync(join(out, 'delete-account.html'), 'utf8');
    assert.ok(del.includes('Settings</strong>, then <strong>Delete account') && del.includes('mailto:privacy@example.com'));

    const bare = siteConfigFromEnv({}, 'app.brainscroll');
    assert.ok(siteWarnings(bare).some((w) => w.startsWith('SITE_CONTACT_EMAIL is not set')));
    buildSite(src, out, bare, policy);
    assert.ok(readFileSync(join(out, 'privacy.html'), 'utf8').includes('[not set]'), 'missing details show plainly, never a guess');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the privacy policy in the repo carries no personal details, only placeholders', () => {
  const policy = readFileSync(join(import.meta.dirname, '..', '..', 'docs', 'privacy-policy.md'), 'utf8');
  assert.deepEqual(policy.match(/[^\s@()`<>]+@[^\s@()`<>]+\.[a-z]{2,}/gi) ?? [], [], 'no email addresses in the policy');
  for (const t of ['{{OPERATOR}}', '{{CONTACT_EMAIL}}', '{{EFFECTIVE_DATE}}']) assert.ok(policy.includes(t), t);
});
