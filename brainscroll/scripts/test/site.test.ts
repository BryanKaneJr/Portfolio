import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite, pagePath, showStores, siteConfigFromEnv, siteWarnings } from '../lib/site';

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
    assert.match(readFileSync(join(out, '_redirects'), 'utf8'), /^\/invite\/\*\s+\/invite\s+200$/m);
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
    assert.ok(privacy.includes('operated by Test Co, 1 Test St') && privacy.includes('<!--email_off--><a href="mailto:privacy@example.com">privacy@example.com</a><!--/email_off-->') && privacy.includes('October 10, 2026'));
    assert.ok(!privacy.includes('{{'), 'every placeholder is filled');
    assert.match(privacy, /<h2>What we collect<\/h2>/);
    const del = readFileSync(join(out, 'delete-account.html'), 'utf8');
    assert.ok(del.includes('Settings</strong>, then <strong>Delete account') && del.includes('mailto:privacy@example.com'));
    for (const f of ['fat-bat.html', join('fat-bat', 'privacy.html')]) {
      const page = readFileSync(join(out, f), 'utf8');
      assert.ok(page.includes('mailto:privacy@example.com') && page.includes('© 2026 Test Co') && !page.includes('{{'), `${f}: Fat Bat's pages fill the contact email and operator, pages in folders included`);
    }

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

test('the store badges and "coming soon" notes are set in the HTML, with no script', () => {
  const html = readFileSync(join(src, 'index.html'), 'utf8').replaceAll('{{APP_STORE_URL}}', 'https://apps.apple.com/app/id1').replaceAll('{{PLAY_STORE_URL}}', '');
  assert.ok(!/<script>/.test(html), 'the home page runs no script');
  const shown = (out: string) => [...out.matchAll(/data-(?:store|soon)="(\w+)"[^>]*>/g)].filter((m) => !/ hidden>$/.test(m[0])).map((m) => m[1]);
  assert.deepEqual(shown(showStores(html, { appStoreUrl: 'https://apps.apple.com/app/id1' })), ['apple', 'play', 'apple', 'play'], 'the App Store badge and "Android coming soon", in both places');
  assert.deepEqual(shown(showStores(html, {})), ['all', 'all'], 'no store yet: "coming soon" only');
  assert.deepEqual(shown(showStores(html, { appStoreUrl: 'https://a', playStoreUrl: 'https://p' })), ['apple', 'play', 'apple', 'play'], 'both badges, no note');
  assert.deepEqual(shown(showStores(html, { playStoreUrl: 'https://p' })), ['play', 'apple', 'play', 'apple'], 'Google Play and "iPhone coming soon"');
});

test('builds robots.txt, sitemap.xml, llms.txt, a 404 page, canonical links and the structured data', () => {
  const out = mkdtempSync(join(tmpdir(), 'bs-site-'));
  try {
    buildSite(src, out, siteConfigFromEnv({ APP_STORE_URL: 'https://apps.apple.com/app/id1', SITE_CONTACT_EMAIL: 'help@example.com' }, 'app.brainscroll'));
    const robots = readFileSync(join(out, 'robots.txt'), 'utf8');
    assert.match(robots, /^Disallow: \/invite$/m);
    assert.match(robots, /^Sitemap: https:\/\/brainscroll\.app\/sitemap\.xml$/m);
    const locs = [...readFileSync(join(out, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    assert.deepEqual(locs, ['/', '/delete-account', '/fat-bat', '/fat-bat/privacy', '/privacy'].map((p) => `https://brainscroll.app${p}`), 'every public page, never the invite or 404 page');
    const llms = readFileSync(join(out, 'llms.txt'), 'utf8');
    assert.ok(llms.startsWith('# BrainScroll\n\n> ') && llms.includes('(https://apps.apple.com/app/id1)') && llms.includes('questions: help@example.com\n'));
    assert.ok(!llms.includes('{{') && !llms.includes('<'), 'plain text, every placeholder filled');
    assert.ok(readFileSync(join(out, '404.html'), 'utf8').includes('<meta name="robots" content="noindex">'));
    const index = readFileSync(join(out, 'index.html'), 'utf8');
    assert.ok(index.includes('<link rel="canonical" href="https://brainscroll.app/">'));
    assert.ok(readFileSync(join(out, 'fat-bat', 'privacy.html'), 'utf8').includes('href="https://brainscroll.app/fat-bat/privacy"'));
    for (const f of ['invite.html', '404.html']) assert.ok(!readFileSync(join(out, f), 'utf8').includes('rel="canonical"'), f);
    const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(index)![1]!);
    const app = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'MobileApplication');
    assert.equal(app.operatingSystem, 'iOS');
    assert.equal(app.installUrl, 'https://apps.apple.com/app/id1');
    assert.equal(app.applicationCategory, 'EducationalApplication');
    assert.match(app.description, /^BrainScroll turns a few minutes a day/, "the page's own description");
    assert.ok(!('aggregateRating' in app) && !('review' in app), 'no ratings or reviews we made up');
    const org = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'Organization');
    assert.deepEqual([org.name, org.logo, app.publisher['@id']], ['BrainScroll', 'https://brainscroll.app/apple-touch-icon.png', org['@id']]);
    assert.match(readFileSync(join(out, '_headers'), 'utf8'), /^\s+Strict-Transport-Security: max-age=31536000; includeSubDomains$/m);
    assert.equal(pagePath('index.html'), '/');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('every page for search has a 30 to 60 character title and a 110 to 160 character description', () => {
  const pages = ['index.html', 'privacy.html', 'delete-account.html', 'fat-bat.html', join('fat-bat', 'privacy.html')];
  for (const f of pages) {
    const html = readFileSync(join(src, f), 'utf8');
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
    const description = /<meta name="description" content="([^"]*)">/.exec(html)?.[1] ?? '';
    assert.ok(title.length >= 30 && title.length <= 60, `${f}: title is ${title.length} characters`);
    assert.ok(description.length >= 110 && description.length <= 160, `${f}: description is ${description.length} characters`);
  }
});
