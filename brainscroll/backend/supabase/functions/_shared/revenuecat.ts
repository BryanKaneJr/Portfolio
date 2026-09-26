/**
 * RevenueCat helpers shared by the Edge Functions. Plain TypeScript with no
 * Deno or Node APIs, so `scripts/test/revenuecat.test.ts` can test it.
 */

/** The one entitlement (packages/core ENTITLEMENT_UNLIMITED). */
export const ENTITLEMENT = 'unlimited_learning';

/** What `apply_entitlement` needs, read from RevenueCat's subscriber record. */
export interface EntitlementState {
  active: boolean;
  /** ISO time, or null for a grant that never expires. */
  expiresAt: string | null;
  productId: string | null;
  /** APP_STORE, PLAY_STORE, … (RevenueCat's store, upper-cased like webhook events). */
  store: string | null;
  willRenew: boolean | null;
}

interface SubscriberEntitlement {
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  product_identifier?: string;
}
interface SubscriberSubscription {
  store?: string;
  is_sandbox?: boolean;
  expires_date?: string | null;
  unsubscribe_detected_at?: string | null;
}
/** The parts of GET /v1/subscribers/{app_user_id} we read. */
export interface SubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, SubscriberEntitlement>;
    subscriptions?: Record<string, SubscriberSubscription>;
  };
}

/**
 * Reads Unlimited from a subscriber record. Access runs to the later of the
 * expiry and any billing grace period; a missing expiry means a grant that
 * never expires. Sandbox purchases count only when `allowSandbox` (staging).
 */
export function entitlementFromSubscriber(body: SubscriberResponse, now: Date = new Date(), allowSandbox = false): EntitlementState {
  const none: EntitlementState = { active: false, expiresAt: null, productId: null, store: null, willRenew: null };
  const e = body.subscriber?.entitlements?.[ENTITLEMENT];
  if (!e) return none;
  const ends = [e.expires_date, e.grace_period_expires_date].filter((d): d is string => !!d).sort().at(-1) ?? null;
  const productId = e.product_identifier ?? null;
  const sub = productId ? body.subscriber?.subscriptions?.[productId] : undefined;
  // A store sandbox (TestFlight, license testers) purchase is not a real one.
  if (sub?.is_sandbox && !allowSandbox) return none;
  return {
    active: ends === null || new Date(ends).getTime() > now.getTime(),
    expiresAt: ends,
    productId,
    store: sub?.store ? sub.store.toUpperCase() : null,
    willRenew: sub ? !sub.unsubscribe_detected_at && !!sub.expires_date : false,
  };
}

/**
 * RevenueCat sends the Authorization header value set in its dashboard. We
 * set it to "Bearer <REVENUECAT_WEBHOOK_SECRET>". Compared in constant time.
 */
export function webhookAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
