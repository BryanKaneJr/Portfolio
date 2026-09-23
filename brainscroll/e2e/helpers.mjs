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

/** Plays the open level to the end. `pick(i)` chooses which option index to tap. */
export async function playLevel(page, { pick = () => 0, doubleTapComplete = false } = {}) {
  let q = 0;
  for (let step = 0; step < 25; step++) {
    await page.waitForTimeout(120);
    if (await button(page, 'Choose an answer').count()) {
      await page.getByRole('radio').nth(pick(q++)).click();
      continue;
    }
    if (await button(page, 'Complete level').count()) {
      const b = button(page, 'Complete level');
      if (doubleTapComplete) await b.dblclick(); // two rapid taps, like an impatient thumb
      else await b.click();
      await page.getByText(/Level \d+ cleared|Replay complete|Mastery cleared/i).first().waitFor({ timeout: 10_000 });
      return;
    }
    await button(page, 'Continue').click();
  }
  throw new Error('level did not finish');
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
