-- Weekly Quests: progress from the ledger, the Final Round, the XP bonus once,
-- the trophy only in the live week, and the Archive's one-at-a-time rule.
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm not like '%' || code || '%' then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;

-- This week's quest, and two that ended (two and three weeks ago). Mondays, UTC.
create function pg_temp.monday(weeks_ago int) returns text language sql as $$
  select (date_trunc('week', now() at time zone 'UTC')::date - 7 * weeks_ago)::text
$$;
select public.import_quests(jsonb_build_array(
  jsonb_build_object('id', 'quest.live', 'title', 'Live', 'tagline', 'This week.', 'art', 'rome.colosseum', 'startsOn', pg_temp.monday(0),
    'requirements', jsonb_build_array(jsonb_build_object('skillId', 'skill.science.testing', 'newLevels', 2),
                                      jsonb_build_object('skillId', 'skill.science.curve', 'newLevels', 1)),
    'xpReward', 50, 'trophy', jsonb_build_object('id', 'trophy.live', 'name', 'Live'), 'status', 'published'),
  jsonb_build_object('id', 'quest.past', 'title', 'Past', 'tagline', 'Two weeks ago.', 'art', 'rome.colosseum', 'startsOn', pg_temp.monday(2),
    'requirements', jsonb_build_array(jsonb_build_object('skillId', 'skill.science.testing', 'newLevels', 1)),
    'xpReward', 75, 'trophy', jsonb_build_object('id', 'trophy.past', 'name', 'Past'), 'status', 'published'),
  jsonb_build_object('id', 'quest.older', 'title', 'Older', 'tagline', 'Three weeks ago.', 'art', 'rome.colosseum', 'startsOn', pg_temp.monday(3),
    'requirements', jsonb_build_array(jsonb_build_object('skillId', 'skill.science.testing', 'newLevels', 1)),
    'xpReward', 50, 'trophy', jsonb_build_object('id', 'trophy.older', 'name', 'Older'), 'status', 'published'),
  jsonb_build_object('id', 'quest.future', 'title', 'Future', 'tagline', 'Next week.', 'art', 'rome.colosseum', 'startsOn', pg_temp.monday(-1),
    'requirements', jsonb_build_array(jsonb_build_object('skillId', 'skill.science.testing', 'newLevels', 1)),
    'xpReward', 50, 'trophy', jsonb_build_object('id', 'trophy.future', 'name', 'Future'), 'status', 'published'),
  jsonb_build_object('id', 'quest.tbd', 'title', 'TBD', 'tagline', 'No date yet.', 'art', 'rome.colosseum', 'startsOn', null,
    'requirements', jsonb_build_array(jsonb_build_object('skillId', 'skill.science.testing', 'newLevels', 1)),
    'xpReward', 50, 'trophy', jsonb_build_object('id', 'trophy.tbd', 'name', 'TBD'), 'status', 'published')
));

create function pg_temp.quest(id text) returns jsonb language sql as $$
  select x from jsonb_array_elements(public.get_quests() -> 'quests') x where x ->> 'id' = id
$$;
create function pg_temp.done(id text, skill text) returns int language sql as $$
  select (r ->> 'done')::int from jsonb_array_elements(pg_temp.quest(id) -> 'requirements') r where r ->> 'skill_id' = skill
$$;
create function pg_temp.clear_testing(n int) returns void language plpgsql as $$
begin
  perform public.answer_question('level.science.testing.' || lpad(n::text, 3, '0'), 'question.testing.' || lpad(n::text, 3, '0') || '.q1', 'a');
  perform public.complete_level('level.science.testing.' || lpad(n::text, 3, '0'), 1, gen_random_uuid());
end $$;
create function pg_temp.clear_curve() returns void language plpgsql as $$
begin
  perform public.answer_question('level.science.curve.001', 'question.curve.001.q' || n, 'a') from generate_series(1, 3) n;
  perform public.complete_level('level.science.curve.001', 1, gen_random_uuid());
