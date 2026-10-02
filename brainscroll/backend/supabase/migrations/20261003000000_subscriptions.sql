-- Unlimited: keeping the entitlements table in step with RevenueCat.
--
-- The server stays the authority on the daily cap (has_unlimited()). Rows are
-- written only by the service role, from two places (docs/subscriptions.md):
--   * the revenuecat-webhook Edge Function, on every RevenueCat event
--     (apply_revenuecat_event), and
--   * the sync-entitlement Edge Function, which the app calls right after a
--     purchase or restore so Unlimited applies at once (apply_entitlement).
-- Events can arrive late or twice, so each write carries the time of the
-- event it came from and an older event never overwrites a newer one.
-- Unlimited only removes the daily new-level cap. It never changes XP,
-- levels, knowledge or trophies.

alter table public.entitlements
  add column product_id text,
  add column store text,
  add column will_renew boolean,
  add column last_event_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- Writes (service role only)
-- ─────────────────────────────────────────────────────────────────────────────

/**
 * Sets the learner's Unlimited entitlement as of p_event_at. Returns false
 * (and changes nothing) when the learner doesn't exist or a newer event has
 * already been applied.
 */
create or replace function public.apply_entitlement(
  p_user uuid,
  p_active boolean,
  p_expires_at timestamptz,
  p_event_at timestamptz,
  p_product_id text default null,
  p_store text default null,
  p_will_renew boolean default null,
  p_customer_id text default null
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_last timestamptz;
begin
  if p_event_at is null then raise exception 'EVENT_TIME_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then return false; end if;
  select last_event_at into v_last from public.entitlements where user_id = p_user and entitlement = 'unlimited_learning';
  if v_last is not null and p_event_at < v_last then return false; end if;
  insert into public.entitlements (user_id, entitlement, active, expires_at, provider, provider_customer_id, product_id, store, will_renew, last_event_at, updated_at)
  values (p_user, 'unlimited_learning', p_active, p_expires_at, 'revenuecat', coalesce(p_customer_id, p_user::text), p_product_id, p_store, p_will_renew, p_event_at, now())
  on conflict (user_id, entitlement) do update set
    active = excluded.active,
    expires_at = excluded.expires_at,
    provider_customer_id = coalesce(excluded.provider_customer_id, entitlements.provider_customer_id),
    product_id = coalesce(excluded.product_id, entitlements.product_id),
    store = coalesce(excluded.store, entitlements.store),
    will_renew = coalesce(excluded.will_renew, entitlements.will_renew),
    last_event_at = excluded.last_event_at,
    updated_at = now();
  return true;
end $$;

/** A uuid from text, or null (RevenueCat's anonymous ids aren't our users). */
create or replace function public.try_uuid(p text) returns uuid
language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

/**
 * Applies one RevenueCat webhook event (the body's "event" object). The app
 * logs RevenueCat in with the Supabase user id, so app_user_id is our user.
 * Events that don't concern unlimited_learning are acknowledged and ignored.
 */
create or replace function public.apply_revenuecat_event(p_event jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_type text := p_event->>'type';
  v_user uuid := public.try_uuid(p_event->>'app_user_id');
  v_at timestamptz := to_timestamp(coalesce((p_event->>'event_timestamp_ms')::numeric, extract(epoch from now()) * 1000) / 1000);
  v_expires timestamptz := case when p_event ? 'expiration_at_ms' and p_event->>'expiration_at_ms' is not null
                                then to_timestamp((p_event->>'expiration_at_ms')::numeric / 1000) end;
  v_product text := p_event->>'product_id';
  v_store text := p_event->>'store';
  v_ours boolean := coalesce(p_event->'entitlement_ids', '[]'::jsonb) ? 'unlimited_learning'
                    or coalesce(p_event->>'entitlement_id', '') = 'unlimited_learning';
  v_applied boolean := false;
  v_from text;
begin
  if v_type is null then raise exception 'EVENT_TYPE_REQUIRED'; end if;
  if v_type = 'TEST' then return jsonb_build_object('applied', false, 'reason', 'test'); end if;

  -- A purchase restored onto another account moves the entitlement: the old
  -- accounts lose it now, and the new one gets it from its own sync.
  if v_type = 'TRANSFER' then
    for v_from in select jsonb_array_elements_text(coalesce(p_event->'transferred_from', '[]'::jsonb)) loop
      if public.try_uuid(v_from) is not null then
        v_applied := public.apply_entitlement(public.try_uuid(v_from), false, null, v_at) or v_applied;
      end if;
    end loop;
    return jsonb_build_object('applied', v_applied, 'type', v_type);
  end if;

  if not v_ours then return jsonb_build_object('applied', false, 'reason', 'other_entitlement'); end if;
  if v_user is null then return jsonb_build_object('applied', false, 'reason', 'unknown_user'); end if;

  v_applied := case
    when v_type in ('INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT') then
      public.apply_entitlement(v_user, true, v_expires, v_at, v_product, v_store, v_type <> 'NON_RENEWING_PURCHASE', p_event->>'original_app_user_id')
    -- Cancelled (or refunded): Unlimited lasts until expiry, then stops. A refund sets expiry to now.
    when v_type = 'CANCELLATION' then
      public.apply_entitlement(v_user, true, v_expires, v_at, v_product, v_store, false, p_event->>'original_app_user_id')
    -- Billing trouble: keep access through the store's grace period (the expiry RevenueCat sends).
    when v_type = 'BILLING_ISSUE' then
      public.apply_entitlement(v_user, true, v_expires, v_at, v_product, v_store, null, p_event->>'original_app_user_id')
    when v_type = 'EXPIRATION' then
      public.apply_entitlement(v_user, false, v_expires, v_at, v_product, v_store, false, p_event->>'original_app_user_id')
    else false -- SUBSCRIPTION_PAUSED and anything new: the expiration event that follows is what counts.
  end;
  return jsonb_build_object('applied', v_applied, 'type', v_type);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Reads (the learner's own)
-- ─────────────────────────────────────────────────────────────────────────────

/** The learner's Unlimited status, for Profile and the paywall. Never used to grade or award. */
create or replace function public.get_entitlement() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_user uuid := auth.uid();
  e public.entitlements;
begin
  if v_user is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into e from public.entitlements where user_id = v_user and entitlement = 'unlimited_learning';
  return jsonb_build_object(
    'active', public.has_unlimited(v_user),
    'expires_at', e.expires_at,
    'will_renew', e.will_renew,
    'store', e.store,
    'product_id', e.product_id
  );
end $$;

revoke execute on function public.apply_entitlement(uuid, boolean, timestamptz, timestamptz, text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.apply_revenuecat_event(jsonb) from public, anon, authenticated;
revoke execute on function public.get_entitlement() from public, anon;
grant execute on function public.apply_entitlement(uuid, boolean, timestamptz, timestamptz, text, text, boolean, text) to service_role;
grant execute on function public.apply_revenuecat_event(jsonb) to service_role;
grant execute on function public.get_entitlement() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Analytics: the paywall funnel (counts only, no prices or receipts)
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.analytics_event_names (name, description) values
  ('paywall_viewed', 'The Unlimited screen was shown: props.from (daily_complete | profile)'),
  ('purchase_started', 'A plan was chosen: props.plan (monthly | annual)'),
  ('subscription_started', 'A purchase finished and Unlimited is on: props.plan'),
  ('purchase_restored', 'Restore purchases ran: props.found (true when Unlimited came back)')
on conflict (name) do nothing;
