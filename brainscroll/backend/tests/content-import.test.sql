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
-- Counts come from the curriculum itself, so this keeps working as content grows.
do $$
declare v_levels int := (select count(*) from public.levels);
begin
  assert v_levels >= 10, format('expected at least the Golden 10 levels, got %s', v_levels);
  assert (select count(*) from public.levels where status = 'published') = v_levels, 'all levels published';
  assert (select count(*) from public.level_revisions) = v_levels, 're-import must not create revisions';
  assert (select max_published_level from public.skills where id = 'skill.science.astronomy') = v_levels;
  -- Testing is proportional: regular 3 questions, checkpoint 5, milestone 7, mastery 10.
  assert (select level_type from public.levels where number = 10) = 'checkpoint';
  assert (select count(*) from public.levels where level_type = 'checkpoint') = (select count(*) from public.levels where number % 10 = 0 and number % 50 <> 0);
  assert (select bool_and(n = case l.level_type when 'regular' then 3 when 'checkpoint' then 5 when 'milestone' then 7 else 10 end)
          from (select q.level_id, count(*) n from public.questions q group by q.level_id) x join public.levels l on l.id = x.level_id),
    'every level has its canonical question count';
  assert (select count(*) from public.answer_options where correct) = (select count(*) from public.questions),
    'every question has exactly one correct option';
  assert (select count(*) from public.source_links where object_type = 'concept') > 0;
end $$;

-- 2. A learner can play real Level 1 end to end.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000c1');
create temp table level1_keys as
  select q.id as question_id, o.option_id from public.questions q join public.answer_options o on o.question_id = q.id and o.correct
  where q.level_id = 'level.science.astronomy.001';
grant select on pg_temp.level1_keys to authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare s jsonb; r jsonb; answers jsonb;
begin
  assert (select count(*) from public.levels) >= 10, 'published levels are readable';
  s := public.start_level('level.science.astronomy.001');
  assert s ->> 'reason' = 'NEW' and s -> 'bundle' ->> 'title' = 'Your Cosmic Address', format('got %s', s ->> 'reason');
  assert not (s -> 'bundle' -> 'questions' -> 0 -> 'options' -> 0 ? 'correct'), 'bundles carry no answer keys';
  assert (s -> 'bundle' -> 'questions' -> 0 -> 'sourceCardIds') is not null, 'bundles carry question → card evidence';
  -- Answer every question correctly on the first try (keys prepared as superuser; learners can't read them).
  for answers in select jsonb_build_object('q', question_id, 'o', option_id) from pg_temp.level1_keys loop
    perform public.answer_question('level.science.astronomy.001', answers ->> 'q', answers ->> 'o');
  end loop;
  r := public.complete_level('level.science.astronomy.001', 1, gen_random_uuid());
  assert (r ->> 'xp_awarded')::int = 100 and r ->> 'outcome' = 'perfect' and (r ->> 'skill_level')::int = 1, format('got %s', r); -- Perfect Recall
  perform pg_temp.expect_error($q$ select public.import_content('{}'::jsonb) $q$, 'permission denied for function import_content');

  -- The snapshot the app renders from.
  s := public.get_progress();
  assert s -> 'skills' -> 'skill.science.astronomy' ->> 'highest_cleared' = '1', format('got %s', s);
  assert s -> 'completed_levels' = '["level.science.astronomy.001"]'::jsonb;
  assert (s ->> 'total_xp')::int = 100 and (s ->> 'xp_today')::int = 100 and (s ->> 'knowledge_level')::int = 3;
  assert (s -> 'daily' ->> 'used')::int = 1 and (s ->> 'reviews_due')::int = 0;

  -- Current bundles; unknown ids are simply absent.
  s := public.get_level_bundles(array['level.science.astronomy.002', 'level.nope.nope.001']);
  assert s -> 'level.science.astronomy.002' ->> 'title' = 'The Sun, Up Close' and s ? 'level.nope.nope.001' = false;
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
