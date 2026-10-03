import type { ImageSourcePropType } from 'react-native';

/**
 * Dr. Scroll's animations: sprite sheets of transparent frames, played once and
 * held on the last frame (docs/mascot.md, "Animations").
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
}

export const MASCOT_ANIMATIONS = {
  /** Waves hello, then points to his right (at a speech bubble beside him). 57 frames, about 4 s. */
  'wave-point': { sheet: require('../../../assets/images/mascot/anim/wave-point.webp'), frames: 57, cols: 8, frameMs: 70 },
} satisfies Record<string, MascotAnimation>;

export type MascotAnimationName = keyof typeof MASCOT_ANIMATIONS;
