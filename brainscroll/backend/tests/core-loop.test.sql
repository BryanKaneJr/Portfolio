-- Core loop acceptance tests: first attempt → reinforcement → resolution → progression.
-- Mirrors packages/core/test/completion.test.ts.
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql

create function pg_temp.lvl(n int) returns text language sql as $$ select 'level.science.testing.' || lpad(n::text, 3, '0') $$;
create function pg_temp.q(n int) returns text language sql as $$ select 'question.testing.' || lpad(n::text, 3, '0') || '.q1' $$;
create function pg_temp.ans(n int, opt text) returns jsonb language sql as $$ select public.answer_question(pg_temp.lvl(n), pg_temp.q(n), opt) $$;
-- Answer the level's only question: `first` first, then correct it if needed.
create function pg_temp.play(n int, first text) returns void language plpgsql as $$
begin
  perform pg_temp.ans(n, first);
  if first <> 'a' then perform pg_temp.ans(n, 'a'); end if;
end $$;
create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm <> code then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;

-- 1. Profiles are created on sign-up.
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'RLS: user should see only their own profile';
end $$;

-- 2. Can't skip ahead, and can't record attempts on locked levels.
do $$ begin
  assert (public.start_level(pg_temp.lvl(2)) ->> 'reason') = 'LEVEL_LOCKED', 'level 2 should be locked';
  assert (public.start_level(pg_temp.lvl(1)) ->> 'allowed')::boolean, 'level 1 should start';
  perform pg_temp.expect_error($q$ select pg_temp.ans(2, 'a') $q$, 'LEVEL_LOCKED');
  perform pg_temp.expect_error($q$ select public.complete_level(pg_temp.lvl(2), 1, gen_random_uuid()) $q$, 'LEVEL_LOCKED');
end $$;

-- 3. Every question must be correctly resolved before the level completes.
do $$
declare r jsonb;
begin
  perform pg_temp.expect_error($q$ select public.complete_level(pg_temp.lvl(1), 1, gen_random_uuid()) $q$, 'UNRESOLVED_QUESTIONS');
  r := pg_temp.ans(1, 'b');
  assert not (r ->> 'correct')::boolean and not (r ->> 'resolved')::boolean and (r ->> 'attempt_count')::int = 1, format('got %s', r);
  assert r ->> 'explanation' is null, 'no explanation before resolution';
  perform pg_temp.expect_error($q$ select public.complete_level(pg_temp.lvl(1), 1, gen_random_uuid()) $q$, 'UNRESOLVED_QUESTIONS');
  r := pg_temp.ans(1, 'a');
  assert (r ->> 'resolved')::boolean and not (r ->> 'first_attempt_correct')::boolean and (r ->> 'attempt_count')::int = 2, format('got %s', r);
  assert r ->> 'explanation' = 'Because.', 'explanation once resolved';
end $$;

-- 4. The first attempt is immutable; corrections don't restore XP; primary XP once.
do $$
declare r jsonb; k uuid := gen_random_uuid();
begin
  r := pg_temp.ans(1, 'a'); -- after resolution, nothing changes
  assert (select first_option_id = 'b' and not first_attempt_correct and attempt_count = 2 from public.user_question_attempts), 'first attempt must not change';
  r := public.complete_level(pg_temp.lvl(1), 1, k);
  assert (r ->> 'xp_awarded')::int = 15 and r ->> 'outcome' = 'heavily_reinforced', format('0/1 first attempt → 15 XP, got %s', r);
  assert (r ->> 'skill_level')::int = 1 and (r ->> 'first_attempt_correct')::int = 0;
  r := public.complete_level(pg_temp.lvl(1), 1, k);
  assert (r ->> 'already_completed')::boolean and (r ->> 'xp_awarded')::int = 0, 'retry is a no-op';
  r := public.complete_level(pg_temp.lvl(1), 1, gen_random_uuid());
  assert (r ->> 'xp_awarded')::int = 0, 'a new key must not re-award a cleared level';
  assert (select sum(amount) from public.xp_events) = 15, 'ledger holds exactly 15 XP';
  assert not exists (select 1 from public.xp_events where type = 'QUESTION_CORRECT'), 'per-question bonus is retired';
  -- Replays grade but record nothing.
  r := pg_temp.ans(1, 'b');
  assert (r ->> 'attempt_count')::int = 0 and (select attempt_count from public.user_question_attempts) = 2, 'replay attempts are not recorded';
end $$;

