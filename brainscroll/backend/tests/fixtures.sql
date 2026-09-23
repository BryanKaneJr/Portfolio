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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.org'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.org');
-- Alice signed up long ago, so today is not her first day (no first-day bonus).
update public.profiles set created_at = now() - interval '30 days' where id = '00000000-0000-0000-0000-00000000000a';
