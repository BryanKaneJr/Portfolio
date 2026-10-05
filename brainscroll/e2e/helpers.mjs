import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

/** Home is the World Map; its Current Quest card's Continue opens the active skill's map. */
export async function questMap(page) {
  await home(page);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForTimeout(800);
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
  await button(page, method === 'phone' ? 'Continue with phone' : 'Continue with email').click();
  await field(page, method === 'phone' ? 'Phone number' : 'Email').fill(method === 'phone' ? phone : email);
  await exactButton(page, 'Send code').click();
  await field(page, 'Code').fill(code);
  await exactButton(page, 'Continue').click();
  await page.waitForTimeout(1500);
}

/** Onboarding, right after signing in: Dr. Scroll's hello → pick a skill → the deal → Level 1 (or look around). */
export async function onboard(page, { start, skill = 'Astronomy' }) {
  await button(page, 'Nice to meet you').click();
  await page.getByRole('radio', { name: new RegExp(skill) }).click();
  await button(page, 'Continue').click();
  await button(page, start ? 'Start Your Cosmic Address' : 'See all subjects').click();
  await page.waitForTimeout(800);
}

/**
 * Plays the open level to the end. Questions are select → CHECK. `pick(i)`
 * chooses the FIRST attempt at question i: a shown position, or 'right' / 'wrong'. After a miss the level shows "Take
 * another look" (the source cards, under the choices) and the player must choose
 * again; we try the remaining options in order until one is right.
 * Returns how many questions needed another look.
 */
export const checkButton = (page) => page.getByRole('button', { name: 'Check', exact: true });

// ─── Match and order questions ───────────────────────────────────────────────
// The tests know each arrangement's answer from the content files (by prompt),
// and solve it by tapping, the way a learner without a mouse would.
const contentDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'skills');
let arrangements;
function arrangementsByPrompt() {
  if (arrangements) return arrangements;
  arrangements = new Map();
  for (const skill of readdirSync(contentDir))
    for (const f of (() => { try { return readdirSync(join(contentDir, skill, 'levels')); } catch { return []; } })())
      for (const q of JSON.parse(readFileSync(join(contentDir, skill, 'levels', f), 'utf8')).questions ?? [])
        if (q.kind === 'match' || q.kind === 'order') arrangements.set(q.prompt, [...(arrangements.get(q.prompt) ?? []), q]);
  return arrangements;
}
const labelOf = (aria) => aria.replace(/, (\d+ of \d+|picked|matched with .*|not a match|correct|in the wrong place)(,.*)?$/, '');
const tileLabels = async (page, id) => Promise.all((await page.getByTestId(id).all()).map(async (t) => labelOf((await t.getAttribute('aria-label')) ?? '')));

/** The open arrangement question and its answer, or null for multiple choice. */
async function openArrangement(page) {
  const kind = (await page.getByTestId('order-question').count()) ? 'order' : (await page.getByTestId('match-question').count()) ? 'match' : null;
  if (!kind) return null;
  const text = await bodyText(page);
  const shown = kind === 'order' ? await tileLabels(page, 'order-tile') : await tileLabels(page, 'match-left');
  for (const [prompt, qs] of arrangementsByPrompt())
    if (text.includes(prompt))
      for (const q of qs)
        if (q.kind === kind && (kind === 'order' ? [...q.items].sort().join('|') === [...shown].sort().join('|') : q.pairs.map((p) => p.left).join('|') === shown.join('|')))
          return { kind, expected: kind === 'order' ? q.items : q.pairs.map((p) => p.right) };
  throw new Error('arrangement question not found in content');
}

/** Order by tap-swaps into `target` (labels). */
async function arrangeOrder(page, target) {
  for (let t = 0; t < target.length; t++) {
    const now = await tileLabels(page, 'order-tile');
    if (now[t] === target[t]) continue;
    const k = now.findIndex((l, i) => i > t && l === target[t]);
    await page.getByTestId('order-tile').nth(t).click();
    await page.getByTestId('order-tile').nth(k).click();
    await page.waitForTimeout(60);
  }
}

