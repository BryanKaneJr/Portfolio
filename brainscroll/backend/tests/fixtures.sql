-- A tiny published skill: 6 levels, one question each, so the daily cap and
-- sequencing can be exercised. Content here is test data, not curriculum.
insert into public.subjects (id, name, status) values ('subject.science', 'Science', 'published');
insert into public.skills (id, subject_id, name, status) values ('skill.science.testing', 'subject.science', 'Testing', 'published');
insert into public.sources (id, title, url, publisher, license, accessed_at, verified)
values ('source.test', 'Test', 'https://example.org', 'Example', 'CC0', '2026-09-23', true);

insert into public.concepts (id, title, description, difficulty)
select 'concept.testing.c' || n, 'Concept ' || n, 'Test concept', 0.1 from generate_series(1, 6) n;

insert into public.levels (id, skill_id, number, title, status)
select 'level.science.testing.' || lpad(n::text, 3, '0'), 'skill.science.testing', n, 'Level ' || n, 'published'
from generate_series(1, 6) n;

insert into public.level_revisions (level_id, revision, bundle)
select id, 1, jsonb_build_object('id', id, 'revision', 1) from public.levels;
update public.levels set current_revision = 1;

insert into public.level_concepts (level_id, concept_id, role)
select 'level.science.testing.' || lpad(n::text, 3, '0'), 'concept.testing.c' || n, 'teach' from generate_series(1, 6) n;

insert into public.questions (id, level_id, prompt, explanation, difficulty)
select 'question.testing.' || lpad(n::text, 3, '0') || '.q1', 'level.science.testing.' || lpad(n::text, 3, '0'), 'Q?', 'Because.', 0.1
from generate_series(1, 6) n;

insert into public.question_concepts (question_id, concept_id)
select 'question.testing.' || lpad(n::text, 3, '0') || '.q1', 'concept.testing.c' || n from generate_series(1, 6) n;

insert into public.answer_options (question_id, option_id, label, correct)
select q.id, o.opt, 'Option ' || o.opt, o.opt = 'a'
from public.questions q cross join (values ('a'), ('b')) o(opt);

-- Every learner has a real account (no guests): Alice signed in with Apple, Bob with email.
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.org', '{"provider": "apple"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.org', '{"provider": "email"}');
-- Alice signed up long ago, so today is not her first day (no first-day bonus).
update public.profiles set created_at = now() - interval '30 days' where id = '00000000-0000-0000-0000-00000000000a';

-- A second skill with one 3-question level (one concept each) for the first-attempt XP curve.
insert into public.skills (id, subject_id, name, status) values ('skill.science.curve', 'subject.science', 'Curve', 'published');
insert into public.concepts (id, title, description, difficulty)
select 'concept.curve.c' || n, 'Curve concept ' || n, 'Test concept', 0.1 from generate_series(1, 3) n;
insert into public.levels (id, skill_id, number, title, status) values ('level.science.curve.001', 'skill.science.curve', 1, 'Curve 1', 'published');
insert into public.level_revisions (level_id, revision, bundle) values ('level.science.curve.001', 1, '{"id": "level.science.curve.001", "revision": 1}');
update public.levels set current_revision = 1 where id = 'level.science.curve.001';
insert into public.level_concepts (level_id, concept_id, role)
select 'level.science.curve.001', 'concept.curve.c' || n, 'teach' from generate_series(1, 3) n;
insert into public.questions (id, level_id, prompt, explanation, difficulty)
select 'question.curve.001.q' || n, 'level.science.curve.001', 'Q' || n || '?', 'Because A.', 0.1 from generate_series(1, 3) n;
insert into public.question_concepts (question_id, concept_id)
select 'question.curve.001.q' || n, 'concept.curve.c' || n from generate_series(1, 3) n;
insert into public.answer_options (question_id, option_id, label, correct, rationale)
select 'question.curve.001.q' || n, o.opt, 'Option ' || o.opt, o.opt = 'a', case when o.opt <> 'a' then 'Not ' || o.opt || '.' end
from generate_series(1, 3) n cross join (values ('a'), ('b'), ('c')) o(opt);

-- A third skill whose only level is number 100 (a Mastery Challenge), for the ★ and the mastery XP pool.
-- Learners are placed at level 99 directly by the test.
insert into public.skills (id, subject_id, name, status) values ('skill.science.mastery', 'subject.science', 'Mastery', 'published');
insert into public.concepts (id, title, description, difficulty) values ('concept.mastery.c1', 'Mastery concept', 'Test concept', 0.1);
insert into public.levels (id, skill_id, number, title, status) values ('level.science.mastery.100', 'skill.science.mastery', 100, 'Mastery Challenge', 'published');
insert into public.level_revisions (level_id, revision, bundle) values ('level.science.mastery.100', 1, '{"id": "level.science.mastery.100", "revision": 1}');
update public.levels set current_revision = 1 where id = 'level.science.mastery.100';
insert into public.level_concepts (level_id, concept_id, role) values ('level.science.mastery.100', 'concept.mastery.c1', 'teach');
insert into public.questions (id, level_id, prompt, explanation, difficulty) values ('question.mastery.100.q1', 'level.science.mastery.100', 'Q?', 'Because.', 0.1);
insert into public.question_concepts (question_id, concept_id) values ('question.mastery.100.q1', 'concept.mastery.c1');
insert into public.answer_options (question_id, option_id, label, correct) values
  ('question.mastery.100.q1', 'a', 'Option a', true), ('question.mastery.100.q1', 'b', 'Option b', false);
