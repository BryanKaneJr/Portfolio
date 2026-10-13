/** The player's message log and pause requests collected during a tick. */
import type { GameState, LogEntry, NationId, NodeId, Offer, PauseReason } from './types';

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

/** Pause reasons raised during the current tick; drained by advanceDay(). Only those the player's settings ask for. */
let pending: PauseReason[] = [];
export function requestPause(s: GameState, reason: PauseReason): void {
  if (s.settings.autoPause[reason] && !pending.includes(reason)) pending.push(reason);
}
export function drainPauses(): PauseReason[] {
  const out = pending;
  pending = [];
  return out;
}

/** The setting that decides whether an offer to the player stops the clock (and pops its card) or is only announced. */
export const offerPause = (o: Pick<Offer, 'kind'> & { ultimatum?: number }): PauseReason =>
  o.kind === 'peace' ? (o.ultimatum !== undefined ? 'ultimatum' : 'peaceOffer') : 'offer';

/** True if the player's nation (or its subjects/allies at war beside it) is involved. */
export const involvesPlayer = (s: GameState, ...nations: (NationId | undefined)[]) => nations.includes(s.player);

/**
 * Is this worth a line in the player's news feed? Anything involving the player, their neighbours,
 * allies or subjects, or a great power. Keeps the log readable when 60 AI nations are busy.
 */
export function newsworthy(s: GameState, ...nations: (NationId | undefined)[]): boolean {
  const p = s.player;
  for (const n of nations) {
    if (!n) continue;
    if (n === p) return true;
    const nat = s.nations[n];
    if (!nat) continue;
    if (nat.overlord === p || s.nations[p]?.overlord === n) return true;
    const key = n < p ? `${n}|${p}` : `${p}|${n}`;
    if (key in s.alliances) return true;
    if (neighbourCache(s).has(n)) return true;
  }
  // Great powers fighting each other is world news.
  return nations.filter(n => n && isMajor(n)).length >= 2;
}

let nbState: GameState | null = null;
let nbDay = -1;
let nb = new Set<NationId>();
function neighbourCache(s: GameState): Set<NationId> {
  if (nbState === s && nbDay === s.day) return nb;
  nbState = s;
  nbDay = s.day;
  nb = new Set(neighborsOfPlayer(s));
  return nb;
}
let neighborsOfPlayer: (s: GameState) => NationId[] = () => [];
let isMajor: (n: NationId) => boolean = () => false;
/** Wired up by queries.ts to avoid an import cycle. */
export function setNewsHelpers(neighbors: (s: GameState) => NationId[], major: (n: NationId) => boolean) {
  neighborsOfPlayer = neighbors;
  isMajor = major;
}
