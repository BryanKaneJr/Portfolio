import type { MascotPose, MascotSpot } from '@brainscroll/core';
import type { ImageSourcePropType } from 'react-native';

/**
 * Dr. Scroll's artwork, all in this one file (docs/mascot.md, "Spots").
 *
 * Every place he appears asks for a SPOT (e.g. 'daily-complete'), and each spot
 * has a default POSE. The picture shown is the first that exists of:
 *
 *   1. SPOT_ART[spot]   one image for just that spot (skipped when the
 *                       placement asks for a pose, e.g. a skill's costume)
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
  'magnifier': require('../../../assets/images/mascot/magnifier.webp'),
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
  'archaeologist': require('../../../assets/images/mascot/archaeologist.webp'),
  'ballot': require('../../../assets/images/mascot/ballot.webp'),
  'bicycle': require('../../../assets/images/mascot/bicycle.webp'),
  'binoculars': require('../../../assets/images/mascot/binoculars.webp'),
  'camera': require('../../../assets/images/mascot/camera.webp'),
  'conducting': require('../../../assets/images/mascot/conducting.webp'),
  'cooking': require('../../../assets/images/mascot/cooking.webp'),
  'crown': require('../../../assets/images/mascot/crown.webp'),
  'diving': require('../../../assets/images/mascot/diving.webp'),
  'doctor': require('../../../assets/images/mascot/doctor.webp'),
  'drums': require('../../../assets/images/mascot/drums.webp'),
  'easel': require('../../../assets/images/mascot/easel.webp'),
  'exercise': require('../../../assets/images/mascot/exercise.webp'),
  'fishing': require('../../../assets/images/mascot/fishing.webp'),
  'gardening': require('../../../assets/images/mascot/gardening.webp'),
  'goggles': require('../../../assets/images/mascot/goggles.webp'),
  'guitar': require('../../../assets/images/mascot/guitar.webp'),
  'hard-hat': require('../../../assets/images/mascot/hard-hat.webp'),
  'headphones': require('../../../assets/images/mascot/headphones.webp'),
  'hiking': require('../../../assets/images/mascot/hiking.webp'),
  'juggling-planets': require('../../../assets/images/mascot/juggling-planets.webp'),
  'knight': require('../../../assets/images/mascot/knight.webp'),
  'laptop': require('../../../assets/images/mascot/laptop.webp'),
  'laurel': require('../../../assets/images/mascot/laurel.webp'),
  'map': require('../../../assets/images/mascot/map.webp'),
  'market-stall': require('../../../assets/images/mascot/market-stall.webp'),
  'piano': require('../../../assets/images/mascot/piano.webp'),
  'piggy-bank': require('../../../assets/images/mascot/piggy-bank.webp'),
  'podium': require('../../../assets/images/mascot/podium.webp'),
  'sailboat': require('../../../assets/images/mascot/sailboat.webp'),
  'sculpting': require('../../../assets/images/mascot/sculpting.webp'),
  'shopping': require('../../../assets/images/mascot/shopping.webp'),
  'space-helmet': require('../../../assets/images/mascot/space-helmet.webp'),
  'telescope': require('../../../assets/images/mascot/telescope.webp'),
  'toga': require('../../../assets/images/mascot/toga.webp'),
  'torch': require('../../../assets/images/mascot/torch.webp'),
  'umbrella': require('../../../assets/images/mascot/umbrella.webp'),
  'violin': require('../../../assets/images/mascot/violin.webp'),
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
  // 'home.path': require('../../../assets/images/mascot/spots/home.path.webp'),
  // 'review.ready': require('../../../assets/images/mascot/spots/review.ready.webp'),
  // 'not-found': require('../../../assets/images/mascot/spots/not-found.webp'),
};

export function mascotArt(pose: MascotPose, spot?: MascotSpot): ImageSourcePropType {
  return (spot && SPOT_ART[spot]) ?? POSE_ART[pose] ?? reference;
}
