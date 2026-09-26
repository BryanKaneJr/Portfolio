-- Hardening from the 2026-09-26 security review (migration 20261004000000).
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.q(n int) returns text language sql as $$ select 'question.testing.' || lpad(n::text, 3, '0') || '.q1' $$;
create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm <> code and sqlerrm not like '%' || code || '%' then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;
-- Time travel (superuser): the concept came due a while ago, after any earlier checks.
create function pg_temp.make_due(c text) returns void language sql as $$
  update public.user_question_checks set checked_at = checked_at - interval '2 days';
  update public.review_queue set due_at = now() - interval '1 day' where concept_id = c;
$$;

-- Alice clears levels 1 and 2 with right first answers.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$ begin
  perform public.answer_question('level.science.testing.001', pg_temp.q(1), 'a');
  perform public.complete_level('level.science.testing.001', 1, gen_random_uuid());
  perform public.answer_question('level.science.testing.002', pg_temp.q(2), 'a');
  perform public.complete_level('level.science.testing.002', 1, gen_random_uuid());
end $$;
reset role;
select pg_temp.make_due('concept.testing.c1');
select pg_temp.make_due('concept.testing.c2');

-- 1. Checking the answer by replaying the level after it came due: the review earns no XP.
set role authenticated;
do $$
declare r jsonb;
begin
  r := public.answer_question('level.science.testing.001', pg_temp.q(1), 'b');   -- probe a wrong option
  assert (r ->> 'correct')::boolean = false, 'replays are still graded';
  r := public.answer_question('level.science.testing.001', pg_temp.q(1), 'a');   -- and the right one
  r := public.submit_review('concept.testing.c1', pg_temp.q(1), 'a');
  assert (r ->> 'correct')::boolean and (r ->> 'scheduled')::boolean, format('the review still counts: %s', r);
  assert (r ->> 'xp_awarded')::int = 0, format('no XP after checking the answer: %s', r);
  -- Practice on a concept that isn't due is noted the same way (c1 is no longer due).
  r := public.submit_review('concept.testing.c1', pg_temp.q(1), 'b');
  assert not (r ->> 'scheduled')::boolean, 'not due: practice';
  -- An honest review of another concept still earns.
  r := public.submit_review('concept.testing.c2', pg_temp.q(2), 'a');
  assert (r ->> 'xp_awarded')::int = 10, format('honest recall earns: %s', r);
end $$;
reset role;

-- 2. Missing on purpose doesn't pay: the quick re-check after a miss earns nothing.
select pg_temp.make_due('concept.testing.c2');
set role authenticated;
do $$
declare r jsonb;
begin
  r := public.submit_review('concept.testing.c2', pg_temp.q(2), 'b');      -- a miss
  assert (r ->> 'xp_awarded')::int = 0;
  r := public.submit_review('concept.testing.c2', pg_temp.q(2), 'a');      -- corrected
  assert (select due_at < now() + interval '1 hour' from public.review_queue where concept_id = 'concept.testing.c2'), 'a miss comes back soon';
end $$;
reset role;
update public.review_queue set due_at = now() - interval '1 minute' where concept_id = 'concept.testing.c2';
set role authenticated;
do $$
declare r jsonb;
begin
  r := public.submit_review('concept.testing.c2', pg_temp.q(2), 'a');
  assert (r ->> 'correct')::boolean and (r ->> 'scheduled')::boolean, format('relearning is recorded: %s', r);
  assert (r ->> 'xp_awarded')::int = 0, format('relearning earns no XP: %s', r);
  assert (select strength from public.user_concept_mastery where concept_id = 'concept.testing.c2') = 1, 'but memory strength recovers';
end $$;
reset role;
-- And the occurrence after a good one earns again.
select pg_temp.make_due('concept.testing.c2');
set role authenticated;
do $$ begin
  assert (public.submit_review('concept.testing.c2', pg_temp.q(2), 'a') ->> 'xp_awarded')::int = 10, 'remembering after a gap earns';
