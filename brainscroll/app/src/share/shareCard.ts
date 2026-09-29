import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, Share, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

/**
 * Shares a rendered card as an image, with its line as the message where the
 * platform allows (iOS). Android's share sheet takes the image alone; the
 * line is printed on the card, so nothing is lost.
 */
export async function shareCard(ref: RefObject<View | null>, message: string): Promise<ShareOutcome> {
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
  if (Platform.OS === 'ios') {
    const r = await Share.share({ url: uri, message });
    return r.action === Share.sharedAction ? 'shared' : 'cancelled';
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: message, UTI: 'public.png' });
    return 'shared';
  }
  const r = await Share.share({ message });
  return r.action === Share.sharedAction ? 'shared' : 'cancelled';
}
