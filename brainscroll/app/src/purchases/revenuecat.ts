import { ENTITLEMENT_UNLIMITED } from '@brainscroll/core';
import { Linking, Platform } from 'react-native';
import RC, { PACKAGE_TYPE, type PurchasesPackage } from 'react-native-purchases';
import { PRODUCT_IDS, type Plan, type PlanId, type Purchases } from './types';

/**
 * App Store / Google Play through RevenueCat. Public SDK keys only (never a
 * secret key):
 *
 *   EXPO_PUBLIC_REVENUECAT_IOS_KEY      RevenueCat → Project → API keys → App Store app (appl_…)
 *   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY  … → Play Store app (goog_…)
 *
 * Needs a development or store build: Expo Go has no store billing.
 */
const KEY = Platform.select({ ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY }) || undefined;

export function createStorePurchases(): Purchases | null {
  if (!KEY) return null;
  let configured = false;
  const packages = new Map<PlanId, PurchasesPackage>();

  const ensure = () => {
    if (!configured) RC.configure({ apiKey: KEY });
    configured = true;
  };

  const planOf = (p: PurchasesPackage): PlanId | null =>
    p.packageType === PACKAGE_TYPE.MONTHLY || p.product.identifier === PRODUCT_IDS.monthly
      ? 'monthly'
      : p.packageType === PACKAGE_TYPE.ANNUAL || p.product.identifier === PRODUCT_IDS.annual
        ? 'annual'
        : null;

  return {
    kind: 'store',
    async identify(userId) {
      ensure();
      // RevenueCat's app user id is the Supabase user id, so webhooks name our learner.
      if (userId) await RC.logIn(userId);
      else if (!(await RC.isAnonymous())) await RC.logOut();
    },
    async plans() {
      ensure();
      const offering = (await RC.getOfferings()).current;
      packages.clear();
      const plans: Plan[] = [];
      for (const p of offering?.availablePackages ?? []) {
        const id = planOf(p);
        if (!id || packages.has(id)) continue;
        packages.set(id, p);
        plans.push({
          id,
          price: p.product.priceString,
          period: id === 'monthly' ? 'per month' : 'per year',
          note: id === 'annual' && p.product.pricePerMonthString ? `Just ${p.product.pricePerMonthString} a month` : undefined,
        });
      }
      return plans.sort((a, b) => (a.id === 'annual' ? -1 : b.id === 'annual' ? 1 : 0));
    },
    async purchase(plan) {
      ensure();
      const pkg = packages.get(plan);
      if (!pkg) throw new Error('That plan isn’t available right now.');
      try {
        const { customerInfo } = await RC.purchasePackage(pkg);
        return customerInfo.entitlements.active[ENTITLEMENT_UNLIMITED] ? 'purchased' : 'pending';
      } catch (e) {
        const err = e as { userCancelled?: boolean | null; code?: string };
        if (err.userCancelled || err.code === '1') return 'cancelled'; // PURCHASE_CANCELLED_ERROR
        if (err.code === '20') return 'pending'; // PAYMENT_PENDING_ERROR (e.g. Ask to Buy)
        throw e;
      }
    },
    async restore() {
      ensure();
      const info = await RC.restorePurchases();
      return !!info.entitlements.active[ENTITLEMENT_UNLIMITED];
    },
    async manage() {
      ensure();
      try {
        await RC.showManageSubscriptions();
      } catch {
        const url = (await RC.getCustomerInfo()).managementURL;
        if (url) await Linking.openURL(url);
      }
    },
  };
}
