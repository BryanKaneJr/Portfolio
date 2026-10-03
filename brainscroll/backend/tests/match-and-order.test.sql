-- Match and order questions: imported with an answer key, graded by label
-- (identical labels are interchangeable), wrong positions named but never the
-- answer, and phones never sent the answer. Mirrors packages/core/test/answers.test.ts.
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
end $$;
create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm not like '%' || code || '%' then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;

-- A one-level skill imported like real content: an order question and a match question.
insert into public.skills (id, subject_id, name, status) values ('skill.science.arrange', 'subject.science', 'Arrange', 'published');
insert into public.concepts (id, title, description, difficulty) values ('concept.arrange.planets', 'Planets', 'Test concept', 0.1);
select public.import_content(jsonb_build_object('levels', jsonb_build_array(jsonb_build_object(
  'id', 'level.science.arrange.001', 'skillId', 'skill.science.arrange', 'number', 1, 'revision', 1, 'status', 'published',
  'title', 'Arrange', 'summary', 'S', 'concepts', '[]'::jsonb, 'sourceIds', '[]'::jsonb, 'cards', '[]'::jsonb,
  'questions', jsonb_build_array(
    jsonb_build_object('id', 'question.arrange.001.q1', 'kind', 'order', 'prompt', 'Order them', 'explanation', 'Inner to outer.',
      'difficulty', 0.2, 'conceptIds', jsonb_build_array('concept.arrange.planets'), 'first', 'Closest', 'last', 'Farthest',
      'items', jsonb_build_array('Mercury', 'Venus', 'Earth', 'Mars')),
    jsonb_build_object('id', 'question.arrange.001.q2', 'kind', 'match', 'prompt', 'Match them', 'explanation', 'Capitals.',
      'difficulty', 0.2, 'conceptIds', jsonb_build_array('concept.arrange.planets'),
      'pairs', jsonb_build_array(
        jsonb_build_object('left', 'Paris', 'right', 'France'),
        jsonb_build_object('left', 'Rome', 'right', 'Italy'),
        jsonb_build_object('left', 'Lyon', 'right', 'France'))),
    jsonb_build_object('id', 'question.arrange.001.q3', 'kind', 'order', 'prompt', 'Two Mars', 'explanation', 'Same.',
      'difficulty', 0.2, 'conceptIds', jsonb_build_array('concept.arrange.planets'), 'first', 'First', 'last', 'Last',
      'items', jsonb_build_array('Mercury', 'Mars', 'Mars', 'Jupiter')))))));

select pg_temp.check((select expected = '["Mercury","Venus","Earth","Mars"]' from public.question_arrangements where question_id = 'question.arrange.001.q1'), 'import stores the order key');
select pg_temp.check((select expected = '["France","Italy","France"]' from public.question_arrangements where question_id = 'question.arrange.001.q2'), 'import stores the match key (right labels by left)');
select pg_temp.check(not exists (select 1 from public.answer_options where question_id like 'question.arrange.%'), 'no answer options for match or order');

