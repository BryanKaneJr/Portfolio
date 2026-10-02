-- Learning streak (owner decision 2026-09-26): consecutive days, in the
-- learner's time zone, on which they cleared a new level or answered a
-- scheduled review. Derived from those rows, never stored as a counter.
-- Missing a day resets `current`; `longest` is kept. Mirrors core `streakFrom`.

create or replace function public.learning_streak(p_user uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with tz as (
    select coalesce(timezone, 'UTC') as tz from public.profiles where id = p_user
  ), today as (
    select (now() at time zone (select tz from tz))::date as d
  ), days as (
    select (completed_at at time zone (select tz from tz))::date as d
      from public.user_level_progress where user_id = p_user and completed_at is not null
    union
    select (first_attempted_at at time zone (select tz from tz))::date
      from public.user_review_attempts where user_id = p_user
  ), runs as (
    select d, d - (row_number() over (order by d))::int as grp from days
  ), islands as (
    select max(d) as last_day, count(*)::int as n from runs group by grp
  )
  select jsonb_build_object(
    'current', coalesce((select n from islands where last_day >= (select d from today) - 1 order by last_day desc limit 1), 0),
    'longest', coalesce((select max(n) from islands), 0),
    'today', exists (select 1 from days where d = (select d from today))
  )
$$;
revoke execute on function public.learning_streak(uuid) from public, anon, authenticated;

-- get_progress gains the streak.
create or replace function public.get_progress() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_daily jsonb;
  v_tz text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  v_daily := public.daily_status_for(v_uid);
  select timezone into v_tz from public.profiles where id = v_uid;

  return jsonb_build_object(
    'skills', coalesce((
      select jsonb_object_agg(skill_id, jsonb_build_object('highest_cleared', highest_cleared, 'stars', stars, 'total_xp', total_xp))
      from public.user_skill_progress where user_id = v_uid), '{}'::jsonb),
    'completed_levels', coalesce((
      select jsonb_agg(level_id order by level_id collate "C")
      from public.user_level_progress where user_id = v_uid and completed_at is not null), '[]'::jsonb),
    'daily', v_daily,
    'knowledge_level', public.knowledge_level(
      (select coalesce(sum(highest_cleared), 0)::int from public.user_skill_progress where user_id = v_uid)),
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_events where user_id = v_uid),
    'xp_today', (select coalesce(sum(amount), 0) from public.xp_events
                 where user_id = v_uid and (created_at at time zone v_tz)::date = (v_daily ->> 'local_date')::date),
    'reviews_due', jsonb_array_length(public.get_review_queue(50)),
    'streak', public.learning_streak(v_uid)
  );
end $$;
revoke execute on function public.get_progress() from public, anon;
grant execute on function public.get_progress() to authenticated;