end $$;

-- Signed-out callers get nothing.
set role anon;
select pg_temp.expect_error($$select public.get_quests()$$, 'permission denied');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;

do $$ begin
  assert pg_temp.quest('quest.future') is null, 'a quest that has not started is hidden';
  assert pg_temp.quest('quest.tbd') is null, 'an unscheduled (TBD) quest is hidden';
  assert pg_temp.quest('quest.live') ->> 'state' = 'live', 'this week''s quest is live';
  assert (pg_temp.quest('quest.live') ->> 'active')::boolean, 'the live quest runs without a start button';
  assert pg_temp.quest('quest.past') ->> 'state' = 'archive' and not (pg_temp.quest('quest.past') ->> 'active')::boolean, 'ended quests wait in the Archive';
  assert pg_temp.done('quest.live', 'skill.science.testing') = 0, 'nothing counted yet';
end $$;

select pg_temp.expect_error($$select public.start_quest('quest.tbd')$$, 'QUEST_NOT_FOUND');

-- Final Round stays locked until every requirement is met.
select pg_temp.expect_error($$select public.open_final_round('quest.live')$$, 'FINAL_ROUND_LOCKED');

select pg_temp.clear_testing(1);
select pg_temp.clear_testing(2);
select pg_temp.clear_curve();
-- A replay is not a new level: nothing more counts.
select pg_temp.clear_testing(1);

do $$
declare v jsonb;
begin
  assert pg_temp.done('quest.live', 'skill.science.testing') = 2, 'two new testing levels count';
  assert pg_temp.done('quest.live', 'skill.science.curve') = 1, 'one new curve level counts';
  assert (pg_temp.quest('quest.live') ->> 'final_round_unlocked')::boolean, 'every requirement met unlocks the Final Round';
  assert pg_temp.done('quest.past', 'skill.science.testing') = 0, 'an Archive quest you have not started counts nothing';

  v := public.open_final_round('quest.live');
  assert v -> 'final_round' -> 'question_ids' = '["question.testing.002.q1", "question.curve.001.q3"]'::jsonb,
    format('one question per requirement skill, from the levels that counted: %s', v -> 'final_round' -> 'question_ids');
  assert public.open_final_round('quest.live') -> 'final_round' -> 'question_ids' = v -> 'final_round' -> 'question_ids', 'the questions are fixed once chosen';
end $$;

select pg_temp.expect_error($$select public.complete_quest('quest.live')$$, 'FINAL_ROUND_UNRESOLVED');
select pg_temp.expect_error($$select public.answer_final_round('quest.live', 'question.testing.001.q1', 'a')$$, 'QUESTION_NOT_IN_FINAL_ROUND');

do $$
declare r jsonb;
begin
  r := public.answer_final_round('quest.live', 'question.curve.001.q3', 'b');
  assert not (r ->> 'correct')::boolean and r ->> 'rationale' = 'Not b.' and r ->> 'explanation' is null, 'a wrong answer explains why, without the answer';
  r := public.answer_final_round('quest.live', 'question.curve.001.q3', 'a');
  assert (r ->> 'resolved')::boolean, 'then it can be corrected';
  perform public.answer_final_round('quest.live', 'question.testing.002.q1', 'a');

  r := public.complete_quest('quest.live');
  assert (r ->> 'xp_awarded')::int = 50 and (r ->> 'live_clear')::boolean and r -> 'trophy' ->> 'trophy_id' = 'trophy.live',
    format('a live-week clear pays the bonus and the trophy: %s', r);
  r := public.complete_quest('quest.live');
  assert (r ->> 'xp_awarded')::int = 0 and (r ->> 'live_clear')::boolean, 'finishing again changes nothing';
  assert pg_temp.quest('quest.live') ->> 'state' = 'completed', 'the quest shows as finished';
  assert (select count(*) from public.xp_events where type = 'QUEST_COMPLETE' and user_id = auth.uid()) = 1, 'the bonus is in the ledger once';
  assert (select count(*) from jsonb_array_elements(public.get_quests() -> 'trophies') x where x ->> 'kind' = 'quest') = 1, 'the trophy is on the shelf';
