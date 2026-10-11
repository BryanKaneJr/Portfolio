/** Read-only questions about the game state used everywhere: who owns what, who is at war with whom. */
import { ERA, GRAPH, MAP_REGION, NATION, POLICY, REGION, TRAITS, UNITS, isNativeNation, isNewWorld, isSea } from './content';
import type { Army, Fleet, GameState, Modifiers, Nation, NationId, NodeId, Region, RegionId, UnitType, War } from './types';
import { setNewsHelpers } from './log';
import { pairKey, yearOf } from './util';

export const REBELS = 'REB';

// The news filter in log.ts needs these; hand them over here to avoid an import cycle.
setNewsHelpers(s => neighborsOf(s, s.player), n => NATION[n]?.tier === 'major');

// Ownership changes rarely, so regions-by-owner is cached until territory.ts bumps the version.
let ownVersion = 0;
let ownCache: { state: GameState | null; version: number; byOwner: Map<NationId, Region[]> } = { state: null, version: -1, byOwner: new Map() };
/** Call whenever a region's owner changes. */
export const bumpOwnership = () => {
  ownVersion++;
};
export const ownershipVersion = () => ownVersion;
export function ownedRegions(s: GameState, n: NationId): Region[] {
  if (ownCache.state !== s || ownCache.version !== ownVersion) {
    const byOwner = new Map<NationId, Region[]>();
    for (const id in s.regions) {
      const r = s.regions[id];
      if (!r.owner) continue;
      const l = byOwner.get(r.owner);
      if (l) l.push(r);
      else byOwner.set(r.owner, [r]);
    }
    ownCache = { state: s, version: ownVersion, byOwner };
  }
  return ownCache.byOwner.get(n) ?? [];
}
export const regionCount = (s: GameState, n: NationId) => ownedRegions(s, n).length;
export const totalDev = (s: GameState, n: NationId) => ownedRegions(s, n).reduce((a, r) => a + r.dev, 0);
export const isCored = (r: Region) => !!r.owner && r.cores.includes(r.owner);

export function aliveNations(s: GameState): Nation[] {
  return Object.values(s.nations).filter(n => n.alive);
}

export const allied = (s: GameState, a: NationId, b: NationId) => pairKey(a, b) in s.alliances;
export const married = (s: GameState, a: NationId, b: NationId) => pairKey(a, b) in s.marriages;
export const hasTruce = (s: GameState, a: NationId, b: NationId) => (s.truces[pairKey(a, b)] ?? -1) > s.day;
export function alliesOf(s: GameState, n: NationId): NationId[] {
  const out: NationId[] = [];
  for (const k in s.alliances) {
    const [a, b] = k.split('|');
    if (a === n && s.nations[b]?.alive) out.push(b);
    else if (b === n && s.nations[a]?.alive) out.push(a);
  }
  return out;
}
export function subjectsOf(s: GameState, n: NationId): NationId[] {
  return Object.values(s.nations)
    .filter(x => x.alive && x.overlord === n)
    .map(x => x.id);
}
/** The top of a nation's subject chain (itself if independent). */
export function topOverlord(s: GameState, n: NationId): NationId {
  let cur = n;
  for (let i = 0; i < 4 && s.nations[cur]?.overlord; i++) cur = s.nations[cur].overlord!;
  return cur;
}

export function warsOf(s: GameState, n: NationId): War[] {
  return Object.values(s.wars).filter(w => w.attackers.includes(n) || w.defenders.includes(n));
}
export function sideOf(w: War, n: NationId): 0 | 1 | null {
  if (w.attackers.includes(n)) return 0;
  if (w.defenders.includes(n)) return 1;
  return null;
}
// Who is at war with whom, rebuilt whenever a war changes (bumpWars) or a new day starts.
let warVersion = 0;
let warCache: { state: GameState | null; version: number; day: number; pairs: Map<string, War> } = { state: null, version: -1, day: -1, pairs: new Map() };
export const bumpWars = () => {
  warVersion++;
};
function warPairs(s: GameState): Map<string, War> {
  if (warCache.state === s && warCache.version === warVersion && warCache.day === s.day) return warCache.pairs;
  const pairs = new Map<string, War>();
  for (const id in s.wars) {
    const w = s.wars[id];
    for (const a of w.attackers) for (const d of w.defenders) pairs.set(a < d ? `${a}|${d}` : `${d}|${a}`, w);
  }
  warCache = { state: s, version: warVersion, day: s.day, pairs };
  return pairs;
}
export function warBetween(s: GameState, a: NationId, b: NationId): War | undefined {
  return warPairs(s).get(a < b ? `${a}|${b}` : `${b}|${a}`);
}
export function warBetweenSlow(s: GameState, a: NationId, b: NationId): War | undefined {
  for (const id in s.wars) {
    const w = s.wars[id];
    const sa = sideOf(w, a);
    const sb = sideOf(w, b);
    if (sa !== null && sb !== null && sa !== sb) return w;
  }
  return undefined;
}
export const atWar = (s: GameState, n: NationId) => warsOf(s, n).length > 0;

