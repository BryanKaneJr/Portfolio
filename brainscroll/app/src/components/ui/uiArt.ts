import type { ImageSourcePropType } from 'react-native';

/**
 * The owner's UI illustrations (app/assets/images/ui, 256 px WebP), by name.
 * Decorative: every place that shows one also says the same thing in words.
 * Not used on purpose (they clash with the product rules): heart-life (no
 * lives), stopwatch (never time or speed), xp-gem (XP is
 * not a currency). share waits for a share feature. Tried and cut as not
 * premium enough where they sat (2026-09-29): level-up, target, calendar-day,
 * bell, sound-on and sound-off (their files stay in the folder). The tab bar
 * uses welcome, medal, review and profile directly (app/(tabs)/_layout.tsx).
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
  // A trophy and a medal: Brainpower's ways to earn, and what earned it.
  trophy: require('../../../assets/images/ui/trophy.webp'),
  medal: require('../../../assets/images/ui/medal.webp'),
  // Brainpower: the header chip and its screen (lit, at 0, Unlimited), the +1 spark and the lucky drop.
  brainpower: require('../../../assets/images/ui/brainpower.webp'),
  'brainpower-empty': require('../../../assets/images/ui/brainpower-empty.webp'),
  'brainpower-unlimited': require('../../../assets/images/ui/brainpower-unlimited.webp'),
  'brainpower-spark': require('../../../assets/images/ui/brainpower-spark.webp'),
  'lucky-drop': require('../../../assets/images/ui/lucky-drop.webp'),
  // League tiers (owner, 2026-10-08; docs/images-league-tiers.md): seven gems, then the crown we already had.
  'league-quartz': require('../../../assets/images/ui/league-quartz.webp'),
  'league-amethyst': require('../../../assets/images/ui/league-amethyst.webp'),
  'league-aquamarine': require('../../../assets/images/ui/league-aquamarine.webp'),
  'league-sapphire': require('../../../assets/images/ui/league-sapphire.webp'),
  'league-emerald': require('../../../assets/images/ui/league-emerald.webp'),
  'league-ruby': require('../../../assets/images/ui/league-ruby.webp'),
  'league-diamond': require('../../../assets/images/ui/league-diamond.webp'),
  'league-crown': require('../../../assets/images/art/medieval.crown.webp'),
  // Map chests (owner, 2026-10-05; docs/specs/REWARDS.md): on the road, on their screen and in the Locker.
  chest: require('../../../assets/images/ui/chest.webp'),
  'chest-open': require('../../../assets/images/ui/chest-open.webp'),
} as const satisfies Record<string, ImageSourcePropType>;

export type UiArtName = keyof typeof UI_ART;