end $$;

-- The live clear's title and emblem can be shown; anything unearned is refused.
select pg_temp.expect_error($$select public.set_equipped('quest.past', null)$$, 'NOT_EARNED');
do $$ begin
  perform public.set_equipped('quest.live', 'quest.live');
  assert public.get_quests() -> 'equipped' = '{"title_quest_id": "quest.live", "emblem_quest_id": "quest.live"}'::jsonb, 'the title and emblem are shown';
  perform public.set_equipped(null, 'quest.live');
  assert public.get_quests() -> 'equipped' ->> 'title_quest_id' is null, 'a title can be taken off';
end $$;

-- The Archive: XP, but no trophy. Levels cleared before you start it don't count.
-- (Separate statements: each runs at its own time, as it would in the app.)
select public.start_quest('quest.past');
do $$ begin
  assert (pg_temp.quest('quest.past') ->> 'active')::boolean and pg_temp.done('quest.past', 'skill.science.testing') = 0, 'starting an Archive quest counts from now';
end $$;
select pg_temp.clear_testing(3);
do $$
declare r jsonb;
begin
  assert pg_temp.done('quest.past', 'skill.science.testing') = 1, 'a new level after starting counts';
  perform public.open_final_round('quest.past');
  perform public.answer_final_round('quest.past', 'question.testing.003.q1', 'a');
  r := public.complete_quest('quest.past');
  assert (r ->> 'xp_awarded')::int = 75 and not (r ->> 'live_clear')::boolean and r -> 'trophy' = 'null'::jsonb,
    format('an Archive clear pays XP but no trophy: %s', r);
  assert (select count(*) from jsonb_array_elements(public.get_quests() -> 'trophies') x where x ->> 'kind' = 'quest') = 1, 'still one quest trophy';
  assert not (pg_temp.quest('quest.past') ->> 'active')::boolean, 'a finished quest is no longer the active one';
end $$;
-- An Archive clear unlocks no title or emblem either.
select pg_temp.expect_error($$select public.set_equipped('quest.past', null)$$, 'NOT_EARNED');
reset role;

-- Bob: one active Archive quest at a time, and switching resets the one you leave.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select public.start_quest('quest.past');
select pg_temp.clear_testing(1);
do $$ begin
  assert pg_temp.done('quest.past', 'skill.science.testing') = 1, 'Bob''s level counts for his active Archive quest';
end $$;
select public.start_quest('quest.older');
do $$ begin
  assert not (pg_temp.quest('quest.past') ->> 'active')::boolean and pg_temp.done('quest.past', 'skill.science.testing') = 0, 'the quest he left is reset';
  assert (pg_temp.quest('quest.older') ->> 'active')::boolean and pg_temp.done('quest.older', 'skill.science.testing') = 0, 'the new one counts from now';
end $$;
reset role;

-- Continuing your own unfinished live week keeps what you did during it.
update public.xp_events set created_at = (select starts_at + interval '1 day' from public.quests where id = 'quest.past')
where user_id = '00000000-0000-0000-0000-00000000000b' and type = 'LEVEL_COMPLETE';
set role authenticated;
do $$ begin
  perform public.start_quest('quest.past');
  assert pg_temp.done('quest.past', 'skill.science.testing') = 1, 'a level from that quest''s live week carries over';
  assert (pg_temp.quest('quest.past') ->> 'final_round_unlocked')::boolean, 'so the Final Round is open';
end $$;
reset role;

-- Direct writes are refused: progress changes only through the functions.
set role authenticated;
select pg_temp.expect_error($$insert into public.user_trophies (user_id, trophy_id, name) values (auth.uid(), 'trophy.fake', 'Fake')$$, 'row-level security');
reset role;

\o
\echo quests: all assertions passed
