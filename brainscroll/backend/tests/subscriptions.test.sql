-- Unlimited: RevenueCat events and app syncs keep entitlements in step, the
-- daily cap follows them, and only the service role can write them.
\set ON_ERROR_STOP on
\set QUIET on
\ir fixtures.sql
\o /dev/null

create function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error % but statement succeeded: %', code, sql;
exception when others then
  if sqlerrm <> code and sqlerrm not like '%' || code || '%' then raise exception 'expected error % but got: %', code, sqlerrm; end if;
end $$;

create function pg_temp.ms(t timestamptz) returns bigint language sql as $$ select (extract(epoch from t) * 1000)::bigint $$;

create function pg_temp.event(type text, user_id text, at timestamptz, expires timestamptz, extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'type', type, 'app_user_id', user_id, 'original_app_user_id', user_id,
    'entitlement_ids', jsonb_build_array('unlimited_learning'),
    'event_timestamp_ms', pg_temp.ms(at), 'expiration_at_ms', pg_temp.ms(expires),
    'product_id', 'unlimited_monthly', 'store', 'APP_STORE'
  ) || extra
$$;

create function pg_temp.cap_for(p_user uuid) returns jsonb language sql as $$ select public.daily_status_for(p_user) $$;

-- 1. Learners can't write entitlements or call the service functions.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
select pg_temp.expect_error($$select public.apply_entitlement('00000000-0000-0000-0000-00000000000a', true, null, now())$$, 'permission denied');
select pg_temp.expect_error($$select public.apply_revenuecat_event('{"type":"INITIAL_PURCHASE"}')$$, 'permission denied');
select pg_temp.expect_error($$insert into public.entitlements (user_id, entitlement, active) values ('00000000-0000-0000-0000-00000000000a', 'unlimited_learning', true)$$, 'row-level security');
do $$ begin
  assert (public.get_entitlement()->>'active')::boolean = false, 'a new learner has no Unlimited';
end $$;
reset role;
set role anon;
select pg_temp.expect_error($$select public.get_entitlement()$$, 'permission denied');
reset role;

-- 2. A purchase turns Unlimited on: no daily cap.
set role service_role;
do $$
declare r jsonb;
begin
  r := public.apply_revenuecat_event(pg_temp.event('INITIAL_PURCHASE', '00000000-0000-0000-0000-00000000000a', now() - interval '1 hour', now() + interval '30 days'));
  assert r->>'applied' = 'true', format('purchase applied: %s', r);
  assert public.has_unlimited('00000000-0000-0000-0000-00000000000a'), 'purchase should grant Unlimited';
  assert pg_temp.cap_for('00000000-0000-0000-0000-00000000000a')->>'cap' is null, 'Unlimited has no cap';
  assert (pg_temp.cap_for('00000000-0000-0000-0000-00000000000a')->>'daily_complete')::boolean = false, 'Unlimited never hits daily complete';
  assert not public.has_unlimited('00000000-0000-0000-0000-00000000000b'), 'another learner is unaffected';
end $$;
reset role;

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare e jsonb := public.get_entitlement();
begin
  assert (e->>'active')::boolean and (e->>'will_renew')::boolean and e->>'store' = 'APP_STORE', format('learner sees their plan: %s', e);
end $$;
reset role;

set role service_role;
do $$
declare r jsonb;
begin
  -- 3. Cancelling keeps Unlimited until the paid period ends; it just won't renew.
  r := public.apply_revenuecat_event(pg_temp.event('CANCELLATION', '00000000-0000-0000-0000-00000000000a', now() - interval '30 minutes', now() + interval '29 days'));
  assert public.has_unlimited('00000000-0000-0000-0000-00000000000a'), 'cancelled but paid through: still Unlimited';
  assert (select will_renew from public.entitlements where user_id = '00000000-0000-0000-0000-00000000000a') = false, 'cancel marks no renewal';

  -- 4. A late, older event never overwrites a newer one.
  r := public.apply_revenuecat_event(pg_temp.event('RENEWAL', '00000000-0000-0000-0000-00000000000a', now() - interval '2 hours', now() + interval '60 days'));
  assert r->>'applied' = 'false', 'stale event ignored';
  assert (select will_renew from public.entitlements where user_id = '00000000-0000-0000-0000-00000000000a') = false, 'stale renewal did not undo the cancel';

  -- 5. Expiry turns it off and the cap returns (Alice isn't on her first day: cap 5).
  r := public.apply_revenuecat_event(pg_temp.event('EXPIRATION', '00000000-0000-0000-0000-00000000000a', now() - interval '10 minutes', now() - interval '10 minutes'));
  assert not public.has_unlimited('00000000-0000-0000-0000-00000000000a'), 'expired: no Unlimited';
  assert (pg_temp.cap_for('00000000-0000-0000-0000-00000000000a')->>'cap')::int = 5, 'cap is back after expiry';

  -- 6. An active row whose expiry has passed doesn't count, even before the EXPIRATION event arrives.
  perform public.apply_entitlement('00000000-0000-0000-0000-00000000000b', true, now() - interval '1 minute', now());
  assert not public.has_unlimited('00000000-0000-0000-0000-00000000000b'), 'a lapsed expiry is not Unlimited';

  -- 7. The app's sync (apply_entitlement) grants at once; a lifetime grant has no expiry.
  assert public.apply_entitlement('00000000-0000-0000-0000-00000000000b', true, null, now() + interval '1 second', 'unlimited_annual', 'PLAY_STORE', true), 'sync applied';
  assert public.has_unlimited('00000000-0000-0000-0000-00000000000b'), 'sync grants Unlimited';

  -- 8. A transfer (restore on another account) removes it from the old account.
  r := public.apply_revenuecat_event(jsonb_build_object('type', 'TRANSFER', 'event_timestamp_ms', pg_temp.ms(now() + interval '2 seconds'),
    'transferred_from', jsonb_build_array('00000000-0000-0000-0000-00000000000b'), 'transferred_to', jsonb_build_array('00000000-0000-0000-0000-00000000000a')));
  assert r->>'applied' = 'true', format('transfer applied: %s', r);
  assert not public.has_unlimited('00000000-0000-0000-0000-00000000000b'), 'transferred away';

  -- 9. Ignored: test pings, other entitlements, RevenueCat anonymous ids, unknown learners.
  assert public.apply_revenuecat_event('{"type":"TEST"}')->>'applied' = 'false', 'test event ignored';
  assert public.apply_revenuecat_event(pg_temp.event('INITIAL_PURCHASE', '00000000-0000-0000-0000-00000000000a', now(), now() + interval '1 day', '{"entitlement_ids": ["something_else"]}'))->>'applied' = 'false', 'other entitlement ignored';
  assert public.apply_revenuecat_event(pg_temp.event('INITIAL_PURCHASE', '$RCAnonymousID:abc', now(), now() + interval '1 day'))->>'reason' = 'unknown_user', 'anonymous id ignored';
  assert public.apply_revenuecat_event(pg_temp.event('INITIAL_PURCHASE', '00000000-0000-0000-0000-0000000000ff', now(), now() + interval '1 day'))->>'applied' = 'false', 'unknown learner ignored';
  assert (select count(*) from public.entitlements) = 2, 'no rows for strangers';
end $$;
reset role;

-- 10. Unlimited never touches XP or levels: no XP rows came from any of this.
do $$ begin
  assert (select count(*) from public.xp_events) = 0, 'entitlements award nothing';
end $$;

\o
\echo subscriptions: all assertions passed
