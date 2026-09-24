// Supabase mode against the real SQL functions (via fake-supabase.mjs):
// anonymous sign-in, server-graded completion, exactly-once XP, live content
// revisions, the server-side 5/day cap, and review.
import { CURVE, REVIEW_XP, bodyText, button, check, checkButton, completionFacts, home, launch, onboard, playLevel, playReview, sql } from './helpers.mjs';

const { browser, page, errors } = await launch();
// Every level bundle the app receives must be free of answer keys, and review
// answers must never reveal the right option.
const leaks = [];
page.on('response', async (res) => {
  const body = /\/rpc\/(start_level|get_level_bundles|submit_review)/.test(res.url()) ? await res.text().catch(() => '') : '';
  if (/\/rpc\/submit_review/.test(res.url()) ? /correct_option/.test(body) : /"correct"\s*:|"rationale"\s*:|"explanation"\s*:/.test(body)) leaks.push(res.url());
});
try {
  await home(page);
  await onboard(page, { start: true });
  check(sql('select count(*) from auth.users') === '1', 'first launch signs in anonymously');
  check(sql('select timezone from public.profiles') !== '', 'device time zone is saved to the profile');

  const reinforced = await playLevel(page, { pick: () => 0, doubleTapComplete: true });
  check(/LEVEL 1 COMPLETE/i.test(await bodyText(page)), 'Level 1 completes on the server');
  check(sql(`select count(*) from public.xp_events where type = 'LEVEL_COMPLETE'`) === '1', 'double-tapping Complete awards XP exactly once');
  const f1 = await completionFacts(page);
  const serverFirst = Number(sql(`select count(*) filter (where first_attempt_correct) from public.user_question_attempts where level_id = 'level.science.astronomy.001'`));
  check(sql(`select count(*) from public.user_question_attempts where level_id = 'level.science.astronomy.001' and resolved_correct`) === '3', 'the server recorded all three questions as resolved');
  check(reinforced === 3 - serverFirst && f1.firstTry === serverFirst, `first attempts were recorded server-side (${serverFirst}/3; ${reinforced} reinforced)`);
  check(String(f1.xp) === sql(`select sum(amount) from public.xp_events`) && f1.xp === CURVE[serverFirst], `XP on screen (${f1.xp}) matches the ledger and the curve`);

  await home(page);
  check((await bodyText(page)).includes('Astronomy · Lv. 1'), 'session and server progress survive a reload');

  // Content report + drop-off: open Level 2, report the card on screen, then leave it unfinished.
  await button(page, 'Start Level 2').click();
  await page.waitForTimeout(800);
  await button(page, 'Report a problem').click();
  await button(page, 'Typo or grammar').click();
  await page.getByLabel('Details (optional)', { exact: true }).fill('Missing comma');
  await button(page, 'Send report').click();
  await page.getByText('Thanks.', { exact: false }).waitFor();
  check(sql(`select object_type || ':' || object_id || ':' || category || ':' || message from public.content_reports`) === 'card:card.astronomy.002.c1:typo:Missing comma',
    'a report reaches content_reports for the card on screen');
  await button(page, 'Back to the level').click();
  await button(page, 'Leave level').click();
  await page.waitForTimeout(500);

  // Publish a correction to Level 2 while the app is running.
  sql(`select public.import_content(jsonb_build_object('levels', jsonb_build_array(
         jsonb_set(jsonb_set(bundle, '{title}', '"The Sun, Up Close (revised)"'), '{revision}', '2') || '{"status":"published"}')))
       from public.level_revisions where level_id = 'level.science.astronomy.002' and revision = 1`);
  await button(page, /(Start|Resume) Level 2/).click();
  await page.waitForTimeout(800);
  check((await bodyText(page)).includes('The Sun, Up Close (revised)'), 'a published correction reaches the app without a new build');
  await playLevel(page);
  check(sql(`select completed_revision from public.user_level_progress where level_id = 'level.science.astronomy.002'`) === '2',
    'completion records the revision that was played');

  // Not the first day any more: the normal 5/day cap applies.
  sql(`update public.profiles set created_at = now() - interval '30 days'`);
  for (let n = 3; n <= 5; n++) {
    await button(page, `Next: Level ${n}`).click();
    await page.waitForTimeout(500);
    await playLevel(page);
  }
  check((await bodyText(page)).includes('Finish the day'), 'the fifth level ends the day');
  await button(page, 'Finish the day').click();
  await page.waitForTimeout(600);
  check((await bodyText(page)).includes('5 / 5'), 'Daily Knowledge Complete shows 5 / 5 from the server');
  await home(page);
  await button(page, 'Daily knowledge complete').click();
  await page.waitForTimeout(500);
  check(sql(`select count(*) from public.user_level_progress where level_id = 'level.science.astronomy.006'`) === '0',
    'a sixth new level is not started');

  // Review: make everything due.
  sql(`update public.review_queue set due_at = now() - interval '1 minute'`);
  await home(page);
  check(/worth refreshing/.test(await bodyText(page)), 'due concepts from the server surface on Home');
  const seenBefore = Number(sql('select sum(seen_count) from public.user_concept_mastery'));
  await button(page, 'Start review').click();
  await checkButton(page).waitFor({ timeout: 10_000 });
  check(true, 'the review session loads questions from the server');
  const corrected = await playReview(page);
  const reviewXp = (await bodyText(page)).match(/\+(\d+) XP/)?.[1];
  check(Number(sql('select sum(seen_count) from public.user_concept_mastery')) > seenBefore, 'review answers update mastery on the server');
  const firstRight = Number(sql('select count(*) from public.user_review_attempts where first_attempt_correct'));
  check(reviewXp === sql(`select coalesce(sum(amount), 0) from public.xp_events where type = 'DELAYED_RECALL'`) && Number(reviewXp) === REVIEW_XP * firstRight,
    `review XP on screen (${reviewXp}) matches the ledger: ${REVIEW_XP} per first-try item`);
  check(sql(`select count(*) from public.user_review_attempts where not first_attempt_correct`) === String(corrected) &&
        sql(`select count(*) from public.user_review_attempts where not resolved_correct`) === '0',
    `missed review items are recorded and were all corrected (${corrected})`);
  check(sql(`select new_levels_used from public.daily_allowances`) === '5', 'review did not use the daily allowance');
  check(leaks.length === 0, `no answer keys reached the app ${leaks.join(', ')}`);
  check(sql(`select count(*) from public.xp_events where type = 'QUESTION_CORRECT'`) === '0', 'no per-question XP is awarded');

  // Account persistence: guest → email on the SAME user, sign out, sign back in.
  const guestId = sql('select id from auth.users');
  const xpBefore = sql('select sum(amount) from public.xp_events');
  const profile = async () => { await home(page); await page.getByRole('tab', { name: /Profile/ }).click(); await page.waitForTimeout(800); };
  const field = (label) => page.getByLabel(label, { exact: true });
  await profile();
  check((await bodyText(page)).includes('playing as a guest'), 'a new player is shown as a guest');
  await button(page, 'Save my progress').click();
  await field('Email').fill('Player@Example.com');
  await button(page, 'Send code').click();
  await field('Code').waitFor();
  check(sql(`select email_change from auth.users`) === 'player@example.com', 'a code is requested for the normalised email');
  await field('Code').fill('000000');
  await button(page, 'Confirm').click();
  await page.waitForTimeout(600);
  check(/wrong or has expired/.test(await bodyText(page)), 'a wrong code is refused with a clear message');
  await field('Code').fill('123456');
  await button(page, 'Confirm').click();
  await page.waitForTimeout(800);
  check((await bodyText(page)).includes('Progress saved to player@example.com'), 'confirming the code saves the account');
  check(sql('select count(*) from auth.users') === '1' && sql('select id from auth.users') === guestId && sql('select is_anonymous from auth.users') === 'f',
    'linking kept the same user id (no migration) and made it permanent');
  check(sql('select sum(amount) from public.xp_events') === xpBefore, 'all XP is still there after linking');

  await profile();
  check((await bodyText(page)).includes('Progress saved to player@example.com'), 'the saved account survives a reload');
  await button(page, 'Sign out').click();
  await page.waitForTimeout(1000);
  check((await bodyText(page)).includes('playing as a guest') && sql('select count(*) from auth.users') === '2', 'signing out continues as a fresh guest');

  // The fresh guest tries to save to the same email: it's taken, so we offer sign-in instead.
  await button(page, 'Save my progress').click();
  await field('Email').fill('player@example.com');
  await button(page, 'Send code').click();
  await page.waitForTimeout(600);
  check(/already has a BrainScroll account/.test(await bodyText(page)), 'an email already in use points to sign-in');
  await field('Email').fill('player@example.com');
  await button(page, 'Send code').click();
  await field('Code').fill('123456');
  await button(page, 'Sign in').click();
  await page.waitForTimeout(1200);
  check((await bodyText(page)).includes('Progress saved to player@example.com'), 'signing in with a code restores the saved account');
  check((await bodyText(page)).includes(`${xpBefore} XP earned`), `the saved account's progress (${xpBefore} XP) is back on this device`);

  // Analytics: only allowlisted, PII-free events; no durations anywhere.
  await page.waitForTimeout(5500); // the tracker flushes in batches
  check(Number(sql(`select count(*) from public.analytics_events where name = 'app_open'`)) >= 1, 'app opens are logged (return days, not minutes)');
  check(sql(`select count(*) from public.analytics_events where name = 'onboarding_step'`) === '2', 'both onboarding steps are logged');
  check(sql(`select props->>'card_index' || '/' || (props->>'card_count') from public.analytics_events where name = 'level_exit' and props->>'level_id' = 'level.science.astronomy.002'`).startsWith('0/'),
    'leaving an unfinished level logs where the learner left');
  check(sql(`select count(*) from public.analytics_events where name in ('account_link_started', 'account_linked')`) === '2', 'the account-link funnel is logged');
  check(sql(`select count(*) from public.analytics_events where props::text ~ '@'`) === '0', 'no email addresses reach analytics');
  check(errors.length === 0, `no page errors ${errors.join('; ')}`);
} finally {
  await browser.close();
}
