-- Encounter XP pools, the mastery star, and review corrections.
--
-- * Checkpoint, milestone and Mastery Challenge levels get their own XP pools
--   (level_xp_curve), by share of questions right on the first attempt:
--     regular     3/3 100 · 2/3 70 · 1/3 35 · 0/3 15            (unchanged)
--     checkpoint  5/5 150 · 4/5 105 · 3/5 60 · 0–2/5 25
--     milestone   7/7 250 · 6/7 175 · 4–5/7 90 · 0–3/7 40
--     mastery     10/10 500 · 8–9/10 350 · 5–7/10 175 · 0–4/10 75
--   Initial balancing numbers: tune them here (and in constants.ts), never in the UI.
-- * The separate +250 MASTERY_CLEAR bonus is retired. The ★ at level 100·k is
--   earned by resolving every question, with no minimum first-attempt score.
-- * Review: the first attempt at a scheduled review occurrence is recorded
--   once. Right → +10 XP (DELAYED_RECALL, once per occurrence), strength up.
--   Wrong → 0 XP, strength 0, due again soon, priority ≥ 1; the item must then
--   be corrected (the app shows its source cards) and corrections earn nothing.
--   The old 20-hour "delayed recall" rule and its +5 are gone, and the
--   response no longer reveals the right answer.
--
-- Mirrors packages/core/src/constants.ts (LEARNING_STRUCTURE[type].firstAttemptXp,
-- XP.REVIEW_FIRST_ATTEMPT) and completion.ts (completeLevel, buildReviewQueue, submitReview).

-- ─────────────────────────────────────────────────────────────────────────────
-- Encounter XP pools
-- ─────────────────────────────────────────────────────────────────────────────

delete from public.level_xp_curve where level_type in ('checkpoint', 'milestone', 'mastery');
insert into public.level_xp_curve (level_type, min_share, xp, outcome) values
  ('checkpoint', 1.0,    150, 'perfect'),
  ('checkpoint', 0.8,    105, 'strong'),
  ('checkpoint', 0.6,     60, 'reinforced'),
  ('checkpoint', 0.0,     25, 'heavily_reinforced'),
  ('milestone',  1.0,    250, 'perfect'),
  ('milestone',  0.8571, 175, 'strong'),      -- 6/7
  ('milestone',  0.5714,  90, 'reinforced'),  -- 4/7
  ('milestone',  0.0,     40, 'heavily_reinforced'),
  ('mastery',    1.0,    500, 'perfect'),
  ('mastery',    0.8,    350, 'strong'),
  ('mastery',    0.5,    175, 'reinforced'),
  ('mastery',    0.0,     75, 'heavily_reinforced');

comment on table public.level_xp_curve is
  'Completion XP by level type and first-attempt share. Mirrors LEARNING_STRUCTURE[type].firstAttemptXp. Initial balancing numbers.';