/** Can these two sides fight? Rebels fight the nation they rebel against (and its allies in the region). */
export function hostile(s: GameState, a: NationId, b: NationId, rebelOfA?: NationId, rebelOfB?: NationId): boolean {
  if (a === b) return false;
  if (a === REBELS || b === REBELS) {
    if (a === REBELS && b === REBELS) return false;
    const target = a === REBELS ? rebelOfA : rebelOfB;
    const other = a === REBELS ? b : a;
    return !!target && (other === target || s.nations[other]?.overlord === target);
  }
  return !!warBetween(s, a, b);
}
export const armiesHostile = (s: GameState, x: Army, y: Army) => hostile(s, x.owner, y.owner, x.rebelOf, y.rebelOf);

export function neighborsOf(s: GameState, n: NationId): NationId[] {
  const set = new Set<NationId>();
  for (const r of ownedRegions(s, n))
    for (const e of GRAPH[r.id]) {
      if (e.kind !== 'land' && e.kind !== 'strait') continue;
      const o = s.regions[e.to]?.owner;
      if (o && o !== n) set.add(o);
    }
  return [...set];
}
export const borders = (s: GameState, a: NationId, b: NationId) => neighborsOf(s, a).includes(b);

export function isCoastal(s: GameState, n: NationId): boolean {
  return ownedRegions(s, n).some(r => MAP_REGION[r.id].seas.length > 0);
}

// ---------------------------------------------------------------- armies & strength

export const armyRegs = (a: Army) => a.regs.inf.n + a.regs.cav.n + a.regs.art.n;
export const armyMen = (a: Army) => a.regs.inf.men + a.regs.cav.men + a.regs.art.men;
export const armiesOf = (s: GameState, n: NationId): Army[] => Object.values(s.armies).filter(a => a.owner === n);
export const fleetsOf = (s: GameState, n: NationId): Fleet[] => Object.values(s.fleets).filter(f => f.owner === n);
export const armiesAt = (s: GameState, node: NodeId): Army[] => Object.values(s.armies).filter(a => a.node === node && a.path.length === 0);
export function totalRegiments(s: GameState, n: NationId): number {
  let t = 0;
  for (const id in s.armies) if (s.armies[id].owner === n) t += armyRegs(s.armies[id]);
  return t;
}
export function totalShips(s: GameState, n: NationId): number {
  let t = 0;
  for (const f of fleetsOf(s, n)) t += f.ships.galley + f.ships.warship + f.ships.transport;
  return t;
}

/** New World peoples fight without steel, guns or horses: their armies are weaker and break sooner. */
const NATIVE_POWER = 0.5;
const NATIVE_MORALE = 0.8;

/** Rough military power for AI comparisons: men weighted by era quality. */
const powerCache = new Map<NationId, { state: GameState; day: number; v: number }>();
export function militaryPower(s: GameState, n: NationId): number {
  const hit = powerCache.get(n);
  if (hit && hit.state === s && hit.day === s.day) return hit.v;
  const v = computePower(s, n);
  powerCache.set(n, { state: s, day: s.day, v });
  return v;
}
function computePower(s: GameState, n: NationId): number {
  const nat = s.nations[n];
  if (!nat) return 0;
  const era = ERA(nat.era);
  let p = 0;
  for (const a of armiesOf(s, n)) {
    p += (a.regs.inf.men * era.inf.power + a.regs.cav.men * era.cav.power + a.regs.art.men * (era.art?.power ?? 1)) / 1000;
  }
  // Manpower in reserve counts for a little: it becomes regiments over a war.
  return (p + nat.manpower / 4000) * (isNativeNation(n) ? NATIVE_POWER : 1);
}

/** Force limit: how many regiments a nation can field without extra upkeep. New World land counts half. */
export function forceLimit(s: GameState, n: NationId): number {
  let dev = 0;
  for (const r of ownedRegions(s, n)) dev += REGION[r.id].nw ? r.dev / 2 : r.dev;
  return Math.round(6 + dev / 2.5);
}

// ---------------------------------------------------------------- modifiers

let modVersion = 0;
const modCache = new Map<NationId, { day: number; state: GameState; version: number; mods: Required<Modifiers> }>();
/** Call after anything that changes a nation's modifiers mid-day (policies, rulers, timed modifiers). */
export const invalidateMods = () => {
  modVersion++;
};
const ZERO: Required<Modifiers> = {
  taxIncome: 0, tradeIncome: 0, manpower: 0, morale: 0, infantryPower: 0, cavalryPower: 0, artilleryPower: 0,
  fortDefense: 0, siegeSpeed: 0, attrition: 0, upkeep: 0, mercCost: 0, devCost: 0, coreCost: 0, fortCost: 0,
  shipCost: 0, navalPower: 0, threatDecay: 0, threatGain: 0, opinion: 0, diplomacy: 0, holyWarMorale: 0, unrest: 0,
  techCost: 0, movement: 0, prestigeGain: 0, stabilityCost: 0, colonists: 0, settlerGrowth: 0,
};

export interface ModSource {
  name: string;
  mods: Modifiers;
}

