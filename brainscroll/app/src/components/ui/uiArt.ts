import type { ImageSourcePropType } from 'react-native';

/**
 * The owner's UI illustrations (app/assets/images/ui, 256 px WebP), by name.
 * Decorative: every place that shows one also says the same thing in words.
 * Not used on purpose (they clash with the product rules): heart-life (no
 * lives), chest and chest-open (no loot; kept for a possible reveal of a
 * trophy already earned, never a random reward), stopwatch (never time or speed), xp-gem (XP is
 * not a currency). share waits for a share feature. Tried and cut as not
 * premium enough where they sat (2026-09-29): level-up, target, calendar-day,
 * bell, sound-on and sound-off (their files stay in the folder). The tab bar
 * uses welcome, level-up, review and profile directly (app/(tabs)/_layout.tsx).
 */
export const UI_ART = {
  'streak-flame': require('../../../assets/images/ui/streak-flame.webp'),
  'streak-ember': require('../../../assets/images/ui/streak-ember.webp'),
  'mastery-star': require('../../../assets/images/ui/mastery-star.webp'),
  review: require('../../../assets/images/ui/review.webp'),
  'review-clear': require('../../../assets/images/ui/review-clear.webp'),
  offline: require('../../../assets/images/ui/offline.webp'),
  'error-plug': require('../../../assets/images/ui/error-plug.webp'),
  'empty-box': require('../../../assets/images/ui/empty-box.webp'),
  // The league banner (Social): the trophy in the top 3, the medal otherwise.
  trophy: require('../../../assets/images/ui/trophy.webp'),
  medal: require('../../../assets/images/ui/medal.webp'),
  // Brainpower: the header chip and its screen (lit, at 0, Unlimited), the +1 spark and the lucky drop.
  brainpower: require('../../../assets/images/ui/brainpower.webp'),
  'brainpower-empty': require('../../../assets/images/ui/brainpower-empty.webp'),
  'brainpower-unlimited': require('../../../assets/images/ui/brainpower-unlimited.webp'),
  'brainpower-spark': require('../../../assets/images/ui/brainpower-spark.webp'),
  'lucky-drop': require('../../../assets/images/ui/lucky-drop.webp'),
} as const satisfies Record<string, ImageSourcePropType>;

export type UiArtName = keyof typeof UI_ART;
