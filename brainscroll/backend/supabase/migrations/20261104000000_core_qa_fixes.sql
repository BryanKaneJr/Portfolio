-- Core loop fixes from QA (2026-10-03).
--
-- 1. A Weekly Quest goal met by a new level was checked when the level's
--    LEVEL_COMPLETE row landed, before complete_level spent its Brainpower (the
--    spend happens on the daily_allowances tally, which is written last). At 10
--    the goal's +1 was then lost (granted 0) while every other award a level
--    pays, made after the spend, was kept. Local play (core completeLevel, then
--    questBrainpower) spends first. Now the server does too: a level's quest
--    goals are checked by the first-clear trigger, after the spend, the perfect
--    drop, the streak and trophies, in core's order. CHAPTER_REVIEW rows (a
--    skill with nothing new left) still check quests as they land: they spend
--    nothing. (20261102000000's comment had the order backwards.)
-- 2. complete_quest also returns the daily status, so Quest Complete can show
--    the Brainpower a quest pays (its last goal, the quest itself, its trophy).
-- 3. submit_review also returns the daily status after a recorded first
--    attempt, so Review Complete can show what the review earned (the streak's
--    +1 when a review is the day's first learning, a trophy).

-- ── 1. Quest Brainpower after a level's spend ──
create or replace function public.tg_brainpower_xp() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.type = 'DELAYED_RECALL' then perform public.brainpower_sync_trophies(new.user_id); end if;
  -- A LEVEL_COMPLETE row's quests are checked by tg_brainpower_level, after the spend.
  if new.type = 'CHAPTER_REVIEW' then perform public.brainpower_sync_quests(new.user_id); end if;
  return new;
end $$;

-- A first clear (complete_level's daily tally, written after its XP row):
-- spend first, so a full learner still gets what this level earns, then the
-- perfect drop, the streak, trophies and the Weekly Quest goals it met.
create or replace function public.tg_brainpower_level() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  lp public.user_level_progress;
  v_pct int := (select brainpower_perfect_drop_percent from public.app_settings);
begin
  if tg_op = 'UPDATE' and new.new_levels_used <= old.new_levels_used then return new; end if;
  perform public.brainpower_spend(new.user_id);
  -- The level cleared in this transaction.
  for lp in select * from public.user_level_progress where user_id = new.user_id and completed_at = now() loop
    if lp.question_count > 0 and lp.correct_count = lp.question_count and random() * 100 < v_pct then
      perform public.brainpower_grant(new.user_id, 'perfect:' || lp.level_id, 'perfect');
    end if;
  end loop;
  perform public.brainpower_after_learning(new.user_id);
  perform public.brainpower_sync_quests(new.user_id);
  return new;
end $$;

revoke execute on function public.tg_brainpower_xp(), public.tg_brainpower_level()
  from public, anon, authenticated;

-- ── 2. complete_quest (as in 20261007000000), now with the daily status ──
create or replace function public.complete_quest(p_quest_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  q public.quests;
  uq public.user_quests;
  v_live boolean;
  v_xp int := 0;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  select * into q from public.quests where id = p_quest_id;
  select * into uq from public.user_quests where user_id = v_uid and quest_id = p_quest_id for update;
  if uq.quest_id is null or uq.final_round_question_ids is null then raise exception 'FINAL_ROUND_LOCKED'; end if;

  if uq.completed_at is null then
    if exists (select 1 from public.user_quest_answers where user_id = v_uid and quest_id = p_quest_id and resolved_at is null) then
      raise exception 'FINAL_ROUND_UNRESOLVED';
    end if;
    v_live := now() < q.ends_at;
    update public.user_quests set completed_at = now(), live_clear = v_live, archive_active = false
    where user_id = v_uid and quest_id = p_quest_id returning * into uq;
    insert into public.xp_events (user_id, type, amount, reason, idempotency_key)
    values (v_uid, 'QUEST_COMPLETE', q.xp_reward, q.id, 'quest_complete:' || q.id)
    on conflict (user_id, idempotency_key) do nothing;
    get diagnostics v_xp = row_count;
    v_xp := v_xp * q.xp_reward;
    if v_live then
      insert into public.user_trophies (user_id, trophy_id, name, quest_id) values (v_uid, q.trophy_id, q.trophy_name, q.id)
      on conflict do nothing;
    end if;
  end if;
  -- `brainpower_earned` lists what this finish paid (empty on a repeat).
  return jsonb_build_object('quest_id', q.id, 'xp_awarded', v_xp, 'live_clear', uq.live_clear,
    'trophy', case when uq.live_clear then jsonb_build_object('trophy_id', q.trophy_id, 'name', q.trophy_name) end,
    'daily', public.daily_status_for(v_uid));
end $$;
revoke execute on function public.complete_quest(text) from public, anon;
grant execute on function public.complete_quest(text) to authenticated;

-- ── 3. submit_review (as in 20261101000000), with the daily status on a recorded first attempt ──
create or replace function public.submit_review(p_concept_id text, p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_skill text;
  v_level text;
  v_correct boolean;
  v_rationale text;
  v_wrong jsonb;
  v_explanation text;
  v_award int := (select xp_review_first_attempt from public.app_settings);
  v_xp int := 0;
  v_strength int;
  v_inserted int;
  v_relearning boolean;
  v_checked boolean;
  a public.user_review_attempts;
  rq public.review_queue;
  m public.user_concept_mastery;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;

  select q.level_id, l.skill_id, q.explanation into v_level, v_skill, v_explanation
  from public.questions q
  join public.levels l on l.id = q.level_id
  join public.question_concepts qc on qc.question_id = q.id and qc.concept_id = p_concept_id
  where q.id = p_question_id
    and exists (select 1 from public.user_level_progress ulp
                where ulp.user_id = v_uid and ulp.level_id = q.level_id and ulp.completed_at is not null);
  if not found then raise exception 'QUESTION_NOT_AVAILABLE'; end if;

  select g.correct, g.rationale, g.wrong into v_correct, v_rationale, v_wrong
  from public.grade_answer(p_question_id, p_option_id) g;

  -- Correcting an open occurrence: resolution only. No XP, no strength change.
  select * into a from public.user_review_attempts
  where user_id = v_uid and concept_id = p_concept_id
  order by first_attempted_at desc, occurrence desc limit 1 for update;
  if found and not a.resolved_correct and a.question_id = p_question_id then
    update public.user_review_attempts set
      attempt_count = attempt_count + 1,
      resolved_correct = v_correct,
      resolved_at = case when v_correct then now() end
    where user_id = v_uid and concept_id = p_concept_id and occurrence = a.occurrence
    returning * into a;
    if v_correct then
      update public.review_queue set priority = greatest(priority, public.review_priority(false, a.attempt_count))
      where user_id = v_uid and concept_id = p_concept_id;
    end if;
    return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', false,
      'attempt_count', a.attempt_count, 'xp_awarded', 0, 'scheduled', true,
      'rationale', case when v_correct then null else v_rationale end,
      'explanation', case when v_correct then v_explanation else null end) || public.wrong_positions(v_correct, v_wrong);
  end if;

  select * into rq from public.review_queue
  where user_id = v_uid and concept_id = p_concept_id and due_at <= now() for update;
  select * into m from public.user_concept_mastery
  where user_id = v_uid and concept_id = p_concept_id for update;

  -- Not due and nothing open: graded practice. Nothing recorded, nothing awarded
  -- (the check is noted, like a replay).
  if rq.concept_id is null or m.concept_id is null then
    insert into public.user_question_checks (user_id, question_id) values (v_uid, p_question_id)
    on conflict (user_id, question_id) do update set checked_at = now();
    return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', v_correct,
      'attempt_count', 0, 'xp_awarded', 0, 'scheduled', false,
      'rationale', case when v_correct then null else v_rationale end,
      'explanation', case when v_correct then v_explanation else null end) || public.wrong_positions(v_correct, v_wrong);
  end if;

  -- First attempt at this scheduled occurrence. XP rewards remembering after a
  -- gap, so none for the quick re-check after a missed review (relearning), or
  -- when this question was graded outside review since it came due.
  v_relearning := a.concept_id is not null and not a.first_attempt_correct;
  v_checked := exists (select 1 from public.user_question_checks
                       where user_id = v_uid and question_id = p_question_id and checked_at >= rq.due_at);
  insert into public.user_review_attempts (user_id, concept_id, occurrence, question_id, first_option_id, first_attempt_correct, resolved_correct, resolved_at)
  values (v_uid, p_concept_id, rq.due_at, p_question_id, p_option_id, v_correct, v_correct, case when v_correct then now() end);

  v_strength := case when v_correct then least(m.strength + 1, 5) else 0 end;
  update public.user_concept_mastery set
    strength = v_strength,
    seen_count = seen_count + 1,
    correct_count = correct_count + v_correct::int,
    incorrect_count = incorrect_count + (not v_correct)::int,
    last_seen_at = now()
  where user_id = v_uid and concept_id = p_concept_id;
  update public.review_queue set
    due_at = now() + public.review_interval(v_strength),
    priority = case when v_correct then 0 else greatest(priority, 1) end
  where user_id = v_uid and concept_id = p_concept_id;

  if v_correct and not v_relearning and not v_checked then
    insert into public.xp_events (user_id, type, amount, skill_id, level_id, concept_id, reason, idempotency_key)
    values (v_uid, 'DELAYED_RECALL', v_award, v_skill, v_level, p_concept_id, 'review: right on the first attempt',
            'review:' || p_concept_id || ':' || rq.due_at::text)
    on conflict (user_id, idempotency_key) do nothing;
    get diagnostics v_inserted = row_count;
    v_xp := v_award * v_inserted;
    if v_xp > 0 then
      update public.user_skill_progress set total_xp = total_xp + v_xp, updated_at = now()
      where user_id = v_uid and skill_id = v_skill;
    end if;
  end if;

  -- A recorded first attempt is a learning moment: `daily.brainpower_earned`
  -- lists what it paid (the streak's +1, a trophy).
  return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', v_correct,
    'attempt_count', 1, 'xp_awarded', v_xp, 'scheduled', true,
    'rationale', case when v_correct then null else v_rationale end,
    'explanation', case when v_correct then v_explanation else null end,
    'daily', public.daily_status_for(v_uid)) || public.wrong_positions(v_correct, v_wrong);
end $$;