/** Pair every left item with the right-hand label in `target`, after undoing any pairs. */
async function arrangeMatch(page, target) {
  for (const t of await page.getByTestId('match-left').all()) if (/matched with/.test((await t.getAttribute('aria-label')) ?? '')) await t.click();
  for (let i = 0; i < target.length; i++) {
    const rights = await page.getByTestId('match-right').all();
    for (const r of rights) {
      const aria = (await r.getAttribute('aria-label')) ?? '';
      if (labelOf(aria) === target[i] && !/matched with/.test(aria)) {
        await page.getByTestId('match-left').nth(i).click();
        await r.click();
        break;
      }
    }
    await page.waitForTimeout(40);
  }
}

/** A wrong arrangement: a rotation of the answer that differs from it, and from `avoid` (what's showing). */
const wrongOf = (expected, avoid = []) => {
  const differs = (a, b) => a.length !== b.length || a.some((l, i) => l !== b[i]);
  for (let k = 1; k < expected.length; k++) {
    const w = [...expected.slice(k), ...expected.slice(0, k)];
    if (differs(w, expected) && differs(w, avoid)) return w;
  }
  return expected;
};

async function answerArrangement(page, a, right) {
  // An order must change before CHECK wakes up, so a wrong one is never the jumble already showing.
  const showing = a.kind === 'order' ? await tileLabels(page, 'order-tile') : [];
  const target = right ? a.expected : wrongOf(a.expected, showing);
  if (a.kind === 'order') await arrangeOrder(page, target);
  else await arrangeMatch(page, target);
}

// ─── Multiple choice ─────────────────────────────────────────────────────────
// Options show in a stable shuffled order (core shuffledOptions), so a test
// that needs a right or wrong first try asks for 'right' or 'wrong' and the
// helper finds it from the content files (by the options shown); a number
// still picks that position.
let mcqs;
function mcqsByOptions() {
  if (mcqs) return mcqs;
  mcqs = new Map();
  for (const skill of readdirSync(contentDir))
    for (const f of (() => { try { return readdirSync(join(contentDir, skill, 'levels')); } catch { return []; } })())
      for (const q of JSON.parse(readFileSync(join(contentDir, skill, 'levels', f), 'utf8')).questions ?? [])
        if (!q.kind || q.kind === 'mcq') {
          const key = q.options.map((o) => o.label).sort().join('\u0000');
          mcqs.set(key, [...(mcqs.get(key) ?? []), q]);
        }
  return mcqs;
}
const optionLabelOf = (aria) => aria.replace(/, (correct|crossed out|in the blank)$/, '');

/** The shown position of the open multiple-choice question's right answer. */
export async function rightOptionIndex(page) {
  const shown = await Promise.all((await page.getByRole('radio').all()).map(async (r) => optionLabelOf((await r.getAttribute('aria-label')) ?? (await r.innerText()))));
  const qs = mcqsByOptions().get([...shown].sort().join('\u0000')) ?? [];
  const text = await bodyText(page);
  const words = (s) => s.replace(/_____/g, ' ').split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
  const q = qs.find((x) => text.replace(/\s+/g, ' ').includes(words(x.prompt))) ?? qs[0];
  if (!q) throw new Error(`multiple-choice question not found in content: ${shown.join(' | ')}`);
  const right = q.options.find((o) => o.correct).label;
  return shown.indexOf(right);
}

/** Where each multiple-choice question answered so far showed its right answer (0 = first). */
export const rightPositions = [];

/** A first pick: a position, or 'right' / 'wrong'. */
async function pickIndex(page, pick) {
  if (typeof pick === 'number') return pick;
  const right = await rightOptionIndex(page);
  return pick === 'right' ? right : right === 0 ? 1 : 0;
}

/**
 * After a miss, the question's own cards must be on screen under "Take another
 * look" (the words alone also appear in the verdict). Server builds fetch
 * cards from earlier levels, so give them a moment.
 */
async function evidenceShown(page) {
  await page.getByTestId('evidence').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
    throw new Error('a miss shows no evidence cards');
  });
}

