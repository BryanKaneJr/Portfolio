-- Brainpower (migration 20261031000000): refill, capacity, spending and the
-- ways to earn it. Mirrors packages/core/test/brainpower.test.ts.
-- Chapter reviews: chapter-reviews.test.sql. The plain gate: core-loop.test.sql.
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.q(n int) returns text language sql as $$ select 'question.testing.' || lpad(n::text, 3, '0') || '.q1' $$;
create function pg_temp.lvl(n int) returns text language sql as $$ select 'level.science.testing.' || lpad(n::text, 3, '0') $$;
-- Clear level n: first answer `first`, corrected if wrong. Returns the summary's daily status.
create function pg_temp.clear(n int, first text) returns jsonb language plpgsql as $$
begin
  perform public.answer_question(pg_temp.lvl(n), pg_temp.q(n), first);
  if first <> 'a' then perform public.answer_question(pg_temp.lvl(n), pg_temp.q(n), 'a'); end if;
  return public.complete_level(pg_temp.lvl(n), 1, gen_random_uuid()) -> 'daily';
end $$;
create function pg_temp.bp() returns int language sql as $$ select (public.get_daily_status() ->> 'brainpower')::int $$;
create function pg_temp.set_bp(n int, days_ago int) returns void language sql as $$
  update public.user_brainpower set balance = n, as_of = public.brainpower_today(user_id) - days_ago
  where user_id = '00000000-0000-0000-0000-00000000000a'
$$;
update public.app_settings set brainpower_perfect_drop_percent = 0 where true;

-- 1. A new learner starts at a day's refill: 5 of 10.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare d jsonb := public.get_daily_status();
begin
  assert (d ->> 'brainpower')::int = 5 and (d ->> 'brainpower_max')::int = 10 and not (d ->> 'daily_complete')::boolean, format('got %s', d);
end $$;
-- 2. Clearing a level spends 1; its trophies pay +1 each (First Level, and Polymath: one subject in the fixtures).
do $$
declare d jsonb := pg_temp.clear(1, 'a');
begin
  assert (d ->> 'brainpower')::int = 6, format('5 - 1 + 2 trophies: %s', d);
  assert (select count(*) from jsonb_array_elements(d -> 'brainpower_earned')) = 2, 'what this level earned is in its summary';
end $$;
do $$ begin
  assert jsonb_array_length(public.get_daily_status() -> 'brainpower_earned') = 0, 'a later status read lists nothing';
end $$;
-- 3. Replays and repeat completions spend nothing.
do $$ begin
  perform public.complete_level(pg_temp.lvl(1), 1, gen_random_uuid());
  assert pg_temp.bp() = 6, 'already cleared: no spend';
end $$;
reset role;

-- 4. The day refill: below 5 comes back up to 5; above 5 is kept.
select pg_temp.set_bp(2, 1);
set role authenticated;
do $$ begin assert pg_temp.bp() = 5, format('2 yesterday → 5 today, got %s', pg_temp.bp()); end $$;
reset role;
select pg_temp.set_bp(8, 1);
set role authenticated;
do $$ begin assert pg_temp.bp() = 8, format('8 yesterday stays 8, got %s', pg_temp.bp()); end $$;
reset role;
select pg_temp.set_bp(2, 0);
set role authenticated;
do $$ begin assert pg_temp.bp() = 2, 'no refill within the same day'; end $$;
reset role;

-- 5. Capacity: at 10, anything earned is lost (and the award is used up).
select pg_temp.set_bp(10, 0);
select public.brainpower_grant('00000000-0000-0000-0000-00000000000a', 'trophy:test.full', 'trophy');
do $$ begin
  assert (select balance from public.user_brainpower where user_id = '00000000-0000-0000-0000-00000000000a') = 10, 'never above 10';
  assert (select granted from public.brainpower_awards where award_key = 'trophy:test.full') = 0, 'noted, not paid';
end $$;
select pg_temp.set_bp(4, 0);
select public.brainpower_grant('00000000-0000-0000-0000-00000000000a', 'trophy:test.full', 'trophy');
do $$ begin
  assert (select balance from public.user_brainpower where user_id = '00000000-0000-0000-0000-00000000000a') = 4, 'an award pays at most once, even if it was lost';
end $$;

-- 6. Spending first, so a full learner still keeps what a level earns: 10 → 9 → +1 perfect drop → 10.
update public.app_settings set brainpower_perfect_drop_percent = 100 where true;
select pg_temp.set_bp(10, 0);
set role authenticated;
do $$
declare d jsonb := pg_temp.clear(2, 'a');
begin
  assert (d ->> 'brainpower')::int = 10, format('got %s', d);
  assert d -> 'brainpower_earned' @> '[{"key": "perfect:level.science.testing.002", "kind": "perfect", "granted": 1}]', format('got %s', d);
