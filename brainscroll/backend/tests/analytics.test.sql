-- Analytics, product-health insights and content reports.
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm <> code and sqlerrm not like '%' || code || '%' then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;

-- 1. Signed-out callers (the anon API role) can't log or report.
set role anon;
select pg_temp.expect_error($$select public.log_events('[{"name":"app_open"}]')$$, 'NOT_AUTHENTICATED');
select pg_temp.expect_error($$select public.report_content('level.science.testing.001', 1, 'level', 'level.science.testing.001', 'typo')$$, 'NOT_AUTHENTICATED');
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;

-- 2. Events: allowlisted names, flat props only; others are dropped, not stored.
do $$
declare r jsonb;
begin
  r := public.log_events('[
    {"name": "app_open", "props": {"backend": "remote"}, "at": "2026-09-24T10:00:00Z"},
    {"name": "level_exit", "props": {"level_id": "level.science.testing.001", "card_index": 2, "card_count": 5}},
    {"name": "session_minutes", "props": {"n": 12}},
    {"name": "app_open", "props": {"nested": {"email": "x@y.z"}}}
  ]');
  assert r = '{"accepted": 2, "rejected": 2}'::jsonb, format('log_events result %s', r);
end $$;
select pg_temp.expect_error($$select public.log_events('{"name":"app_open"}')$$, 'EVENTS_MUST_BE_ARRAY');
select pg_temp.expect_error(format('select public.log_events(%L)', (select jsonb_agg('{"name":"app_open"}'::jsonb) from generate_series(1, 51))), 'TOO_MANY_EVENTS');

-- 3. Learners can't read or write events directly.
do $$ begin
  assert (select count(*) from public.analytics_events) = 0, 'events are not readable by learners';
end $$;
select pg_temp.expect_error($$insert into public.analytics_events (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'app_open')$$, 'row-level security');

-- 4. Reports: object must belong to the level; repeats update the open report.
select pg_temp.expect_error($$select public.report_content('level.science.testing.001', 1, 'question', 'question.testing.002.q1', 'factual')$$, 'OBJECT_NOT_IN_LEVEL');
select pg_temp.expect_error($$select public.report_content('level.science.testing.001', 9, 'level', 'level.science.testing.001', 'typo')$$, 'LEVEL_NOT_AVAILABLE');
select pg_temp.expect_error(format('select public.report_content(%L, 1, %L, %L, %L, %L)', 'level.science.testing.001', 'level', 'level.science.testing.001', 'typo', repeat('x', 1001)), 'MESSAGE_TOO_LONG');
select pg_temp.expect_error($$insert into public.content_reports (object_type, object_id, category) values ('level', 'x', 'typo')$$, 'row-level security');
do $$
declare r1 jsonb; r2 jsonb;
begin
  r1 := public.report_content('level.science.testing.001', 1, 'question', 'question.testing.001.q1', 'factual', ' The answer looks wrong ');
  r2 := public.report_content('level.science.testing.001', 1, 'question', 'question.testing.001.q1', 'confusing_question');
  assert r1 ->> 'id' = r2 ->> 'id' and (r2 ->> 'duplicate')::boolean, 'a repeat report updates the open one';
  assert (select count(*) from public.content_reports) = 1, 'learners see only their own reports';
  assert (select message from public.content_reports) = 'The answer looks wrong', 'message is trimmed and kept when a repeat has none';
  assert (select category::text from public.content_reports) = 'confusing_question', 'the category is updated';
end $$;

-- 5. Admin insights are service-role only.
select pg_temp.expect_error($$select public.admin_learning_health()$$, 'permission denied');
select pg_temp.expect_error($$select public.admin_question_stats()$$, 'permission denied');
select pg_temp.expect_error($$select public.admin_content_reports()$$, 'permission denied');

-- 6. Some learning to aggregate: Alice gets level 1 wrong first, Bob right first.
do $$ begin
  perform public.answer_question('level.science.testing.001', 'question.testing.001.q1', 'b');
  perform public.answer_question('level.science.testing.001', 'question.testing.001.q1', 'a');
  perform public.complete_level('level.science.testing.001', 1, gen_random_uuid());
end $$;
reset role;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
set role authenticated;
do $$ begin
  perform public.answer_question('level.science.testing.001', 'question.testing.001.q1', 'a');
  perform public.complete_level('level.science.testing.001', 1, gen_random_uuid());
  perform public.log_events('[{"name": "level_exit", "props": {"level_id": "level.science.testing.002", "card_index": 1, "card_count": 3}}]');
end $$;
reset role;

set role service_role;
do $$
declare q jsonb; f jsonb; h jsonb; reports jsonb;
begin
  q := (select e from jsonb_array_elements(public.admin_question_stats('skill.science.testing')) e where e ->> 'question_id' = 'question.testing.001.q1');
  assert (q ->> 'learners')::int = 2, format('two learners met q1: %s', q);
  assert (q ->> 'first_try_rate')::numeric = 0.5, 'half got it right first time';
  assert q -> 'first_picks' = '{"a": 1, "b": 1}'::jsonb, format('first picks per option: %s', q -> 'first_picks');

  f := (select e from jsonb_array_elements(public.admin_level_funnel()) e where e ->> 'level_id' = 'level.science.testing.001');
  assert (f ->> 'started')::int = 2 and (f ->> 'completed')::int = 2 and (f ->> 'completion_rate')::numeric = 1, format('funnel %s', f);
  f := (select e from jsonb_array_elements(public.admin_level_funnel()) e where e ->> 'level_id' = 'level.science.testing.001');
  assert (select count(*) from jsonb_array_elements(public.admin_level_funnel())) >= 1, 'funnel has rows';

  h := public.admin_learning_health(28);
  assert (h ->> 'active_learners')::int = 2, format('health %s', h);
  assert (h ->> 'levels_completed')::int = 2, 'two completions in the window';
  assert (h ->> 'first_try_rate_new_levels')::numeric = 0.5, 'first-try rate on new levels';
  assert (h ->> 'open_reports')::int = 1, 'one open report';
  assert not (h ? 'avg_session_minutes') and not (h ? 'time_in_app'), 'no time-spent metrics';
  assert h -> 'new_accounts_by_method' = '{"apple": 1, "email": 1}'::jsonb, format('new accounts by sign-in method: %s', h -> 'new_accounts_by_method');
  assert not (h ? 'saved_account_share'), 'no guest-vs-saved metric: every learner has an account';

  reports := public.admin_content_reports();
  assert jsonb_array_length(reports) = 1 and reports -> 0 ->> 'object_id' = 'question.testing.001.q1', 'admin sees the report';
  perform public.admin_set_report_status((reports -> 0 ->> 'id')::uuid, 'fixed');
  assert jsonb_array_length(public.admin_content_reports()) = 0, 'fixed reports leave the open inbox';
end $$;
reset role;
\echo analytics: all assertions passed
