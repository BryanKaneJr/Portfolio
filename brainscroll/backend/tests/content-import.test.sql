-- Content import/publish tests against the real curriculum in content/.
\set ON_ERROR_STOP on
\set QUIET on

create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm <> code then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;

-- 1. Import (drafts published, as on staging), then import again: idempotent.
\o /dev/null
\i :content_sql
\i :content_sql
\o
do $$ begin
  assert (select count(*) from public.levels where status = 'published') = 10, 'all 10 levels published';
  assert (select count(*) from public.level_revisions) = 10, 're-import must not create revisions';
  assert (select max_published_level from public.skills where id = 'skill.science.astronomy') = 10;
  assert (select count(*) from public.answer_options where correct) = (select count(*) from public.questions),
    'every question has exactly one correct option';
  assert (select count(*) from public.source_links where object_type = 'concept') > 0;
end $$;

-- 2. A learner can play real Level 1 end to end.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c1');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare s jsonb; r jsonb; answers jsonb;
begin
  assert (select count(*) from public.levels) = 10, 'published levels are readable';
  s := public.start_level('level.science.astronomy.001');
  assert s ->> 'reason' = 'NEW' and s -> 'bundle' ->> 'title' = 'Your Cosmic Address', format('got %s', s ->> 'reason');
  select jsonb_agg(jsonb_build_object('question_id', question_id, 'option_id', option_id)) into answers
  from public.answer_options o join public.questions q on q.id = o.question_id
  where q.level_id = 'level.science.astronomy.001' and o.correct;
  r := public.complete_level('level.science.astronomy.001', 1, answers, gen_random_uuid());
  assert (r ->> 'xp_awarded')::int = 24 and (r ->> 'skill_level')::int = 1, format('got %s', r);
  perform pg_temp.expect_error($q$ select public.import_content('{}'::jsonb) $q$, 'permission denied for function import_content');
end $$;
reset role;

-- 3. Changing published content without a revision bump is refused.
do $$
declare b jsonb := (select bundle from public.level_revisions where level_id = 'level.science.astronomy.001' and revision = 1);
begin
  perform pg_temp.expect_error(format($q$ select public.import_content(%L::jsonb) $q$,
    jsonb_build_object('levels', jsonb_build_array(jsonb_set(b, '{title}', '"Changed"') || '{"status":"published"}'))), 'REVISION_CONFLICT');
end $$;

-- 4. Bumping the revision publishes a correction without touching earned progress.
do $$
declare b jsonb := (select bundle from public.level_revisions where level_id = 'level.science.astronomy.001' and revision = 1);
begin
  perform public.import_content(jsonb_build_object('levels', jsonb_build_array(
    jsonb_set(jsonb_set(b, '{title}', '"Your Cosmic Address (revised)"'), '{revision}', '2') || '{"status":"published"}')));
  assert (select current_revision from public.levels where id = 'level.science.astronomy.001') = 2;
  assert (select count(*) from public.level_revisions where level_id = 'level.science.astronomy.001') = 2, 'r1 is kept';
  assert (select completed_at is not null from public.user_level_progress where level_id = 'level.science.astronomy.001');
  assert (select highest_cleared from public.user_skill_progress) = 1, 'progress survives the revision';
  -- Re-importing the old revision would move content backwards.
  perform pg_temp.expect_error(format($q$ select public.import_content(%L::jsonb) $q$,
    jsonb_build_object('levels', jsonb_build_array(b || '{"status":"published"}'))), 'REVISION_REGRESSION');
end $$;

-- 5. Without --publish-drafts, drafts stay drafts.
do $$ begin
  assert public.effective_status('draft', false) = 'draft';
  assert public.effective_status('draft', true) = 'published';
  assert public.effective_status('retired', true) = 'retired';
end $$;

\echo 'content-import: all assertions passed'