end $$;
-- 7. A level with a miss is never a perfect drop.
do $$
declare d jsonb := pg_temp.clear(3, 'b');
begin
  assert (d ->> 'brainpower')::int = 9 and not (d -> 'brainpower_earned' @> '[{"kind": "perfect"}]'), format('got %s', d);
end $$;
reset role;
update public.app_settings set brainpower_perfect_drop_percent = 0 where true;

-- 8. The streak: only when it grows past one day (yesterday was a learning day), once a day.
set role authenticated;
do $$
declare d jsonb := pg_temp.clear(4, 'a');
begin
  assert not (d -> 'brainpower_earned' @> '[{"kind": "streak"}]'), 'day 1 of a streak pays nothing';
end $$;
reset role;
insert into public.user_learning_days (user_id, day, first_at)
values ('00000000-0000-0000-0000-00000000000a', public.brainpower_today('00000000-0000-0000-0000-00000000000a') - 1, now() - interval '1 day');
set role authenticated;
do $$
declare d jsonb := pg_temp.clear(5, 'a');
begin
  assert d -> 'brainpower_earned' @> jsonb_build_array(jsonb_build_object('key', 'streak:' || current_date, 'kind', 'streak', 'granted', 1)), format('day 2 pays +1: %s', d);
end $$;
do $$
declare d jsonb := pg_temp.clear(6, 'a');
begin
  assert not (d -> 'brainpower_earned' @> '[{"kind": "streak"}]'), 'once a day';
end $$;

-- 9. None left: no new level; everything else stays open.
reset role;
select pg_temp.set_bp(0, 0);
set role authenticated;
do $$ begin
  assert (public.get_daily_status() ->> 'daily_complete')::boolean, 'out of Brainpower';
  assert (public.start_level('level.science.curve.001') ->> 'reason') = 'DAILY_COMPLETE', 'a new level needs Brainpower';
  assert (public.start_level(pg_temp.lvl(1)) ->> 'reason') = 'REPLAY', 'replays are free';
end $$;

-- 10. Unlimited: ∞, never spends, and its awards are noted at 0 (no backlog if it lapses).
reset role;
insert into public.entitlements (user_id, entitlement, active) values ('00000000-0000-0000-0000-00000000000a', 'unlimited_learning', true);
update public.app_settings set brainpower_perfect_drop_percent = 100 where true;
set role authenticated;
do $$
declare d jsonb;
begin
  for n in 1..3 loop perform public.answer_question('level.science.curve.001', 'question.curve.001.q' || n, 'a'); end loop;
  d := public.complete_level('level.science.curve.001', 1, gen_random_uuid()) -> 'daily';
  assert d ->> 'brainpower' is null and (d ->> 'unlimited')::boolean and not (d ->> 'daily_complete')::boolean, format('got %s', d);
  assert d -> 'brainpower_earned' @> '[{"key": "perfect:level.science.curve.001", "granted": 0}]', format('noted at 0: %s', d);
end $$;
reset role;
do $$ begin
  assert (select balance from public.user_brainpower where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'Unlimited spent nothing';
end $$;

-- 11. A scheduled review answer reports what it paid: when it's the day's
-- first learning after yesterday's, the streak's +1 (Review Complete shows it).
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.clear(1, 'a');
reset role;
insert into public.user_learning_days (user_id, day, first_at)
values ('00000000-0000-0000-0000-00000000000b', public.brainpower_today('00000000-0000-0000-0000-00000000000b') - 1, now() - interval '1 day');
update public.review_queue set due_at = now() - interval '1 minute' where user_id = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
do $$
declare
  v_before int := pg_temp.bp();
  r jsonb := public.submit_review('concept.testing.c1', pg_temp.q(1), 'b');
begin
  assert r -> 'daily' -> 'brainpower_earned' @> jsonb_build_array(jsonb_build_object('key', 'streak:' || current_date, 'kind', 'streak', 'granted', 1)),
    format('the review''s streak +1 comes back with it: %s', r);
  assert (r -> 'daily' ->> 'brainpower')::int = v_before + 1, format('+1 from %s: %s', v_before, r);
  r := public.submit_review('concept.testing.c1', pg_temp.q(1), 'a');
  assert r -> 'daily' is null, format('a correction is not a learning moment: %s', r);
end $$;
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

-- 12. Learners can't read or write the balance or the awards directly.
set role authenticated;
do $$ begin
  assert (select count(*) from public.user_brainpower) = 0 and (select count(*) from public.brainpower_awards) = 0, 'RPC-only';
end $$;
reset role;

\o
\echo brainpower: all assertions passed
