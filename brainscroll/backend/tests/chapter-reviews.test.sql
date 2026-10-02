-- Chapter reviews: any cleared chapter, one question per level (rotating),
-- graded like a level, at most 30 XP each time, and quest credit only once a
-- skill has no new levels left. Mirrors packages/core/test/chapterReview.test.ts.
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

-- A ten-level skill (one chapter), two questions a level. Alice has cleared all of it.
insert into public.skills (id, subject_id, name, status) values ('skill.science.chapters', 'subject.science', 'Chapters', 'published');
insert into public.levels (id, skill_id, number, title, status)
select 'level.science.chapters.' || lpad(n::text, 3, '0'), 'skill.science.chapters', n, 'Level ' || n, 'published' from generate_series(1, 10) n;
insert into public.questions (id, level_id, prompt, explanation, difficulty)
select 'question.chapters.' || lpad(n::text, 3, '0') || '.q' || k, 'level.science.chapters.' || lpad(n::text, 3, '0'), 'Q?', 'Because.', 0.1
from generate_series(1, 10) n cross join generate_series(1, 2) k;
insert into public.answer_options (question_id, option_id, label, correct, rationale)
select q.id, o.opt, 'Option ' || o.opt, o.opt = 'a', case when o.opt <> 'a' then 'Not ' || o.opt || '.' end
from public.questions q cross join (values ('a'), ('b')) o(opt) where q.id like 'question.chapters.%';
insert into public.user_skill_progress (user_id, skill_id, highest_cleared) values ('00000000-0000-0000-0000-00000000000a', 'skill.science.chapters', 10);

-- This week's quest needs two levels of it.
select public.import_quests(jsonb_build_array(
  jsonb_build_object('id', 'quest.live', 'title', 'Live', 'tagline', 'This week.', 'art', 'rome.colosseum',
    'startsOn', (date_trunc('week', now() at time zone 'UTC')::date)::text,
    'requirements', jsonb_build_array(jsonb_build_object('skillId', 'skill.science.chapters', 'newLevels', 2)),
    'xpReward', 50, 'trophy', jsonb_build_object('id', 'trophy.live', 'name', 'Live'), 'status', 'published')));
create function pg_temp.quest_done() returns int language sql as $$
  select (x -> 'requirements' -> 0 ->> 'done')::int from jsonb_array_elements(public.get_quests() -> 'quests') x where x ->> 'id' = 'quest.live'
$$;
create function pg_temp.answer_all(review jsonb) returns void language plpgsql as $$
begin
  perform public.answer_chapter_review((review ->> 'review_id')::uuid, q, 'a') from jsonb_array_elements_text(review -> 'question_ids') q;
end $$;

-- Signed out: nothing.
set role anon;
select pg_temp.expect_error($$select public.start_chapter_review('skill.science.chapters', 1)$$, 'permission denied');
reset role;

-- Bob hasn't cleared the chapter; Alice hasn't cleared a second one.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.expect_error($$select public.start_chapter_review('skill.science.chapters', 1)$$, 'CHAPTER_NOT_CLEARED');
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
select pg_temp.expect_error($$select public.start_chapter_review('skill.science.chapters', 2)$$, 'CHAPTER_NOT_CLEARED');
select pg_temp.expect_error($$select public.start_chapter_review('skill.science.chapters', 0)$$, 'CHAPTER_NOT_CLEARED');

create temp table rv (n int primary key, review jsonb);
insert into rv select 1, public.start_chapter_review('skill.science.chapters', 1);

do $$
declare
  v jsonb := (select review from rv where n = 1);
  id uuid := (v ->> 'review_id')::uuid;
  r jsonb;
begin
  assert jsonb_array_length(v -> 'question_ids') = 10 and v -> 'question_ids' ->> 0 = 'question.chapters.001.q1'
    and v -> 'question_ids' ->> 9 = 'question.chapters.010.q1', format('one question per level, in order: %s', v);
  assert public.start_chapter_review('skill.science.chapters', 1) ->> 'review_id' = id::text, 'starting again resumes the open review';
  perform pg_temp.expect_error(format('select public.complete_chapter_review(%L)', id), 'REVIEW_UNRESOLVED');
  perform pg_temp.expect_error(format('select public.answer_chapter_review(%L, %L, %L)', id, 'question.chapters.001.q2', 'a'), 'QUESTION_NOT_IN_REVIEW');

  r := public.answer_chapter_review(id, 'question.chapters.001.q1', 'b');
  assert not (r ->> 'correct')::boolean and r ->> 'rationale' = 'Not b.' and r ->> 'explanation' is null and not (r ->> 'resolved')::boolean,
    format('a miss explains why, without the answer: %s', r);
  r := public.answer_chapter_review(id, 'question.chapters.001.q1', 'a');
  assert (r ->> 'resolved')::boolean and not (r ->> 'first_attempt_correct')::boolean and (r ->> 'attempt_count')::int = 2,
    format('then it is corrected; the first attempt stands: %s', r);
  assert (public.start_chapter_review('skill.science.chapters', 1) -> 'resolved') = '["question.chapters.001.q1"]'::jsonb, 'resuming shows what is done';
  perform pg_temp.answer_all(v);

  r := public.complete_chapter_review(id);
  assert (r ->> 'xp_awarded')::int = 27 and (r ->> 'first_attempt_correct')::int = 9 and (r ->> 'total')::int = 10,
    format('XP is 30 scaled by first tries, rounded (9 of 10 is 27): %s', r);
  assert (r ->> 'quest_credit')::boolean, 'nothing new left in the skill: it counts toward quests';
  assert (select total_xp from public.user_skill_progress where user_id = auth.uid() and skill_id = 'skill.science.chapters') = 27, 'the skill''s XP goes up';
  assert exists (select 1 from public.xp_events where user_id = auth.uid() and type = 'CHAPTER_REVIEW' and amount = 27
                 and level_id = 'level.science.chapters.010' and reason = 'no_new_levels'), 'in the ledger as the chapter''s last level';
  r := public.complete_chapter_review(id);
  assert (r ->> 'xp_awarded')::int = 0 and (r ->> 'already_completed')::boolean and (r ->> 'quest_credit')::boolean, 'finishing again pays nothing';
  perform pg_temp.expect_error(format('select public.answer_chapter_review(%L, %L, %L)', id, 'question.chapters.002.q1', 'a'), 'QUESTION_NOT_IN_REVIEW');
  assert pg_temp.quest_done() = 1, 'the review counts as one level toward the quest';
