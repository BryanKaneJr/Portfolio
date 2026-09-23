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
-- Superuser-only time travel: make the concept due again (a new scheduled occurrence).
create function pg_temp.make_due(c text) returns void language sql as $$
  update public.review_queue set due_at = now() - interval '1 minute' where concept_id = c;
$$;
create function pg_temp.review(opt text) returns jsonb language sql as $$
  select public.submit_review('concept.testing.c1', pg_temp.q(1), opt)
$$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;

-- Clear level 1 with a wrong first answer (then corrected): c1 is due in 10 minutes, not yet.
do $$ begin
  perform public.answer_question('level.science.testing.001', pg_temp.q(1), 'b');
  perform public.answer_question('level.science.testing.001', pg_temp.q(1), 'a');
  perform public.complete_level('level.science.testing.001', 1, gen_random_uuid());
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

-- 2. Right on the first attempt: +10 XP (DELAYED_RECALL), strength up, priority cleared.
--    Replaying or reopening the same review is practice: nothing recorded, nothing awarded.
do $$
declare r jsonb;
begin
  r := pg_temp.review('a');
  assert r = '{"correct": true, "resolved": true, "first_attempt_correct": true, "attempt_count": 1, "xp_awarded": 10, "scheduled": true, "rationale": null, "explanation": "Because."}'::jsonb, format('got %s', r);
  assert (select strength from public.user_concept_mastery where concept_id = 'concept.testing.c1') = 1;
  assert (select due_at between now() + interval '23 hours' and now() + interval '25 hours' and priority = 0 from public.review_queue), 'a right review clears priority';
  assert (select count(*) from public.xp_events where type = 'DELAYED_RECALL' and amount = 10) = 1;
  assert (select total_xp from public.user_skill_progress) = 25, 'skill XP = 15 (0/1 first attempt) + 10 (review)';
  r := pg_temp.review('a');
  assert (r ->> 'xp_awarded')::int = 0 and not (r ->> 'scheduled')::boolean, format('replay must be practice, got %s', r);
  assert (select count(*) from public.xp_events where type = 'DELAYED_RECALL') = 1;
  assert (select strength from public.user_concept_mastery where concept_id = 'concept.testing.c1') = 1;
  assert (select count(*) from public.user_review_attempts) = 1;
end $$;

-- 3. The next scheduled occurrence earns again; the old +5 / 20-hour rule is gone.
reset role;
do $$ begin perform pg_temp.make_due('concept.testing.c1'); end $$;
set role authenticated;
do $$
declare r jsonb;
begin
  r := pg_temp.review('a');
  assert (r ->> 'xp_awarded')::int = 10, format('expected 10 XP, got %s', r);
  assert (select count(*) from public.xp_events where type = 'DELAYED_RECALL') = 2;
  assert (select total_xp from public.user_skill_progress) = 35;
end $$;

-- 4. A wrong first attempt: 0 XP, no answer revealed, strength 0, priority ≥ 1.
--    The item stays in the queue until corrected; corrections earn nothing.
reset role;
do $$ begin perform pg_temp.make_due('concept.testing.c1'); end $$;
set role authenticated;
do $$
declare r jsonb; v_due timestamptz;
begin
  r := pg_temp.review('b');
  assert r = '{"correct": false, "resolved": false, "first_attempt_correct": false, "attempt_count": 1, "xp_awarded": 0, "scheduled": true, "rationale": null, "explanation": null}'::jsonb, format('got %s', r);
  assert not (r ? 'correct_option_id'), 'the right answer must not be revealed';
  assert (select strength from public.user_concept_mastery where concept_id = 'concept.testing.c1') = 0;
  assert (select priority from public.review_queue where concept_id = 'concept.testing.c1') = 1, 'a missed review raises priority';
  select due_at into v_due from public.review_queue where concept_id = 'concept.testing.c1';
  assert v_due > now(), 'rescheduled soon, not now';
  -- Reopening review serves the same item until it's corrected.
  assert public.get_review_queue() -> 0 ->> 'question_id' = pg_temp.q(1), format('open item must be served, got %s', public.get_review_queue());
  r := pg_temp.review('b');
  assert (r ->> 'attempt_count')::int = 2 and not (r ->> 'resolved')::boolean and (r ->> 'xp_awarded')::int = 0;
  r := pg_temp.review('a');
  assert (r ->> 'resolved')::boolean and not (r ->> 'first_attempt_correct')::boolean and (r ->> 'attempt_count')::int = 3
    and (r ->> 'xp_awarded')::int = 0 and r ->> 'explanation' = 'Because.', format('got %s', r);
  assert (select count(*) from public.xp_events where type = 'DELAYED_RECALL') = 2, 'corrections earn nothing';
  assert (select strength from public.user_concept_mastery where concept_id = 'concept.testing.c1') = 0, 'corrections change no strength';
  assert (select priority = 2 and due_at = v_due from public.review_queue where concept_id = 'concept.testing.c1'), 'missed repeatedly → priority 2';
  assert public.get_review_queue() = '[]'::jsonb, 'resolved and not yet due';
  assert (select highest_cleared from public.user_skill_progress) = 1;
  assert (public.get_daily_status() ->> 'used')::int = 1, 'review must not consume allowance';
  assert (select first_option_id = 'b' and resolved_correct from public.user_review_attempts order by occurrence desc limit 1);
end $$;

-- 5. Questions from levels you haven't cleared are off limits.
do $$ begin
  perform pg_temp.expect_error($q$ select public.submit_review('concept.testing.c2', pg_temp.q(2), 'a') $q$, 'QUESTION_NOT_AVAILABLE');
  -- …and a question must test the concept it's reviewing.
  perform pg_temp.expect_error($q$ select public.submit_review('concept.testing.c2', pg_temp.q(1), 'a') $q$, 'QUESTION_NOT_AVAILABLE');
end $$;

-- 6. Isolation.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  reset role;
  update public.review_queue set due_at = now() - interval '1 minute';
  set role authenticated;
  assert public.get_review_queue() = '[]'::jsonb, 'Bob must not see Alice''s reviews';
  perform pg_temp.expect_error($q$ select pg_temp.review('a') $q$, 'QUESTION_NOT_AVAILABLE');
end $$;

\echo 'review: all assertions passed'
