-- Milestone trophies are derived from progress (mirrors packages/core/test/trophies.test.ts).
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.shelf() returns jsonb language sql as $$ select public.get_quests() -> 'trophies' $$;
create function pg_temp.has(id text) returns boolean language sql as $$
  select exists (select 1 from jsonb_array_elements(pg_temp.shelf()) x where x ->> 'trophy_id' = id)
$$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$ begin assert jsonb_array_length(pg_temp.shelf()) = 0, 'nothing before any learning'; end $$;
select public.answer_question('level.science.testing.001', 'question.testing.001.q1', 'a');
select public.complete_level('level.science.testing.001', 1, gen_random_uuid());
do $$ begin
  assert pg_temp.has('trophy.first_level'), 'the first clear earns First Level';
  -- The fixtures' only subject is Science, so one level covers every subject.
  assert pg_temp.has('trophy.polymath'), 'a level in every subject earns Polymath';
  assert not pg_temp.has('trophy.chapter_one'), 'no checkpoint yet';
  assert not pg_temp.has('trophy.explorer'), 'not every skill yet';
  assert (select x ->> 'kind' from jsonb_array_elements(pg_temp.shelf()) x where x ->> 'trophy_id' = 'trophy.first_level') = 'milestone', 'milestones say so';
end $$;
reset role;

-- 100 first-try reviews earn Long Memory, dated by the hundredth.
insert into public.xp_events (user_id, type, amount, skill_id, level_id, idempotency_key, created_at)
select '00000000-0000-0000-0000-00000000000a', 'DELAYED_RECALL', 10, 'skill.science.testing', 'level.science.testing.001', 'r' || n, now() - interval '1 day' + n * interval '1 minute'
from generate_series(1, 100) n;
set role authenticated;
do $$ begin
  assert pg_temp.has('trophy.long_memory'), '100 first-try reviews earn Long Memory';
  assert (select (x ->> 'earned_at')::timestamptz from jsonb_array_elements(pg_temp.shelf()) x where x ->> 'trophy_id' = 'trophy.long_memory')
         = (select created_at from public.xp_events where idempotency_key = 'r100'), 'dated by the hundredth';
end $$;
reset role;

