/**
 * What each crown wants, so the AI behaves roughly as history did: France wants the English off the continent,
 * Castile wants Granada, Muscovy wants the Russian lands. Wanted land comes from two places: historical aims
 * (content/aims.json, each with optional years; AI crowns only) and the land named in the goals of a crown's open
 * missions. The AI forges claims on it, prefers wars against whoever holds it, asks for it first at
 * the peace table and thinks less of the holder. Old friendships and enmities (bonds) colour opinion both ways.
 */
import { AIMS, BONDS, MISSIONS, REGION } from './content';
import type { AimDef, BondDef, Condition, GameState, MissionDef, NationId, RegionId } from './types';
import { yearOf } from './util';

/** How much a crown wants land named by a historical aim, and by an open mission's goal. */
export const AIM_WEIGHT = 2;
export const MISSION_WEIGHT = 1;

const inYears = (s: GameState, x: { from?: number; until?: number }) => {
  const y = yearOf(s.day);
  return (x.from === undefined || y >= x.from) && (x.until === undefined || y < x.until);
};

/** Does `n` hold this region, itself or through a subject? */
export function holds(s: GameState, n: NationId, r: RegionId): boolean {
  const o = s.regions[r]?.owner;
  return !!o && (o === n || s.nations[o]?.overlord === n);
}

const AIMS_OF = new Map<NationId, AimDef[]>();
for (const a of AIMS) AIMS_OF.set(a.nation, [...(AIMS_OF.get(a.nation) ?? []), a]);
const MISSIONS_OF = new Map<string, MissionDef[]>();
for (const m of MISSIONS) MISSIONS_OF.set(m.nation, [...(MISSIONS_OF.get(m.nation) ?? []), m]);

/** Historical aims this crown still pursues: the years fit and it lacks some of the land. None for the player. */
export function activeAims(s: GameState, n: NationId): AimDef[] {
  if (n === s.player && !('__spectate' in s.flags)) return [];
  return (AIMS_OF.get(n) ?? []).filter(a => inYears(s, a) && a.regions.some(r => !holds(s, n, r)));
}

function goalRegions(c: Condition, out: Set<RegionId>): void {
  const k = Object.keys(c)[0];
  const v = (c as Record<string, unknown>)[k];
  if (k === 'all' || k === 'any') for (const x of v as Condition[]) goalRegions(x, out);
  else if (k === 'owns' || k === 'ownsAny') for (const r of Array.isArray(v) ? v : [v]) out.add(r as RegionId);
  else if (k === 'controls') out.add(v as RegionId);
}

// Rebuilt when the day or the crown's finished missions change, so it never depends on when it was first asked.
const cache = new WeakMap<GameState, Map<NationId, { key: string; wanted: Map<RegionId, number> }>>();

/**
 * Region → how much `n` wants it (AIM_WEIGHT or MISSION_WEIGHT). Includes land it already holds: callers ask
 * about land held by someone else (`wantsFrom`).
 */
export function wantedRegions(s: GameState, n: NationId): Map<RegionId, number> {
  const nat = s.nations[n];
  const key = `${s.day}|${nat?.missionsDone.length ?? 0}`;
  let byNation = cache.get(s);
  if (!byNation) cache.set(s, (byNation = new Map()));
  const hit = byNation.get(n);
  if (hit && hit.key === key) return hit.wanted;
  const wanted = new Map<RegionId, number>();
  if (nat?.alive) {
    for (const m of MISSIONS_OF.get(n) ?? MISSIONS_OF.get('generic') ?? []) {
      if (nat.missionsDone.includes(m.id) || !m.requires.every(r => nat.missionsDone.includes(r))) continue;
      const goal = new Set<RegionId>();
      goalRegions(m.goal, goal);
      for (const r of goal) if (REGION[r]) wanted.set(r, Math.max(wanted.get(r) ?? 0, MISSION_WEIGHT));
    }
    for (const a of activeAims(s, n)) for (const r of a.regions) wanted.set(r, AIM_WEIGHT);
  }
  byNation.set(n, { key, wanted });
  return wanted;
}

/** Land `n` wants that `holder` (or one of its subjects) holds now, most wanted first. */
export function wantsFrom(s: GameState, n: NationId, holder: NationId, minWeight = MISSION_WEIGHT): RegionId[] {
  const out: [RegionId, number][] = [];
  for (const [r, w] of wantedRegions(s, n)) if (w >= minWeight && holds(s, holder, r) && !holds(s, n, r)) out.push([r, w]);
  return out.sort((a, b) => b[1] - a[1] || s.regions[b[0]].dev - s.regions[a[0]].dev).map(x => x[0]);
}

/** Old friendships and enmities between two crowns that hold in the current year. */
export function bondsBetween(s: GameState, a: NationId, b: NationId): BondDef[] {
  return BONDS.filter(x => ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && inYears(s, x));
}

export function bondsOf(s: GameState, n: NationId): BondDef[] {
  return BONDS.filter(x => (x.a === n || x.b === n) && inYears(s, x) && s.nations[x.a]?.alive && s.nations[x.b]?.alive);
}
