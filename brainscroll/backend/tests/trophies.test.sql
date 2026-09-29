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

-- Nothing is stored: the milestones are computed, and other learners have none.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
do $$ begin assert jsonb_array_length(pg_temp.shelf()) = 0, 'Bob has none'; end $$;
reset role;
do $$ begin assert (select count(*) from public.user_trophies) = 0, 'milestones are never stored'; end $$;

\o
\echo trophies: all assertions passed