end $$;

reset role;
do $$ begin
  assert exists (select 1 from public.user_question_checks where user_id = '00000000-0000-0000-0000-00000000000a' and question_id = 'question.chapters.001.q1'),
    'each answer is noted as a check, so the next scheduled review of it pays nothing';
end $$;
set role authenticated;

-- The next review of the chapter rotates to the other questions. It pays again
-- (farming is allowed, just small), but the same chapter counts once for a quest.
insert into rv select 2, public.start_chapter_review('skill.science.chapters', 1);
do $$
declare
  v jsonb := (select review from rv where n = 2);
  r jsonb;
begin
  assert v ->> 'review_id' <> (select review ->> 'review_id' from rv where n = 1), 'a new review';
  assert v -> 'question_ids' ->> 0 = 'question.chapters.001.q2', format('the questions rotate: %s', v -> 'question_ids');
  perform pg_temp.answer_all(v);
  r := public.complete_chapter_review((v ->> 'review_id')::uuid);
  assert (r ->> 'xp_awarded')::int = 30, format('all right first time pays the most, 30: %s', r);
  assert pg_temp.quest_done() = 1, 'the same chapter does not count twice';
end $$;
reset role;

-- A new level is published: the skill has something new again, so reviews no longer feed quests.
insert into public.levels (id, skill_id, number, title, status) values ('level.science.chapters.011', 'skill.science.chapters', 11, 'Level 11', 'published');
set role authenticated;
insert into rv select 3, public.start_chapter_review('skill.science.chapters', 1);
do $$
declare
  v jsonb := (select review from rv where n = 3);
  r jsonb;
begin
  assert v -> 'question_ids' ->> 0 = 'question.chapters.001.q1', 'the rotation wraps around';
  perform pg_temp.answer_all(v);
  r := public.complete_chapter_review((v ->> 'review_id')::uuid);
  assert (r ->> 'xp_awarded')::int = 30 and not (r ->> 'quest_credit')::boolean, format('XP, but no quest credit: %s', r);
  assert exists (select 1 from public.xp_events where idempotency_key = 'chapter_review:' || (v ->> 'review_id') and reason = 'chapter_review'), 'recorded without credit';
  assert pg_temp.quest_done() = 1, 'still one';
end $$;

-- A replay that checks an answer during a review makes that first try not count.
set role authenticated;
insert into rv select 4, public.start_chapter_review('skill.science.chapters', 1);
do $$
declare
  v jsonb := (select review from rv where n = 4);
  q text := v -> 'question_ids' ->> 0;
  r jsonb;
begin
  -- A replay of the (cleared) level would grade the answer and note the check, as answer_question does.
  perform pg_sleep(0.01);
  execute 'reset role';
  insert into public.user_question_checks (user_id, question_id) values ('00000000-0000-0000-0000-00000000000a', q)
  on conflict (user_id, question_id) do update set checked_at = clock_timestamp();
  execute 'set role authenticated';
  r := public.answer_chapter_review((v ->> 'review_id')::uuid, q, 'a');
  assert (r ->> 'correct')::boolean and not (r ->> 'first_attempt_correct')::boolean, format('a just-checked answer is not a first-try right: %s', r);
end $$;
reset role;

-- A chapter whose levels were all retired can't be reviewed.
update public.levels set status = 'retired' where skill_id = 'skill.science.chapters';
set role authenticated;
select pg_temp.expect_error($$select public.start_chapter_review('skill.science.chapters', 1)$$, 'CHAPTER_NOT_AVAILABLE');
reset role;
update public.levels set status = 'published' where skill_id = 'skill.science.chapters';

-- Someone else's review is not yours.
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
select pg_temp.expect_error(format('select public.complete_chapter_review(%L)', (select review ->> 'review_id' from rv where n = 1)), 'REVIEW_NOT_FOUND');
select pg_temp.expect_error(format('select public.answer_chapter_review(%L, %L, %L)', (select review ->> 'review_id' from rv where n = 3), 'question.chapters.001.q1', 'a'), 'QUESTION_NOT_IN_REVIEW');
-- Direct writes are refused.
select pg_temp.expect_error($$insert into public.user_chapter_reviews (user_id, skill_id, chapter, question_ids) values (auth.uid(), 'skill.science.chapters', 1, '{}')$$, 'row-level security');
reset role;

-- Brainpower: the first completed review of a chapter pays +1; reviewing it again pays nothing more.
do $$ begin
  assert (select count(*) from public.brainpower_awards where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'chapter_review') = 1,
    'one chapter award, however often the chapter is reviewed';
  assert (select granted from public.brainpower_awards where user_id = '00000000-0000-0000-0000-00000000000a'
          and award_key = 'chapter:skill.science.chapters:1') = 1, 'the first review of chapter 1 paid +1';
end $$;

\o
\echo chapter-reviews: all assertions passed
