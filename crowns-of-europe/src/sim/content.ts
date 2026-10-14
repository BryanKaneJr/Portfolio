/** Typed access to the bundled JSON content, plus the movement graph built from the map. */
import regionsJson from '../content/regions.json';
import seasJson from '../content/seas.json';
import mapJson from '../content/map.json';
import nationsJson from '../content/nations.json';
import scenarioJson from '../content/scenario1444.json';
import traitsJson from '../content/traits.json';
import policiesJson from '../content/policies.json';
import unitsJson from '../content/units.json';
import historicalEventsJson from '../content/events-historical.json';
import genericEventsJson from '../content/events-generic.json';
import newWorldEventsJson from '../content/events-newworld.json';
import missionsJson from '../content/missions.json';
import achievementsJson from '../content/achievements.json';
import aimsJson from '../content/aims.json';
import advancesJson from '../content/advances.json';
import namesJson from '../content/names.json';
import type {
  AchievementDef,
  AdvanceDef,
  AimDef,
  BondDef,
  EventDef,
  MapData,
  MapRegion,
  MapSea,
  MissionDef,
  NationDef,
  NationId,
  NodeId,
  PolicyDef,
  RegionDef,
  RegionId,
  SeaId,
  ShipType,
  TraitDef,
  UnitEra,
  UnitType,
} from './types';

export const REGIONS = regionsJson as unknown as RegionDef[];
export const REGION: Record<RegionId, RegionDef> = Object.fromEntries(REGIONS.map(r => [r.id, r]));

export const MAP = mapJson as unknown as MapData;
export const MAP_REGION: Record<RegionId, MapRegion> = Object.fromEntries(MAP.regions.map(r => [r.id, r]));
export const MAP_SEA: Record<SeaId, MapSea> = Object.fromEntries(MAP.seas.map(s => [s.id, s]));

export interface SeaDef {
  id: SeaId;
  name: string;
  ocean?: boolean; // open ocean: a coast here lets you send colonists overseas
  nw?: boolean; // New World waters: closed until the New World is discovered
  closed?: boolean; // outside the game: drawn on the map, never sailed
  charted?: boolean; // a closed sea drawn as water rather than as the parchment of the unknown
  days?: number; // days to cross (default 4; the open Atlantic takes much longer)
}
export interface StraitDef {
  a: RegionId;
  b: RegionId;
  sea: SeaId;
  name: string;
}
export const SEAS = ((seasJson as any).seas as SeaDef[]).filter(s => !s.closed);
export const SEA: Record<SeaId, SeaDef> = Object.fromEntries(SEAS.map(s => [s.id, s]));
export const STRAITS = (seasJson as any).straits as StraitDef[];
export const WASTELANDS = (seasJson as any).wastelands as { id: string; name: string }[];
/** Wildernesses across the Atlantic (hidden with the rest of the New World until it is discovered). */
export const NW_WASTELANDS = new Set(((seasJson as any).wastelands as { id: string; seeds: [number, number][] }[]).filter(w => w.seeds[0][0] < -30).map(w => w.id));
/** Sea zones the game never uses (the Pacific, Hudson Bay...): drawn as darker water. */
/** Every water's name, closed seas included (for map labels). */
export const SEA_NAMES: Record<string, string> = Object.fromEntries(((seasJson as any).seas as SeaDef[]).map(s => [s.id, s.name]));
export const CLOSED_SEAS = new Set(((seasJson as any).seas as SeaDef[]).filter(s => s.closed).map(s => s.id));
/** Borders along a major river ("a|b", sorted): attacking across one costs the attacker 1 on every roll. */
export const RIVERS: Map<string, string> = new Map(
  ((seasJson as any).rivers as { name: string; between: [string, string][] }[]).flatMap(r => r.between.map(([a, b]) => [a < b ? `${a}|${b}` : `${b}|${a}`, r.name] as [string, string])),
);
export const riverBetween = (a: string, b: string) => RIVERS.get(a < b ? `${a}|${b}` : `${b}|${a}`);
/** Inland seas where galleys fight at full strength. */
export const INLAND_SEAS = new Set(['west_med', 'tyrrhenian', 'adriatic', 'ionian', 'aegean', 'levant', 'black_sea', 'baltic', 'bothnia']);

export const NATIONS = nationsJson as unknown as NationDef[];
export const NATION: Record<NationId, NationDef> = Object.fromEntries(NATIONS.map(n => [n.id, n]));

/** A claim a crown holds when the game starts: its historical reason, lapsing at the start of `until`. */
export interface StartingClaim {
  region: RegionId;
  until: number;
  why: string;
}

export interface Scenario {
  start: { year: number; month: number; day: number };
  claims: Record<NationId, StartingClaim[]>;
  alliances: [NationId, NationId][];
  subjects: { overlord: NationId; subject: NationId; type: 'vassal' | 'union' }[];
  rivals: [NationId, NationId][];
  truces: { a: NationId; b: NationId; years: number }[];
  marriages: [NationId, NationId][];
  hre: { emperor: NationId; electors: NationId[] };
}
export const SCENARIO = scenarioJson as unknown as Scenario;
/** The claim of `n` on region `r` it started the game with, if any (its reason and the year it lapses). */
export const startingClaim = (n: NationId, r: RegionId): StartingClaim | undefined => SCENARIO.claims[n]?.find(c => c.region === r);

