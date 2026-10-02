-- Hardening from the 2026-09-26 security review (docs/security-review.md).
--
-- 1. Checking answers before a review. Replays of finished levels and
--    practice on concepts that aren't due are graded but not recorded, so a
--    learner could grade every option and then submit the right one as a
--    review "first attempt". Those checks are now noted, and a review first
--    attempt at that question after it came due earns no XP.
-- 2. Missing on purpose. A missed review comes back 10 minutes later; a right
--    answer then earned +10 XP, so missing deliberately paid more than
--    remembering. That relearning occurrence now earns no XP.
-- 3. Content corrections failed to import once anyone had reviewed a removed
--    question (the review-attempt foreign key didn't cascade).
-- 4. Changing time zone reset the daily allowance. It now changes only through
--    update_profile, at most once a day.
-- 5. Store sandbox purchases granted real Unlimited. They're ignored unless
--    app_settings.allow_sandbox_purchases is on (staging).
-- 6. Analytics: a malformed timestamp aborted the whole batch, and any prop
--    key was stored. Timestamps are parsed safely and only declared keys kept.
-- 7. Display names are capped at 60 characters.

-- ─── 1 + 2. Review XP integrity ─────────────────────────────────────────────
create table public.user_question_checks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.user_question_checks enable row level security;
-- No policies: written and read only inside answer_question / submit_review.

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

  -- Replays: grade only, but note the check (a review of this question right
  -- after earns no XP: see submit_review).
  if exists (select 1 from public.user_level_progress where user_id = v_uid and level_id = p_level_id and completed_at is not null) then
    insert into public.user_question_checks (user_id, question_id) values (v_uid, p_question_id)
    on conflict (user_id, question_id) do update set checked_at = now();
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

  -- Not due and nothing open: graded practice. Nothing recorded, nothing awarded
  -- (the check is noted, like a replay).
  if rq.concept_id is null or m.concept_id is null then
    insert into public.user_question_checks (user_id, question_id) values (v_uid, p_question_id)
    on conflict (user_id, question_id) do update set checked_at = now();
    return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', v_correct,
      'attempt_count', 0, 'xp_awarded', 0, 'scheduled', false,
      'rationale', case when v_correct then null else v_rationale end,
      'explanation', case when v_correct then v_explanation else null end);
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

  return jsonb_build_object('correct', v_correct, 'resolved', v_correct, 'first_attempt_correct', v_correct,
    'attempt_count', 1, 'xp_awarded', v_xp, 'scheduled', true,
    'rationale', case when v_correct then null else v_rationale end,
    'explanation', case when v_correct then v_explanation else null end);
end $$;

-- ─── 3. Content corrections ──────────────────────────────────────────────────
alter table public.user_review_attempts drop constraint user_review_attempts_question_id_fkey;
alter table public.user_review_attempts
  add constraint user_review_attempts_question_id_fkey foreign key (question_id) references public.questions (id) on delete cascade;