-- grade_answer: by label, wrong positions only, anything else wrong everywhere.
select pg_temp.check((select correct and wrong is null from public.grade_answer('question.arrange.001.q1', '["Mercury","Venus","Earth","Mars"]')), 'order: right');
select pg_temp.check((select not correct and wrong = '[0,1]' from public.grade_answer('question.arrange.001.q1', '["Venus","Mercury","Earth","Mars"]')), 'order: wrong positions named');
select pg_temp.check((select correct from public.grade_answer('question.arrange.001.q3', '["Mercury","Mars","Mars","Jupiter"]')), 'identical items are interchangeable');
select pg_temp.check((select correct from public.grade_answer('question.arrange.001.q2', '["France","Italy","France"]')), 'match: shared partners are interchangeable');
select pg_temp.check((select not correct and wrong = '[0,1]' from public.grade_answer('question.arrange.001.q2', '["Italy","France","France"]')), 'match: wrong positions named');
select pg_temp.check((select not correct and wrong = '[0,1,2,3]' from public.grade_answer('question.arrange.001.q1', '["Mercury","Venus","Earth"]')), 'too few: all wrong');
select pg_temp.check((select not correct from public.grade_answer('question.arrange.001.q1', '["Mercury","Venus","Earth","Pluto"]')), 'a label it does not have');
select pg_temp.check((select not correct from public.grade_answer('question.arrange.001.q1', '["Mercury","Mercury","Earth","Mars"]')), 'a label twice');
select pg_temp.check((select not correct from public.grade_answer('question.arrange.001.q1', 'not json')), 'not JSON');
select pg_temp.check((select not correct from public.grade_answer('question.arrange.001.q1', '{"a":1}')), 'not an array');
select pg_temp.check((select not correct from public.grade_answer('question.arrange.001.q1', '[1,2,3,4]')), 'not strings');
-- Multiple choice is unchanged.
select pg_temp.check((select correct from public.grade_answer('question.testing.001.q1', 'a')), 'multiple choice still grades by option');
select pg_temp.check((select not correct from public.grade_answer('question.testing.001.q1', 'b')), 'multiple choice wrong option');

-- What a phone receives: no answer, jumbled, never already solved.
create temp table lb as
select q from jsonb_array_elements(public.learner_bundle((select bundle from public.level_revisions where level_id = 'level.science.arrange.001')) -> 'questions') q;
select pg_temp.check((select count(*) = 0 from lb where q ? 'explanation' or q ? 'pairs'), 'no explanation or pairs');
select pg_temp.check((select bool_and(q ->> 'shuffled' = 'true') from lb), 'marked as already jumbled');
select pg_temp.check((select q -> 'items' <> '["Mercury","Venus","Earth","Mars"]' from lb where q ->> 'id' = 'question.arrange.001.q1'), 'order items are jumbled');
select pg_temp.check((select (select array_agg(t order by t) from jsonb_array_elements_text(q -> 'items') t) = array['Earth','Mars','Mercury','Venus'] from lb where q ->> 'id' = 'question.arrange.001.q1'), 'every item is still there');
select pg_temp.check((select q -> 'lefts' = '["Paris","Rome","Lyon"]' and q -> 'rights' <> '["France","Italy","France"]' from lb where q ->> 'id' = 'question.arrange.001.q2'), 'match: lefts in order, rights jumbled');

-- Clients can't call the grader directly (it would test answers unrecorded).
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
select pg_temp.expect_error($$select public.grade_answer('question.arrange.001.q1', '[]')$$, 'permission denied');

-- answer_question: a wrong first try names the positions, then a fix resolves it.
create temp table r1 as select public.answer_question('level.science.arrange.001', 'question.arrange.001.q1', '["Venus","Mercury","Earth","Mars"]') r;
select pg_temp.check((select not (r ->> 'correct')::boolean and r -> 'wrong' = '[0,1]' and r -> 'explanation' = 'null' from r1), 'wrong first try: positions, no explanation');
create temp table r2 as select public.answer_question('level.science.arrange.001', 'question.arrange.001.q1', '["Mercury","Venus","Earth","Mars"]') r;
select pg_temp.check((select (r ->> 'correct')::boolean and (r ->> 'resolved')::boolean and not (r ->> 'first_attempt_correct')::boolean and not (r ? 'wrong') from r2), 'the fix resolves it; the first try stays wrong');
select pg_temp.check((select (public.answer_question('level.science.arrange.001', 'question.arrange.001.q2', '["France","Italy","France"]') ->> 'first_attempt_correct')::boolean), 'match right first time');
reset role;
select pg_temp.check((select first_option_id = '["Venus","Mercury","Earth","Mars"]' from public.user_question_attempts where question_id = 'question.arrange.001.q1'), 'the first attempt is recorded as given');

\o
\echo match-and-order ok