end $$;

-- 3. The time zone can't be flipped to reset the daily allowance.
select pg_temp.expect_error($$update public.profiles set timezone = 'Pacific/Kiritimati' where id = auth.uid()$$, 'permission denied');
do $$ begin
  perform public.update_profile('Asia/Tokyo');
  assert (select timezone from public.profiles where id = auth.uid()) = 'Asia/Tokyo', 'a first change is allowed';
  perform public.update_profile('Pacific/Kiritimati');
  assert (select timezone from public.profiles where id = auth.uid()) = 'Asia/Tokyo', 'a second change within a day is ignored';
  perform public.update_profile(null, 'Alice');
  assert (select display_name from public.profiles where id = auth.uid()) = 'Alice';
end $$;

-- 4. Display names are capped.
select pg_temp.expect_error(format('select public.update_profile(null, %L)', repeat('x', 61)), 'profiles_display_name_length');

-- 5. Analytics keep only declared props, and a bad timestamp doesn't sink the batch.
do $$
declare r jsonb;
begin
  r := public.log_events('[
    {"name": "app_open", "props": {"backend": "remote", "email": "a@b.c"}, "at": "2026-99-99T00:00:00Z"},
    {"name": "paywall_viewed", "props": {"from": "profile"}, "at": "2026-09-26T10:00:00Z"}
  ]');
  assert r = '{"accepted": 2, "rejected": 0}'::jsonb, format('both events kept: %s', r);
end $$;
reset role;
do $$ begin
  assert (select props from public.analytics_events where name = 'app_open') = '{"backend": "remote"}'::jsonb, 'undeclared props are dropped';
  assert (select client_at is null from public.analytics_events where name = 'app_open'), 'a malformed timestamp is ignored';
end $$;

-- 6. Sandbox store purchases don't grant Unlimited in production.
set role service_role;
do $$
declare r jsonb;
begin
  r := public.apply_revenuecat_event_checked(jsonb_build_object('type', 'INITIAL_PURCHASE', 'environment', 'SANDBOX',
    'app_user_id', '00000000-0000-0000-0000-00000000000b', 'entitlement_ids', jsonb_build_array('unlimited_learning'),
    'event_timestamp_ms', (extract(epoch from now()) * 1000)::bigint, 'expiration_at_ms', (extract(epoch from now() + interval '1 day') * 1000)::bigint));
  assert r ->> 'reason' = 'sandbox', format('sandbox ignored: %s', r);
  assert not public.has_unlimited('00000000-0000-0000-0000-00000000000b');
end $$;
reset role;
update public.app_settings set allow_sandbox_purchases = true;   -- a staging project
set role service_role;
do $$ begin
  assert public.apply_revenuecat_event_checked(jsonb_build_object('type', 'INITIAL_PURCHASE', 'environment', 'SANDBOX',
    'app_user_id', '00000000-0000-0000-0000-00000000000b', 'entitlement_ids', jsonb_build_array('unlimited_learning'),
    'event_timestamp_ms', (extract(epoch from now()) * 1000)::bigint, 'expiration_at_ms', (extract(epoch from now() + interval '1 day') * 1000)::bigint)) ->> 'applied' = 'true',
    'staging accepts sandbox purchases';
end $$;
reset role;

-- 7. A content correction can remove a question that learners have reviewed.
do $$ begin
  assert (select count(*) from public.user_review_attempts where question_id = pg_temp.q(2)) > 0;
  delete from public.questions where id = pg_temp.q(2);
  assert (select count(*) from public.user_review_attempts where question_id = pg_temp.q(2)) = 0, 'its review attempts go with it';
end $$;

-- 8. Learners can't read the checks table.
set role authenticated;
do $$ begin
  assert (select count(*) from public.user_question_checks) = 0, 'no policy: learners see nothing';
end $$;
reset role;

\o
\echo security: all assertions passed
