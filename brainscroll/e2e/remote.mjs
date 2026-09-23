// Supabase mode against the real SQL functions (via fake-supabase.mjs):
// anonymous sign-in, server-graded completion, exactly-once XP, live content
// revisions, the server-side 5/day cap, and review.
import { bodyText, button, check, home, launch, onboard, playLevel, sql } from './helpers.mjs';

const { browser, page, errors } = await launch();
try {
  await home(page);
  await onboard(page, { start: true });
  check(sql('select count(*) from auth.users') === '1', 'first launch signs in anonymously');
  check(sql('select timezone from public.profiles') !== '', 'device time zone is saved to the profile');

  await playLevel(page, { pick: () => 0, doubleTapComplete: true });
  check(/LEVEL 1 CLEARED/i.test(await bodyText(page)), 'Level 1 completes on the server');
  check(sql(`select count(*) from public.xp_events where type = 'LEVEL_COMPLETE'`) === '1', 'double-tapping Complete awards XP exactly once');
  const shownXp = (await bodyText(page)).match(/\+(\d+) XP/)?.[1];
  await page.waitForTimeout(1200); // let the count-up finish
  const finalXp = (await bodyText(page)).match(/\+(\d+) XP/)?.[1];
  check(finalXp === sql(`select sum(amount) from public.xp_events`), `XP on screen (${finalXp ?? shownXp}) matches the ledger`);

  await home(page);
  check((await bodyText(page)).includes('Astronomy · Lv. 1'), 'session and server progress survive a reload');

  // Publish a correction to Level 2 while the app is running.
  sql(`select public.import_content(jsonb_build_object('levels', jsonb_build_array(
         jsonb_set(jsonb_set(bundle, '{title}', '"The Sun, Up Close (revised)"'), '{revision}', '2') || '{"status":"published"}')))
       from public.level_revisions where level_id = 'level.science.astronomy.002' and revision = 1`);
  await button(page, 'Start Level 2').click();
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
  check((await bodyText(page)).includes('5 / 5'), 'Daily Quest Complete shows 5 / 5 from the server');
  await home(page);
  await button(page, 'Daily quest complete').click();
  await page.waitForTimeout(500);
  check(sql(`select count(*) from public.user_level_progress where level_id = 'level.science.astronomy.006'`) === '0',
    'a sixth new level is not started');

  // Review after a real gap.
  sql(`update public.user_concept_mastery set last_seen_at = now() - interval '30 hours';
       update public.review_queue set due_at = now() - interval '1 minute'`);
  await home(page);
  check(/worth refreshing/.test(await bodyText(page)), 'due concepts from the server surface on Home');
  const seenBefore = Number(sql('select sum(seen_count) from public.user_concept_mastery'));
  await button(page, 'Start review').click();
  await button(page, 'Choose an answer').waitFor({ timeout: 10_000 });
  check(true, 'the review session loads questions from the server');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    if (await button(page, 'Choose an answer').count()) await page.getByRole('radio').first().click();
    else if (await button(page, 'Finish review').count()) break;
    else await button(page, 'Continue').click();
  }
  await page.waitForTimeout(500);
  await button(page, 'Finish review').click();
  await page.waitForTimeout(500);
  const reviewXp = (await bodyText(page)).match(/\+(\d+) XP/)?.[1];
  check(Number(sql('select sum(seen_count) from public.user_concept_mastery')) > seenBefore, 'review answers update mastery on the server');
  check(reviewXp === sql(`select coalesce(sum(amount), 0) from public.xp_events where type = 'DELAYED_RECALL'`),
    `review XP on screen (${reviewXp}) matches DELAYED_RECALL in the ledger`);
  check(sql(`select new_levels_used from public.daily_allowances`) === '5', 'review did not use the daily allowance');
  check(errors.length === 0, `no page errors ${errors.join('; ')}`);
} finally {
  await browser.close();
}
