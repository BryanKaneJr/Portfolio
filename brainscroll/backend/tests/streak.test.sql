-- Learning streak (migration 20261006000000): days with a first clear or a review answer.
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.q(n int) returns text language sql as $$ select 'question.testing.' || lpad(n::text, 3, '0') || '.q1' $$;
create function pg_temp.streak() returns jsonb language sql as $$ select public.get_progress() -> 'streak' $$;
-- Time travel (superuser): move a level's first clear n days back.
create function pg_temp.clear_days_ago(lvl text, n int) returns void language sql as $$
  update public.user_level_progress set completed_at = now() - make_interval(days => n) where level_id = lvl;
$$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$ begin
  assert pg_temp.streak() = '{"current": 0, "longest": 0, "today": false}'::jsonb, format('no learning, no streak: %s', pg_temp.streak());
  perform public.answer_question('level.science.testing.001', pg_temp.q(1), 'a');
  perform public.complete_level('level.science.testing.001', 1, gen_random_uuid());
  assert pg_temp.streak() = '{"current": 1, "longest": 1, "today": true}'::jsonb, format('a first clear starts it: %s', pg_temp.streak());
  perform public.answer_question('level.science.testing.002', pg_temp.q(2), 'a');
  perform public.complete_level('level.science.testing.002', 1, gen_random_uuid());
  assert (pg_temp.streak() ->> 'current')::int = 1, 'two levels on one day are one day';
end $$;
reset role;

-- Yesterday and today: two days.
select pg_temp.clear_days_ago('level.science.testing.001', 1);
set role authenticated;
do $$ begin
  assert pg_temp.streak() = '{"current": 2, "longest": 2, "today": true}'::jsonb, format('yesterday + today: %s', pg_temp.streak());
end $$;
reset role;

-- Only yesterday counted so far today: the streak stands, today not yet counted.
select pg_temp.clear_days_ago('level.science.testing.002', 1);
select pg_temp.clear_days_ago('level.science.testing.001', 2);
set role authenticated;
do $$ begin
  assert pg_temp.streak() = '{"current": 2, "longest": 2, "today": false}'::jsonb, format('alive until today ends: %s', pg_temp.streak());
end $$;
reset role;

-- A missed day resets current; longest is kept.
select pg_temp.clear_days_ago('level.science.testing.002', 3);
select pg_temp.clear_days_ago('level.science.testing.001', 4);
set role authenticated;
do $$ begin
  assert pg_temp.streak() = '{"current": 0, "longest": 2, "today": false}'::jsonb, format('a gap resets current only: %s', pg_temp.streak());
end $$;
reset role;

-- Answering a scheduled review counts as a learning day.
update public.review_queue set due_at = now() - interval '1 minute';
set role authenticated;
do $$ begin
  perform public.submit_review('concept.testing.c1', pg_temp.q(1), 'a');
  assert pg_temp.streak() = '{"current": 1, "longest": 2, "today": true}'::jsonb, format('a review keeps the day: %s', pg_temp.streak());
end $$;
reset role;

-- Nobody else can read it directly.
set role authenticated;
do $$ begin
  perform public.learning_streak('00000000-0000-0000-0000-00000000000a');
  raise exception 'learners must not call learning_streak directly';
exception when insufficient_privilege then null;
end $$;
reset role;

\o
\echo streak: all assertions passed