-- A skill's Level 100 earns its mastery trophy; a subject's comes once all its skills are mastered.
-- (The fixtures' Science has three skills: testing, curve and mastery.)
update public.user_skill_progress set highest_cleared = 99 where true;
insert into public.user_skill_progress (user_id, skill_id, highest_cleared)
values ('00000000-0000-0000-0000-00000000000a', 'skill.science.mastery', 99)
on conflict (user_id, skill_id) do update set highest_cleared = 99;
set role authenticated;
select public.answer_question('level.science.mastery.100', 'question.mastery.100.q1', 'a');
select public.complete_level('level.science.mastery.100', 1, gen_random_uuid());
do $$ begin
  assert pg_temp.has('trophy.mastery_mastery'), 'Level 100 earns that skill''s mastery trophy';
  assert pg_temp.has('trophy.mastered'), 'and First Mastery';
  assert not pg_temp.has('trophy.subject_science'), 'Science isn''t mastered until all its skills are';
  assert (select x ->> 'kind' from jsonb_array_elements(pg_temp.shelf()) x where x ->> 'trophy_id' = 'trophy.mastery_mastery') = 'mastery', 'mastery trophies say so';
end $$;
reset role;
-- Master the other two Science skills (their Level 100 clears, as ledger rows).
insert into public.levels (id, skill_id, number, title, status) values
  ('level.science.testing.100', 'skill.science.testing', 100, 'T100', 'published'),
  ('level.science.curve.100', 'skill.science.curve', 100, 'C100', 'published');
insert into public.xp_events (user_id, type, amount, skill_id, level_id, idempotency_key) values
  ('00000000-0000-0000-0000-00000000000a', 'LEVEL_COMPLETE', 500, 'skill.science.testing', 'level.science.testing.100', 'e2e:t100'),
  ('00000000-0000-0000-0000-00000000000a', 'LEVEL_COMPLETE', 500, 'skill.science.curve', 'level.science.curve.100', 'e2e:c100');
set role authenticated;
do $$ begin
  assert pg_temp.has('trophy.subject_science'), 'every Science skill mastered earns Master of Science';
  assert pg_temp.has('trophy.explorer'), 'and a level in every skill';
  -- The fixtures' only subject is Science, so its three skills are every skill.
  assert pg_temp.has('trophy.master_of_all'), 'every skill mastered earns Master of All';
  assert not pg_temp.has('trophy.jack_of_all_trades'), 'Jack of All Trades needs every skill''s Level 50 clear';
end $$;
reset role;

-- Perfect lessons: ten first clears with every question right first try earn the first tier.
insert into public.user_level_progress (user_id, level_id, completed_at, correct_count, question_count)
select '00000000-0000-0000-0000-00000000000b', l.id, now() - interval '1 hour' + n * interval '1 minute', 1, 1
from (select id, row_number() over (order by id) as n from public.levels) l(id, n) where n <= 10;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
do $$ begin assert pg_temp.has('trophy.perfect_10') and not pg_temp.has('trophy.perfect_25'), 'ten perfect lessons earn the first tier'; end $$;
reset role;
delete from public.user_level_progress where user_id = '00000000-0000-0000-0000-00000000000b';
select public.rebuild_learning_days('00000000-0000-0000-0000-00000000000b'); -- the cleanup above removed its learning too
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

-- Nothing is stored: the milestones are computed, and other learners have none.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
do $$ begin assert jsonb_array_length(pg_temp.shelf()) = 0, 'Bob has none'; end $$;
reset role;
do $$ begin assert (select count(*) from public.user_trophies) = 0, 'milestones are never stored'; end $$;

-- Streaks: a 6-day run, a gap, then 7 days in a row earns One Week, dated by the seventh day's first learning.
insert into public.levels (id, skill_id, number, title, status)
select 'level.science.testing.' || (200 + n), 'skill.science.testing', 200 + n, 'S' || n, 'published' from generate_series(1, 13) n;
insert into public.user_level_progress (user_id, level_id, completed_at, correct_count, question_count)
select '00000000-0000-0000-0000-00000000000b', 'level.science.testing.' || (200 + n),
       date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + (d || ' days')::interval + interval '12 hours', 0, 1
from (select n, case when n <= 6 then n - 31 else n - 18 end as d from generate_series(1, 13) n) x;
set role authenticated;
do $$ begin
  assert pg_temp.has('trophy.streak_7'), 'seven learning days in a row earn One Week';
  assert not pg_temp.has('trophy.streak_30'), 'but not One Month';
  assert (select (x ->> 'earned_at')::timestamptz from jsonb_array_elements(pg_temp.shelf()) x where x ->> 'trophy_id' = 'trophy.streak_7')
         = date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + interval '-5 days 12 hours', 'dated by the seventh day';
end $$;
reset role;
-- A content correction that removes a question keeps the review answers to it (they are learning days).
insert into public.questions (id, level_id, prompt, explanation, difficulty) values ('question.testing.001.q9', 'level.science.testing.001', 'Q?', 'Because.', 0.1);
insert into public.user_review_attempts (user_id, concept_id, occurrence, question_id, first_option_id, first_attempt_correct, resolved_correct, first_attempted_at)
values ('00000000-0000-0000-0000-00000000000b', 'concept.testing.c1', now() - interval '40 days', 'question.testing.001.q9', 'a', true, true, now() - interval '40 days');
delete from public.questions where id = 'question.testing.001.q9';
do $$ begin
  assert (select question_id is null from public.user_review_attempts where user_id = '00000000-0000-0000-0000-00000000000b' and concept_id = 'concept.testing.c1'),
    'the review answer stays, with its question cleared';
end $$;

-- It's for the longest run ever: the streak ending changes nothing.
set role authenticated;
do $$ begin assert (public.get_progress() -> 'streak' ->> 'current')::int = 0 and pg_temp.has('trophy.streak_7'), 'kept after the streak ends'; end $$;
reset role;

\o
\echo trophies: all assertions passed
