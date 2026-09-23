-- Read-side RPCs for the app: one call to render Home / Skills / Profile,
-- and fetching current published level bundles (so corrections reach players
-- without an app release).

-- Everything the app shows about the signed-in learner, in one round trip.
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
    'reviews_due', jsonb_array_length(public.get_review_queue(50))
  );
end $$;

-- Current published bundle per requested level (unknown/unpublished ids are omitted).
create or replace function public.get_level_bundles(p_level_ids text[]) returns jsonb
language sql stable security invoker set search_path = public, pg_temp as $$
  select coalesce(jsonb_object_agg(l.id, r.bundle), '{}'::jsonb)
  from public.levels l
  join public.level_revisions r on r.level_id = l.id and r.revision = l.current_revision
  where l.id = any (p_level_ids) and l.status = 'published'
$$;

revoke execute on function public.get_progress() from public, anon;
grant execute on function public.get_progress() to authenticated;
grant execute on function public.get_level_bundles(text[]) to anon, authenticated;

-- Profile settings the app manages. Time zone defines the learner's local day
-- for the daily allowance; it's set from the device on sign-in.
create or replace function public.update_profile(p_timezone text default null, p_display_name text default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED' using errcode = '28000'; end if;
  update public.profiles set
    timezone = coalesce(p_timezone, timezone),
    display_name = coalesce(p_display_name, display_name)
  where id = auth.uid();
end $$;

revoke execute on function public.update_profile(text, text) from public, anon;
grant execute on function public.update_profile(text, text) to authenticated;
