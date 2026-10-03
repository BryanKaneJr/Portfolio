import { PRICING } from '@brainscroll/core';
import { DEV_UNLIMITED_KEY, type DevUnlimitedGrant } from '@/progress/localBackend';
import { load, remove, save } from '@/progress/storage';
import { PRODUCT_IDS, type Purchases } from './types';

/** Like the stores: one free trial per account, then plain prices. */
const SANDBOX_TRIAL = { label: '7 days free' };

/**
 * The development harness's store (local backend only). Buying writes a
 * sandbox record for the account, the way a store and RevenueCat would;
 * syncEntitlement() then reads it, so the whole round trip runs without
 * any accounts or money. "Manage" ends the sandbox plan at once.
 */
export function createSandboxPurchases(): Purchases {
  let userId: string | null = null;
  const key = () => {
    if (!userId) throw new Error('Sign in first.');
    return `${DEV_UNLIMITED_KEY}:${userId}`;
  };
  const usd = (n: number) => `$${n.toFixed(2)}`;
  return {
    kind: 'sandbox',
    async identify(id) {
      userId = id;
    },
    async plans() {
      const trial = (await load<boolean>(`${key()}:trial-used`)) ? undefined : SANDBOX_TRIAL;
      return [
        { id: 'annual', price: usd(PRICING.annualUsd), period: 'per year', note: `Just ${usd(Math.floor((PRICING.annualUsd / 12) * 100) / 100)} a month`, trial },
        { id: 'monthly', price: usd(PRICING.monthlyUsd), period: 'per month', trial },
      ];
    },
    async purchase(plan) {
      const grant: DevUnlimitedGrant = { productId: PRODUCT_IDS[plan], store: 'SANDBOX', purchasedAt: new Date().toISOString() };
      await save(key(), grant);
      await save(`${key()}:trial-used`, true);
      return 'purchased';
    },
    async restore() {
      return !!(await load<DevUnlimitedGrant>(key()));
    },
    async manage() {
      await remove(key());
    },
  };
}
