/**
 * Science: each crown's scholars build up science every month and spend it on advances (content/advances.json),
 * which unlock artillery, colonies, warships and better troops and give lasting bonuses.
 *
 * Learning is fastest in Italy and the West and slowest on the fringes (LEARNING); gold buys more of it (funding,
 * universities). An advance costs more the earlier it is taken than its historical year and less once neighbours
 * know it, so the most learned crowns reach each one near its real date and knowledge spreads outward from them.
 */
import { ADVANCE, ADVANCES, LEARNING, NATION, REGION, START_ADVANCES, isNativeNation } from './content';
import { log } from './log';
import { invalidateMods, isCoastal, nationMods, neighborsOf, ownedRegions, totalDev } from './queries';
import { markMapDirty } from './territory';
import type { AdvanceDef, AdvanceUnlock, GameState, Nation, NationId, Region, RegionId } from './types';
import { yearOf } from './util';

/** Funding your scholars: a tenth of your income buys a quarter more science. */
export const FUNDING_SHARE = 0.1;
export const FUNDING_BOOST = 0.25;
export const UNIVERSITY_COST = 150; // and 100 more for each university you already have
export const UNIVERSITY_SCIENCE = 0.5;
export const UNIVERSITY_MIN_DEV = 5;
const BASE_SCIENCE = 1;
const TOWN_SCIENCE = 0.6; // per point of average prosperity in your richest regions: learning lives in rich towns
const RICHEST = 5; // how many of your richest regions count (a city state counts all it has)
const SIZE_SCIENCE = 0.15; // × the square root of the realm's prosperity: land adds only a little
const BIG_REALM = 10; // regions; beyond this each region adds...
const BIG_REALM_COST = 0.01; // ...1% to the cost of an advance...
const BIG_REALM_MAX = 0.5; // ...up to +50%
const TRADE_CENTRE_SCIENCE = 0.4;
const MAX_TRADE_CENTRES = 5;
const ORDER_FACTOR = 0.05; // per point of order
const EARLY_PER_YEAR = 0.05; // +5% cost per year before the historical year
const LATE_PER_YEAR = 0.012; // -1.2% per year after it...
const LATE_FLOOR = 0.6; // ...down to 60%
const NEIGHBOUR_DISCOUNT = 0.1; // -10% per neighbour who knows it...
const MAX_NEIGHBOURS = 3; // ...up to three

export const knows = (nat: Nation | undefined, id: string) => !!nat?.advances.includes(id);
export const hasAdvance = (s: GameState, n: NationId, id: string) => knows(s.nations[n], id);
/** The advance that opens up something (artillery, ocean colonies...). */
export const advanceFor = (what: AdvanceUnlock): AdvanceDef => ADVANCES.find(a => a.unlock === what)!;
export const unlocked = (s: GameState, n: NationId, what: AdvanceUnlock) => hasAdvance(s, n, advanceFor(what).id);
export const learningOf = (n: NationId) => LEARNING[n] ?? 1;
/** One policy at first, one more for every three advances (four at most). */
export const policySlots = (nat: Nation) => 1 + Math.min(3, Math.floor(nat.advances.length / 3));
/** New World peoples follow their own path: they gain no science. */
export const studies = (s: GameState, n: NationId) => !!s.nations[n]?.alive && !isNativeNation(n);

export interface ScienceBreakdown {
  sources: { label: string; value: number }[];
  factors: { label: string; value: number }[]; // multipliers
  total: number;
}

