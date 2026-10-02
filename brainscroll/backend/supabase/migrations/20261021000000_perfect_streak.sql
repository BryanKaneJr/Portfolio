-- Perfect streak (owner, 2026-10-01). A level cleared with every question
-- right on the first try, straight after other perfect levels, pays more: the
-- 2nd in a row 1.1x, the 3rd 1.2x, up to +50%. Only first clears count:
-- reviews, chapter reviews and quests neither build nor break it. A clear
-- with a miss resets it. The bonus is part of the level's LEVEL_COMPLETE
-- event, so the ledger stays one row per level and nothing is stored twice:
-- the streak is derived from user_level_progress.
-- Mirrors XP.PERFECT_STREAK_* and perfectStreakBefore / perfectStreakBonus (core).

alter table public.app_settings
  add column perfect_streak_step_percent int not null default 10,
  add column perfect_streak_max_percent int not null default 50;
comment on column public.app_settings.perfect_streak_step_percent is 'Extra XP per earlier perfect level in a row, in percent. Mirrors XP.PERFECT_STREAK_STEP_PERCENT (core).';
comment on column public.app_settings.perfect_streak_max_percent is 'Most extra XP the perfect streak pays, in percent. Mirrors XP.PERFECT_STREAK_MAX_PERCENT (core).';

-- Perfect first clears after the latest first clear with a miss.
create or replace function public.perfect_streak_before(p_uid uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::int from public.user_level_progress p
  where p.user_id = p_uid and p.completed_at is not null and p.correct_count >= p.question_count
    and p.completed_at > coalesce((
      select max(m.completed_at) from public.user_level_progress m
      where m.user_id = p_uid and m.completed_at is not null and m.correct_count < m.question_count
    ), '-infinity'::timestamptz)
$$;
revoke execute on function public.perfect_streak_before(uuid) from public, anon, authenticated;

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
  v_perfect_before int := 0;
  v_streak_percent int := 0;
  v_streak_bonus int := 0;
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
  -- Perfect streak: a perfect level straight after other perfect ones pays extra, in the same event.
  if v_first >= v_total then
    v_perfect_before := public.perfect_streak_before(v_uid);
    v_streak_percent := least(v_perfect_before * s.perfect_streak_step_percent, s.perfect_streak_max_percent);
    v_streak_bonus := (v_band.xp * v_streak_percent + 50) / 100;
    v_xp := v_xp + v_streak_bonus;
  end if;

  insert into public.xp_events (user_id, type, amount, skill_id, level_id, reason, idempotency_key) values
    (v_uid, 'LEVEL_COMPLETE', v_xp, v_level.skill_id, p_level_id,
     'first attempt ' || v_first || '/' || v_total || ' (' || v_band.outcome || ')'
       || case when v_streak_bonus > 0 then ', perfect streak +' || v_streak_percent || '%' else '' end,
     'level_complete:' || p_level_id);

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
    'mastery_cleared', v_is_mastery,
    'perfect_streak', case when v_first >= v_total then v_perfect_before + 1 else 0 end,
    'perfect_streak_percent', v_streak_percent,
    'perfect_streak_bonus_xp', v_streak_bonus
  );
end $$;
