/** The clock's speeds, and the one rule on them: the fastest is for quiet years, not for wars. */
import { atWar } from '../sim/queries';
import type { GameState } from '../sim/types';

/** Days per real second at each speed. */
export const SPEEDS = [1.5, 3, 6, 12];
export const SPEED_LABELS = ['1×', '2×', '4×', '8×'];
/** The quiet-years speed: refused, and dropped, while the player is at war. */
export const FAST = 3;

/** The speed the clock may run at when `i` is asked for: never FAST while the player is at war. */
export function allowedSpeed(s: GameState | null, i: number): number {
  const want = Math.max(0, Math.min(SPEEDS.length - 1, i));
  return want === FAST && s && atWar(s, s.player) ? FAST - 1 : want;
}
