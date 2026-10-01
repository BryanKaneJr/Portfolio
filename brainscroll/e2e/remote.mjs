// Supabase mode against the real SQL functions (via fake-supabase.mjs):
// sign-in before anything (phone, email, Google OAuth), server-graded
// completion, exactly-once XP, live content revisions, the server-side 5/day
// cap, review, progress that survives a reinstall, and account deletion.
import { questMap, CHAPTER_REVIEW_MAX, CURVE, REVIEW_XP, answerStep, bodyText, button, check, checkButton, completionFacts, exactButton, field, home, launch, onboard, playLevel, playReview, signIn, sql } from './helpers.mjs';

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
  check(/Continue with phone/i.test(first) && first.includes('Stop scrolling. Start leveling.'), 'first launch opens on the sign-in screen');
  check(['Apple', 'Google', 'phone', 'email'].every((m) => new RegExp(`Continue with ${m}`, 'i').test(first)), 'every method the project enables is offered');
  check(sql('select count(*) from auth.users') === '0' && sql('select count(*) from public.profiles') === '0', 'nothing is created before signing in (no anonymous user)');
  await button(page, 'Continue with phone').click();
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
  await page.getByText(/Trophy earned/i).waitFor({ timeout: 5_000 }).catch(() => {});
  check(/Trophy earned[\s\S]*First Level/i.test(await bodyText(page)), 'the server\'s shelf gives the first level its trophy moment');
  check(sql(`select count(*) from public.xp_events where type = 'LEVEL_COMPLETE'`) === '1', 'double-tapping Complete awards XP exactly once');
  const f1 = await completionFacts(page);
  const serverFirst = Number(sql(`select count(*) filter (where first_attempt_correct) from public.user_question_attempts where level_id = 'level.science.astronomy.001'`));
  check(sql(`select count(*) from public.user_question_attempts where level_id = 'level.science.astronomy.001' and resolved_correct`) === '3', 'the server recorded all three questions as resolved');
  check(reinforced === 3 - serverFirst && f1.firstTry === serverFirst, `first attempts were recorded server-side (${serverFirst}/3; ${reinforced} reinforced)`);
  check(String(f1.xp) === sql(`select sum(amount) from public.xp_events`) && f1.xp === CURVE[serverFirst], `XP on screen (${f1.xp}) matches the ledger and the curve`);

  await home(page);
  check((await bodyText(page)).includes('Astronomy · Lv. 1'), 'session and server progress survive a reload');
  check((await page.getByLabel('1-day learning streak').count()) === 1, 'the server derives the learning streak (flame on the World Map)');

  // Offline at launch: the saved session keeps the learner signed in; the tabs show an offline state, and Try again recovers.
  const cutOff = (route) => route.abort('internetdisconnected');
  await page.route('**/rest/v1/**', cutOff);
  await page.route('**/functions/v1/**', cutOff);
  await page.reload();
  await page.waitForTimeout(1500);
  const offlineText = await bodyText(page);
  check(/Couldn.t reach BrainScroll/.test(offlineText) && !/Continue with email/i.test(offlineText), 'offline at launch shows the offline state, still signed in (not the sign-in screen)');
  await page.unroute('**/rest/v1/**', cutOff);
  await page.unroute('**/functions/v1/**', cutOff);
  await button(page, 'Try again').click();
  await page.waitForTimeout(1500);
  check((await bodyText(page)).includes('Astronomy · Lv. 1'), 'back online, Try again restores the World Map and progress');
  await questMap(page);

  // Content report + drop-off: open Level 2, report the card on screen, then leave it unfinished.
  await button(page, 'Start Level 2').click();
  await page.waitForTimeout(800);
  await button(page, 'Report a problem').click();
  // One step: say what's wrong. Send waits for some text.
  check(await button(page, 'Send report').isDisabled(), 'a report needs a description before it can be sent');
  await page.getByLabel('What’s wrong?', { exact: true }).fill('Missing comma');
  await button(page, 'Send report').click();
  await page.getByText('Thanks.', { exact: false }).waitFor();
  check(sql(`select object_type || ':' || object_id || ':' || category || ':' || message from public.content_reports`) === 'card:card.astronomy.002.c1:other:Missing comma',
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
  await questMap(page);
  await button(page, 'Daily knowledge complete').click();
  await page.waitForTimeout(500);
  check(sql(`select count(*) from public.user_level_progress where level_id = 'level.science.astronomy.006'`) === '0',
    'a sixth new level is not started');

  // Unlimited, the server path: web has no store, so RevenueCat's webhook grants it.
  await home(page);
  await button(page, 'Continue').click();
  await page.waitForTimeout(800);
  await button(page, 'Daily knowledge complete').click();
  await page.waitForTimeout(600);
  await button(page, 'Want more today? See Unlimited').click();
  await page.waitForTimeout(800);
  check(/available in the BrainScroll app for iPhone and Android/.test(await bodyText(page)), 'on the web, Unlimited explains it is bought in the phone apps');
  const webhook = (event, secret = 'test-webhook-secret') =>
    fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/revenuecat-webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` }, body: JSON.stringify({ event }),
    });
  const rcEvent = (type, expiresInMs) => ({ type, app_user_id: learnerId, original_app_user_id: learnerId, entitlement_ids: ['unlimited_learning'],
    event_timestamp_ms: Date.now(), expiration_at_ms: Date.now() + expiresInMs, product_id: 'unlimited_monthly', store: 'APP_STORE' });
  check((await webhook(rcEvent('INITIAL_PURCHASE', 30 * 864e5), 'wrong-secret')).status === 401, 'the webhook refuses a wrong secret');
  check(sql('select count(*) from public.entitlements') === '0', 'and nothing is granted');
  check((await webhook(rcEvent('INITIAL_PURCHASE', 30 * 864e5))).status === 200, 'a RevenueCat purchase event is accepted');
  check(sql(`select active::text || ':' || store from public.entitlements where user_id = '${learnerId}'`) === 'true:APP_STORE', 'the server records Unlimited for that learner');
  await home(page);
  check(/Today 5 \/ ∞/i.test(await bodyText(page)), 'with Unlimited the server lifts the daily cap');
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.waitForTimeout(800);
  await exactButton(page, 'Settings').click();
  await page.waitForTimeout(800);
  await exactButton(page, 'Unlimited details').click();
  await page.waitForTimeout(800);
  check(/Unlimited is on\.[\s\S]*Renews on/.test(await bodyText(page)), 'the Unlimited screen shows the plan and its renewal date');
  check((await webhook(rcEvent('EXPIRATION', -1000))).status === 200, 'an expiry event is accepted');
  await home(page);
  check(/5 \/ 5/.test(await bodyText(page)), 'when Unlimited expires the daily cap returns');
  check(sql(`select count(*) from public.analytics_events where name = 'paywall_viewed' and user_id = '${learnerId}'`) !== '0', 'opening Unlimited is logged (paywall funnel)');

  // Review: make everything due.
  sql(`update public.review_queue set due_at = now() - interval '1 minute'`);
  await home(page);
  await page.getByRole('tab', { name: /Review/ }).click();
  await page.waitForTimeout(1000);
  check(/ready to refresh/.test(await bodyText(page)), 'due concepts from the server show in the Review tab');
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

  // Weekly Quests: this week's quest from the real catalog, its 25 levels seeded as done (0 XP, so totals stay honest),
  // then the Final Round and the trophy through the UI.
  // Quests ship unscheduled (TBD): give one this week and one last week.
  sql(`update public.quests set starts_at = (date_trunc('week', now() at time zone 'UTC') - interval '7 days') at time zone 'UTC',
         ends_at = date_trunc('week', now() at time zone 'UTC') at time zone 'UTC' where id = 'quest.how_we_think'`);
  sql(`update public.quests set starts_at = date_trunc('week', now() at time zone 'UTC') at time zone 'UTC',
         ends_at = (date_trunc('week', now() at time zone 'UTC') + interval '7 days') at time zone 'UTC' where id = 'quest.roman_world'`);
  sql(`insert into public.xp_events (user_id, type, amount, skill_id, level_id, idempotency_key)
       select '${learnerId}', 'LEVEL_COMPLETE', 0, r.skill_id, l.id, 'e2e_quest:' || l.id
       from public.quest_requirements r join public.levels l on l.skill_id = r.skill_id and l.number <= r.new_levels
       where r.quest_id = 'quest.roman_world'`);
  const questXpBefore = Number(sql('select sum(amount) from public.xp_events'));
  await home(page);
  const questHome = await bodyText(page);
  check(/The Roman World/.test(questHome) && /25 \/ 25 new levels/.test(questHome) && /Final Round is open/.test(questHome), 'Home shows this week\'s quest, its progress and the open Final Round');
  await button(page, 'This week’s quest: The Roman World').click();
  await page.waitForTimeout(1000);
  check(/Ancient Rome[\s\S]*5 \/ 5/.test(await bodyText(page)), 'the quest page lists each skill with its new levels');
  await button(page, 'Start the Final Round').click();
  await exactButton(page, 'Continue').waitFor({ timeout: 10_000 });
  check(/Final Round · Ancient Rome, from Level \d+ · 1 of 5/.test(await bodyText(page)), 'the Final Round opens as a lesson: a card from each of the five skills');
  for (let i = 0; i < 4; i++) {
    await exactButton(page, 'Continue').click();
    await page.waitForTimeout(250);
  }
  check(/World Religions/.test(await bodyText(page)), 'the last card comes from the fifth skill');
  await exactButton(page, 'On to the questions').click();
  await checkButton(page).waitFor({ timeout: 10_000 });
  check(/Question 1 of 5 · Ancient Rome/.test(await bodyText(page)), 'then a question on each skill');
  for (let i = 0; i < 60 && !(await button(page, 'Finish the quest').count()); i++) {
    await page.waitForTimeout(200);
    if (await checkButton(page).count()) await answerStep(page, () => 1, () => {});
    else if (await exactButton(page, 'Finish').count()) await exactButton(page, 'Finish').click();
    else if (await exactButton(page, 'Continue').count()) await exactButton(page, 'Continue').click();
  }
  check(sql(`select count(*) from public.user_quest_answers where user_id = '${learnerId}' and resolved_at is not null`) === '5', 'all five questions were answered on the server');
  await button(page, 'Finish the quest').click();
  await page.waitForTimeout(1500);
  const questDone = await bodyText(page);
  check(/Quest complete/i.test(questDone) && /Trophy: The Roman World/.test(questDone), 'finishing in its week earns the trophy');
  check(Number(sql('select sum(amount) from public.xp_events')) === questXpBefore + 50 && sql(`select count(*) from public.xp_events where type = 'QUEST_COMPLETE'`) === '1', 'and the quest\'s +50 XP, once');
  check(sql(`select trophy_id from public.user_trophies where user_id = '${learnerId}'`) === 'trophy.roman_world', 'the trophy is recorded on the server');
  await exactButton(page, 'Done').click();
  await page.waitForTimeout(800);
  await home(page);
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.waitForTimeout(1000);
  check(await page.getByRole('button', { name: /^Trophy: The Roman World\. Share$/ }).count() === 1, 'Profile shows the trophy');
  await button(page, 'See all trophies').click();
  await page.waitForTimeout(800);
  check(/First Level/.test(await bodyText(page)), 'milestone trophies are on the shelf too');
  await page.getByRole('radio', { name: 'Citizen of Rome', exact: true }).click();
  await page.waitForTimeout(1000);
  check(sql(`select equipped_title_quest from public.profiles where id = '${learnerId}'`) === 'quest.roman_world', 'the live clear\'s title can be shown');
  await page.goBack();
  await page.waitForTimeout(800);
  check(/Citizen of Rome/.test(await bodyText(page)), 'Profile shows the chosen title');
  // The Archive: an ended quest still pays XP, never a trophy.
  await home(page);
  await button(page, 'This week’s quest: The Roman World').click();
  await page.waitForTimeout(800);
  await button(page, 'See the Archive').click();
  await page.waitForTimeout(800);
  check(/The Archive/.test(await bodyText(page)) && /Not started/.test(await bodyText(page)), 'past quests wait in the Archive');

  // Chapter reviews: once a skill has nothing new left, a review of any chapter counts toward quests.
  sql(`insert into public.user_skill_progress (user_id, skill_id, highest_cleared)
       select '${learnerId}', 'skill.history.ancient_rome', max(number) from public.levels where skill_id = 'skill.history.ancient_rome' and status = 'published'
       on conflict (user_id, skill_id) do update set highest_cleared = excluded.highest_cleared`);
  await home(page);
  await page.getByRole('tab', { name: /Review/ }).click();
  await page.waitForTimeout(1000);
  check(/Counts toward quests/.test(await bodyText(page)), 'a skill with nothing new left says its chapter reviews count toward quests');
  await page.getByRole('button', { name: /^Review Ancient Rome, Chapter 1:/ }).click();
  await checkButton(page).waitFor({ timeout: 10_000 });
  await playReview(page);
  const ct = await bodyText(page);
  const [, cright, ctotal] = ct.match(/(\d+) \/ (\d+) right first time/) ?? [];
  const cxp = ct.match(/\+(\d+) XP[\s\S]*?\d+ \/ \d+ right first time/)?.[1] ?? '0';
  check(/Chapter review complete/i.test(ct) && ctotal === '10' && Number(cxp) === Math.round((CHAPTER_REVIEW_MAX * Number(cright)) / 10) && /counts toward a Weekly Quest/.test(ct),
    `a chapter review is graded on the server: ${cright}/10 → +${cxp}, and it counts toward quests`);
  check(sql(`select amount || ':' || reason || ':' || level_id from public.xp_events where type = 'CHAPTER_REVIEW' and user_id = '${learnerId}'`) === `${cxp}:no_new_levels:level.history.ancient_rome.010`,
    'the ledger has it once, as Chapter 1\'s last level, with quest credit');
  check(sql(`select count(*) from public.user_chapter_review_answers where user_id = '${learnerId}' and resolved_at is null`) === '0', 'every question was resolved on the server');
  await exactButton(page, 'Done').click();
  await page.waitForTimeout(600);
  // Undo the seeded skill level, so Home follows Astronomy again below (the ledger keeps the review's XP).
  sql(`delete from public.user_skill_progress where user_id = '${learnerId}' and skill_id = 'skill.history.ancient_rome'`);

  // Social, on the server: your league (alone so far), the feed, a username search, a request and an invite code.
  sql(`insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f1'), ('00000000-0000-0000-0000-0000000000f2')`);
  sql(`update public.profiles set username = 'study_buddy' where id = '00000000-0000-0000-0000-0000000000f1'`);
  sql(`update public.profiles set username = 'old_pal', invite_code = 'PAL12345' where id = '00000000-0000-0000-0000-0000000000f2'`);
  await home(page);
  await page.getByRole('tab', { name: /Social/ }).click();
  await page.waitForTimeout(1500);
  let social = await bodyText(page);
  check(/League/i.test(social) && /1st place/.test(social) && /You’re leading/.test(social), 'Social joins this week\'s league on the server and shows your place');
  check(/You earned First Level/.test(social), 'the feed shows your own moments, derived on the server');
  check(/^[a-z]+_[a-z]+_\d{4}$/.test(sql(`select username from public.profiles where id = '${learnerId}'`)), 'you get a friendly username');
  check(/^avatar\.[a-z_]+$/.test(sql(`select avatar from public.profiles where id = '${learnerId}'`)), 'the server gave you a random starter avatar');
  // Make the starter something else, so picking Astronomy is a change.
  sql(`update public.profiles set avatar = 'avatar.ancient_rome' where id = '${learnerId}'`);
  await exactButton(page, 'Edit your profile').click();
  await page.waitForTimeout(1200);
  await exactButton(page, 'Change avatar').click();
  await page.waitForTimeout(1200);
  await page.getByRole('radio', { name: /^Astronomy$/ }).click();
  await page.waitForTimeout(1000);
  check(sql(`select avatar from public.profiles where id = '${learnerId}'`) === 'avatar.astronomy', 'an avatar is saved on the server');
  check((await page.getByRole('radio', { name: /^Astronomy, locked/ }).count()) === 1, 'and the gold one stays locked without mastery');
  await page.goBack();
  await page.waitForTimeout(1000);
  await page.goBack();
  await page.waitForTimeout(1000);
  await exactButton(page, 'Add friends').first().click();
  await page.waitForTimeout(1000);
  await field(page, 'Find by username or code').fill('study_buddy');
  await exactButton(page, 'Find').click();
  await page.waitForTimeout(1000);
  await exactButton(page, 'Add').click();
  await page.waitForTimeout(1000);
  check(/Request sent to @study_buddy/.test(await bodyText(page)) && sql(`select count(*) from public.friend_requests where user_id = '${learnerId}'`) === '1', 'a username search sends a request that waits on the server');
  await field(page, 'Find by username or code').fill('pal12345');
  await exactButton(page, 'Find').click();
  await page.waitForTimeout(1000);
  check(/You and @old_pal are friends now/.test(await bodyText(page)) && sql(`select count(*) from public.friendships where user_id = '${learnerId}'`) === '1', 'an invite code makes friends at once, both ways');
  await page.goBack();
  await page.waitForTimeout(1000);
  check(/This week with friends[\s\S]*@old_pal/.test(await bodyText(page)), 'friends appear ranked by this week\'s XP');
  // The seeded learners leave again (and their friendship with them, by cascade).
  sql(`delete from auth.users where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2')`);
  check(sql(`select count(*) from public.friendships`) === '0', 'a deleted learner leaves no friendship behind');

  const xpBefore = sql('select sum(amount) from public.xp_events');
  // Account actions live in Settings, one tap from Profile.
  const profile = async () => { await home(page); await page.getByRole('tab', { name: /Profile/ }).click(); await page.waitForTimeout(800); await exactButton(page, 'Settings').click(); await page.waitForTimeout(800); };
  await profile();
  const profileText = await bodyText(page);
  check(profileText.includes('Signed in with your phone number: +15 •••• 0100') && !/guest/i.test(profileText), 'Profile shows the phone account, masked, and no guest anywhere');
  await button(page, 'Sign out').click();
  await page.waitForTimeout(1000);
  check(/Continue with phone/i.test(await bodyText(page)), 'signing out returns to the sign-in screen');
  check(sql('select count(*) from auth.users') === '1', 'signing out creates nothing (no fresh guest)');

  // Reinstall: wipe everything on the device, then sign in the same way.
  await page.evaluate(() => localStorage.clear());
  await home(page);
  check(/Continue with phone/i.test(await bodyText(page)), 'a reinstalled app starts at sign-in');
  await signIn(page, { method: 'phone', phone: '+15555550100' });
  check(sql('select count(*) from auth.users') === '1' && sql('select id from auth.users') === learnerId, 'signing in again finds the same account');
  check((await bodyText(page)).includes('Astronomy · Lv. 5'), 'after a reinstall, progress is back and onboarding is skipped');
  await home(page);
  await page.getByRole('tab', { name: /Profile/ }).click();
  await page.waitForTimeout(800);
  check(new RegExp(`Total XP\\D{0,40}\\b${xpBefore}\\b`, 'i').test(await bodyText(page)), `all ${xpBefore} XP came back with the account`);

  // Google on the web: an OAuth redirect (PKCE) that comes back signed in to a separate, new account.
  await exactButton(page, 'Settings').click();
  await page.waitForTimeout(800);
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
  check(/Continue with phone/i.test(await bodyText(page)), 'after deletion the app is back at the sign-in screen');
  check(sql(`select count(*) from auth.users where id = '${learnerId}'`) === '0', 'the deleted auth user is gone');
  check(sql(`select (select count(*) from public.xp_events where user_id = '${learnerId}') + (select count(*) from public.user_level_progress where user_id = '${learnerId}') + (select count(*) from public.analytics_events where user_id = '${learnerId}')`) === '0',
    'their XP, progress and analytics rows are gone');
  check(sql('select count(*) from auth.users') === '1' && sql('select count(*) from auth.users where is_anonymous') === '0', 'no replacement user is created (only the Google account remains)');

  check(errors.length === 0, `no page errors ${errors.join('; ')}`);
} finally {
  await browser.close();
}