/** Science a month, with every source and factor (the Science tab shows them all). */
export function scienceRate(s: GameState, n: NationId): ScienceBreakdown {
  const nat = s.nations[n];
  if (!studies(s, n)) return { sources: [], factors: [], total: 0 };
  const owned = ownedRegions(s, n);
  const sources: ScienceBreakdown['sources'] = [{ label: 'Scholars at court', value: BASE_SCIENCE }];
  const towns = richestTowns(s, n);
  if (towns.length) {
    const avg = towns.reduce((t, r) => t + r.dev, 0) / towns.length;
    sources.push({ label: `Your ${towns.length > 1 ? `${towns.length} richest regions` : 'region'} (average prosperity ${avg.toFixed(1)})`, value: avg * TOWN_SCIENCE });
  }
  const dev = totalDev(s, n);
  sources.push({ label: `Size of your realm (prosperity ${dev})`, value: Math.sqrt(dev) * SIZE_SCIENCE });
  const trade = owned.filter(r => REGION[r.id].trade).length;
  if (trade) sources.push({ label: `Trade centres (${trade}${trade > MAX_TRADE_CENTRES ? `, ${MAX_TRADE_CENTRES} count` : ''})`, value: Math.min(MAX_TRADE_CENTRES, trade) * TRADE_CENTRE_SCIENCE });
  const unis = owned.filter(r => r.university).length;
  if (unis) sources.push({ label: `Universities (${unis})`, value: unis * UNIVERSITY_SCIENCE });
  const factors: ScienceBreakdown['factors'] = [];
  if (nat.scienceFunding) factors.push({ label: 'Funding your scholars', value: 1 + FUNDING_BOOST });
  const learning = learningOf(n);
  if (learning !== 1) factors.push({ label: learning > 1 ? 'Learned lands' : 'Far from the centres of learning', value: learning });
  if (nat.stability) factors.push({ label: `Order ${nat.stability > 0 ? '+' : '−'}${Math.abs(nat.stability)}`, value: 1 + ORDER_FACTOR * nat.stability });
  const m = nationMods(s, n).science;
  if (m) factors.push({ label: 'Advances, traits and modifiers', value: 1 + m });
  const total = sources.reduce((t, x) => t + x.value, 0) * factors.reduce((t, x) => t * x.value, 1);
  return { sources, factors, total };
}

export interface CostBreakdown {
  base: number;
  factors: { label: string; value: number }[];
  total: number;
}

/** What an advance costs this crown now, and why. */
export function advanceCost(s: GameState, n: NationId, id: string): CostBreakdown {
  const def = ADVANCE[id];
  const factors: CostBreakdown['factors'] = [];
  const y = yearOf(s.day);
  if (y < def.year) factors.push({ label: `${def.year - y} years before its time`, value: 1 + EARLY_PER_YEAR * (def.year - y) });
  else if (y > def.year) factors.push({ label: `Known since about ${def.year}`, value: Math.max(LATE_FLOOR, 1 - LATE_PER_YEAR * (y - def.year)) });
  const regions = ownedRegions(s, n).length;
  if (regions > BIG_REALM) factors.push({ label: `Large realm (${regions} regions)`, value: 1 + Math.min(BIG_REALM_MAX, BIG_REALM_COST * (regions - BIG_REALM)) });
  const near = Math.min(MAX_NEIGHBOURS, neighborsOf(s, n).filter(o => knows(s.nations[o], id)).length);
  if (near) factors.push({ label: `${near} neighbour${near > 1 ? 's' : ''} already know${near > 1 ? '' : 's'} it`, value: 1 - NEIGHBOUR_DISCOUNT * near });
  const m = nationMods(s, n).techCost;
  if (m) factors.push({ label: 'Traits and modifiers', value: 1 + m });
  const total = Math.max(1, Math.round(def.cost * factors.reduce((t, x) => t * x.value, 1)));
  return { base: def.cost, factors, total };
}

/** The regions whose prosperity drives a crown's science: its richest few (all of them for a small realm). */
export function richestTowns(s: GameState, n: NationId): Region[] {
  return ownedRegions(s, n)
    .sort((a, b) => b.dev - a.dev)
    .slice(0, RICHEST);
}

/** Would raising this region's prosperity raise science? (Only the richest few regions count.) */
export function prosperityAddsScience(s: GameState, n: NationId, region: RegionId): boolean {
  const towns = richestTowns(s, n);
  if (towns.length < RICHEST || towns.some(r => r.id === region)) return true;
  return (s.regions[region]?.dev ?? 0) + 1 > towns[towns.length - 1].dev;
}

/** What the next university costs this crown. */
export const universityCost = (s: GameState, n: NationId) => UNIVERSITY_COST + 100 * ownedRegions(s, n).filter(r => r.university).length;

