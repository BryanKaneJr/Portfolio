/**
 * Buying Unlimited (docs/subscriptions.md). Screens use this interface only.
 * A purchase never grants anything by itself: afterwards the app asks the
 * server to re-read the store's record (ProgressBackend.syncEntitlement), and
 * the server alone lifts the daily cap.
 */
export type PlanId = 'monthly' | 'annual';

export interface Plan {
  id: PlanId;
  /** The store's localized price, e.g. "$4.99". */
  price: string;
  /** "per month" / "per year". */
  period: string;
  /** A second line, e.g. "Just $3.33 a month". */
  note?: string;
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'pending';

export interface Purchases {
  /** store: App Store / Google Play through RevenueCat. sandbox: the dev harness. unavailable: nothing to buy with here. */
  readonly kind: 'store' | 'sandbox' | 'unavailable';
  /** Why buying isn't possible here, in words a learner can read. */
  readonly unavailableReason?: string;
  /** Ties purchases to the signed-in account (its Supabase user id), or forgets it on sign-out. */
  identify(userId: string | null): Promise<void>;
  plans(): Promise<Plan[]>;
  purchase(plan: PlanId): Promise<PurchaseOutcome>;
  /** Restores earlier purchases on this store account. True when Unlimited was found. */
  restore(): Promise<boolean>;
  /** Opens the store's own subscription management (cancel, change plan). */
  manage(): Promise<void>;
}

/** The offering's product ids, set up in App Store Connect, Google Play and RevenueCat. */
export const PRODUCT_IDS: Record<PlanId, string> = { monthly: 'unlimited_monthly', annual: 'unlimited_annual' };

export const UNAVAILABLE_ON_WEB = 'Unlimited is available in the BrainScroll app for iPhone and Android.';
