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

/** The code every phone/email sign-in accepts in tests (fake-supabase FAKE_OTP, local DEV_CODE). */
export const TEST_CODE = '123456';
export const exactButton = (page, name) => page.getByRole('button', { name, exact: true });
export const field = (page, label) => page.getByLabel(label, { exact: true });

/**
 * Signs in from the sign-in screen. Phone and email go through the code step
 * (`code` defaults to the right one); Apple and Google press the button (on
 * web that's an OAuth redirect, answered straight away by fake-supabase).
 */
export async function signIn(page, { method = 'email', email = 'learner@example.com', phone = '+1 555 555 0100', code = TEST_CODE } = {}) {
  if (method === 'apple' || method === 'google') {
    await button(page, `Continue with ${method === 'apple' ? 'Apple' : 'Google'}`).click();
    await page.waitForTimeout(2500);
    return;
  }
  await button(page, method === 'phone' ? 'Continue with phone number' : 'Continue with email').click();
  await field(page, method === 'phone' ? 'Phone number' : 'Email').fill(method === 'phone' ? phone : email);
  await exactButton(page, 'Send code').click();
  await field(page, 'Code').fill(code);
  await exactButton(page, 'Continue').click();
  await page.waitForTimeout(1500);
}

/** Onboarding, right after signing in: pick a skill → the deal → Level 1 (or look around). */
export async function onboard(page, { start, skill = 'Astronomy' }) {
  await page.getByRole('radio', { name: new RegExp(skill) }).click();
  await button(page, 'Continue').click();
  await button(page, start ? 'Start Your Cosmic Address' : 'Look around first').click();
  await page.waitForTimeout(800);
}

/**
 * Plays the open level to the end. Questions are select → CHECK. `pick(i)`
 * chooses the FIRST attempt at question i. After a miss the level shows "Take
 * another look" (the source cards, under the prompt) and the player must choose
 * again; we try the remaining options in order until one is right.
 * Returns how many questions needed another look.
 */
export const checkButton = (page) => page.getByRole('button', { name: 'Check', exact: true });

async function answerStep(page, firstPick, onMiss) {
  const missed = await page.getByText('Take another look').count();
  if (missed) {
    if (!(await page.getByText('Take another look').first().isVisible())) throw new Error('evidence not visible');
    onMiss();
    await page.getByRole('radio', { disabled: false }).first().click();
  } else {
    await page.getByRole('radio').nth(firstPick()).click();
  }
  await checkButton(page).click();
  await page.waitForTimeout(150);
}

export async function playLevel(page, { pick = () => 0, doubleTapComplete = false } = {}) {
  let q = 0;
  let reinforced = 0;
  let missedThis = false;
  for (let step = 0; step < 80; step++) {
    await page.waitForTimeout(150);
    if (await checkButton(page).count()) {
      await answerStep(
        page,
        () => {
          missedThis = false;
          return pick(q++);
        },
        () => {
          if (!missedThis) reinforced++;
          missedThis = true;
        },
      );
      continue;
    }
    if (await button(page, 'Complete level').count()) {
      const b = button(page, 'Complete level');
      if (doubleTapComplete) await b.dblclick(); // two rapid taps, like an impatient thumb
      else await b.click();
      await page.getByText(/(Level|Checkpoint|Milestone|Mastery Challenge) \d+ complete|Replay complete|Mastery star earned/i).first().waitFor({ timeout: 10_000 });
      return reinforced;
    }
    await button(page, 'Continue').click();
  }
  throw new Error('level did not finish');
}

/** XP by first-attempt score on a 3-question level (must match LEARNING_STRUCTURE.regular). */
export const CURVE = { 3: 100, 2: 70, 1: 35, 0: 15 };
/** The checkpoint pool on a 5-question level (LEARNING_STRUCTURE.checkpoint): 150 / 105 / 60 / 25. */
export const CHECKPOINT_CURVE = { 5: 150, 4: 105, 3: 60, 2: 25, 1: 25, 0: 25 };
/** XP for one scheduled review item right on the first attempt (XP.REVIEW_FIRST_ATTEMPT). */
export const REVIEW_XP = 10;

/**
 * Plays an open review session to the end, varying the first choice by item and
 * correcting misses with the remaining options. A miss must show the source
 * cards and keep the choices open (no answer reveal). Returns the number of
 * items that needed correcting.
 */
export async function playReview(page) {
  let corrected = 0;
  let item = 0;
  let missedThis = false;
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(200);
    if (await checkButton(page).count()) {
      await answerStep(
        page,
        () => {
          missedThis = false;
          return item++ % 3;
        },
        () => {
          if (!missedThis) corrected++;
          missedThis = true;
        },
      );
    } else if (await button(page, 'Finish review').count()) {
      await button(page, 'Finish review').click();
      await page.waitForTimeout(1600); // let the XP count-up settle
      return corrected;
    } else await button(page, 'Continue').click();
  }
  throw new Error('review did not finish');
}

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
