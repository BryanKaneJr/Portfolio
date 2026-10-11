/**
 * The New World: discovery, colonists, colonies and trade goods.
 *
 * The Americas are uncharted until someone's expedition finds them (or 1500 comes, when every pilot in
 * Lisbon knows the way). After that, nations with colonists send settlers to uncolonized land: a colony
 * grows month by month until it reaches 1,000 settlers and becomes a region of yours. Natives slow it and
 * may attack it; troops in the region keep the settlers safe. Every New World region trades in a good
 * (silver, sugar, furs...) that pays its owner on top of taxes.
 */
import { GRAPH, MAP_REGION, NATION, REGION, SEA, isNativeNation, isNewWorld, regionName } from './content';
import { log, requestPause } from './log';
import { armyRegs, bumpOwnership, invalidateMods, modifierSources, nationMods, ownedRegions } from './queries';
import { markMapDirty } from './territory';
import type { Faith, GameState, Good, NationId, NodeId, Region, RegionId } from './types';
import { chance, clamp, months, yearOf, years } from './util';

export const COLONY_COST = 30;
export const COLONY_UPKEEP = 1; // gold per month for each colony still growing
export const SETTLERS_NEEDED = 1000;
export const EXPEDITION_COST = 100;
export const EXPEDITION_MONTHS = 8;
export const EXPEDITION_YEAR = 1470; // the earliest year a captain will sail west into the unknown
export const DISCOVERY_YEAR = 1500; // by now the New World is common knowledge
export const SPREAD_THIN = 0.06; // settler growth lost per New World region you already own (at most 60%)
export const BASE_COLONIST_DEV = 30; // realms this large (with an ocean coast) get a colonist from the Wars of Religion on

export const GOOD_NAME: Record<Good, string> = {
  silver: 'Silver',
  gold: 'Gold',
  sugar: 'Sugar',
  tobacco: 'Tobacco',
  cocoa: 'Cocoa',
  dyes: 'Dyes',
  furs: 'Furs',
  fish: 'Fish',
  grain: 'Grain',
};
/** Gold per month a good is worth, before development. */
export const GOOD_VALUE: Record<Good, number> = {
  silver: 2.0,
  gold: 1.8,
  sugar: 1.1,
  tobacco: 0.9,
  cocoa: 0.9,
  dyes: 0.8,
  furs: 0.7,
  fish: 0.6,
  grain: 0.4,
};

const CHRISTIAN = new Set<Faith>(['catholic', 'orthodox', 'protestant']);

// ---------------------------------------------------------------- charting

export const discovered = (s: GameState) => !!s.discovery;
/** Can armies and fleets go here yet? The New World is closed until it is discovered. */
export const charted = (s: GameState, node: NodeId) => !!s.discovery || !isNewWorld(node);

/** Does this nation own a coast on the open ocean? */
export function hasOceanCoast(s: GameState, n: NationId): boolean {
  return ownedRegions(s, n).some(r => MAP_REGION[r.id].seas.some(sea => SEA[sea]?.ocean));
}

export function canSendExpedition(s: GameState, n: NationId): string | null {
  const nat = s.nations[n];
  if (s.discovery) return 'The New World has already been found.';
  if (isNativeNation(n)) return 'Your people have no ships for the open ocean.';
  if (yearOf(s.day) < EXPEDITION_YEAR) return `No captain will sail into the unknown before ${EXPEDITION_YEAR}.`;
  if (!hasOceanCoast(s, n)) return 'You need a coast on the open ocean.';
  if (nat.expedition) return 'Your expedition is already at sea.';
  if (nat.gold < EXPEDITION_COST) return `You need ${EXPEDITION_COST} gold.`;
  return null;
}

export function sendExpedition(s: GameState, n: NationId): string | null {
  const why = canSendExpedition(s, n);
  if (why) return why;
  const nat = s.nations[n];
  nat.gold -= EXPEDITION_COST;
  nat.expedition = { done: s.day + months(EXPEDITION_MONTHS) };
  return null;
}

/** The New World is found: by a nation's expedition, or by everyone at once (by = null). */
export function discoverNewWorld(s: GameState, by: NationId | null): void {
  if (s.discovery) return;
  s.discovery = { day: s.day, by };
  markMapDirty();
  if (by && s.nations[by]) {
    const nat = s.nations[by];
    nat.prestige = clamp(nat.prestige + 25, 0, 100);
    nat.modifiers.push({ id: 'first_to_new_world', name: 'First to the New World', mods: { colonists: 1 }, until: s.day + years(30) });
    nat.flags.found_new_world = s.day;
    invalidateMods();
  }
  const who = by ? `${NATION[by].name}’s expedition has` : 'Pilots and fishermen have';
  log(s, 'colony', `${who} found land across the Atlantic: a New World! Colonists can now sail west.`, { important: true, nation: by ?? undefined });
  if (!s.pendingEvents.some(e => e.event === 'new_world')) s.pendingEvents.push({ event: 'new_world', nation: s.player, day: s.day });
  requestPause(s, 'event');
}

