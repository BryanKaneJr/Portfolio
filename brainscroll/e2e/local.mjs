// Offline play: onboarding, a full chapter, resume, persistence, first-day cap, review.
import { bodyText, button, check, home, launch, onboard, playLevel } from './helpers.mjs';

const { browser, page, errors } = await launch();
try {
  await home(page);
  check((await bodyText(page)).includes('Stop scrolling. Start leveling.'), 'first run shows onboarding');
  await onboard(page, { start: true });
  check((await bodyText(page)).includes('Your Cosmic Address'), 'onboarding lands in Level 1');

  await playLevel(page, { pick: (i) => (i === 0 ? 3 : 0) });
  check(/LEVEL 1 CLEARED/i.test(await bodyText(page)), 'Level 1 completes');

  await home(page);
  check((await bodyText(page)).includes('Astronomy · Lv. 1'), 'progress persists across reload');

  // Resume mid-level.
  await button(page, 'Start Level 2').click();
  await page.waitForTimeout(400);
  await button(page, 'Continue').click();
  await button(page, 'Continue').click();
  const before = (await bodyText(page)).slice(0, 200);
  await home(page);
  await button(page, 'Resume Level 2').click();
  await page.waitForTimeout(600);
  check((await bodyText(page)).slice(0, 200) === before, 'an interrupted level resumes on the same card');
  await playLevel(page);

  for (let n = 3; n <= 10; n++) {
    await button(page, `Next: Level ${n}`).click();
    await page.waitForTimeout(400);
    await playLevel(page, { pick: (i) => i % 2 });
  }
  check(/LEVEL 10 CLEARED/i.test(await bodyText(page)), 'all ten Golden levels play from data');
  await button(page, 'Finish the day').click();
  await page.waitForTimeout(600);
  check((await bodyText(page)).includes('10 / 10'), 'first-day cap of 10 ends in Daily Quest Complete');

  // Time travel: concepts last seen 30h ago and due now.
  await page.evaluate(() => {
    const k = 'brainscroll.progress.v1';
    const s = JSON.parse(localStorage.getItem(k));
    for (const c of Object.values(s.concepts)) {
      c.lastSeenAt = new Date(Date.now() - 30 * 3600e3).toISOString();
      c.dueAt = new Date(Date.now() - 60e3).toISOString();
    }
    localStorage.setItem(k, JSON.stringify(s));
  });
  await home(page);
  check(/worth refreshing/.test(await bodyText(page)), 'due concepts surface on Home');
  await button(page, 'Start review').click();
  await page.waitForTimeout(500);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    if (await button(page, 'Choose an answer').count()) await page.getByRole('radio').first().click();
    else if (await button(page, 'Finish review').count()) break;
    else await button(page, 'Continue').click();
  }
  await button(page, 'Finish review').click();
  await page.waitForTimeout(400);
  check(/REVIEW COMPLETE/i.test(await bodyText(page)), 'a review session completes');
  check(errors.length === 0, `no page errors ${errors.join('; ')}`);
} finally {
  await browser.close();
}
