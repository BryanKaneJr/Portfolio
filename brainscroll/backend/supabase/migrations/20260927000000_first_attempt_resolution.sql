-- Lesson completion: first attempt → reinforcement → correct resolution → progression.
--
-- * Every attempt at a question in the level being played goes through
--   answer_question(). The FIRST attempt is stored once and never replaced, so
--   restarting a level can't improve its score.
-- * A wrong answer is corrected in context (the app shows the question's source
--   cards); complete_level() refuses until every question is resolved.
-- * Completion XP comes only from first-attempt accuracy (level_xp_curve):
--   regular 3/3 → 100, 2/3 → 70, 1/3 → 35, 0/3 → 15. Corrections add no XP.
-- * Missed concepts get higher review priority and come back sooner.
-- * Learners no longer receive answer keys: bundles are stripped of `correct`,
--   `rationale` and `explanation`, and grading happens here.
--
-- Mirrors packages/core/src/completion.ts (answerQuestion / completeLevel) and
-- LEARNING_STRUCTURE[type].firstAttemptXp in constants.ts.

-- ─────────────────────────────────────────────────────────────────────────────
-- XP curve by level type (mirrors STANDARD_FIRST_ATTEMPT_XP)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.level_xp_curve (
  level_type text not null check (level_type in ('regular', 'checkpoint', 'milestone', 'mastery')),
  min_share numeric(5, 4) not null check (min_share between 0 and 1),
  xp int not null check (xp > 0),
  outcome text not null check (outcome in ('perfect', 'strong', 'reinforced', 'heavily_reinforced')),
  primary key (level_type, min_share)
);

-- Regular levels use the standard curve. Checkpoint/milestone/mastery use it
-- provisionally (by share of questions) until their own rules are decided.
insert into public.level_xp_curve (level_type, min_share, xp, outcome)
select t, b.min_share, b.xp, b.outcome
from unnest(array['regular', 'checkpoint', 'milestone', 'mastery']) t
cross join (values (1.0, 100, 'perfect'), (0.6666, 70, 'strong'), (0.3333, 35, 'reinforced'), (0.0, 15, 'heavily_reinforced'))
  as b(min_share, xp, outcome);

alter table public.level_xp_curve enable row level security;
create policy "read xp curve" on public.level_xp_curve for select using (true);

create or replace function public.first_attempt_band(p_type text, p_first_correct int, p_total int)
returns public.level_xp_curve
language sql stable security definer set search_path = public, pg_temp as $$
  select c.* from public.level_xp_curve c
  where c.level_type = p_type
    and (case when p_total > 0 then p_first_correct::numeric / p_total else 1 end) >= c.min_share
  order by c.min_share desc
  limit 1
$$;

-- The old per-question bonus is retired: first-attempt accuracy sets level XP.
alter table public.app_settings
  drop column xp_level_complete,
  drop column xp_question_correct,
  drop column xp_question_correct_cap;

-- ─────────────────────────────────────────────────────────────────────────────
-- Attempts (one row per learner per question; first attempt immutable)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.user_question_attempts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  level_id text not null references public.levels (id),
  first_option_id text not null,
  first_attempt_correct boolean not null,
  attempt_count int not null default 1 check (attempt_count >= 1),
  resolved_correct boolean not null,
  first_attempt_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (user_id, question_id)
);
create index on public.user_question_attempts (user_id, level_id);

alter table public.user_question_attempts enable row level security;
create policy "own attempts" on public.user_question_attempts for select using (user_id = auth.uid());

-- 0 got it first time · 1 missed once · 2 missed repeatedly (mirrors reviewPriority()).
create or replace function public.review_priority(p_first_correct boolean, p_attempts int) returns int
language sql immutable as $$
  select case when p_first_correct then 0 when p_attempts <= 2 then 1 else 2 end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Learner bundles: no answer keys leave the server
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.learner_bundle(b jsonb) returns jsonb
language sql immutable as $$
  select case when b ? 'questions' then
    jsonb_set(b, '{questions}', coalesce((
      select jsonb_agg(
        (q - 'explanation') || jsonb_build_object('options', coalesce((
          select jsonb_agg(o - 'correct' - 'rationale' order by oi)
          from jsonb_array_elements(q -> 'options') with ordinality as oo(o, oi)), '[]'::jsonb))
        order by qi)
      from jsonb_array_elements(b -> 'questions') with ordinality as qq(q, qi)), '[]'::jsonb))
  else b end
$$;

-- Content with answers is readable only through the functions above/below.
drop policy "read published revisions" on public.level_revisions;
drop policy "read published questions" on public.questions;
drop policy "read answer options" on public.answer_options;

create or replace function public.get_level_bundles(p_level_ids text[]) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_object_agg(l.id, public.learner_bundle(r.bundle)), '{}'::jsonb)
  from public.levels l
  join public.level_revisions r on r.level_id = l.id and r.revision = l.current_revision
  where l.id = any (p_level_ids) and l.status = 'published'
