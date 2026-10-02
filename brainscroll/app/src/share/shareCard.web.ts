import type { RefObject } from 'react';
import type { View } from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

/**
 * The web build shares the line (and the app's address) through the browser's
 * share sheet when it has one, and otherwise copies the line. The image card
 * is shared from the phone apps.
 */
export async function shareCard(_ref: RefObject<View | null>, message: string): Promise<ShareOutcome> {
  const nav = globalThis.navigator as (Navigator & { share?: (d: ShareData) => Promise<void> }) | undefined;
  if (nav?.share) {
    try {
      await nav.share({ text: message });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  if (!nav?.clipboard) return 'cancelled';
  try {
    await nav.clipboard.writeText(message);
    return 'copied';
  } catch {
    return 'cancelled';
  }
}