export async function answerStep(page, firstPick, onMiss) {
  const arrangement = await openArrangement(page);
  if (arrangement) {
    // Match and order: a first pick of 0 (or 'right') answers right; anything else misses first.
    if (await page.getByText('Take another look').count()) {
      await evidenceShown(page);
      onMiss();
      await answerArrangement(page, arrangement, true);
    } else {
      const p = firstPick();
      await answerArrangement(page, arrangement, p === 0 || p === 'right');
    }
    await checkButton(page).click();
    await page.waitForTimeout(150);
    return;
  }
  const missed = await page.getByText('Take another look').count();
  if (missed) {
    await evidenceShown(page);
    onMiss();
    await page.getByRole('radio', { disabled: false }).first().click();
  } else {
    const right = await rightOptionIndex(page).catch(() => undefined);
    if (right !== undefined) rightPositions.push(right);
    await page.getByRole('radio').nth(await pickIndex(page, firstPick())).click();
  }
  await checkButton(page).click();
  await page.waitForTimeout(150);
}

/** `texts`, if given, collects the page text at every question step (for checking what was shown). */
export async function playLevel(page, { pick = () => 0, doubleTapComplete = false, texts } = {}) {
  let q = 0;
  let reinforced = 0;
  let missedThis = false;
  for (let step = 0; step < 80; step++) {
    await page.waitForTimeout(150);
    if (await checkButton(page).count()) {
      if (texts) texts.push(await bodyText(page));
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
      await page.getByText(/Level \d+( · (Checkpoint|Milestone|Mastery Challenge))? complete|Replay complete|Mastery star earned/i).first().waitFor({ timeout: 10_000 });
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
/** The most a chapter review pays (XP.CHAPTER_REVIEW_MAX), scaled by first tries. */
export const CHAPTER_REVIEW_MAX = 30;

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
  // Let the XP count-up settle. On a checkpoint the recap leads and the XP
  // arrives after "You know this now.", so poll until the number holds.
  let t = '';
  let last;
  let steady = 0;
  for (let waited = 0; waited < 8_000 && steady < 2; waited += 400) {
    await page.waitForTimeout(400);
    t = await bodyText(page);
    const now = t.match(/\+(\d+) XP/)?.[1];
    const settled = now !== undefined && (Number(now) > 0 || /Replays earn no XP/.test(t));
    steady = settled && now === last ? steady + 1 : 0;
    last = now;
  }
  const first = t.match(/First try: (\d+) \/ (\d+)/);
  const xp = t.match(/\+(\d+) XP/);
  return { firstTry: first ? Number(first[1]) : undefined, total: first ? Number(first[2]) : undefined, xp: xp ? Number(xp[1]) : undefined, text: t };
}

export function sql(query) {
  if (!process.env.E2E_PSQL) throw new Error('E2E_PSQL not set (remote mode only)');
  // Via stdin: no shell quoting to get wrong.
  return execSync(process.env.E2E_PSQL, { input: query, encoding: 'utf8' }).trim();
}

/** Polls a SQL query until it returns what's expected (remote mode); returns the last value. */
export async function sqlUntil(query, expected, timeoutMs = 10_000) {
  const until = Date.now() + timeoutMs;
  let value = sql(query);
  while (value !== expected && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 250));
    value = sql(query);
  }
  return value;
}

export function check(cond, message) {
  if (!cond) throw new Error(`✖ ${message}`);
  console.log(`✓ ${message}`);
}

/**
 * Opens a deep link cold (a refresh or a shared link), as a learner would.
 * The e2e server answers unknown dynamic routes with the app's index page, so
 * React reports a hydration mismatch (#418) on the first render; that is a
 * separate, app-wide fix. Only that one error is set aside here, so anything
 * else a cold load throws (like "Progress backend not ready") still fails.
 */
export async function coldLoad(page, errors, url) {
  const before = errors.length;
  await page.goto(url);
  await page.waitForTimeout(1500);
  const added = errors.splice(before);
  errors.push(...added.filter((e) => !/Minified React error #418/.test(e)));
}