$$;

create or replace function public.start_level(p_level_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_level public.levels;
  v_cleared int;
  v_daily jsonb;
  v_bundle jsonb;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  select * into v_level from public.levels where id = p_level_id;
  if not found or v_level.status <> 'published' or v_level.current_revision is null then
    return jsonb_build_object('allowed', false, 'reason', 'LEVEL_NOT_AVAILABLE');
  end if;

  select public.learner_bundle(bundle) into v_bundle from public.level_revisions
  where level_id = p_level_id and revision = v_level.current_revision;

  -- Replaying a cleared level is always allowed and never costs allowance.
  if exists (select 1 from public.user_level_progress where user_id = v_uid and level_id = p_level_id and completed_at is not null) then
    return jsonb_build_object('allowed', true, 'reason', 'REPLAY', 'revision', v_level.current_revision, 'bundle', v_bundle);
  end if;

  select coalesce((select highest_cleared from public.user_skill_progress where user_id = v_uid and skill_id = v_level.skill_id), 0)
    into v_cleared;
  if v_level.number <> v_cleared + 1 then
    return jsonb_build_object('allowed', false, 'reason', 'LEVEL_LOCKED');
  end if;

  v_daily := public.daily_status_for(v_uid);
  if (v_daily ->> 'daily_complete')::boolean then
    return jsonb_build_object('allowed', false, 'reason', 'DAILY_COMPLETE', 'daily', v_daily);
  end if;

  insert into public.user_level_progress (user_id, level_id, started_revision)
  values (v_uid, p_level_id, v_level.current_revision)
  on conflict (user_id, level_id) do update set started_at = now(), started_revision = excluded.started_revision;

  return jsonb_build_object('allowed', true, 'reason', 'NEW', 'revision', v_level.current_revision, 'bundle', v_bundle, 'daily', v_daily);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- answer_question: grade one attempt; record the first one immutably
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Returns { correct, resolved, first_attempt_correct, attempt_count,
--           rationale (wrong answers), explanation (once resolved) }.
-- Replays of completed levels are graded but not recorded.

create or replace function public.answer_question(p_level_id text, p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_level public.levels;
  v_cleared int;
  v_correct boolean;
  v_rationale text;
  v_explanation text;
  a public.user_question_attempts;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  select * into v_level from public.levels where id = p_level_id;
  if not found or v_level.status <> 'published' then raise exception 'LEVEL_NOT_AVAILABLE'; end if;
  select explanation into v_explanation from public.questions where id = p_question_id and level_id = p_level_id;
  if not found then raise exception 'QUESTION_NOT_IN_LEVEL'; end if;

  select coalesce(o.correct, false), o.rationale into v_correct, v_rationale
  from (select 1) one
  left join public.answer_options o on o.question_id = p_question_id and o.option_id = p_option_id;

  -- Replays: grade only.
  if exists (select 1 from public.user_level_progress where user_id = v_uid and level_id = p_level_id and completed_at is not null) then
    return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', v_correct, 'attempt_count', 0,
      'rationale', case when v_correct then null else v_rationale end,
      'explanation', case when v_correct then v_explanation else null end);
  end if;

  perform 1 from public.profiles where id = v_uid for update;
  select coalesce((select highest_cleared from public.user_skill_progress where user_id = v_uid and skill_id = v_level.skill_id), 0)
    into v_cleared;
  if v_level.number <> v_cleared + 1 then raise exception 'LEVEL_LOCKED'; end if;

  insert into public.user_question_attempts (user_id, question_id, level_id, first_option_id, first_attempt_correct, resolved_correct, resolved_at)
  values (v_uid, p_question_id, p_level_id, p_option_id, v_correct, v_correct, case when v_correct then now() end)
  on conflict (user_id, question_id) do update set
    -- The first attempt never changes. Later attempts count until resolved; then nothing changes.
    attempt_count = user_question_attempts.attempt_count + (not user_question_attempts.resolved_correct)::int,
    resolved_correct = user_question_attempts.resolved_correct or excluded.resolved_correct,
    resolved_at = coalesce(user_question_attempts.resolved_at, excluded.resolved_at)
  returning * into a;

  return jsonb_build_object(
    'correct', v_correct,
    'resolved', a.resolved_correct,
    'first_attempt_correct', a.first_attempt_correct,
    'attempt_count', a.attempt_count,
    'rationale', case when v_correct then null else v_rationale end,
    'explanation', case when v_correct then v_explanation else null end
  );
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- complete_level: resolved questions required; XP from first attempts only
-- ─────────────────────────────────────────────────────────────────────────────

drop function public.complete_level(text, int, jsonb, uuid);

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
  v_xp := v_band.xp + case when v_is_mastery then s.xp_mastery_clear else 0 end;

  insert into public.xp_events (user_id, type, amount, skill_id, level_id, reason, idempotency_key) values
    (v_uid, 'LEVEL_COMPLETE', v_band.xp, v_level.skill_id, p_level_id,
     'first attempt ' || v_first || '/' || v_total || ' (' || v_band.outcome || ')', 'level_complete:' || p_level_id);
  if v_is_mastery then
    insert into public.xp_events (user_id, type, amount, skill_id, level_id, reason, idempotency_key) values
      (v_uid, 'MASTERY_CLEAR', s.xp_mastery_clear, v_level.skill_id, p_level_id, 'mastery checkpoint', 'mastery:' || p_level_id);
  end if;

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

comment on column public.user_level_progress.correct_count is 'Questions answered correctly on the FIRST attempt (sets the XP).';

-- ─────────────────────────────────────────────────────────────────────────────
-- Review: priority first; a correct review clears it, a miss keeps it ≥ 1
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_review_queue(p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_items jsonb := '[]'::jsonb;
  v_used text[] := '{}';
  r record;
  v_n int;
  v_pick record;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;

  for r in
    select rq.concept_id, m.seen_count
    from public.review_queue rq
    join public.user_concept_mastery m on m.user_id = rq.user_id and m.concept_id = rq.concept_id
    where rq.user_id = v_uid and rq.due_at <= now()
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

create or replace function public.submit_review(p_question_id text, p_option_id text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_skill text;
  v_level text;
  v_correct boolean;
  v_xp int := 0;
  v_refreshed text[] := '{}';
  v_strength int;
  v_inserted int;
  v_award int := (select xp_delayed_recall from public.app_settings);
  m record;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  perform 1 from public.profiles where id = v_uid for update;

  select q.level_id, l.skill_id into v_level, v_skill
  from public.questions q join public.levels l on l.id = q.level_id
  where q.id = p_question_id
    and exists (select 1 from public.user_level_progress ulp
                where ulp.user_id = v_uid and ulp.level_id = q.level_id and ulp.completed_at is not null);
  if not found then raise exception 'QUESTION_NOT_AVAILABLE'; end if;

  select coalesce((select correct from public.answer_options where question_id = p_question_id and option_id = p_option_id), false)
    into v_correct;

  for m in
    select um.concept_id, um.strength, um.last_seen_at
    from public.question_concepts qc
    join public.user_concept_mastery um on um.user_id = v_uid and um.concept_id = qc.concept_id
    join public.review_queue rq on rq.user_id = v_uid and rq.concept_id = qc.concept_id
    where qc.question_id = p_question_id and rq.due_at <= now()
    order by qc.concept_id collate "C"
    for update of um, rq
  loop
    v_refreshed := v_refreshed || m.concept_id;

    if v_correct and now() - m.last_seen_at >= interval '20 hours' then
      insert into public.xp_events (user_id, type, amount, skill_id, level_id, concept_id, reason, idempotency_key)
      values (v_uid, 'DELAYED_RECALL', v_award, v_skill, v_level, m.concept_id, 'delayed recall',
              'delayed_recall:' || m.concept_id || ':' || m.last_seen_at::text)
      on conflict (user_id, idempotency_key) do nothing;
      get diagnostics v_inserted = row_count;
      v_xp := v_xp + v_award * v_inserted;
    end if;

    v_strength := case when v_correct then least(m.strength + 1, 5) else 0 end;
    update public.user_concept_mastery set
      strength = v_strength,
      seen_count = seen_count + 1,
      correct_count = correct_count + v_correct::int,
      incorrect_count = incorrect_count + (not v_correct)::int,
      last_seen_at = now()
    where user_id = v_uid and concept_id = m.concept_id;
    update public.review_queue set
      due_at = now() + public.review_interval(v_strength),
      priority = case when v_correct then 0 else greatest(priority, 1) end
    where user_id = v_uid and concept_id = m.concept_id;
  end loop;

  if v_xp > 0 then
    update public.user_skill_progress set total_xp = total_xp + v_xp, updated_at = now()
    where user_id = v_uid and skill_id = v_skill;
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'xp_awarded', v_xp,
    'refreshed', to_jsonb(v_refreshed),
    'correct_option_id', (select option_id from public.answer_options where question_id = p_question_id and correct),
    'explanation', (select explanation from public.questions where id = p_question_id)
  );
end $$;

revoke execute on function public.answer_question(text, text, text) from public, anon;
revoke execute on function public.complete_level(text, int, uuid) from public, anon;
revoke execute on function public.first_attempt_band(text, int, int) from public, anon, authenticated;
grant execute on function public.answer_question(text, text, text) to authenticated;
grant execute on function public.complete_level(text, int, uuid) to authenticated;
grant execute on function public.get_level_bundles(text[]) to anon, authenticated;
