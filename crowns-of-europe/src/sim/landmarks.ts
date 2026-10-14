/**
 * Landmarks: fifteen famous places (Hagia Sophia, the Alhambra, the Kremlin...), each with one fixed bonus for
 * whoever holds its region. Nothing to build and no upkeep; an occupied landmark gives nothing until it is free.
 * The bonus reaches a realm through `modifierSources` (queries.ts); territory.ts refreshes the modifiers when one
 * changes hands.
 */
import { LANDMARKS, REGION } from './content';
import { MODIFIER_KEYS } from './dsl';
import type { LandmarkDef } from './content';
import type { GameState, NationId } from './types';

/** The landmarks realm `n` holds: it owns their region and its own troops hold it (not occupied). */
export function landmarksHeld(s: GameState, n: NationId): LandmarkDef[] {
  const out: LandmarkDef[] = [];
  for (const lm of LANDMARKS) {
    const r = s.regions[lm.region];
    if (r && r.owner === n && r.controller === n) out.push(lm);
  }
  return out;
}

/** Who holds landmark `id` now (null: nobody, or its region is occupied). */
export function heldBy(s: GameState, id: string): NationId | null {
  const lm = LANDMARKS.find(l => l.id === id);
  const r = lm ? s.regions[lm.region] : undefined;
  return r && r.owner && r.controller === r.owner ? r.owner : null;
}

/** Longest history line a landmark may have (it is read on a phone, under the name). */
export const LANDMARK_TEXT_MAX = 90;

/**
 * What is wrong with a list of landmarks (empty when nothing): an unknown region, two in one region, other than
 * exactly one known modifier, no picture (`pictures`: the landmark ids that have a baked painting), a missing name or
 * a history line too long. Used by scripts/validate-content.ts and the tests.
 */
export function landmarkErrors(list: LandmarkDef[], pictures?: string[]): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  const regions = new Set<string>();
  for (const lm of list) {
    const at = `landmark ${lm.id}`;
    if (ids.has(lm.id)) errs.push(`${at}: id used twice`);
    ids.add(lm.id);
    if (!REGION[lm.region]) errs.push(`${at}: unknown region ${lm.region}`);
    if (regions.has(lm.region)) errs.push(`${at}: ${lm.region} already has a landmark`);
    regions.add(lm.region);
    const keys = Object.keys(lm.mods ?? {});
    if (keys.length !== 1) errs.push(`${at}: needs exactly one bonus (has ${keys.length})`);
    for (const k of keys) if (!MODIFIER_KEYS.includes(k)) errs.push(`${at}: unknown modifier ${k}`);
    if (pictures && !pictures.includes(lm.id)) errs.push(`${at}: no picture (art/landmarks/${lm.id}.png, then npm run landmarks:build)`);
    if (!lm.name?.trim()) errs.push(`${at}: needs a name`);
    if (!lm.text?.trim()) errs.push(`${at}: needs its history ('text')`);
    else if (lm.text.length > LANDMARK_TEXT_MAX) errs.push(`${at}: text is over ${LANDMARK_TEXT_MAX} characters`);
  }
  return errs;
}