-- ─────────────────────────────────────────────────────────────────────────────
-- complete_level: no separate mastery bonus; the ★ comes from resolution
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.complete_level(p_level_id text, p_revision int, p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  s public.app_settings;
  v_level public.levels;
  v_cleared int;
  v_daily jsonb;
  v_date date;
  v_total int;
  v_first int;
  v_band public.level_xp_curve;
  v_xp int;
  v_is_mastery boolean;
  v_reinforced jsonb;
  prior public.user_level_progress;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023'; end if;

  -- Serialize this user's completions so double taps can't race.
  perform 1 from public.profiles where id = v_uid for update;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into s from public.app_settings;
  select * into v_level from public.levels where id = p_level_id;
  if not found or v_level.status <> 'published' then raise exception 'LEVEL_NOT_AVAILABLE'; end if;
  if not exists (select 1 from public.level_revisions where level_id = p_level_id and revision = p_revision) then
    raise exception 'REVISION_NOT_FOUND';
  end if;
  select count(*) into v_total from public.questions where level_id = p_level_id;

  -- Exactly once: a second completion (same or different key) awards nothing.
  select * into prior from public.user_level_progress where user_id = v_uid and level_id = p_level_id and completed_at is not null;
  if found then
    return public.progress_summary(v_uid, v_level.skill_id) || jsonb_build_object(
      'level_id', p_level_id, 'already_completed', true, 'xp_awarded', 0,
      'first_attempt_correct', prior.correct_count, 'total', prior.question_count,
      'outcome', (public.first_attempt_band(v_level.level_type, prior.correct_count, prior.question_count)).outcome,
      'reinforced_concept_ids', '[]'::jsonb);
  end if;

  insert into public.user_skill_progress (user_id, skill_id) values (v_uid, v_level.skill_id) on conflict do nothing;
  select highest_cleared into v_cleared from public.user_skill_progress
  where user_id = v_uid and skill_id = v_level.skill_id for update;
  if v_level.number <> v_cleared + 1 then raise exception 'LEVEL_LOCKED'; end if;

  v_daily := public.daily_status_for(v_uid);
  if (v_daily ->> 'daily_complete')::boolean then raise exception 'DAILY_LIMIT_REACHED'; end if;
  v_date := (v_daily ->> 'local_date')::date;

  -- A level isn't complete until every question has been answered correctly.
  if exists (
    select 1 from public.questions q
    left join public.user_question_attempts a on a.user_id = v_uid and a.question_id = q.id
    where q.level_id = p_level_id and not coalesce(a.resolved_correct, false)
  ) then
    raise exception 'UNRESOLVED_QUESTIONS';
  end if;

  select count(*) filter (where a.first_attempt_correct) into v_first
  from public.questions q join public.user_question_attempts a on a.user_id = v_uid and a.question_id = q.id
  where q.level_id = p_level_id;

  -- Concepts first seen in this level: tested ones start at 0, untested at 1 (due tomorrow).
  insert into public.user_concept_mastery (user_id, concept_id, strength)
  select v_uid, lc.concept_id,
         case when exists (select 1 from public.question_concepts qc join public.questions qq on qq.id = qc.question_id
                           where qq.level_id = p_level_id and qc.concept_id = lc.concept_id) then 0 else 1 end
  from public.level_concepts lc where lc.level_id = p_level_id
  on conflict do nothing;

  -- Mastery from FIRST attempts (in question order, like the core engine).
  declare
    q record;
  begin
    for q in
      select qc.concept_id, a.first_attempt_correct as ok
      from public.questions qq
      join public.user_question_attempts a on a.user_id = v_uid and a.question_id = qq.id
      join public.question_concepts qc on qc.question_id = qq.id
      where qq.level_id = p_level_id
      order by qq.id collate "C", qc.concept_id collate "C"
    loop
      update public.user_concept_mastery m set
        strength = case when q.ok then least(m.strength + 1, 5) else 0 end,
        correct_count = m.correct_count + q.ok::int,
        incorrect_count = m.incorrect_count + (not q.ok)::int
      where m.user_id = v_uid and m.concept_id = q.concept_id;
    end loop;
  end;

  update public.user_concept_mastery m set seen_count = m.seen_count + 1, last_seen_at = now()
  from public.level_concepts lc
  where lc.level_id = p_level_id and m.user_id = v_uid and m.concept_id = lc.concept_id;

  -- Review priority per concept: the worst result among this level's questions on it.
  with prio as (
    select lc.concept_id,
           coalesce(max(case when a.question_id is not null
                             then public.review_priority(a.first_attempt_correct, a.attempt_count) end), 0) as p
    from public.level_concepts lc
    left join public.question_concepts qc on qc.concept_id = lc.concept_id
    left join public.questions qq on qq.id = qc.question_id and qq.level_id = p_level_id
    left join public.user_question_attempts a on a.user_id = v_uid and a.question_id = qq.id
    where lc.level_id = p_level_id
    group by lc.concept_id
  )
  insert into public.review_queue (user_id, concept_id, due_at, priority)
  select v_uid, m.concept_id,
         case when prio.p >= 2 then now() else now() + public.review_interval(m.strength) end,
         prio.p
  from public.user_concept_mastery m join prio on prio.concept_id = m.concept_id
  where m.user_id = v_uid
  on conflict (user_id, concept_id) do update set
    due_at = excluded.due_at,
    priority = greatest(public.review_queue.priority, excluded.priority);

  select coalesce(jsonb_agg(distinct qc.concept_id), '[]'::jsonb) into v_reinforced
  from public.questions qq
  join public.user_question_attempts a on a.user_id = v_uid and a.question_id = qq.id and not a.first_attempt_correct
  join public.question_concepts qc on qc.question_id = qq.id
  where qq.level_id = p_level_id;

  -- XP ledger: one LEVEL_COMPLETE event from first-attempt accuracy; corrections add nothing.
  v_band := public.first_attempt_band(v_level.level_type, v_first, v_total);
  v_is_mastery := v_level.number % s.mastery_band_size = 0;
  -- The ★ is earned by resolving the level, whatever the first-attempt score. No separate bonus.
  v_xp := v_band.xp;

  insert into public.xp_events (user_id, type, amount, skill_id, level_id, reason, idempotency_key) values
    (v_uid, 'LEVEL_COMPLETE', v_band.xp, v_level.skill_id, p_level_id,
     'first attempt ' || v_first || '/' || v_total || ' (' || v_band.outcome || ')', 'level_complete:' || p_level_id);

  update public.user_skill_progress set
    highest_cleared = v_level.number,
    stars = v_level.number / s.mastery_band_size,
    total_xp = total_xp + v_xp,
    updated_at = now()
  where user_id = v_uid and skill_id = v_level.skill_id;

  insert into public.user_level_progress (user_id, level_id, completed_at, completed_revision, correct_count, question_count, idempotency_key, started_revision)
  values (v_uid, p_level_id, now(), p_revision, v_first, v_total, p_idempotency_key, p_revision)
  on conflict (user_id, level_id) do update set
    completed_at = excluded.completed_at,
    completed_revision = excluded.completed_revision,
    correct_count = excluded.correct_count,
    question_count = excluded.question_count,
    idempotency_key = excluded.idempotency_key;

  insert into public.daily_allowances (user_id, local_date, new_levels_used) values (v_uid, v_date, 1)
  on conflict (user_id, local_date) do update set new_levels_used = public.daily_allowances.new_levels_used + 1;

  return public.progress_summary(v_uid, v_level.skill_id) || jsonb_build_object(
    'level_id', p_level_id,
    'already_completed', false,
    'skill_level_before', v_cleared,
    'first_attempt_correct', v_first,
    'total', v_total,
    'outcome', v_band.outcome,
    'reinforced_concept_ids', v_reinforced,
    'xp_awarded', v_xp,
    'mastery_cleared', v_is_mastery
  );
end $$;

alter table public.app_settings drop column xp_mastery_clear;
comment on column public.user_skill_progress.stars is 'Mastery stars: one per band of 100 levels completed and correctly resolved. No minimum first-attempt score.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Review: first attempt per scheduled occurrence; corrections required
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.app_settings rename column xp_delayed_recall to xp_review_first_attempt;
alter table public.app_settings alter column xp_review_first_attempt set default 10;
update public.app_settings set xp_review_first_attempt = 10;
comment on column public.app_settings.xp_review_first_attempt is
  'XP for a scheduled review item right on the first attempt, once per occurrence (XP.REVIEW_FIRST_ATTEMPT).';

-- One row per scheduled review occurrence answered. The first attempt is immutable.
create table public.user_review_attempts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  concept_id text not null references public.concepts (id),
  -- review_queue.due_at when the occurrence was first answered.
  occurrence timestamptz not null,
  question_id text not null references public.questions (id),
  first_option_id text not null,
  first_attempt_correct boolean not null,
  attempt_count int not null default 1,
  resolved_correct boolean not null,
  first_attempted_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (user_id, concept_id, occurrence)
);
alter table public.user_review_attempts enable row level security;
create policy "own review attempts" on public.user_review_attempts for select using (user_id = auth.uid());