// ---------------------------------------------------------------- colonists

export interface ColonistPart {
  label: string;
  value: number;
}

/** Where a nation's colonists come from (each one can grow one colony at a time). */
export function colonistSources(s: GameState, n: NationId): ColonistPart[] {
  const nat = s.nations[n];
  if (!nat || isNativeNation(n)) return [];
  const out: ColonistPart[] = [];
  if (CHRISTIAN.has(nat.faith) && nat.era >= 3 && homeDev(s, n) >= BASE_COLONIST_DEV && hasOceanCoast(s, n)) out.push({ label: 'Great realm with an ocean coast (era 3)', value: 1 });
  for (const src of modifierSources(s, n)) if (src.mods.colonists) out.push({ label: src.name, value: src.mods.colonists });
  return out;
}
/** Development of a nation's Old World land (colonies don't make a realm great at home). */
export const homeDev = (s: GameState, n: NationId) => ownedRegions(s, n).reduce((t, r) => t + (REGION[r.id].nw ? 0 : r.dev), 0);
export const colonistsOf = (s: GameState, n: NationId) => colonistSources(s, n).reduce((t, p) => t + p.value, 0);
export const coloniesOf = (s: GameState, n: NationId): Region[] => Object.values(s.regions).filter(r => r.colony?.by === n);
export const freeColonists = (s: GameState, n: NationId) => colonistsOf(s, n) - coloniesOf(s, n).length;

/** Why `n` can't start a colony in region `r` (null if it can). */
export function canColonize(s: GameState, n: NationId, r: RegionId): string | null {
  const reg = s.regions[r];
  if (!reg || reg.owner) return 'Only uncolonized land can be settled.';
  if (!charted(s, r)) return 'These lands are uncharted.';
  if (reg.colony) return reg.colony.by === n ? 'Your settlers are already here.' : `${NATION[reg.colony.by]?.name ?? 'Someone'} is already settling here.`;
  if (isNativeNation(n)) return 'Your people do not send colonists.';
  if (freeColonists(s, n) <= 0) return colonistsOf(s, n) ? 'All your colonists are busy.' : 'You have no colonists (see the Colonies section of the Realm menu).';
  const coastal = MAP_REGION[r].seas.length > 0;
  const nextToOwn = GRAPH[r].some(e => (e.kind === 'land' || e.kind === 'strait') && s.regions[e.to]?.owner === n);
  if (!nextToOwn && !(coastal && hasOceanCoast(s, n))) return coastal ? 'You need a coast on the open ocean to send settlers.' : 'Inland: settle a neighbouring region first.';
  if (s.nations[n].gold < COLONY_COST) return `You need ${COLONY_COST} gold.`;
  return null;
}

export function startColony(s: GameState, n: NationId, r: RegionId): string | null {
  const why = canColonize(s, n, r);
  if (why) return why;
  s.nations[n].gold -= COLONY_COST;
  s.regions[r].colony = { by: n, settlers: 0, started: s.day };
  markMapDirty();
  return null;
}

export function abandonColony(s: GameState, n: NationId, r: RegionId): string | null {
  const reg = s.regions[r];
  if (reg?.colony?.by !== n) return 'You have no colony there.';
  reg.colony = undefined;
  markMapDirty();
  return null;
}

// ---------------------------------------------------------------- growth

/** Settlers a colony gains each month, line by line. */
export function settlerGrowth(s: GameState, r: Region): ColonistPart[] {
  const c = r.colony;
  if (!c) return [];
  const out: ColonistPart[] = [{ label: 'Settlers arriving', value: 9 }];
  if (GRAPH[r.id].some(e => (e.kind === 'land' || e.kind === 'strait') && s.regions[e.to]?.owner === c.by)) out.push({ label: 'Next to your land', value: 3 });
  const base = out.reduce((t, p) => t + p.value, 0);
  const m = nationMods(s, c.by).settlerGrowth;
  if (m) out.push({ label: 'Traits, policies and modifiers', value: Math.round(base * m * 10) / 10 });
  let left = base * (1 + m);
  if (r.natives > 0) {
    const cut = left * (1 - Math.max(0.5, 1 - 0.07 * r.natives));
    out.push({ label: `Natives (${fmtK(r.natives)})`, value: -Math.round(cut * 10) / 10 });
    left -= cut;
  }
  if (!MAP_REGION[r.id].seas.length) {
    const cut = left * 0.45;
    out.push({ label: 'Inland: settlers come overland', value: -Math.round(cut * 10) / 10 });
    left -= cut;
  }
  // Every region you already hold across the ocean draws settlers too: big empires grow slower.
  const owned = newWorldRegions(s, c.by).length;
  if (owned > 0) {
    const cut = left * (1 - Math.max(0.4, 1 - SPREAD_THIN * owned));
    out.push({ label: `Settlers spread thin (${owned} New World region${owned > 1 ? 's' : ''})`, value: -Math.round(cut * 10) / 10 });
  }
  return out;
}
export const monthlySettlers = (s: GameState, r: Region) => Math.max(1, settlerGrowth(s, r).reduce((t, p) => t + p.value, 0));

