/**
 * Buying Unlimited (docs/subscriptions.md). Screens use this interface only.
 * A purchase never grants anything by itself: afterwards the app asks the
 * server to re-read the store's record (ProgressBackend.syncEntitlement), and
 * the server alone grants ∞ Brainpower.
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
  /**
   * A free trial this learner can start on this plan ("7 days free"), from the
   * store's introductory offer. Only when the store says they're eligible
   * (one trial per Apple ID / Google account); otherwise absent, and the
   * screens show the plain price.
   */
  trial?: { label: string };
}

/** "7 days free" from a store period: DAY / WEEK / MONTH / YEAR × count. */
export function trialLabel(unit: string, count: number): string {
  const days = unit === 'DAY' ? count : unit === 'WEEK' ? count * 7 : null;
  if (days !== null) return `${days} ${days === 1 ? 'day' : 'days'} free`;
  const word = unit === 'MONTH' ? 'month' : 'year';
  return `${count} ${count === 1 ? word : `${word}s`} free`;
}

/** The trial on offer, if any plan has one (the out-of-Brainpower card leads with it). */
export const offeredTrial = (plans: readonly Plan[] | null | undefined) => plans?.find((p) => p.trial)?.trial;

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
