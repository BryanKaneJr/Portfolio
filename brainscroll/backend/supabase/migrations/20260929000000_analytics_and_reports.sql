-- Learning analytics, product health, and content reports.
--
-- Principle: measure learning and product health, never time spent. There
-- are no session-length, time-in-app or scroll-depth metrics here, by design.
--
-- * Most signals already exist as immutable server records: first attempts
--   (user_question_attempts, incl. the first option picked), review
--   occurrences (user_review_attempts), level starts/completions, the XP
--   ledger and daily allowances. The admin_* functions below aggregate them.
-- * analytics_events holds only the few things the server can't see (where a
--   learner left an unfinished level, the onboarding funnel, the daily-cap
--   screen, the account-link funnel). Names come from an allowlist that
--   mirrors packages/core/src/analytics.ts; props are small, flat and PII-free.
-- * Content reports go through report_content(), which checks the reported
--   object belongs to the level, dedupes, and rate-limits.
-- * admin_* functions are service-role only (scripts/insights.ts → Content Admin).

-- ─────────────────────────────────────────────────────────────────────────────
-- Client events
-- ─────────────────────────────────────────────────────────────────────────────

create table public.analytics_event_names (
  name text primary key,
  description text not null
);
insert into public.analytics_event_names (name, description) values
  ('app_open', 'The app became active (counts return days, never durations)'),
  ('onboarding_step', 'An onboarding screen was completed: props.step'),
  ('level_exit', 'Left an unfinished level: props.level_id, props.card_index, props.card_count'),
  ('daily_complete_seen', 'The Daily Knowledge Complete screen was shown: props.used, props.cap'),
  ('account_link_started', 'A guest asked for a code to save progress'),
  ('account_linked', 'A guest confirmed an email (same user id)'),
  ('report_opened', 'The report form was opened: props.object_type');

create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null references public.analytics_event_names (name),
  props jsonb not null default '{}' check (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 1024),
  client_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.analytics_events (name, created_at);
create index on public.analytics_events (user_id, created_at);
alter table public.analytics_events enable row level security;
alter table public.analytics_event_names enable row level security;
create policy "read event names" on public.analytics_event_names for select using (true);
-- No select/insert policies on analytics_events: clients write only through log_events().