/** Chance per month that the natives attack the colony (0 with your troops there). */
export function attackChance(s: GameState, r: Region): number {
  if (!r.colony || r.natives <= 0) return 0;
  const hostility = REGION[r.id].hostility ?? 0;
  if (guarded(s, r)) return 0;
  return Math.min(0.2, r.natives * hostility * 0.0025);
}
const guarded = (s: GameState, r: Region) => Object.values(s.armies).some(a => a.owner === r.colony?.by && a.node === r.id && !a.path.length && armyRegs(a) > 0);
const fmtK = (k: number) => `${Math.round(k * 10) / 10}k`;

export function monthlyColonies(s: GameState): void {
  // Expeditions come home.
  for (const nat of Object.values(s.nations)) {
    if (!nat.expedition || nat.expedition.done > s.day) continue;
    nat.expedition = undefined;
    if (!s.discovery) discoverNewWorld(s, nat.id);
    else if (nat.id === s.player) log(s, 'colony', 'Your expedition returns: others found the New World first.', {});
  }
  if (!s.discovery && yearOf(s.day) >= DISCOVERY_YEAR) discoverNewWorld(s, null);

  for (const r of Object.values(s.regions)) {
    const c = r.colony;
    if (!c) continue;
    const nat = s.nations[c.by];
    if (!nat?.alive || r.owner) {
      r.colony = undefined;
      markMapDirty();
      continue;
    }
    // Disease and settlers push the natives back.
    if (r.natives > 0) r.natives = Math.max(0, r.natives - 0.02);
    if (chance(s, attackChance(s, r))) {
      const loss = Math.round(50 + r.natives * 25);
      c.settlers -= loss;
      if (c.settlers <= 0) {
        r.colony = undefined;
        markMapDirty();
        if (c.by === s.player) log(s, 'colony', `Natives destroy your colony in ${regionName(r.id)}. Station troops there before you try again.`, { node: r.id, important: true });
        continue;
      }
      if (c.by === s.player) log(s, 'colony', `Natives attack your settlers in ${regionName(r.id)}: ${loss} killed. Troops in the region would keep them safe.`, { node: r.id });
    } else if (guarded(s, r) && r.natives > 0 && chance(s, 0.05)) {
      r.natives = Math.max(0, r.natives - 0.5);
    }
    c.settlers += monthlySettlers(s, r);
    if (c.settlers >= SETTLERS_NEEDED) foundColony(s, r);
  }

  // Finished colonies keep drawing settlers and slowly grow.
  for (const r of Object.values(s.regions)) {
    if (!r.owner || !REGION[r.id].nw || isNativeNation(r.owner) || r.dev >= 5 || r.controller !== r.owner) continue;
    if (chance(s, 1 / 180)) r.dev++;
  }
}

function foundColony(s: GameState, r: Region): void {
  const c = r.colony!;
  const def = REGION[r.id];
  const nat = s.nations[c.by];
  r.colony = undefined;
  r.owner = c.by;
  r.controller = c.by;
  r.cores = [c.by];
  r.conquered = undefined;
  r.dev = def.dev + Math.floor(r.natives / 3);
  if (r.natives < 3) r.faith = nat.faith;
  if (r.natives >= 2) r.unrestMods.push({ amount: 2, until: s.day + years(5) });
  r.natives = 0;
  bumpOwnership();
  markMapDirty();
  if (c.by === s.player) log(s, 'colony', `Your colony in ${def.name} is founded! It now counts as one of your regions.`, { node: r.id, important: true });
}

// ---------------------------------------------------------------- goods

/** Monthly gold a region's trade good brings its owner. */
export function goodsIncome(s: GameState, r: Region): number {
  const good = REGION[r.id].good;
  if (!good || !r.owner || r.controller !== r.owner) return 0;
  const cored = r.cores.includes(r.owner);
  let v = GOOD_VALUE[good] * (0.5 + 0.1 * r.dev) * (cored ? 1 : 0.5) * (1 + nationMods(s, r.owner).tradeIncome);
  if (r.blockaded) v *= 0.5;
  return v;
}

/** Regions a nation owns in the New World. */
export const newWorldRegions = (s: GameState, n: NationId) => ownedRegions(s, n).filter(r => REGION[r.id].nw);
