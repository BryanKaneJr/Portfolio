import type { MascotPose, MascotSpot } from '@brainscroll/core';
import type { ImageSourcePropType } from 'react-native';

/**
 * Dr. Scroll's artwork, all in this one file (docs/mascot.md, "Spots").
 *
 * Every place he appears asks for a SPOT (e.g. 'daily-complete'), and each spot
 * has a default POSE. The picture shown is the first that exists of:
 *
 *   1. SPOT_ART[spot]   one image for just that spot
 *   2. POSE_ART[pose]   the pose's image, shared by every spot using it
 *   3. the reference    until the pose art is made
 *
 * To add an image: save it as assets/images/mascot/<pose>.webp (or
 * assets/images/mascot/spots/<spot>.webp) and uncomment its line below.
 * React Native needs a literal require() for each file, so every slot is
 * listed here ready to switch on.
 */
const reference: ImageSourcePropType = require('../../../assets/images/mascot/reference.webp');

export const POSE_ART: Partial<Record<MascotPose, ImageSourcePropType>> = {
  reference,
  'wave': require('../../../assets/images/mascot/wave.webp'),
  'pointing': require('../../../assets/images/mascot/pointing.webp'),
  'thinking': require('../../../assets/images/mascot/thinking.webp'),
  'idea': require('../../../assets/images/mascot/idea.webp'),
  'explaining': require('../../../assets/images/mascot/explaining.webp'),
  // 'chalkboard': require('../../../assets/images/mascot/chalkboard.webp'),
  'reading': require('../../../assets/images/mascot/reading.webp'),
  // 'magnifier': require('../../../assets/images/mascot/magnifier.webp'),
  'surprised': require('../../../assets/images/mascot/surprised.webp'),
  'whisper': require('../../../assets/images/mascot/whisper.webp'),
  'waiting': require('../../../assets/images/mascot/waiting.webp'),
  'tangled': require('../../../assets/images/mascot/tangled.webp'),
  'thumbs-up': require('../../../assets/images/mascot/thumbs-up.webp'),
  'oops': require('../../../assets/images/mascot/oops.webp'),
  'encourage': require('../../../assets/images/mascot/encourage.webp'),
  'clapping': require('../../../assets/images/mascot/clapping.webp'),
  'celebrate': require('../../../assets/images/mascot/celebrate.webp'),
  'checkpoint': require('../../../assets/images/mascot/checkpoint.webp'),
  'review': require('../../../assets/images/mascot/review.webp'),
  'mastery': require('../../../assets/images/mascot/mastery.webp'),
  'go-outside': require('../../../assets/images/mascot/go-outside.webp'),
  'sleeping': require('../../../assets/images/mascot/sleeping.webp'),
  'history': require('../../../assets/images/mascot/history.webp'),
  'science': require('../../../assets/images/mascot/science.webp'),
  'geography': require('../../../assets/images/mascot/geography.webp'),
  'money': require('../../../assets/images/mascot/money.webp'),
  'arts': require('../../../assets/images/mascot/arts.webp'),
  'world-systems': require('../../../assets/images/mascot/world-systems.webp'),
};

export const SPOT_ART: Partial<Record<MascotSpot, ImageSourcePropType>> = {
  // 'first-question': require('../../../assets/images/mascot/spots/first-question.webp'),
  // 'first-miss': require('../../../assets/images/mascot/spots/first-miss.webp'),
  // 'first-checkpoint': require('../../../assets/images/mascot/spots/first-checkpoint.webp'),
  // 'first-review': require('../../../assets/images/mascot/spots/first-review.webp'),
  // 'sign-in': require('../../../assets/images/mascot/spots/sign-in.webp'),
  // 'onboarding.hello': require('../../../assets/images/mascot/spots/onboarding.hello.webp'),
  // 'tip.first-question': require('../../../assets/images/mascot/spots/tip.first-question.webp'),
  // 'tip.first-miss': require('../../../assets/images/mascot/spots/tip.first-miss.webp'),
  // 'tip.first-checkpoint': require('../../../assets/images/mascot/spots/tip.first-checkpoint.webp'),
  // 'tip.first-review': require('../../../assets/images/mascot/spots/tip.first-review.webp'),
  // 'checkpoint.intro': require('../../../assets/images/mascot/spots/checkpoint.intro.webp'),
  // 'feedback.correct': require('../../../assets/images/mascot/spots/feedback.correct.webp'),
  // 'feedback.wrong': require('../../../assets/images/mascot/spots/feedback.wrong.webp'),
  // 'level-complete.cleared': require('../../../assets/images/mascot/spots/level-complete.cleared.webp'),
  // 'level-complete.level-up': require('../../../assets/images/mascot/spots/level-complete.level-up.webp'),
  // 'level-complete.mastery': require('../../../assets/images/mascot/spots/level-complete.mastery.webp'),
  // 'review-complete': require('../../../assets/images/mascot/spots/review-complete.webp'),
  // 'daily-complete': require('../../../assets/images/mascot/spots/daily-complete.webp'),
  // 'review.empty': require('../../../assets/images/mascot/spots/review.empty.webp'),
  // 'loading': require('../../../assets/images/mascot/spots/loading.webp'),
  // 'error.load': require('../../../assets/images/mascot/spots/error.load.webp'),
  // 'level.locked': require('../../../assets/images/mascot/spots/level.locked.webp'),
  // 'not-found': require('../../../assets/images/mascot/spots/not-found.webp'),
};

export function mascotArt(pose: MascotPose, spot?: MascotSpot): ImageSourcePropType {
  return (spot && SPOT_ART[spot]) ?? POSE_ART[pose] ?? reference;
}
