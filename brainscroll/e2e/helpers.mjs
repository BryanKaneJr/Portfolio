import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

export const URL = process.env.E2E_URL ?? 'http://localhost:8790/';

export async function launch() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { browser, page, errors };
}

export const button = (page, name) => page.getByRole('button', { name, exact: false });
export const bodyText = (page) => page.locator('body').innerText();

export async function home(page) {
  await page.goto(URL);
  await page.waitForTimeout(1500);
}

export async function onboard(page, { start }) {
  await button(page, 'Continue').click();
  await button(page, 'Continue').click();
  await button(page, start ? 'Start Your Cosmic Address' : 'Look around first').click();
  await page.waitForTimeout(800);
}

/**
 * Plays the open level to the end. `pick(i)` chooses the FIRST attempt at
 * question i. After a miss the level shows "Take another look" and the player
 * must choose again; we try the remaining options in order until one is right.
 * Returns how many questions needed another look.
 */
export async function playLevel(page, { pick = () => 0, doubleTapComplete = false } = {}) {
  let q = 0;
  let reinforced = 0;
  let missedThis = false;
  for (let step = 0; step < 60; step++) {
    await page.waitForTimeout(150);
    if (await button(page, 'Choose an answer').count()) {
      await page.getByRole('radio').nth(pick(q++)).click();
      missedThis = false;
      continue;
    }
    if (await button(page, 'Choose again').count()) {
      if (!(await page.getByText('Take another look').count())) throw new Error('a miss must show "Take another look"');
      if (step === 0 || !(await page.getByText('Take another look').first().isVisible())) throw new Error('evidence not visible');
      if (!missedThis) reinforced++;
      missedThis = true;
      await page.getByRole('radio', { disabled: false }).first().click();
      continue;
    }
    if (await button(page, 'Complete level').count()) {
      const b = button(page, 'Complete level');
      if (doubleTapComplete) await b.dblclick(); // two rapid taps, like an impatient thumb
      else await b.click();
      await page.getByText(/Level \d+ complete|Replay complete|Mastery cleared/i).first().waitFor({ timeout: 10_000 });
      return reinforced;
    }
    await button(page, 'Continue').click();
  }
  throw new Error('level did not finish');
}

/** XP by first-attempt score on a 3-question level (must match LEARNING_STRUCTURE). */
export const CURVE = { 3: 100, 2: 70, 1: 35, 0: 15 };

/** Reads "First try: x / n" and the settled "+N XP" from the Level Complete screen. */
export async function completionFacts(page) {
  await page.waitForTimeout(1200); // let the XP count-up settle
  const t = await bodyText(page);
  const first = t.match(/First try: (\d+) \/ (\d+)/);
  const xp = t.match(/\+(\d+) XP/);
  return { firstTry: first ? Number(first[1]) : undefined, total: first ? Number(first[2]) : undefined, xp: xp ? Number(xp[1]) : undefined, text: t };
}

export function sql(query) {
  if (!process.env.E2E_PSQL) throw new Error('E2E_PSQL not set (remote mode only)');
  // Via stdin: no shell quoting to get wrong.
  return execSync(process.env.E2E_PSQL, { input: query, encoding: 'utf8' }).trim();
}

export function check(cond, message) {
  if (!cond) throw new Error(`✖ ${message}`);
  console.log(`✓ ${message}`);
}
