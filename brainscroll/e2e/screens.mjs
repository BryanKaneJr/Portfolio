// Screenshot tour: every screen a learner meets, in order, saved as PNGs for a
// design review or the store listings. Local mode (development harness).
//
//   bash e2e/run.sh screens                          # 390×844 @3x into ./screens
//   SHOT_OUT=dir SHOT_W=430 SHOT_H=932 bash e2e/run.sh screens   # App Store 6.7"/6.9" (1290×2796)
//   SHOT_OUT=dir SHOT_W=360 SHOT_H=720 bash e2e/run.sh screens   # Google Play (1080×2160)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { URL, bodyText, button, checkButton, exactButton, field, home, onboard, playLevel, playReview, signIn } from './helpers.mjs';

const out = process.env.SHOT_OUT ?? join(process.cwd(), 'screens');
const width = Number(process.env.SHOT_W ?? 390);
const height = Number(process.env.SHOT_H ?? 844);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(700);
  const file = join(out, `${String(++n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('shot', file);
};
/** Scrolls the screen's scroll view to the bottom (react-native-web renders it as an overflow div). */
const scrollDown = async () => {
  await page.mouse.move(width / 2, height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 600);
  await page.waitForTimeout(400);
};

try {
  await home(page);
  await shot('sign-in');
  await button(page, 'Continue with email').click();
  await field(page, 'Email').fill('learner@example.com');
  await exactButton(page, 'Send code').click();
  await page.waitForTimeout(400);
  await shot('sign-in-code');
  await field(page, 'Code').fill('123456');
  await exactButton(page, 'Continue').click();
  await page.waitForTimeout(1200);
  await shot('onboarding-hello');
  await button(page, 'Nice to meet you').click();
  await page.getByRole('radio', { name: /Astronomy/ }).click();
  await shot('onboarding-pick-skill');
  await button(page, 'Continue').click();
  await shot('onboarding-deal');
  await button(page, 'Start Your Cosmic Address').click();
  await page.waitForTimeout(800);

  // Level 1, card by card, with a miss on the first question.
  let card = 0;
  let missed = false;
  for (let step = 0; step < 40; step++) {
    if (await checkButton(page).count()) {
      if (await page.getByText('Take another look').count()) {
        await page.getByRole('radio', { disabled: false }).first().click();
        await checkButton(page).click();
        await page.waitForTimeout(400);
        continue;
      }
      await page.getByRole('radio').nth(missed ? 0 : 3).click();
      await shot(`level-question-${step}`);
      await checkButton(page).click();
      await page.waitForTimeout(500);
      if (!missed && (await page.getByText('Take another look').count())) {
        await shot('level-take-another-look');
        await scrollDown();
        await shot('level-take-another-look-cards');
        missed = true;
        await page.getByRole('radio', { disabled: false }).first().click();
        await checkButton(page).click();
        await page.waitForTimeout(400);
      }
      continue;
    }
    if (await button(page, 'Complete level').count()) {
      await shot('level-recap');
      await button(page, 'Complete level').click();
      await page.getByText(/Level 1 complete/i).first().waitFor({ timeout: 10_000 });
      await page.waitForTimeout(1500);
      await shot('level-complete');
      break;
    }
    if (card < 6) await shot(`level-card-${++card}`);
    await button(page, 'Continue').click();
    await page.waitForTimeout(300);
  }

  await home(page);
  await shot('world-map');
  await page.getByRole('button', { name: /day learning streak/ }).click();
  await page.waitForTimeout(800);
  await shot('streak');
  await exactButton(page, 'Share your streak').click();
  await page.waitForTimeout(800);
  await shot('share-streak');
  await home(page);
  await scrollDown();
  await shot('world-map-lower');
  await home(page);
  if (await exactButton(page, 'Choose for me').count()) {
    await exactButton(page, 'Choose for me').click();
    await exactButton(page, 'Pick again').waitFor({ timeout: 5_000 });
    await shot('choose-for-me');
  }
  await home(page);
  // This week's quest, when the catalog has one live today.
  const questCard = page.getByRole('button', { name: /^This week’s quest:/ });
  if (await questCard.count()) {
    await questCard.click();
    await page.waitForTimeout(800);
    await shot('quest');
    await scrollDown();
    await shot('quest-lower');
    await button(page, 'See the Archive').click();
    await page.waitForTimeout(600);
    await shot('quest-archive');
  }
  await home(page);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForTimeout(1000);
  await shot('skill-map');

  // Levels 2 to 10: Level 10 is the chapter checkpoint with the proof card.
  for (let lv = 2; lv <= 10; lv++) {
    if (lv === 2) await button(page, 'Start Level 2').click();
    else await button(page, `Next: Level ${lv}`).click();
    await page.waitForTimeout(500);
    await playLevel(page, { pick: () => 0 });
  }
  await page.waitForTimeout(2600);
  await shot('checkpoint-complete');
  await scrollDown();
  await page.waitForTimeout(1500);
  await shot('checkpoint-complete-proof');
  await button(page, 'Finish the day').click();
  await page.waitForTimeout(1200);
  await shot('daily-complete');
  if (await button(page, 'Want more today? See Unlimited').count()) {
    await button(page, 'Want more today? See Unlimited').click();
    await page.waitForTimeout(1000);
    await shot('unlimited');
    await scrollDown();
    await shot('unlimited-lower');
  }

  // A day later: reviews are due.
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((key) => key.startsWith('brainscroll.progress.v2:'));
    const s = JSON.parse(localStorage.getItem(k));
    for (const c of Object.values(s.concepts)) c.dueAt = new Date(Date.now() - 60e3).toISOString();
    localStorage.setItem(k, JSON.stringify(s));
  });
  await home(page);
  await page.getByRole('tab', { name: /Review/ }).click();
  await shot('review-tab');
  await button(page, 'Start review').click();
  await page.waitForTimeout(600);
  if (await checkButton(page).count()) {
    await page.getByRole('radio').first().click();
    await shot('review-question');
  }
  // Going back over a cleared chapter: the Review tab's second half, a question, and the finish.
  await home(page);
  await page.getByRole('tab', { name: /Review/ }).click();
  await page.waitForTimeout(800);
  await scrollDown();
  await shot('review-tab-chapters');
  await page.getByRole('button', { name: /^Review Astronomy, Chapter 1:/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole('radio').first().click();
  await shot('chapter-review-question');
  await playReview(page);
  await shot('chapter-review-complete');
  await home(page);
  await page.getByRole('tab', { name: /Skills/ }).click();
  await shot('skills-tab');
  await home(page);
  const history = page.getByRole('button', { name: /^Open History/ });
  if (await history.count()) {
    await history.first().click();
    await shot('subject-region');
  }
  await home(page);
  await page.getByRole('tab', { name: /Profile/ }).click();
  await shot('profile');
  await button(page, 'See all trophies').click();
  await page.waitForTimeout(800);
  await shot('trophies');
  await page.getByRole('button', { name: /^First Level(, new)?\. Share$/ }).click();
  await page.waitForTimeout(800);
  await shot('share-trophy');
  await exactButton(page, 'Close').click();
  await page.waitForTimeout(600);
  await page.goBack();
  await page.waitForTimeout(800);
  await scrollDown();
  await shot('profile-lower');
  if (errors.length) console.log('page errors:', errors);
} finally {
  await browser.close();
}
