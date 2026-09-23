-- Review loop acceptance tests (blueprint Stage 5). Mirrors packages/core/test/review.test.ts.
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql

create function pg_temp.q(n int) returns text language sql as $$ select 'question.testing.' || lpad(n::text, 3, '0') || '.q1' $$;
create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm <> code then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;
-- Superuser-only time travel: pretend the concept was last seen `ago` and is now due.
create function pg_temp.age_concept(c text, ago interval) returns void language sql as $$
  update public.user_concept_mastery set last_seen_at = now() - ago where concept_id = c;
  update public.review_queue set due_at = now() - interval '1 minute' where concept_id = c;
$$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;

-- Clear level 1 with a wrong answer: c1 is due in 10 minutes, not yet.
do $$ begin
  perform public.complete_level('level.science.testing.001', 1,
    jsonb_build_array(jsonb_build_object('question_id', pg_temp.q(1), 'option_id', 'b')), gen_random_uuid());
  assert public.get_review_queue() = '[]'::jsonb, 'nothing should be due immediately';
end $$;

reset role;
update public.review_queue set due_at = now() - interval '1 minute';
set role authenticated;

-- 1. A due concept is served with a question from a completed level.
do $$
declare q jsonb := public.get_review_queue();
begin
  assert jsonb_array_length(q) = 1, format('expected one item, got %s', q);
  assert q -> 0 ->> 'concept_id' = 'concept.testing.c1';
  assert q -> 0 ->> 'question_id' = pg_temp.q(1);
end $$;

-- 2. A quick correct answer reschedules without XP; a double submit is a no-op.
do $$
declare r jsonb;
begin
  r := public.submit_review(pg_temp.q(1), 'a');
  assert (r ->> 'correct')::boolean and (r ->> 'xp_awarded')::int = 0, format('got %s', r);
  assert r -> 'refreshed' = '["concept.testing.c1"]'::jsonb;
  assert (select strength from public.user_concept_mastery where concept_id = 'concept.testing.c1') = 1;
  assert (select due_at between now() + interval '23 hours' and now() + interval '25 hours' from public.review_queue);
  r := public.submit_review(pg_temp.q(1), 'a');
  assert r -> 'refreshed' = '[]'::jsonb and (r ->> 'xp_awarded')::int = 0, 'double submit must change nothing';
  assert (select strength from public.user_concept_mastery where concept_id = 'concept.testing.c1') = 1;
end $$;

-- 3. Correct after a real gap earns DELAYED_RECALL once, added to the skill's XP.
reset role;
do $$ begin perform pg_temp.age_concept('concept.testing.c1', interval '30 hours'); end $$;
set role authenticated;
do $$
declare r jsonb;
begin
  r := public.submit_review(pg_temp.q(1), 'a');
  assert (r ->> 'xp_awarded')::int = 5, format('expected 5 XP, got %s', r);
  assert (select count(*) from public.xp_events where type = 'DELAYED_RECALL') = 1;
  assert (select total_xp from public.user_skill_progress) = 25, 'skill XP = 20 (level) + 5 (recall)';
end $$;

-- 4. A wrong review resets strength but never lowers the skill level or uses allowance.
reset role;
do $$ begin perform pg_temp.age_concept('concept.testing.c1', interval '30 hours'); end $$;
set role authenticated;
do $$
declare r jsonb;
begin
  r := public.submit_review(pg_temp.q(1), 'b');
  assert not (r ->> 'correct')::boolean and (r ->> 'xp_awarded')::int = 0;
  assert r ->> 'correct_option_id' = 'a', 'response reveals the right answer for feedback';
  assert (select strength from public.user_concept_mastery where concept_id = 'concept.testing.c1') = 0;
  assert (select highest_cleared from public.user_skill_progress) = 1;
  assert (public.get_daily_status() ->> 'used')::int = 1, 'review must not consume allowance';
end $$;

-- 5. Questions from levels you haven't cleared are off limits.
do $$ begin
  perform pg_temp.expect_error($q$ select public.submit_review(pg_temp.q(2), 'a') $q$, 'QUESTION_NOT_AVAILABLE');
end $$;

-- 6. Isolation.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  reset role;
  update public.review_queue set due_at = now() - interval '1 minute';
  set role authenticated;
  assert public.get_review_queue() = '[]'::jsonb, 'Bob must not see Alice''s reviews';
  perform pg_temp.expect_error($q$ select public.submit_review(pg_temp.q(1), 'a') $q$, 'QUESTION_NOT_AVAILABLE');
end $$;

\echo 'review: all assertions passed'
