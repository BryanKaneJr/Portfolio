-- Account deletion removes every row belonging to the learner, and only theirs.
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

-- Signed-out callers (the anon API role) can't delete anything.
set role anon;
select pg_temp.expect_error($$select public.delete_my_account()$$, 'permission denied');
reset role;

-- Alice and Bob both learn something and leave traces everywhere.
create function pg_temp.learn(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform public.answer_question('level.science.testing.001', 'question.testing.001.q1', 'b');
  perform public.answer_question('level.science.testing.001', 'question.testing.001.q1', 'a');
  perform public.complete_level('level.science.testing.001', 1, gen_random_uuid());
  perform public.log_events('[{"name": "app_open", "props": {"backend": "remote"}}]');
  perform public.report_content('level.science.testing.001', 1, 'level', 'level.science.testing.001', 'typo');
end $$;
set role authenticated;
select pg_temp.learn('00000000-0000-0000-0000-00000000000a');
select pg_temp.learn('00000000-0000-0000-0000-00000000000b');
reset role;
insert into public.entitlements (user_id, entitlement, active) values ('00000000-0000-0000-0000-00000000000a', 'unlimited_learning', true);

-- Alice deletes her account.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$ begin
  assert public.delete_my_account() = '{"deleted": true}'::jsonb, 'deletion reports success';
end $$;
reset role;

do $$
declare t text; n int;
begin
  assert not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000a'), 'the auth user is gone';
  foreach t in array array['profiles', 'user_skill_progress', 'user_level_progress', 'user_concept_mastery', 'review_queue',
    'xp_events', 'daily_allowances', 'entitlements', 'content_reports', 'user_question_attempts', 'analytics_events',
    'user_review_attempts', 'user_question_checks'] loop
    execute format('select count(*) from public.%I where %I = %L', t, case when t = 'profiles' then 'id' else 'user_id' end,
                   '00000000-0000-0000-0000-00000000000a') into n;
    assert n = 0, format('%s still has %s rows for the deleted learner', t, n);
  end loop;
  assert (select count(*) from public.xp_events where user_id = '00000000-0000-0000-0000-00000000000b') > 0, 'other learners are untouched';
  assert exists (select 1 from auth.users where id = '00000000-0000-0000-0000-00000000000b'), 'Bob still exists';
end $$;

-- A deleted session can't act any more.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
select pg_temp.expect_error($$select public.complete_level('level.science.testing.002', 1, gen_random_uuid())$$, '');
reset role;
\o
\echo account-deletion: all assertions passed
