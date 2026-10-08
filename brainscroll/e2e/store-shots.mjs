// App Store screenshots (docs/store-listing.md#screenshots), 6.9" iPhone
// (1290×2796). A learner's real first week on a moved clock: Level 1 by hand,
// then each day the app preview's "Clear to the next chest" (the real rules,
// every answer right) and the chest opened from the map. Today one more level
// is played by hand, with a miss, and the store set is taken.
//
//   SHOT_OUT=dir bash e2e/run.sh store-shots
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { URL, answerStep, bodyText, button, checkButton, exactButton, home, onboard, playLevel, signIn } from './helpers.mjs';

const out = process.env.SHOT_OUT ?? join(process.cwd(), 'store-shots');
const DAYS = 7;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const DAY = 864e5;
const today = new Date();
today.setHours(18, 0, 0, 0);
await page.clock.install({ time: new Date(today.getTime() - DAYS * DAY) });

const shot = async (name, settle = 900) => {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log('shot', name);
};
const tab = async (name) => {
  await home(page);
  // A plain click can hang on the moved clock; a DOM click doesn't.
  await page.getByRole('tab', { name }).evaluate((e) => e.click());
  await page.waitForTimeout(1000);
};
/** A full day's Brainpower (10), so a day's play isn't cut short. */
const topUp = async () => {
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((key) => key.startsWith('brainscroll.progress.v2:'));
    const s = JSON.parse(localStorage.getItem(k));
    s.brainpower = { balance: 10, asOf: new Date().toLocaleDateString('en-CA', { timeZone: s.timeZone }) };
    localStorage.setItem(k, JSON.stringify(s));
  });
  await home(page);
};
/** Settings → "Clear Astronomy to its next chest", then open that chest on the map (wearing a look it gives). */
const clearToChest = async () => {
  await tab(/Profile/);
  await exactButton(page, 'Settings').click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /^Clear .* to its next chest$/ }).click();
  const chest = page.getByRole('button', { name: /chest\. Open$/ }).first();
  await chest.waitFor({ timeout: 120_000 });
  await chest.click();
  await page.waitForTimeout(800);
  await page.getByTestId('open-chest').click();
  await page.getByTestId('chest-reward').waitFor({ timeout: 5_000 });
  await page.waitForTimeout(600);
  console.log('chest', (await page.getByTestId('chest-reward').innerText()).replace(/\s+/g, ' ').trim());
  if (await page.getByTestId('wear-now').count()) await page.getByTestId('wear-now').click();
  await page.waitForTimeout(600);
  for (const name of ['Done', 'Save for later', 'Later', 'Close'])
    if (await exactButton(page, name).count()) {
      await exactButton(page, name).click();
      break;
    }
  await page.waitForTimeout(600);
};

try {
  await home(page);
  await signIn(page);
  await onboard(page, { start: true });
  await playLevel(page);
  await topUp();
  await clearToChest();
  for (let d = 1; d < DAYS; d++) {
    await page.clock.setSystemTime(new Date(today.getTime() - (DAYS - d) * DAY));
    await topUp();
    await clearToChest();
  }

  // Today: the next level by hand, missing its first question.
  await page.clock.setSystemTime(today);
  await topUp();
  await home(page);
  await shot('01-home');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForTimeout(1000);
  await shot('02-skill-map');
  await page.getByRole('button', { name: /^Start Level \d+/ }).first().click();
  await page.waitForTimeout(1000);
  let keyIdea = false;
  let missed = false;
  for (let step = 0; step < 40; step++) {
    await page.waitForTimeout(250);
    if (await checkButton(page).count()) {
      await answerStep(page, () => (missed ? 'right' : 'wrong'), () => {});
      if (!missed) {
        await page.waitForTimeout(600);
        await shot('04-take-another-look');
        missed = true;
      }
      continue;
    }
    if (await button(page, 'Complete level').count()) {
      await button(page, 'Complete level').click();
      await page.getByText(/Level \d+( · (Checkpoint|Milestone))? complete/i).first().waitFor({ timeout: 10_000 });
      await shot('05-level-complete', 4500);
      break;
    }
    if (!keyIdea && /Key idea/i.test(await bodyText(page))) {
      await shot('03-learning-card');
      keyIdea = true;
    }
    await button(page, 'Continue').click();
  }

  await tab(/Profile/);
  await shot('06-profile');
  await button(page, 'See all trophies').click();
  await page.waitForTimeout(1000);
  await shot('07-trophies');
  await tab(/Social/);
  await shot('08-social', 3000);
  await page.goto(`${URL}league`);
  await page.waitForTimeout(1500);
  await shot('09-league');
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
} finally {
  await browser.close();
}
