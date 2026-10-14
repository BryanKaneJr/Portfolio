/**
 * Endowment: the crown endows one field of learning (war, sea or statecraft). Its advances cost a fifth less and
 * the others a tenth more (one factor in `advanceCost`, science.ts). The first choice is free; after that it can
 * change once every 25 years. One tap, nothing to keep up.
 */
import { NATION, isNativeNation } from './content';
import { isCoastal } from './queries';
import type { AdvanceDef, GameState, Nation, NationId } from './types';
import { yearOf, years } from './util';

export type Field = AdvanceDef['field'];

export const ENDOW = { own: -0.2, others: 0.1, years: 25 };
/** The fields as the player reads them (the Science tab's own names). */
export const FIELD_NAME: Record<Field, string> = { war: 'War', sea: 'Sea', state: 'Statecraft' };
/** The crowns that look to the sea whatever their temper: the first colonial powers. */
const SEAFARERS = ['POR', 'CAS', 'ENG'];
/**
 * The crowns that endow statecraft whatever their temper. The Ottomans: endowing war, their troops reached the age of
 * the musket about 1590 instead of about 1635 (`scripts/dev/ottomans.ts 260 1 2`), closing the gap with Europe the
 * science is tuned to open by 1600 (design notes, "Europe's science answer").
 */
const STATESMEN = ['TUR'];

/** Dev-only tallies for scripts/dev (the game never reads them). */
export const COUNTS = { byField: { war: 0, sea: 0, state: 0 } as Record<Field, number> };

/** The day the endowment may change again (undefined before the first choice). */
export const endowLockedUntil = (nat: Nation): number | undefined => (nat.endowment ? nat.endowment.since + years(ENDOW.years) : undefined);

/** Why this crown cannot endow that field now, or null if it can. */
export function endowBlocked(s: GameState, n: NationId, field: Field): string | null {
  const nat = s.nations[n];
  if (!nat?.alive || isNativeNation(n)) return 'Your people follow their own ways';
  if (nat.endowment?.field === field) return 'Already endowed';
  const until = endowLockedUntil(nat);
  if (until !== undefined && s.day < until) return `Change again in ${yearOf(until)}`;
  return null;
}

export function endow(s: GameState, n: NationId, field: Field): void {
  if (endowBlocked(s, n, field)) return;
  s.nations[n].endowment = { field, since: s.day };
}

/** The factor an advance's cost takes from the endowment, if any. */
export function endowFactor(nat: Nation, field: Field): { label: string; value: number } | null {
  const e = nat.endowment;
  if (!e) return null;
  return e.field === field ? { label: `Endowed: ${FIELD_NAME[field]}`, value: 1 + ENDOW.own } : { label: 'Endowed elsewhere', value: 1 + ENDOW.others };
}

/** The AI endows once, by its temper (the first colonial powers look to the sea, the Ottomans to statecraft), and never changes. */
export function aiEndowment(s: GameState, nat: Nation): void {
  if (nat.endowment || isNativeNation(nat.id)) return;
  const pers = NATION[nat.id]?.personality;
  const field: Field = SEAFARERS.includes(nat.id) ? 'sea' : STATESMEN.includes(nat.id) ? 'state' : pers === 'trader' ? (isCoastal(s, nat.id) ? 'sea' : 'state') : pers === 'defensive' ? 'state' : 'war';
  endow(s, nat.id, field);
  if (nat.endowment) COUNTS.byField[field]++;
}
