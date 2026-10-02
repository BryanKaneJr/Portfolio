import { createStorePurchases } from './revenuecat';
import { createSandboxPurchases } from './sandbox';
import { UNAVAILABLE_ON_WEB, type Purchases } from './types';

export * from './types';

/**
 * Picks how Unlimited is bought: the sandbox with the local development
 * harness, RevenueCat on iPhone and Android when its key is set, and
 * otherwise nothing (the web build, or a build without keys).
 */
export function createPurchases(backendKind: 'local' | 'remote'): Purchases {
  if (backendKind === 'local') return createSandboxPurchases();
  return createStorePurchases() ?? unavailable(UNAVAILABLE_ON_WEB);
}

function unavailable(reason: string): Purchases {
  const no = async (): Promise<never> => {
    throw new Error(reason);
  };
  return { kind: 'unavailable', unavailableReason: reason, identify: async () => {}, plans: async () => [], purchase: no, restore: no, manage: no };
}
