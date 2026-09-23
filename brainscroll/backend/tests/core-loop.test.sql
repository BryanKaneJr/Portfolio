-- Core loop acceptance tests (blueprint Stage 1/4/6 exit gates).
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql

create function pg_temp.answers(n int, opt text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('question_id', 'question.testing.' || lpad(n::text, 3, '0') || '.q1', 'option_id', opt));
$$;
create function pg_temp.lvl(n int) returns text language sql as $$ select 'level.science.testing.' || lpad(n::text, 3, '0') $$;
create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm <> code then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;

-- 1. Profiles are created on sign-up.
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'RLS: user should see only their own profile';
end $$;

-- 2. Can't skip ahead.
do $$ begin
  assert (public.start_level(pg_temp.lvl(2)) ->> 'reason') = 'LEVEL_LOCKED', 'level 2 should be locked';
  assert (public.start_level(pg_temp.lvl(1)) ->> 'allowed')::boolean, 'level 1 should start';
  perform pg_temp.expect_error($q$ select public.complete_level(pg_temp.lvl(2), 1, pg_temp.answers(2, 'a'), gen_random_uuid()) $q$, 'LEVEL_LOCKED');
end $$;

-- 3. Must answer every question; wrong answers still complete the level.
do $$ begin
  perform pg_temp.expect_error($q$ select public.complete_level(pg_temp.lvl(1), 1, '[]', gen_random_uuid()) $q$, 'INCOMPLETE_ANSWERS');
end $$;

-- 4. First completion awards XP once; the double tap awards nothing.
do $$
declare r jsonb; k uuid := gen_random_uuid();
begin
  r := public.complete_level(pg_temp.lvl(1), 1, pg_temp.answers(1, 'a'), k);
  assert (r ->> 'xp_awarded')::int = 22, format('expected 20 + 2 XP, got %s', r);
  assert (r ->> 'skill_level')::int = 1, 'skill level should be 1';
  assert (r ->> 'already_completed')::boolean = false;
  r := public.complete_level(pg_temp.lvl(1), 1, pg_temp.answers(1, 'a'), k);
  assert (r ->> 'already_completed')::boolean, 'retry should be a no-op';
  assert (r ->> 'xp_awarded')::int = 0;
  r := public.complete_level(pg_temp.lvl(1), 1, pg_temp.answers(1, 'a'), gen_random_uuid());
  assert (r ->> 'xp_awarded')::int = 0, 'a new key must not re-award a cleared level';
  assert (select sum(amount) from public.xp_events) = 22, 'ledger should hold exactly 22 XP';
  assert (select total_xp from public.user_skill_progress) = 22;
end $$;

-- 5. A wrong answer teaches: level completes, concept is due soon, strength 0.
do $$
declare r jsonb;
begin
  r := public.complete_level(pg_temp.lvl(2), 1, pg_temp.answers(2, 'b'), gen_random_uuid());
  assert (r ->> 'xp_awarded')::int = 20, 'no question bonus for a wrong answer';
  assert (select strength from public.user_concept_mastery where concept_id = 'concept.testing.c2') = 0;
  assert (select due_at < now() + interval '1 hour' from public.review_queue where concept_id = 'concept.testing.c2');
  assert (select strength from public.user_concept_mastery where concept_id = 'concept.testing.c1') = 1;
  assert (select due_at > now() + interval '23 hours' from public.review_queue where concept_id = 'concept.testing.c1');
end $$;

-- 6. Daily cap: 5 new levels, then Daily Complete. Replays and review stay open.
do $$
declare r jsonb;
begin
  for n in 3..5 loop
    perform public.complete_level(pg_temp.lvl(n), 1, pg_temp.answers(n, 'a'), gen_random_uuid());
  end loop;
  r := public.get_daily_status();
  assert (r ->> 'used')::int = 5 and (r ->> 'daily_complete')::boolean, format('expected 5/5 daily complete, got %s', r);
  assert (public.start_level(pg_temp.lvl(6)) ->> 'reason') = 'DAILY_COMPLETE';
  perform pg_temp.expect_error($q$ select public.complete_level(pg_temp.lvl(6), 1, pg_temp.answers(6, 'a'), gen_random_uuid()) $q$, 'DAILY_LIMIT_REACHED');
  assert (public.start_level(pg_temp.lvl(1)) ->> 'reason') = 'REPLAY', 'cleared levels remain replayable after the cap';
end $$;

-- 7. Clients cannot write progress directly.
do $$ begin
  perform pg_temp.expect_error($q$ insert into public.xp_events (user_id, type, amount, idempotency_key) values (auth.uid(), 'CORRECTION', 9999, 'cheat') $q$,
    'new row violates row-level security policy for table "xp_events"');
  update public.user_skill_progress set highest_cleared = 99;
  assert (select highest_cleared from public.user_skill_progress) = 5, 'direct update must not change progress';
  perform pg_temp.expect_error($q$ update public.profiles set created_at = now() $q$, 'permission denied for table profiles');
end $$;

-- 8. Unlimited removes the cap (and nothing else).
reset role;
insert into public.entitlements (user_id, entitlement, active) values ('00000000-0000-0000-0000-00000000000a', 'unlimited_learning', true);
set role authenticated;
do $$
declare r jsonb;
begin
  r := public.complete_level(pg_temp.lvl(6), 1, pg_temp.answers(6, 'a'), gen_random_uuid());
  assert (r ->> 'skill_level')::int = 6;
  assert (r ->> 'xp_awarded')::int = 22, 'Unlimited users earn the same XP per level';
  assert (r -> 'daily' ->> 'cap') is null;
end $$;

-- 9. Isolation: Bob sees none of Alice's progress, and gets the first-day bonus.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.xp_events) = 0, 'RLS leak: Bob can see XP';
  assert (select count(*) from public.user_skill_progress) = 0, 'RLS leak: Bob can see progress';
  assert (public.get_daily_status() ->> 'cap')::int = 10, 'first-day bonus should apply to a new account';
end $$;

-- 10. Published revisions are immutable.
reset role;
do $$ begin
  perform pg_temp.expect_error($q$ update public.level_revisions set bundle = '{}' $q$, 'level_revisions is immutable; publish a new revision instead');
end $$;

\echo 'core-loop: all assertions passed'
