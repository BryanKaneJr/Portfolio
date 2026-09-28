import * as Haptics from 'expo-haptics';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { load, save } from '@/progress/storage';
import { playSound, type SoundName } from './sounds';

/**
 * One feedback system for the whole app (roadmap §14). Every acknowledged
 * action is an event; each event has a tier, and the tier decides how loud the
 * haptic and sound are, so a checkpoint always feels bigger than a tap.
 *
 *   tiny   : selecting, small progress. A light tick.
 *   normal : an answer checked, a level complete. A short, clear response.
 *   major  : level-up, checkpoint, milestone, unlock, Choose For You landing.
 *   rare   : Level 100 mastery. The one place BrainScroll goes big.
 *
 * Rules: never on scroll or plain navigation; a wrong answer is soft, never
 * punishing; the streak has no event of its own (it is never a reward). Sound
 * and haptics each have their own switch, and the app makes complete sense
 * with both off.
 */
export type FeedbackEvent =
  | 'select'
  | 'correct'
  | 'incorrect'
  | 'levelComplete'
  | 'levelUp'
  | 'checkpoint'
  | 'milestone'
  | 'mastery'
  | 'unlock'
  | 'chooseTick'
  | 'chooseLand'
  | 'purchase';

export type FeedbackTier = 'tiny' | 'normal' | 'major' | 'rare';

export const FEEDBACK_TIER: Record<FeedbackEvent, FeedbackTier> = {
  select: 'tiny',
  chooseTick: 'tiny',
  correct: 'normal',
  incorrect: 'normal',
  levelComplete: 'normal',
  purchase: 'normal',
  levelUp: 'major',
  checkpoint: 'major',
  milestone: 'major',
  unlock: 'major',
  chooseLand: 'major',
  mastery: 'rare',
};

const SOUND: Partial<Record<FeedbackEvent, SoundName>> = {
  select: 'select',
  correct: 'correct',
  incorrect: 'incorrect',
  levelComplete: 'levelComplete',
  levelUp: 'levelUp',
  checkpoint: 'checkpoint',
  milestone: 'milestone',
  mastery: 'mastery',
  unlock: 'unlock',
  chooseTick: 'chooseTick',
  chooseLand: 'chooseLand',
};

// ----- Preferences (device-wide: a phone's sound and vibration taste, not progress) -----

export type FeedbackPrefs = { sound: boolean; haptics: boolean };
const PREFS_KEY = 'bs.prefs.feedback';
let prefs: FeedbackPrefs = { sound: true, haptics: true };
const listeners = new Set<() => void>();
void load<FeedbackPrefs>(PREFS_KEY).then((p) => {
  if (p) {
    prefs = { ...prefs, ...p };
    listeners.forEach((l) => l());
  }
});

export function setFeedbackPref(key: keyof FeedbackPrefs, value: boolean): void {
  prefs = { ...prefs, [key]: value };
  void save(PREFS_KEY, prefs);
  listeners.forEach((l) => l());
}

export function useFeedbackPrefs(): FeedbackPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => prefs,
    () => prefs,
  );
}

// ----- Haptics -----

const native = Platform.OS === 'ios' || Platform.OS === 'android';
const safe = (p: Promise<void>) => void p.catch(() => {});
const later = (ms: number, f: () => void) => setTimeout(f, ms);

const HAPTIC: Record<FeedbackEvent, () => void> = {
  select: () => safe(Haptics.selectionAsync()),
  chooseTick: () => safe(Haptics.selectionAsync()),
  correct: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  // Soft, single and short: a nudge, not a buzz of disapproval.
  incorrect: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  levelComplete: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  purchase: () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  levelUp: () => {
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    later(140, () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)));
  },
  unlock: () => {
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    later(110, () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)));
  },
  chooseLand: () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  // The checkpoint's signature: a rising three-beat.
  checkpoint: () => {
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    later(120, () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)));
    later(260, () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)));
  },
  milestone: () => {
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    later(130, () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)));
    later(280, () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)));
  },
  mastery: () => {
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    later(150, () => safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)));
    later(320, () => safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)));
  },
};

/** Acknowledge an event with the haptic and sound its tier calls for. */
export function feedback(event: FeedbackEvent): void {
  if (prefs.haptics && native) HAPTIC[event]();
  const s = SOUND[event];
  if (prefs.sound && s) playSound(s);
}

/** The strongest event a level completion earned, in the order learners care about. */
export function completionEvent(r: { mastery?: boolean; milestone?: boolean; checkpoint?: boolean; leveledUp?: boolean }): FeedbackEvent {
  if (r.mastery) return 'mastery';
  if (r.milestone) return 'milestone';
  if (r.checkpoint) return 'checkpoint';
  if (r.leveledUp) return 'levelUp';
  return 'levelComplete';
}

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
