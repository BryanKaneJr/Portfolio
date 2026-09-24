// Development harness (no Supabase, simulated accounts): sign-in first, onboarding,
// a full chapter, resume, persistence, first-day cap, review, and progress that
// belongs to the account (sign out, a second account, deletion).
import { CHECKPOINT_CURVE, CURVE, REVIEW_XP, bodyText, button, check, completionFacts, exactButton, field, home, launch, onboard, playLevel, playReview, signIn } from './helpers.mjs';

const progressKeys = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('brainscroll.progress.')));

const { browser, page, errors } = await launch();
try {
  await home(page);
  const first = await bodyText(page);
  check(first.includes('Stop scrolling. Start leveling.') && /Continue with email/i.test(first), 'first run opens on the sign-in screen');
  check(['Apple', 'Google', 'phone number', 'email'].every((m) => new RegExp(`Continue with ${m}`, 'i').test(first)), 'Apple, Google, phone and email are offered');
  check(/accounts are simulated/i.test(first), 'the development harness says its accounts are simulated');
  check((await progressKeys(page)).length === 0, 'nothing is saved before signing in (no guest progress)');
  await button(page, 'Continue with email').click();
  await field(page, 'Email').fill('Learner@Example.com');
  await exactButton(page, 'Send code').click();
  await field(page, 'Code').fill('000000');
  await exactButton(page, 'Continue').click();
  await page.waitForTimeout(500);
  check(/wrong or has expired/.test(await bodyText(page)), 'a wrong code is refused with a clear message');
  await field(page, 'Code').fill('123456');
  await exactButton(page, 'Continue').click();
  await page.waitForTimeout(1200);
  check(/Pick your first skill/i.test(await bodyText(page)), 'signing in goes straight to onboarding');
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
    if (f.firstTry === f.total) sawPerfect ||= /perfect recall/i.test(f.text);
    if (f.total === 3 && f.xp !== CURVE[f.firstTry]) throw new Error(`level ${n}: ${f.firstTry}/3 gave ${f.xp} XP`);
    if (n === 10) {
      check(/CHECKPOINT 10 COMPLETE/i.test(f.text), 'all ten Golden levels play from data; Level 10 is a checkpoint');
      check(f.total === 5 && f.xp === CHECKPOINT_CURVE[f.firstTry], `the checkpoint uses its own XP pool (${f.firstTry}/5 → ${f.xp} XP)`);
    }
  }
  await button(page, 'Finish the day').click();
  await page.waitForTimeout(600);
  check((await bodyText(page)).includes('10 / 10'), 'first-day cap of 10 ends in Daily Knowledge Complete');

  // Time travel: every concept is due now.
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((key) => key.startsWith('brainscroll.progress.v2:'));
    const s = JSON.parse(localStorage.getItem(k));
    for (const c of Object.values(s.concepts)) c.dueAt = new Date(Date.now() - 60e3).toISOString();
    localStorage.setItem(k, JSON.stringify(s));
  });
  await home(page);
  check(/worth refreshing/.test(await bodyText(page)), 'due concepts surface on Home');
  await page.getByRole('tab', { name: /Review/ }).click();
  await page.waitForTimeout(800);
  check(/ready to refresh/.test(await bodyText(page)), 'the Review tab shows what is ready (and settles: no refresh loop)');
  await home(page);
  await button(page, 'Start review').click();
  await page.waitForTimeout(500);
  const corrected = await playReview(page);
  const t = await bodyText(page);
  check(/REVIEW COMPLETE/i.test(t), `a review session completes once every item is resolved (${corrected} corrected)`);
  const [, xp, right, total] = t.match(/\+(\d+) XP[\s\S]*?(\d+) \/ (\d+) right first time/) ?? [];
  check(Number(xp) === REVIEW_XP * Number(right) && Number(total) - Number(right) === corrected,
    `review XP is ${REVIEW_XP} per first-try item; corrections earn nothing (${right}/${total} → +${xp})`);
  await home(page);
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.waitForTimeout(800);
  const profileText = await bodyText(page);
  check(profileText.includes('Signed in with email: learner@example.com') && !/guest/i.test(profileText), 'Profile shows the account (normalised email), and there is no guest anywhere');
  // A second skill: choosing it on the Skills tab makes Home follow it.
  await page.getByRole('tab', { name: /Skills/ }).click();
  await page.waitForTimeout(600);
  await button(page, 'Continue Ancient Rome').click();
  await page.waitForTimeout(800);
  await home(page);
  check((await bodyText(page)).includes('Ancient Rome · Lv. 0'), 'Home follows the skill the learner chose last (a second tree plays from data)');
  // Progress belongs to the account: sign out, and it comes back with the same sign-in.
  const profile = async () => { await home(page); await page.getByRole('tab', { name: /Profile/ }).click(); await page.waitForTimeout(800); };
  await profile();
  await button(page, 'Sign out').click();
  await page.waitForTimeout(1000);
  check(/Continue with email/i.test(await bodyText(page)), 'signing out returns to the sign-in screen');
  await home(page);
  check(/Continue with email/i.test(await bodyText(page)), 'signed out, the app stays on the sign-in screen (no way around it)');
  await signIn(page, { method: 'email', email: 'learner@example.com' });
  check((await bodyText(page)).includes('Ancient Rome · Lv. 0'), 'signing back in restores that account\'s progress and skips onboarding');

  // A second account on the same device starts fresh and never sees the first one's progress.
  await profile();
  await button(page, 'Sign out').click();
  await page.waitForTimeout(1000);
  await signIn(page, { method: 'phone', phone: '+1 555 555 0100' });
  check(/Pick your first skill/i.test(await bodyText(page)), 'a new account on the same device gets its own onboarding');
  await onboard(page, { start: false });
  check((await bodyText(page)).includes('Astronomy · Lv. 0'), 'and none of the first account\'s progress');
  await profile();
  check((await bodyText(page)).includes('Signed in with your phone number: +15 •••• 0100'), 'Profile shows the phone account, masked');
  await button(page, 'Sign out').click();
  await page.waitForTimeout(1000);
  await signIn(page, { method: 'email', email: 'learner@example.com' });

  // Deleting the account removes it and its progress, and returns to sign-in.
  const doomed = await progressKeys(page); // only this account has played, so these are all its keys
  check(doomed.length === 1, 'progress is stored under the account, not the device');
  await profile();
  await button(page, 'Delete account').click();
  check(/permanently deletes your account/.test(await bodyText(page)), 'deletion explains what will be lost before confirming');
  await button(page, 'Delete permanently').click();
  await page.waitForTimeout(1200);
  check(/Continue with email/i.test(await bodyText(page)), 'after deletion the app is back at the sign-in screen');
  check(!(await progressKeys(page)).some((k) => doomed.includes(k)), 'the deleted account\'s progress is gone from the device');
  await signIn(page, { method: 'email', email: 'learner@example.com' });
  check(/Pick your first skill/i.test(await bodyText(page)), 'signing in with the deleted email starts a brand-new account');
  check(errors.length === 0, `no page errors ${errors.join('; ')}`);
} finally {
  await browser.close();
}