-- 5. A missed concept is queued sooner, at priority 1.
do $$ begin
  perform pg_temp.play(2, 'b');
  perform public.complete_level(pg_temp.lvl(2), 1, gen_random_uuid());
  assert (select strength from public.user_concept_mastery where concept_id = 'concept.testing.c2') = 0;
  assert (select due_at < now() + interval '1 hour' and priority = 1 from public.review_queue where concept_id = 'concept.testing.c2');
end $$;

-- 6. Daily cap: one resolved level is one level. 5/5 ends the day; replays stay open.
do $$
declare r jsonb;
begin
  for n in 3..5 loop
    perform pg_temp.play(n, 'a');
    perform public.complete_level(pg_temp.lvl(n), 1, gen_random_uuid());
  end loop;
  r := public.get_daily_status();
  assert (r ->> 'used')::int = 5 and (r ->> 'daily_complete')::boolean, format('expected 5/5 daily complete, got %s', r);
  assert (public.start_level(pg_temp.lvl(6)) ->> 'reason') = 'DAILY_COMPLETE';
  perform pg_temp.play(6, 'a');
  perform pg_temp.expect_error($q$ select public.complete_level(pg_temp.lvl(6), 1, gen_random_uuid()) $q$, 'DAILY_LIMIT_REACHED');
  assert (public.start_level(pg_temp.lvl(1)) ->> 'reason') = 'REPLAY', 'cleared levels remain replayable after the cap';
end $$;

-- 7. Clients cannot write progress or read answer keys.
do $$ begin
  perform pg_temp.expect_error($q$ insert into public.xp_events (user_id, type, amount, idempotency_key) values (auth.uid(), 'CORRECTION', 9999, 'cheat') $q$,
    'new row violates row-level security policy for table "xp_events"');
  perform pg_temp.expect_error($q$ insert into public.user_question_attempts (user_id, question_id, level_id, first_option_id, first_attempt_correct, resolved_correct) values (auth.uid(), pg_temp.q(6), pg_temp.lvl(6), 'a', true, true) $q$,
    'new row violates row-level security policy for table "user_question_attempts"');
  update public.user_skill_progress set highest_cleared = 99;
  update public.user_question_attempts set first_attempt_correct = true;
  assert (select highest_cleared from public.user_skill_progress) = 5, 'direct update must not change progress';
  assert (select count(*) from public.user_question_attempts where first_attempt_correct) = 4, 'direct update must not change attempts';
  perform pg_temp.expect_error($q$ update public.profiles set created_at = now() $q$, 'permission denied for table profiles');
  assert (select count(*) from public.answer_options) = 0, 'answer keys are not readable';
  assert (select count(*) from public.level_revisions) = 0, 'raw bundles are not readable';
  assert (select count(*) from public.questions) = 0, 'questions (with explanations) are not readable';
end $$;

-- 8. Unlimited removes the cap (and nothing else).
reset role;
insert into public.entitlements (user_id, entitlement, active) values ('00000000-0000-0000-0000-00000000000a', 'unlimited_learning', true);
set role authenticated;
do $$
declare r jsonb;
begin
  r := public.complete_level(pg_temp.lvl(6), 1, gen_random_uuid());
  assert (r ->> 'skill_level')::int = 6;
  assert (r ->> 'xp_awarded')::int = 100, 'Unlimited users earn the same XP per level';
  assert (r -> 'daily' ->> 'cap') is null;
end $$;

-- 9. The curve on a 3-question level: 100 / 70 / 35 / 15, and review priority 2 for repeated misses.
reset role;
insert into auth.users (id) select ('00000000-0000-0000-0000-0000000001' || lpad(n::text, 2, '0'))::uuid from generate_series(0, 3) n;
set role authenticated;
do $$
declare
  cases text[][] := array[array['a','a','a'], array['a','b','a'], array['a','b','c'], array['b','c','b']];
  expected int[] := array[100, 70, 35, 15];
  outcomes text[] := array['perfect', 'strong', 'reinforced', 'heavily_reinforced'];
  r jsonb;