/** Every modifier source affecting a nation, for tooltips ("why is my income +15%?"). */
export function modifierSources(s: GameState, n: NationId): ModSource[] {
  const nat = s.nations[n];
  const def = NATION[n];
  if (!nat || !def) return [];
  const out: ModSource[] = [];
  const t = TRAITS.national[def.trait];
  if (t) out.push({ name: t.name, mods: t.mods });
  for (const tr of nat.ruler.traits) {
    const rt = TRAITS.ruler[tr];
    if (rt) out.push({ name: `${nat.ruler.name}: ${rt.name}`, mods: rt.mods });
  }
  for (const p of nat.policies) if (POLICY[p]) out.push({ name: POLICY[p].name, mods: POLICY[p].mods });
  for (const m of nat.modifiers) if (m.until < 0 || m.until > s.day) out.push({ name: m.name, mods: m.mods });
  if (s.hre.emperor === n) out.push({ name: 'Holy Roman Emperor', mods: { manpower: 0.1, diplomacy: 1, opinion: 10 } });
  // Difficulty: the AI gets a small bonus or malus.
  if (n !== s.player && s.settings.difficulty !== 'normal') {
    const k = s.settings.difficulty === 'hard' ? 1 : -1;
    out.push({ name: 'Difficulty', mods: { taxIncome: 0.2 * k, manpower: 0.2 * k } });
  }
  return out;
}

export function nationMods(s: GameState, n: NationId): Required<Modifiers> {
  const hit = modCache.get(n);
  if (hit && hit.day === s.day && hit.state === s && hit.version === modVersion) return hit.mods;
  const mods: Required<Modifiers> = { ...ZERO };
  for (const src of modifierSources(s, n)) for (const k in src.mods) (mods as any)[k] += (src.mods as any)[k] ?? 0;
  modCache.set(n, { day: s.day, state: s, version: modVersion, mods });
  return mods;
}

export function maxMorale(s: GameState, n: NationId): number {
  if (n === REBELS) return 2.0;
  const nat = s.nations[n];
  return ERA(nat?.era ?? 1).morale * (1 + nationMods(s, n).morale) * (isNativeNation(n) ? NATIVE_MORALE : 1);
}

export function unitPower(s: GameState, n: NationId, t: UnitType): number {
  if (n === REBELS) return t === 'inf' ? 0.9 : t === 'cav' ? 1.3 : 0.8;
  const nat = s.nations[n];
  const era = ERA(nat.era);
  const m = nationMods(s, n);
  const k = isNativeNation(n) ? NATIVE_POWER : 1;
  if (t === 'inf') return era.inf.power * (1 + m.infantryPower) * k;
  if (t === 'cav') return era.cav.power * (1 + m.cavalryPower) * k;
  return (era.art?.power ?? 0.8) * (1 + m.artilleryPower) * k;
}

/** The latest era whose start year has passed (the player still has to pay to adopt it). */
export const availableEra = (s: GameState) => {
  const y = yearOf(s.day);
  let e = 1;
  for (const era of UNITS.eras) if (y >= era.start) e = era.id;
  return e;
};

export function rulerAge(s: GameState, n: NationId): number {
  return yearOf(s.day) - s.nations[n].ruler.born;
}

// ---------------------------------------------------------------- access & movement permissions

/** May army owner `n` enter region `r`? */
export function canEnter(s: GameState, n: NationId, node: NodeId, rebelOf?: NationId): boolean {
  if (!s.discovery && isNewWorld(node)) return false;
  if (isSea(node)) return true;
  const r = s.regions[node];
  if (!r) return false;
  if (n === REBELS) return true;
  const o = r.owner;
  const c = r.controller;
  // Uncolonized land is open to anyone.
  if (!o || !c) return true;
  if (o === n || c === n) return true;
  if (topOverlord(s, o) === topOverlord(s, n)) return true;
  if (allied(s, n, o)) return true;
  if (`${o}>${n}` in s.access) return true;
  if (hostile(s, n, o) || controllerHostile(s, n, r)) return true;
  return false;
}

/** Is whoever holds region `r` right now an enemy of `n`? Rebels holding a region are enemies of its owner's camp. */
export function controllerHostile(s: GameState, n: NationId, r: Region): boolean {
  if (!r.controller || !r.owner) return false;
  if (r.controller === REBELS) return friendlyTo(s, n, r.owner);
  return hostile(s, n, r.controller);
}
/** Same nation, same overlord chain, or allied. */
export function friendlyTo(s: GameState, a: NationId, b: NationId | null): boolean {
  if (!b) return false;
  if (a === b) return true;
  if (a === REBELS || b === REBELS) return false;
  return topOverlord(s, a) === topOverlord(s, b) || allied(s, a, b);
}

/** Is region `r` a hostile fort for nation `n` (stops movement through it)? */
export function hostileFort(s: GameState, n: NationId, r: RegionId): boolean {
  const reg = s.regions[r];
  if (!reg || reg.fort <= 0) return false;
  return controllerHostile(s, n, reg);
}

export const capitalOf = (s: GameState, n: NationId) => s.nations[n]?.capital;
export const regionDef = (id: RegionId) => REGION[id];
