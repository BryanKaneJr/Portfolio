// Supabase mode against the real SQL functions (via fake-supabase.mjs):
// sign-in before anything (phone, email, Google OAuth), server-graded
// completion, exactly-once XP, live content revisions, the server-side 5/day
// cap, review, progress that survives a reinstall, and account deletion.
import { CURVE, REVIEW_XP, bodyText, button, check, checkButton, completionFacts, exactButton, field, home, launch, onboard, playLevel, playReview, signIn, sql } from './helpers.mjs';

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
  const first = await bodyText(page);
  check(/Continue with phone number/i.test(first) && first.includes('Stop scrolling. Start leveling.'), 'first launch opens on the sign-in screen');
  check(['Apple', 'Google', 'phone number', 'email'].every((m) => new RegExp(`Continue with ${m}`, 'i').test(first)), 'every method the project enables is offered');
  check(sql('select count(*) from auth.users') === '0' && sql('select count(*) from public.profiles') === '0', 'nothing is created before signing in (no anonymous user)');
  await button(page, 'Continue with phone number').click();
  await field(page, 'Phone number').fill('555 555 0100');
  await exactButton(page, 'Send code').click();
  await page.waitForTimeout(400);
  check(/country code/.test(await bodyText(page)), 'a number without a country code is caught before sending');
  await field(page, 'Phone number').fill('+1 (555) 555-0100');
  await exactButton(page, 'Send code').click();
  await field(page, 'Code').fill('000000');
  await exactButton(page, 'Continue').click();
  await page.waitForTimeout(600);
  check(/wrong or has expired/.test(await bodyText(page)), 'a wrong code is refused with a clear message');
  await field(page, 'Code').fill('123456');
  await exactButton(page, 'Continue').click();
  await page.waitForTimeout(1500);
  check(sql('select count(*) from auth.users') === '1' && sql(`select phone || ':' || (raw_app_meta_data->>'provider') || ':' || is_anonymous from auth.users`) === '15555550100:phone:false',
    'the code creates one permanent phone account, stored in E.164');
  check(sql('select timezone from public.profiles') !== '', 'device time zone is saved to the profile');
  const learnerId = sql('select id from auth.users');
  check(/Hi, I'm Dr\. Scroll/.test(await bodyText(page)), 'a new account goes straight to onboarding');
  await onboard(page, { start: true });

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
  check(/finish the day/i.test(await bodyText(page)), 'the fifth level ends the day');
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

  // Accounts: progress belongs to the account, not the install.
  const xpBefore = sql('select sum(amount) from public.xp_events');
  const profile = async () => { await home(page); await page.getByRole('tab', { name: /Profile/ }).click(); await page.waitForTimeout(800); };
  await profile();
  const profileText = await bodyText(page);
  check(profileText.includes('Signed in with your phone number: +15 •••• 0100') && !/guest/i.test(profileText), 'Profile shows the phone account, masked, and no guest anywhere');
  await button(page, 'Sign out').click();
  await page.waitForTimeout(1000);
  check(/Continue with phone number/i.test(await bodyText(page)), 'signing out returns to the sign-in screen');
  check(sql('select count(*) from auth.users') === '1', 'signing out creates nothing (no fresh guest)');

  // Reinstall: wipe everything on the device, then sign in the same way.
  await page.evaluate(() => localStorage.clear());
  await home(page);
  check(/Continue with phone number/i.test(await bodyText(page)), 'a reinstalled app starts at sign-in');
  await signIn(page, { method: 'phone', phone: '+15555550100' });
  check(sql('select count(*) from auth.users') === '1' && sql('select id from auth.users') === learnerId, 'signing in again finds the same account');
  check((await bodyText(page)).includes('Astronomy · Lv. 5'), 'after a reinstall, progress is back and onboarding is skipped');
  await profile();
  check(new RegExp(`Total XP\\D{0,40}\\b${xpBefore}\\b`, 'i').test(await bodyText(page)), `all ${xpBefore} XP came back with the account`);

  // Google on the web: an OAuth redirect (PKCE) that comes back signed in to a separate, new account.
  await button(page, 'Sign out').click();
  await page.waitForTimeout(1000);
  await signIn(page, { method: 'google' });
  check(sql(`select count(*) from auth.users where email = 'google.learner@example.com' and raw_app_meta_data->>'provider' = 'google'`) === '1', 'Google sign-in creates a Google account');
  check(/Hi, I'm Dr\. Scroll/.test(await bodyText(page)), 'a new Google account gets its own onboarding');
  await onboard(page, { start: false });
  check((await bodyText(page)).includes('Astronomy · Lv. 0'), 'and none of the phone account\'s progress');
  await profile();
  check((await bodyText(page)).includes('Signed in with Google as google.learner@example.com'), 'Profile shows the Google account');
  await button(page, 'Sign out').click();
  await page.waitForTimeout(1000);
  await signIn(page, { method: 'phone', phone: '+15555550100' });

  // Analytics: only allowlisted, PII-free events; no durations anywhere.
  await page.waitForTimeout(5500); // the tracker flushes in batches
  check(Number(sql(`select count(*) from public.analytics_events where name = 'app_open'`)) >= 1, 'app opens are logged (return days, not minutes)');
  check(sql(`select count(*) from public.analytics_events where name = 'onboarding_step' and user_id = '${learnerId}'`) === '2', 'both onboarding steps before the deal are logged (hello, skill)');
  check(sql(`select props->>'card_index' || '/' || (props->>'card_count') from public.analytics_events where name = 'level_exit' and props->>'level_id' = 'level.science.astronomy.002'`).startsWith('0/'),
    'leaving an unfinished level logs where the learner left');
  check(Number(sql(`select count(*) from public.analytics_events where name = 'sign_in_completed' and props->>'method' = 'phone' and user_id = '${learnerId}'`)) >= 2,
    'the sign-in funnel is logged with the method');
  check(sql(`select count(*) from public.analytics_events where props::text ~ '@' or props::text ~ '[0-9]{7}'`) === '0', 'no email addresses or phone numbers reach analytics');

  // Account deletion (store requirement): everything goes, and the app returns to sign-in.
  await profile();
  await button(page, 'Delete account').click();
  check(/permanently deletes your account/.test(await bodyText(page)), 'deletion explains what will be lost before confirming');
  await button(page, 'Delete permanently').click();
  await page.waitForTimeout(1500);
  check(/Continue with phone number/i.test(await bodyText(page)), 'after deletion the app is back at the sign-in screen');
  check(sql(`select count(*) from auth.users where id = '${learnerId}'`) === '0', 'the deleted auth user is gone');
  check(sql(`select (select count(*) from public.xp_events where user_id = '${learnerId}') + (select count(*) from public.user_level_progress where user_id = '${learnerId}') + (select count(*) from public.analytics_events where user_id = '${learnerId}')`) === '0',
    'their XP, progress and analytics rows are gone');
  check(sql('select count(*) from auth.users') === '1' && sql('select count(*) from auth.users where is_anonymous') === '0', 'no replacement user is created (only the Google account remains)');

  check(errors.length === 0, `no page errors ${errors.join('; ')}`);
} finally {
  await browser.close();
}