begin
  for u in 1..4 loop
    perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000001' || lpad((u - 1)::text, 2, '0'), false);
    for i in 1..3 loop
      perform public.answer_question('level.science.curve.001', 'question.curve.001.q' || i, cases[u][i]);
      if cases[u][i] <> 'a' then
        if u = 4 and i = 3 then perform public.answer_question('level.science.curve.001', 'question.curve.001.q3', 'c'); end if;
        perform public.answer_question('level.science.curve.001', 'question.curve.001.q' || i, 'a');
      end if;
    end loop;
    r := public.complete_level('level.science.curve.001', 1, gen_random_uuid());
    assert (r ->> 'xp_awarded')::int = expected[u] and r ->> 'outcome' = outcomes[u], format('case %s: got %s', u, r);
  end loop;
  -- The last learner missed q3 twice before resolving it: high priority, due now.
  assert (select priority = 2 and due_at <= now() from public.review_queue where concept_id = 'concept.curve.c3');
  assert (select priority = 1 from public.review_queue where concept_id = 'concept.curve.c1');
  assert (r -> 'reinforced_concept_ids') = '["concept.curve.c1", "concept.curve.c2", "concept.curve.c3"]'::jsonb, format('got %s', r);
end $$;

-- 9b. Encounter XP pools: each level type has its own bands (mirrors LEARNING_STRUCTURE).
reset role;
do $$
declare
  cases jsonb := '[
    ["regular", 3, 3, 100], ["regular", 2, 3, 70], ["regular", 1, 3, 35], ["regular", 0, 3, 15],
    ["checkpoint", 5, 5, 150], ["checkpoint", 4, 5, 105], ["checkpoint", 3, 5, 60], ["checkpoint", 2, 5, 25], ["checkpoint", 0, 5, 25],
    ["milestone", 7, 7, 250], ["milestone", 6, 7, 175], ["milestone", 5, 7, 90], ["milestone", 4, 7, 90], ["milestone", 3, 7, 40], ["milestone", 0, 7, 40],
    ["mastery", 10, 10, 500], ["mastery", 9, 10, 350], ["mastery", 8, 10, 350], ["mastery", 7, 10, 175], ["mastery", 5, 10, 175], ["mastery", 4, 10, 75], ["mastery", 0, 10, 75]
  ]';
  c jsonb;
begin
  for c in select * from jsonb_array_elements(cases) loop
    assert (public.first_attempt_band(c ->> 0, (c ->> 1)::int, (c ->> 2)::int)).xp = (c ->> 3)::int, format('band %s', c);
  end loop;
  assert not exists (select 1 from information_schema.columns where table_name = 'app_settings' and column_name = 'xp_mastery_clear'),
    'the separate mastery bonus is retired';
end $$;

-- 9c. The ★ at level 100: resolving earns it with no minimum first-attempt score, XP from the
--     mastery pool, no separate MASTERY_CLEAR event, and the next band opens.
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000200');
insert into public.user_skill_progress (user_id, skill_id, highest_cleared)
values ('00000000-0000-0000-0000-000000000200', 'skill.science.mastery', 99);
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000200';
set role authenticated;
do $$
declare r jsonb;
begin
  perform public.answer_question('level.science.mastery.100', 'question.mastery.100.q1', 'b');
  perform public.answer_question('level.science.mastery.100', 'question.mastery.100.q1', 'a');
  r := public.complete_level('level.science.mastery.100', 1, gen_random_uuid());
  assert (r ->> 'mastery_cleared')::boolean and (r ->> 'stars')::int = 1 and (r ->> 'skill_level')::int = 100, format('got %s', r);
  assert (r ->> 'xp_awarded')::int = 75 and r ->> 'outcome' = 'heavily_reinforced', format('0/1 first attempt → 75, got %s', r);
  assert (select count(*) from public.xp_events) = 1 and not exists (select 1 from public.xp_events where type = 'MASTERY_CLEAR');
end $$;

-- 10. Isolation: Bob sees none of Alice's progress, and gets the first-day bonus.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.xp_events) = 0, 'RLS leak: Bob can see XP';
  assert (select count(*) from public.user_question_attempts) = 0, 'RLS leak: Bob can see attempts';
  assert (public.get_daily_status() ->> 'cap')::int = 10, 'first-day bonus should apply to a new account';
end $$;

-- 11. Published revisions are immutable, and learner bundles never carry answer keys.
reset role;
do $$ begin
  perform pg_temp.expect_error($q$ update public.level_revisions set bundle = '{}' $q$, 'level_revisions is immutable; publish a new revision instead');
  assert public.learner_bundle('{"id": "l", "questions": [{"id": "q", "prompt": "P", "explanation": "E", "sourceCardIds": ["c"], "options": [{"id": "a", "label": "A", "correct": true, "rationale": "R"}]}]}')
       = '{"id": "l", "questions": [{"id": "q", "prompt": "P", "sourceCardIds": ["c"], "options": [{"id": "a", "label": "A"}]}]}'::jsonb;
end $$;

\echo 'core-loop: all assertions passed'