create or replace function public.log_events(p_events jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_event jsonb;
  v_accepted int := 0;
  v_rejected int := 0;
  v_today int;
  v_props jsonb;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if jsonb_typeof(p_events) <> 'array' then raise exception 'EVENTS_MUST_BE_ARRAY'; end if;
  if jsonb_array_length(p_events) > 50 then raise exception 'TOO_MANY_EVENTS'; end if;
  select count(*) into v_today from public.analytics_events where user_id = v_user and created_at > now() - interval '1 day';

  for v_event in select * from jsonb_array_elements(p_events) loop
    v_props := coalesce(v_event -> 'props', '{}');
    if v_today + v_accepted >= 500                                            -- daily budget per learner
       or not exists (select 1 from public.analytics_event_names where name = v_event ->> 'name')
       or jsonb_typeof(v_props) <> 'object'
       or pg_column_size(v_props) > 1024
       or exists (select 1 from jsonb_each(v_props) e where jsonb_typeof(e.value) in ('object', 'array'))
    then
      v_rejected := v_rejected + 1;
      continue;
    end if;
    insert into public.analytics_events (user_id, name, props, client_at)
    values (v_user, v_event ->> 'name', v_props,
            case when (v_event ->> 'at') ~ '^\d{4}-\d{2}-\d{2}T' then (v_event ->> 'at')::timestamptz end);
    v_accepted := v_accepted + 1;
  end loop;
  return jsonb_build_object('accepted', v_accepted, 'rejected', v_rejected);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Content reports
-- ─────────────────────────────────────────────────────────────────────────────

drop policy "file reports" on public.content_reports;  -- reports now go through report_content()
alter table public.content_reports add column updated_at timestamptz not null default now();
create index on public.content_reports (status, level_id);

create or replace function public.report_content(
  p_level_id text, p_revision int, p_object_type text, p_object_id text, p_category public.report_category, p_message text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  v_bundle jsonb;
  v_id uuid;
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if v_message is not null and char_length(v_message) > 1000 then raise exception 'MESSAGE_TOO_LONG'; end if;
  select bundle into v_bundle from public.level_revisions where level_id = p_level_id and revision = p_revision;
  if v_bundle is null then raise exception 'LEVEL_NOT_AVAILABLE'; end if;

  -- The reported object must belong to this level.
  if not (case p_object_type
    when 'level' then p_object_id = p_level_id
    when 'question' then exists (select 1 from public.questions where id = p_object_id and level_id = p_level_id)
    when 'card' then coalesce(v_bundle -> 'cards', '[]') @> jsonb_build_array(jsonb_build_object('id', p_object_id))
    when 'asset' then coalesce(v_bundle -> 'cards', '[]') @> jsonb_build_array(jsonb_build_object('assetId', p_object_id))
    else false
  end) then
    raise exception 'OBJECT_NOT_IN_LEVEL';
  end if;

  -- One open report per learner per object: a repeat updates it.
  select id into v_id from public.content_reports
  where user_id = v_user and object_type = p_object_type and object_id = p_object_id and status = 'open';
  if v_id is not null then
    update public.content_reports
    set category = p_category, message = coalesce(v_message, message), revision = p_revision, updated_at = now()
    where id = v_id;
    return jsonb_build_object('id', v_id, 'duplicate', true);
  end if;

  if (select count(*) from public.content_reports where user_id = v_user and created_at > now() - interval '1 day') >= 20 then
    raise exception 'REPORT_LIMIT_REACHED';
  end if;
  insert into public.content_reports (user_id, level_id, revision, object_type, object_id, category, message)
  values (v_user, p_level_id, p_revision, p_object_type, p_object_id, p_category, v_message)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'duplicate', false);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Insights (service role only)
-- ─────────────────────────────────────────────────────────────────────────────

-- Per question: how many learners met it, how often the first attempt was
-- right, which option they picked first (distractor analysis), and how the
-- same question fares later in review (delayed recall).
create or replace function public.admin_question_stats(p_skill_id text default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with qa as (
    select a.question_id, a.level_id, count(*) as learners,
           avg(a.first_attempt_correct::int)::numeric(5, 3) as first_try_rate,
           avg(a.attempt_count)::numeric(5, 2) as avg_attempts
    from public.user_question_attempts a join public.levels l on l.id = a.level_id
    where p_skill_id is null or l.skill_id = p_skill_id
    group by a.question_id, a.level_id
  ), picks as (
    select question_id, jsonb_object_agg(first_option_id, n) as first_picks
    from (select question_id, first_option_id, count(*) as n from public.user_question_attempts group by 1, 2) x
    group by question_id
  ), rv as (
    select question_id, count(*) as review_attempts, avg(first_attempt_correct::int)::numeric(5, 3) as review_first_try_rate
    from public.user_review_attempts group by question_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'question_id', qa.question_id, 'level_id', qa.level_id, 'learners', qa.learners,
    'first_try_rate', qa.first_try_rate, 'avg_attempts', qa.avg_attempts,
    'first_picks', coalesce(picks.first_picks, '{}'),
    'review_attempts', coalesce(rv.review_attempts, 0), 'review_first_try_rate', rv.review_first_try_rate
  ) order by qa.level_id, qa.question_id), '[]')
  from qa left join picks using (question_id) left join rv using (question_id)
$$;

-- Per level: starts, completions, mean first-attempt share, and where
-- learners left it unfinished (card index → exits).
create or replace function public.admin_level_funnel(p_skill_id text default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with lp as (
    select p.level_id, count(*) as started, count(p.completed_at) as completed,
           avg(p.correct_count::numeric / nullif(p.question_count, 0))::numeric(5, 3) as mean_first_try_share
    from public.user_level_progress p join public.levels l on l.id = p.level_id
    where p_skill_id is null or l.skill_id = p_skill_id
    group by p.level_id
  ), exits as (
    select level_id, jsonb_object_agg(card_index, n) as exits_by_card
    from (select props ->> 'level_id' as level_id, props ->> 'card_index' as card_index, count(*) as n
          from public.analytics_events where name = 'level_exit' group by 1, 2) x
    where level_id is not null and card_index is not null
    group by level_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'level_id', lp.level_id, 'started', lp.started, 'completed', lp.completed,
    'completion_rate', (lp.completed::numeric / nullif(lp.started, 0))::numeric(5, 3),
    'mean_first_try_share', lp.mean_first_try_share, 'exits_by_card', coalesce(exits.exits_by_card, '{}')
  ) order by lp.level_id), '[]')
  from lp left join exits using (level_id)
