/** The player's message log and pause requests collected during a tick. */
import type { GameState, LogEntry, NationId, NodeId, PauseReason } from './types';

const MAX_LOG = 150;

export function log(
  s: GameState,
  kind: LogEntry['kind'],
  text: string,
  opts: { node?: NodeId; nation?: NationId; important?: boolean } = {},
): void {
  s.log.unshift({ id: ++s.seq, day: s.day, kind, text, ...opts });
  if (s.log.length > MAX_LOG) s.log.length = MAX_LOG;
}

/** Pause reasons raised during the current tick; drained by advanceDay(). */
let pending: PauseReason[] = [];
export function requestPause(s: GameState, reason: PauseReason): void {
  if (s.settings.autoPause[reason] && !pending.includes(reason)) pending.push(reason);
}
export function drainPauses(): PauseReason[] {
  const out = pending;
  pending = [];
  return out;
}

/** True if the player's nation (or its subjects/allies at war beside it) is involved. */
export const involvesPlayer = (s: GameState, ...nations: (NationId | undefined)[]) => nations.includes(s.player);
