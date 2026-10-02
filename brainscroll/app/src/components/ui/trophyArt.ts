import type { ImageSourcePropType } from 'react-native';

/**
 * Trophy artwork (docs/images-trophies.md), by the `art` key in
 * packages/core/src/trophies.ts. Counted trophies share one image per series
 * and the app draws the count on top. Until a file exists its trophy shows
 * the trophy icon. Files: app/assets/images/trophies/<key>.webp (the
 * owner's art, 384 px WebP).
 * (Skill mastery trophies use each skill's Level 100 art; quest trophies
 * their quest's art. Neither is listed here.)
 */
export const TROPHY_ART: Partial<Record<string, ImageSourcePropType>> = {
  'master-of-all': require('../../../assets/images/trophies/master-of-all.webp'),
  'jack-of-all-trades': require('../../../assets/images/trophies/jack-of-all-trades.webp'),
  'first-level': require('../../../assets/images/trophies/first-level.webp'),
  'levels': require('../../../assets/images/trophies/levels.webp'),
  'chapters': require('../../../assets/images/trophies/chapters.webp'),
  'halfway': require('../../../assets/images/trophies/halfway.webp'),
  'first-mastery': require('../../../assets/images/trophies/first-mastery.webp'),
  'perfect-lessons': require('../../../assets/images/trophies/perfect-lessons.webp'),
  'reviews': require('../../../assets/images/trophies/reviews.webp'),
  'curious': require('../../../assets/images/trophies/curious.webp'),
  'explorer': require('../../../assets/images/trophies/explorer.webp'),
  'well-rounded': require('../../../assets/images/trophies/well-rounded.webp'),
  'polymath': require('../../../assets/images/trophies/polymath.webp'),
  'quest-clears': require('../../../assets/images/trophies/quest-clears.webp'),
  'streak': require('../../../assets/images/trophies/streak.webp'),
  // Each counted series' top tier, in gold (docs/images-trophies-gold.md).
  'levels-gold': require('../../../assets/images/trophies/levels-gold.webp'),
  'chapters-gold': require('../../../assets/images/trophies/chapters-gold.webp'),
  'perfect-lessons-gold': require('../../../assets/images/trophies/perfect-lessons-gold.webp'),
  'reviews-gold': require('../../../assets/images/trophies/reviews-gold.webp'),
  'quest-clears-gold': require('../../../assets/images/trophies/quest-clears-gold.webp'),
  'streak-gold': require('../../../assets/images/trophies/streak-gold.webp'),
  'subject-history': require('../../../assets/images/trophies/subject-history.webp'),
  'subject-science': require('../../../assets/images/trophies/subject-science.webp'),
  'subject-geography': require('../../../assets/images/trophies/subject-geography.webp'),
  'subject-arts': require('../../../assets/images/trophies/subject-arts.webp'),
  'subject-world-systems': require('../../../assets/images/trophies/subject-world-systems.webp'),
  'subject-mind': require('../../../assets/images/trophies/subject-mind.webp'),
};