-- The latest occurrence per concept, if its first attempt was wrong and it hasn't been corrected yet.
create or replace function public.open_review_attempts(p_uid uuid) returns setof public.user_review_attempts
language sql stable security definer set search_path = public, pg_temp as $$
  select * from (
    select distinct on (a.concept_id) a.* from public.user_review_attempts a
    where a.user_id = p_uid
    order by a.concept_id, a.first_attempted_at desc, a.occurrence desc
  ) latest
  where not latest.resolved_correct
$$;

create or replace function public.get_review_queue(p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_items jsonb := '[]'::jsonb;
  v_used text[] := '{}';
  v_open text[] := '{}';
  r record;
  v_n int;
  v_pick record;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  -- Unfinished corrections first, with the same question, so they can be resolved.
  for r in
    select o.concept_id, o.question_id, q.level_id, l.skill_id
    from public.open_review_attempts(v_uid) o
    join public.questions q on q.id = o.question_id
    join public.levels l on l.id = q.level_id
    join public.user_level_progress ulp on ulp.level_id = q.level_id and ulp.user_id = v_uid and ulp.completed_at is not null
    order by o.concept_id collate "C"
  loop
    exit when jsonb_array_length(v_items) >= p_limit;
    v_open := v_open || r.concept_id;
    v_used := v_used || r.question_id;
    v_items := v_items || jsonb_build_object(
      'concept_id', r.concept_id, 'question_id', r.question_id, 'level_id', r.level_id, 'skill_id', r.skill_id);
  end loop;

  for r in
    select rq.concept_id, m.seen_count
    from public.review_queue rq
    join public.user_concept_mastery m on m.user_id = rq.user_id and m.concept_id = rq.concept_id
    where rq.user_id = v_uid and rq.due_at <= now() and not (rq.concept_id = any (v_open))
    order by rq.priority desc, rq.due_at, rq.concept_id collate "C"
  loop
    exit when jsonb_array_length(v_items) >= p_limit;

    select count(*) into v_n
    from public.questions q
    join public.question_concepts qc on qc.question_id = q.id and qc.concept_id = r.concept_id
    join public.user_level_progress ulp on ulp.level_id = q.level_id and ulp.user_id = v_uid and ulp.completed_at is not null
    where not (q.id = any (v_used));
    continue when v_n = 0;

    select q.id, q.level_id, l.skill_id into v_pick
    from public.questions q
    join public.levels l on l.id = q.level_id
    join public.question_concepts qc on qc.question_id = q.id and qc.concept_id = r.concept_id
    join public.user_level_progress ulp on ulp.level_id = q.level_id and ulp.user_id = v_uid and ulp.completed_at is not null
    where not (q.id = any (v_used))
    order by q.id collate "C"
    offset (r.seen_count % v_n) limit 1;

    v_used := v_used || v_pick.id;
    v_items := v_items || jsonb_build_object(
      'concept_id', r.concept_id, 'question_id', v_pick.id, 'level_id', v_pick.level_id, 'skill_id', v_pick.skill_id);
  end loop;

  return v_items;
end $$;

drop function public.submit_review(text, text);

-- Returns { correct, resolved, first_attempt_correct, attempt_count, xp_awarded,
--           scheduled, rationale (wrong answers), explanation (once resolved) }.
-- Never returns the right answer: a miss must be corrected.
create or replace function public.submit_review(p_concept_id text, p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_skill text;
  v_level text;
  v_correct boolean;
  v_rationale text;
  v_explanation text;
  v_award int := (select xp_review_first_attempt from public.app_settings);
  v_xp int := 0;
  v_strength int;
  v_inserted int;
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

  select coalesce(o.correct, false), o.rationale into v_correct, v_rationale
  from (select 1) one
  left join public.answer_options o on o.question_id = p_question_id and o.option_id = p_option_id;

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
      'explanation', case when v_correct then v_explanation else null end);
  end if;

  select * into rq from public.review_queue
  where user_id = v_uid and concept_id = p_concept_id and due_at <= now() for update;
  select * into m from public.user_concept_mastery
  where user_id = v_uid and concept_id = p_concept_id for update;

  -- Not due and nothing open: graded practice. Nothing recorded, nothing awarded.
  if rq.concept_id is null or m.concept_id is null then
    return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', v_correct,
      'attempt_count', 0, 'xp_awarded', 0, 'scheduled', false,
      'rationale', case when v_correct then null else v_rationale end,
      'explanation', case when v_correct then v_explanation else null end);
  end if;

  -- First attempt at this scheduled occurrence.
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

  if v_correct then
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

  return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', v_correct,
    'attempt_count', 1, 'xp_awarded', v_xp, 'scheduled', true,
    'rationale', case when v_correct then null else v_rationale end,
    'explanation', case when v_correct then v_explanation else null end);
end $$;

revoke execute on function public.open_review_attempts(uuid) from public, anon, authenticated;
revoke execute on function public.submit_review(text, text, text) from public, anon;
grant execute on function public.submit_review(text, text, text) to authenticated;
