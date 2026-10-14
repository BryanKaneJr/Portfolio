/**
 * Greater crowns (content/formables.json): a realm that holds enough of a crown's lands may proclaim it, taking its
 * name, arms and lasting bonus. Stubs for now; the rules come with the crowns themselves.
 */
import type { GameState, NationId, RegionId } from './types';

/** How near a realm is to a crown it may aim at. */
export interface CrownProgress {
  id: string;
  held: number;
  need: number;
  keysMissing: RegionId[];
  ready: boolean;
  /** Why it cannot be proclaimed yet, if it cannot. */
  why?: string;
}

/** The crowns `n` may aim at, and how near it is to each. */
export function crownProgress(_s: GameState, _n: NationId): CrownProgress[] {
  return [];
}

/** Null if `n` may proclaim crown `id` now, otherwise the reason it may not. */
export function canProclaim(_s: GameState, _n: NationId, _id: string): string | null {
  return 'Not yet';
}

/** `n` proclaims crown `id` (call only when canProclaim allows it). */
export function proclaim(_s: GameState, _n: NationId, _id: string): void {}

/** Every January: the computer's realms proclaim the crowns they are ready for, and the player hears of theirs. */
export function monthlyCrowns(_s: GameState): void {}