/** Advances this crown could study now (requirements met, not yet known). */
export const FIELDS: AdvanceDef['field'][] = ['war', 'sea', 'state'];
/** Each field is a track of four advances, one after another. */
export const track = (field: AdvanceDef['field']) => ADVANCES.filter(a => a.field === field).sort((a, b) => a.year - b.year);

export function availableAdvances(s: GameState, n: NationId): AdvanceDef[] {
  const nat = s.nations[n];
  return ADVANCES.filter(a => !knows(nat, a.id) && a.requires.every(r => knows(nat, r)));
}

/** What a learned advance gives, in plain words. */
export function advanceUnlockText(a: AdvanceDef): string | null {
  if (a.armyEra) return `Your troops reach the ${['', 'Late Medieval', 'Renaissance', 'Wars of Religion', 'Absolutism'][a.armyEra]} age: stronger units and higher morale`;
  switch (a.unlock) {
    case 'artillery':
      return 'Recruit artillery';
    case 'warships':
      return 'Build galleons, the strongest warships';
    case 'coastColonies':
      return 'Settle the African coast and Atlantic islands';
    case 'oceanColonies':
      return 'Send expeditions west and settle the New World';
    default:
      return null;
  }
}

export function learnAdvance(s: GameState, n: NationId, id: string): void {
  const nat = s.nations[n];
  const def = ADVANCE[id];
  if (!nat || !def || knows(nat, id)) return;
  const first = !Object.values(s.nations).some(o => o.id !== n && knows(o, id));
  nat.advances.push(id);
  if (def.armyEra) nat.era = Math.max(nat.era, def.armyEra);
  if (nat.researching === id) nat.researching = null;
  invalidateMods();
  markMapDirty(); // the Science map mode
  if (n === s.player) {
    const what = advanceUnlockText(def);
    log(s, 'economy', `Your scholars have mastered ${def.name}${what ? `. ${what}.` : '.'}`, { important: true });
  } else if (first) log(s, 'news', `${NATION[n].name} is the first to master ${def.name}.`, { nation: n });
}

/** The AI's (and a spectated player's) choice of what to study: cheap advances it cares about first. */
export function chooseResearch(s: GameState, n: NationId): string | null {
  const options = availableAdvances(s, n);
  if (!options.length) return null;
  const pers = NATION[n].personality;
  const coastal = isCoastal(s, n);
  const colonial = ['POR', 'CAS', 'ENG', 'FRA', 'BUR', 'DAN', 'SCO', 'ARA'].includes(n);
  const weight = (a: AdvanceDef) => {
    let w = 1;
    if (a.field === 'war') w *= pers === 'expansionist' ? 1.35 : pers === 'opportunist' ? 1.15 : 1;
    if (a.field === 'state') w *= pers === 'trader' ? 1.3 : pers === 'defensive' ? 1.15 : 1;
    if (a.field === 'sea') w *= colonial ? 1.4 : coastal ? 0.9 : 0.6;
    if (a.armyEra) w *= 1.4;
    if (a.unlock === 'artillery') w *= 1.3;
    return w;
  };
  return options.map(a => ({ id: a.id, score: weight(a) / advanceCost(s, n, a.id).total })).sort((a, b) => b.score - a.score)[0].id;
}

export function monthlyScience(s: GameState): void {
  for (const nat of Object.values(s.nations)) {
    const n = nat.id;
    if (!studies(s, n)) continue;
    nat.science += scienceRate(s, n).total;
    const ai = n !== s.player || '__spectate' in s.flags;
    if (ai && (!nat.researching || knows(nat, nat.researching))) nat.researching = chooseResearch(s, n);
    if (!nat.researching) continue;
    const cost = advanceCost(s, n, nat.researching).total;
    if (nat.science >= cost) {
      nat.science -= cost;
      learnAdvance(s, n, nat.researching);
    }
  }
}

/** Advances each crown knows in 1444. */
export const startingAdvances = (n: NationId) => Object.entries(START_ADVANCES).filter(([, who]) => who.includes(n)).map(([id]) => id);