-- ─── 4. Time zone changes ────────────────────────────────────────────────────
alter table public.profiles add column timezone_changed_at timestamptz;
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create or replace function public.update_profile(p_timezone text default null, p_display_name text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  p public.profiles;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  select * into p from public.profiles where id = auth.uid() for update;
  -- The time zone defines the learner's day for the daily allowance, so it can
  -- change at most once a day (a trip, not a trick). Other calls keep it.
  if p_timezone is not null and p_timezone <> p.timezone
     and (p.timezone_changed_at is null or p.timezone_changed_at < now() - interval '1 day') then
    update public.profiles set timezone = p_timezone, timezone_changed_at = now() where id = p.id;
  end if;
  if p_display_name is not null then
    update public.profiles set display_name = p_display_name where id = p.id;
  end if;
end $$;

-- ─── 5. Sandbox purchases ────────────────────────────────────────────────────
alter table public.app_settings add column allow_sandbox_purchases boolean not null default false;

create or replace function public.apply_revenuecat_event_checked(p_event jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if upper(coalesce(p_event->>'environment', 'PRODUCTION')) = 'SANDBOX'
     and not (select allow_sandbox_purchases from public.app_settings) then
    return jsonb_build_object('applied', false, 'reason', 'sandbox');
  end if;
  return public.apply_revenuecat_event(p_event);
end $$;
revoke execute on function public.apply_revenuecat_event_checked(jsonb) from public, anon, authenticated;
grant execute on function public.apply_revenuecat_event_checked(jsonb) to service_role;

-- ─── 6. Analytics ────────────────────────────────────────────────────────────
alter table public.analytics_event_names add column prop_keys text[] not null default '{}';
update public.analytics_event_names set prop_keys = array['backend']::text[] where name = 'app_open';
update public.analytics_event_names set prop_keys = array['step']::text[] where name = 'onboarding_step';
update public.analytics_event_names set prop_keys = array['level_id', 'card_index', 'card_count']::text[] where name = 'level_exit';
update public.analytics_event_names set prop_keys = array['used', 'cap']::text[] where name = 'daily_complete_seen';
update public.analytics_event_names set prop_keys = array['method']::text[] where name = 'sign_in_started';
update public.analytics_event_names set prop_keys = array['method']::text[] where name = 'sign_in_completed';
update public.analytics_event_names set prop_keys = array['object_type']::text[] where name = 'report_opened';
update public.analytics_event_names set prop_keys = array['from']::text[] where name = 'paywall_viewed';
update public.analytics_event_names set prop_keys = array['plan']::text[] where name = 'purchase_started';
update public.analytics_event_names set prop_keys = array['plan']::text[] where name = 'subscription_started';
update public.analytics_event_names set prop_keys = array['found']::text[] where name = 'purchase_restored';

create or replace function public.try_timestamptz(p text) returns timestamptz
language plpgsql immutable as $$
begin
  return p::timestamptz;
exception when others then
  return null;
end $$;

create or replace function public.log_events(p_events jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_event jsonb;
  v_accepted int := 0;
  v_rejected int := 0;
  v_today int;
  v_props jsonb;
  v_keys text[];
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if jsonb_typeof(p_events) <> 'array' then raise exception 'EVENTS_MUST_BE_ARRAY'; end if;
  if jsonb_array_length(p_events) > 50 then raise exception 'TOO_MANY_EVENTS'; end if;
  select count(*) into v_today from public.analytics_events where user_id = v_user and created_at > now() - interval '1 day';

  for v_event in select * from jsonb_array_elements(p_events) loop
    v_props := coalesce(v_event -> 'props', '{}');
    select prop_keys into v_keys from public.analytics_event_names where name = v_event ->> 'name';
    if v_today + v_accepted >= 500                                            -- daily budget per learner
       or v_keys is null                                                      -- not an allowlisted event
       or jsonb_typeof(v_props) <> 'object'
       or pg_column_size(v_props) > 1024
       or exists (select 1 from jsonb_each(v_props) e where jsonb_typeof(e.value) in ('object', 'array'))
    then
      v_rejected := v_rejected + 1;
      continue;
    end if;
    -- Only the event's declared props are stored (never an email someone slipped in).
    select coalesce(jsonb_object_agg(key, value), '{}') into v_props from jsonb_each(v_props) where key = any (v_keys);
    insert into public.analytics_events (user_id, name, props, client_at)
    values (v_user, v_event ->> 'name', v_props, public.try_timestamptz(v_event ->> 'at'));
    v_accepted := v_accepted + 1;
  end loop;
  return jsonb_build_object('accepted', v_accepted, 'rejected', v_rejected);
end $$;

-- ─── 7. Display names ────────────────────────────────────────────────────────
update public.profiles set display_name = left(display_name, 60) where char_length(display_name) > 60;
alter table public.profiles add constraint profiles_display_name_length check (char_length(display_name) <= 60);
