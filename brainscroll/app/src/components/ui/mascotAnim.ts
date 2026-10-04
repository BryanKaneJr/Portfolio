import type { MascotPose } from '@brainscroll/core';
import type { ImageSourcePropType } from 'react-native';

/**
 * Dr. Scroll's animations: sprite sheets of transparent frames, played once and
 * held on the last frame, or looped where `loop` is set (docs/mascot.md, "Animations").
 *
 * To add one: export PNG frames with a transparent background, then pack them
 * into a sheet (frames left to right, top to bottom, `cols` across, square
 * frames) at assets/images/mascot/anim/<name>.webp and add its line below.
 */
export interface MascotAnimation {
  sheet: ImageSourcePropType;
  frames: number;
  cols: number;
  /** Milliseconds per frame. */
  frameMs: number;
  /** Plays over and over (its first and last frames meet); otherwise once, holding the last. */
  loop?: boolean;
}

export const MASCOT_ANIMATIONS = {
  /** Waves hello, then points to his right (at a speech bubble beside him). 57 frames at 24 fps, about 2.4 s. */
  'wave-point': { sheet: require('../../../assets/images/mascot/anim/wave-point.webp'), frames: 57, cols: 8, frameMs: 42 },
  /** Eyes closed, smiling, clapping. 73 frames, about 3 s a loop. */
  clapping: { sheet: require('../../../assets/images/mascot/anim/clapping.webp'), frames: 73, cols: 8, frameMs: 42, loop: true },
  /** Puzzled, scratching his head. 96 frames, about 4 s a loop. */
  'scratch-head': { sheet: require('../../../assets/images/mascot/anim/scratch-head.webp'), frames: 96, cols: 8, frameMs: 42, loop: true },
  /** Floating in his space helmet. 96 frames, about 4 s a loop. */
  astronaut: { sheet: require('../../../assets/images/mascot/anim/astronaut.webp'), frames: 96, cols: 8, frameMs: 42, loop: true },
  /** Running happily, a bee buzzing round him. 96 frames, about 4 s a loop. */
  'bee-chase': { sheet: require('../../../assets/images/mascot/anim/bee-chase.webp'), frames: 96, cols: 8, frameMs: 42, loop: true },
  /** Balancing on one leg, wobbling. 93 frames, about 4 s a loop. */
  'yoga-wobble': { sheet: require('../../../assets/images/mascot/anim/yoga-wobble.webp'), frames: 93, cols: 8, frameMs: 42, loop: true },
} satisfies Record<string, MascotAnimation>;

export type MascotAnimationName = keyof typeof MASCOT_ANIMATIONS;

/**
 * Poses that come to life: wherever one of these stills would show (outside
 * lessons), its animation loops instead, so they turn up on the skill map, Level
 * Complete and the rest without each screen asking (owner, 2026-10-04).
 */
export const POSE_ANIMATION: Partial<Record<MascotPose, MascotAnimationName>> = {
  clapping: 'clapping',
  tangled: 'scratch-head',
  'space-helmet': 'astronaut',
  'bee-chase': 'bee-chase',
  'yoga-wobble': 'yoga-wobble',
};
