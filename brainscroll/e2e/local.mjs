// Offline play: onboarding, a full chapter, resume, persistence, first-day cap, review.
import { CURVE, bodyText, button, check, completionFacts, home, launch, onboard, playLevel } from './helpers.mjs';

const { browser, page, errors } = await launch();
try {
  await home(page);
  check((await bodyText(page)).includes('Stop scrolling. Start leveling.'), 'first run shows onboarding');
  await onboard(page, { start: true });
  check((await bodyText(page)).includes('Your Cosmic Address'), 'onboarding lands in Level 1');

  const reinforced = await playLevel(page, { pick: (i) => (i === 0 ? 3 : 0) });
  check(reinforced > 0, 'a missed question shows "Take another look" and must be answered correctly');
  const l1 = await completionFacts(page);
  check(/LEVEL 1 COMPLETE/i.test(l1.text), 'Level 1 completes once every question is resolved');
  check(l1.total === 3 && l1.xp === CURVE[l1.firstTry], `XP follows the first-attempt curve (${l1.firstTry}/3 → ${l1.xp} XP)`);

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

  let sawPerfect = false;
  for (let n = 3; n <= 10; n++) {
    await button(page, `Next: Level ${n}`).click();
    await page.waitForTimeout(400);
    await playLevel(page, { pick: (i) => i % 2 });
    const f = await completionFacts(page);
    if (f.firstTry === f.total) sawPerfect ||= /Perfect Recall/.test(f.text);
    if (f.total === 3 && f.xp !== CURVE[f.firstTry]) throw new Error(`level ${n}: ${f.firstTry}/3 gave ${f.xp} XP`);
  }
  check(/LEVEL 10 COMPLETE/i.test(await bodyText(page)), 'all ten Golden levels play from data');
  await button(page, 'Finish the day').click();
  await page.waitForTimeout(600);
  check((await bodyText(page)).includes('10 / 10'), 'first-day cap of 10 ends in Daily Knowledge Complete');

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