$$;

-- Product and learning health over a window. Return days, not minutes.
create or replace function public.admin_learning_health(p_days int default 28) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with win as (select now() - make_interval(days => p_days) as since),
  activity as (  -- one row per learner per UTC day with any learning
    select user_id, (created_at at time zone 'UTC')::date as d from public.xp_events, win where created_at >= since
    union
    select user_id, (first_attempt_at at time zone 'UTC')::date from public.user_question_attempts, win where first_attempt_at >= since
    union
    select user_id, (first_attempted_at at time zone 'UTC')::date from public.user_review_attempts, win where first_attempted_at >= since
  ), firsts as (select user_id, min(d) as d0 from activity group by user_id),
  cap as (select daily_free_new_levels as n from public.app_settings)
  select jsonb_build_object(
    'window_days', p_days,
    'active_learners', (select count(distinct user_id) from activity),
    'learning_days', (select count(*) from activity),
    'levels_completed', (select count(*) from public.xp_events, win where type = 'LEVEL_COMPLETE' and created_at >= since),
    'first_try_rate_new_levels', (select avg(first_attempt_correct::int)::numeric(5, 3) from public.user_question_attempts, win where first_attempt_at >= since),
    -- Delayed recall: right on the first try at a scheduled review. The truest learning signal here.
    'review_first_try_rate', (select avg(first_attempt_correct::int)::numeric(5, 3) from public.user_review_attempts, win where first_attempted_at >= since),
    'reviews_answered', (select count(*) from public.user_review_attempts, win where first_attempted_at >= since),
    'concept_strength_distribution', (select coalesce(jsonb_object_agg(strength, n), '{}') from (select strength, count(*) as n from public.user_concept_mastery group by strength) s),
    'days_at_daily_cap_share', (select (count(*) filter (where new_levels_used >= (select n from cap))::numeric / nullif(count(*), 0))::numeric(5, 3)
                                 from public.daily_allowances, win where local_date >= since::date and new_levels_used > 0),
    'returned_next_day_share', (select (count(*) filter (where exists (select 1 from activity a where a.user_id = f.user_id and a.d = f.d0 + 1))::numeric / nullif(count(*), 0))::numeric(5, 3)
                                 from firsts f where f.d0 < current_date - 1),
    'returned_within_7_days_share', (select (count(*) filter (where exists (select 1 from activity a where a.user_id = f.user_id and a.d between f.d0 + 1 and f.d0 + 7))::numeric / nullif(count(*), 0))::numeric(5, 3)
                                 from firsts f where f.d0 < current_date - 7),
    'saved_account_share', (select (count(*) filter (where not u.is_anonymous)::numeric / nullif(count(*), 0))::numeric(5, 3) from auth.users u),
    'open_reports', (select count(*) from public.content_reports where status = 'open')
  )
$$;

create or replace function public.admin_content_reports(p_status public.report_status default 'open') returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'level_id', level_id, 'revision', revision, 'object_type', object_type, 'object_id', object_id,
    'category', category, 'message', message, 'status', status, 'created_at', created_at, 'updated_at', updated_at
  ) order by level_id, object_id, created_at), '[]')
  from public.content_reports where p_status is null or status = p_status
$$;

create or replace function public.admin_set_report_status(p_id uuid, p_status public.report_status) returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.content_reports set status = p_status, updated_at = now() where id = p_id
$$;

revoke execute on function public.admin_question_stats(text) from public, anon, authenticated;
revoke execute on function public.admin_level_funnel(text) from public, anon, authenticated;
revoke execute on function public.admin_learning_health(int) from public, anon, authenticated;
revoke execute on function public.admin_content_reports(public.report_status) from public, anon, authenticated;
revoke execute on function public.admin_set_report_status(uuid, public.report_status) from public, anon, authenticated;
grant execute on function public.admin_question_stats(text) to service_role;
grant execute on function public.admin_level_funnel(text) to service_role;
grant execute on function public.admin_learning_health(int) to service_role;
grant execute on function public.admin_content_reports(public.report_status) to service_role;
grant execute on function public.admin_set_report_status(uuid, public.report_status) to service_role;
