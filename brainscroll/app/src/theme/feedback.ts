import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Haptics with meaning. Light taps for selection; success/warning notifications
 * for answers; a heavier pattern only for progression moments. No-ops on web.
 */
const on = Platform.OS === 'ios' || Platform.OS === 'android';
const safe = (p: Promise<void>) => void p.catch(() => {});

export const haptic = {
  select: () => on && safe(Haptics.selectionAsync()),
  correct: () => on && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  incorrect: () => on && safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  reward: () => on && safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
};

/** True when the OS asks for reduced motion; animations should snap instead. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => alive && setReduce(r))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}