export const TRAITS = traitsJson as unknown as { national: Record<string, TraitDef>; ruler: Record<string, TraitDef> };
export const POLICIES = policiesJson as unknown as PolicyDef[];
export const POLICY: Record<string, PolicyDef> = Object.fromEntries(POLICIES.map(p => [p.id, p]));

export interface ShipDef {
  name: string;
  cost: number;
  upkeep: number;
  power: number;
  capacity: number;
  advance?: string; // an advance needed to build it
}
export const UNITS = unitsJson as unknown as {
  eras: UnitEra[];
  unitCost: Record<UnitType, number>;
  unitUpkeep: Record<UnitType, number>;
  ships: Record<ShipType, ShipDef>;
};
export const ERA = (n: number): UnitEra => UNITS.eras[Math.max(0, Math.min(UNITS.eras.length - 1, n - 1))];

export const EVENTS = [...(historicalEventsJson as unknown[]), ...(genericEventsJson as unknown[]), ...(newWorldEventsJson as unknown[])] as EventDef[];
export const EVENT: Record<string, EventDef> = Object.fromEntries(EVENTS.map(e => [e.id, e]));
export const MISSIONS = missionsJson as unknown as MissionDef[];
export const AIMS = (aimsJson as unknown as { aims: AimDef[] }).aims;
export const BONDS = (aimsJson as unknown as { bonds: BondDef[] }).bonds;
const advancesData = advancesJson as unknown as { advances: AdvanceDef[]; learning: Record<NationId, number>; start: Record<string, NationId[]> };
export const ADVANCES = advancesData.advances;
export const ADVANCE: Record<string, AdvanceDef> = Object.fromEntries(ADVANCES.map(a => [a.id, a]));
/** How quickly each crown's scholars learn (1 = average; Italy fastest, the steppe and West Africa slowest). */
export const LEARNING = advancesData.learning;
export const START_ADVANCES = advancesData.start;
export const MISSION: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map(m => [m.id, m]));
export const ACHIEVEMENTS = achievementsJson as unknown as AchievementDef[];

const names = namesJson as unknown as Record<string, string[]> & { groups: Record<NationId, string> };
export function namePool(nation: NationId): string[] {
  return names[names.groups[nation] ?? 'german'] ?? names.german;
}

// ---------------------------------------------------------------- graph

export type EdgeKind = 'land' | 'strait' | 'coast' | 'sea';
export interface Edge {
  to: NodeId;
  kind: EdgeKind;
  sea?: SeaId; // the sea a strait crosses
}

export const isSea = (node: NodeId): boolean => node in SEA;
export const isRegion = (node: NodeId): boolean => node in REGION;

export const GRAPH: Record<NodeId, Edge[]> = (() => {
  const g: Record<NodeId, Edge[]> = {};
  for (const r of MAP.regions) {
    g[r.id] = [
      ...r.neighbors.map(n => ({ to: n, kind: 'land' as const })),
      ...r.seas.map(s => ({ to: s, kind: 'coast' as const })),
    ];
  }
  for (const s of MAP.seas) {
    if (s.closed) continue;
    g[s.id] = [...s.neighbors.map(n => ({ to: n, kind: 'sea' as const }))];
  }
  for (const r of MAP.regions) for (const s of r.seas) g[s].push({ to: r.id, kind: 'coast' });
  for (const st of STRAITS) {
    if (g[st.a].some(e => e.to === st.b)) continue; // already joined by land
    g[st.a].push({ to: st.b, kind: 'strait', sea: st.sea });
    g[st.b].push({ to: st.a, kind: 'strait', sea: st.sea });
  }
  return g;
})();

/** Coastal regions of each sea zone. */
export const SEA_COAST: Record<SeaId, RegionId[]> = (() => {
  const out: Record<SeaId, RegionId[]> = {};
  for (const r of MAP.regions) for (const s of r.seas) (out[s] ??= []).push(r.id);
  return out;
})();

/** Hop distance between two regions over land and straits (cached per source). */
const hopCache = new Map<RegionId, Map<RegionId, number>>();
export function hops(a: RegionId, b: RegionId): number {
  if (a === b) return 0;
  let m = hopCache.get(a);
  if (!m) {
    m = new Map([[a, 0]]);
    const q = [a];
    while (q.length) {
      const cur = q.shift()!;
      const d = m.get(cur)!;
      for (const e of GRAPH[cur]) {
        if (e.kind === 'coast' || e.kind === 'sea') continue;
        if (!m.has(e.to)) {
          m.set(e.to, d + 1);
          q.push(e.to);
        }
      }
    }
    hopCache.set(a, m);
  }
  return m.get(b) ?? 99;
}

/** Straight-line distance between region labels in map units (1 unit ≈ 4.4 km). */
export function mapDistance(a: RegionId, b: RegionId): number {
  const pa = MAP_REGION[a].label;
  const pb = MAP_REGION[b].label;
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
}

/** Is this region or sea part of the New World (hidden until it is discovered)? */
export const isNewWorld = (node: NodeId): boolean => !!(REGION[node]?.nw ?? SEA[node]?.nw);
export const isNativeNation = (n: NationId): boolean => !!NATION[n]?.native;

export const regionName = (id: NodeId): string => REGION[id]?.name ?? SEA[id]?.name ?? id;
export const nationName = (id: NationId | null): string => (id === null ? 'Natives' : id === 'REB' ? 'Rebels' : (NATION[id]?.name ?? id));
