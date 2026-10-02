import * as Haptics from 'expo-haptics';
import { useEffect, useSyncExternalStore } from 'react';
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

// ----- Accessibility settings (read once, shared, kept current) -----

/**
 * One app-wide copy of an OS accessibility switch. It is read once at launch
 * and kept current by the OS's change event, so every component that mounts
 * later (a new lesson card, a reward screen) already knows the answer on its
 * first frame instead of animating for a frame and then snapping.
 */
function osSetting(read: () => Promise<boolean>, event: 'reduceMotionChanged' | 'screenReaderChanged') {
  let value = false;
  const subs = new Set<() => void>();
  const set = (v: boolean) => {
    if (v === value) return;
    value = v;
    subs.forEach((l) => l());
  };
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    read().then(set, () => {});
    AccessibilityInfo.addEventListener?.(event, set);
  };
  return function useSetting(): boolean {
    start();
    return useSyncExternalStore(
      (l) => {
        subs.add(l);
        return () => subs.delete(l);
      },
      () => value,
      () => false,
    );
  };
}

/** True when the OS asks for reduced motion; animations should snap or fade instead. */
export const useReduceMotion = osSetting(() => AccessibilityInfo.isReduceMotionEnabled(), 'reduceMotionChanged');

/** True while VoiceOver or TalkBack is on: skip purely visual sequences (like Choose for me's name cycle). */
export const useScreenReader = osSetting(() => AccessibilityInfo.isScreenReaderEnabled(), 'screenReaderChanged');

/**
 * Speak a short status to VoiceOver/TalkBack ("Correct", "Not quite") when it
 * appears somewhere focus isn't. Native only: on web the same text sits in an
 * aria-live region (`liveRegion` below), so it isn't spoken twice.
 */
export function announce(message: string): void {
  if (!native || !message) return;
  try {
    AccessibilityInfo.announceForAccessibility(message);
  } catch {
    // Announcements are a courtesy; never let one interrupt learning.
  }
}

/**
 * `accessibilityLiveRegion` for text that `announce` also speaks: polite on
 * web (an aria-live region), off on native, where `announce` already did it.
 */
export const liveRegion: 'polite' | 'none' = native ? 'none' : 'polite';

/** Announce `message` whenever it changes to a non-empty value. */
export function useAnnounce(message: string | null | undefined): void {
  useEffect(() => {
    if (message) announce(message);
  }, [message]);
}
