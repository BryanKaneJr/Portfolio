import type { Purchases } from './types';

/** The web build has no store billing; the RevenueCat native SDK isn't bundled here. */
export function createStorePurchases(): Purchases | null {
  return null;
}
