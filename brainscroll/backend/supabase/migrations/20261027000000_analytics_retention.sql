-- Analytics retention (owner, 2026-10-02; privacy policy "How long we keep it"): raw
-- analytics events are deleted after 13 months, even for accounts that are kept.
-- docs/analytics.md suggested it; the policy now promises it.
--
-- No scheduler is required: log_events purges a bounded batch on about 1 in 50 calls,
-- so the table trims itself as long as anyone uses the app. Where pg_cron is
-- available (hosted Supabase can enable it), a nightly job does the same.

create index if not exists analytics_events_created_at on public.analytics_events (created_at);

-- Deletes up to 5,000 events older than 13 months; returns how many went.
create or replace function public.purge_old_analytics() returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  delete from public.analytics_events
  where id in (select id from public.analytics_events where created_at < now() - interval '13 months' order by created_at limit 5000);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.purge_old_analytics() from public, anon, authenticated;
grant execute on function public.purge_old_analytics() to service_role;

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
  -- Retention: now and then, a batch of events older than 13 months goes (no scheduler needed).
  if random() < 0.02 then perform public.purge_old_analytics(); end if;
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

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('brainscroll-analytics-retention', '17 3 * * *', 'select public.purge_old_analytics()');
  end if;
end $$;
