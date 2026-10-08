// Every tree, played: Level 1 of each of the 26 skills, opened from its map and
// played to Level Complete with a miss on the first question (so "Take another
// look" renders its cards). Fails on any page error, console error or failed
// request, and saves each level's first card for a look.
//
//   SHOT_OUT=dir bash e2e/run.sh sweep
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { URL, bodyText, check, home, onboard, playLevel, signIn } from './helpers.mjs';

const out = process.env.SHOT_OUT ?? join(process.cwd(), 'sweep');
mkdirSync(out, { recursive: true });
const skillsDir = join(process.cwd(), 'content', 'skills');
const skills = readdirSync(skillsDir).map((d) => JSON.parse(readFileSync(join(skillsDir, d, 'skill.json'), 'utf8')));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const problems = [];
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()}: ${r.url()}`));

/** A full day's Brainpower, so 26 first levels fit in one sitting. */
const topUp = () =>
  page.evaluate(() => {
    const k = Object.keys(localStorage).find((key) => key.startsWith('brainscroll.progress.v2:'));
    const s = JSON.parse(localStorage.getItem(k));
    s.brainpower = { balance: 10, asOf: new Date().toLocaleDateString('en-CA', { timeZone: s.timeZone }) };
    localStorage.setItem(k, JSON.stringify(s));
  });

try {
  await home(page);
  await signIn(page);
  await onboard(page, { start: false });
  for (const skill of skills) {
    const before = problems.length;
    await topUp();
    await page.goto(`${URL}skill/${skill.id}`);
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /^Start Level 1\b/ }).first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `${skill.id.replace(/^skill\./, '')}.png`) });
    const missed = await playLevel(page, { pick: (i) => (i === 0 ? 'wrong' : 'right') });
    const done = await bodyText(page);
    check(/Level 1 complete/i.test(done) && missed >= 1 && problems.length === before, `${skill.name}: Level 1 plays to the end, a miss shows its cards${problems.length > before ? ` (${problems.slice(before).join(' | ')})` : ''}`);
  }
  check(problems.length === 0, `no errors across ${skills.length} trees`);
} finally {
  await browser.close();
}
