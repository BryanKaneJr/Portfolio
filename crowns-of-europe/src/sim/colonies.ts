/**
 * The New World: discovery, colonists, colonies and trade goods.
 *
 * The Americas are uncharted until someone's expedition finds them (or 1500 comes, when every pilot in
 * Lisbon knows the way). After that, nations with colonists send settlers to uncolonized land: a colony
 * grows month by month until it reaches 1,000 settlers and becomes a region of yours. Settlers either trade with
 * the natives (slower, safe unless they are fierce, and they join the colony) or take the land by force (natives
 * slow them and may attack unless troops or paid guards are there). Enemy armies at war raid colonies being
 * settled. A colonist with no land left to settle can grow a founded New World region of yours instead (+1
 * prosperity per 500 settlers, up to 8). Every New World region trades in a good (silver, sugar, furs...) that
 * pays its owner on top of taxes.
 */
import { GRAPH, MAP_REGION, NATION, REGION, SEA, isNativeNation, isNewWorld, nationName, regionName } from './content';
import { log, requestPause } from './log';
import { REBELS, armyRegs, bumpOwnership, friendlyTo, hostile, invalidateMods, modifierSources, nationMods, ownedRegions } from './queries';
import { advanceFor, hasAdvance, unlocked } from './science';
import { markMapDirty } from './territory';
import type { Army, Faith, GameState, Good, NationId, NativePolicy, NodeId, Region, RegionId } from './types';
import { chance, clamp, months, round1, yearOf, years } from './util';

export const COLONY_COST = 30;
export const COLONY_UPKEEP = 1; // gold per month for each colony still growing (and each colonist growing a region)
export const COLONY_GUARD_UPKEEP = 0.5; // gold per month for a colony's paid guards
export const SETTLERS_NEEDED = 1000;
export const GROW_SETTLERS = 500; // settlers that raise a founded colony's prosperity by 1
export const MAX_GROWN_DEV = 8; // settlers grow a founded colony up to this prosperity
export const NATURAL_GROWTH_DEV = 5; // founded colonies grow on their own (slowly) up to this prosperity
export const TRADE_SLOWDOWN = 0.15; // settler growth lost by trading with the natives instead of taking their land
export const RAID_PER_REG = 20; // settlers an enemy regiment kills each month in a colony being settled
export const RAID_MAX = 200; // ... at most, in one colony a month
export const EXPEDITION_COST = 100;
export const EXPEDITION_MONTHS = 8;
export const EXPEDITION_YEAR = 1470; // the AI's urge to sail west grows from here (expeditions need Ocean Navigation)
export const DISCOVERY_YEAR = 1500; // by now the New World is common knowledge
export const SPREAD_THIN = 0.06; // settler growth lost per New World region you already own (at most 60%)
export const BASE_COLONIST_DEV = 30; // realms this large at home (with an ocean coast and Galleons) get a second colonist

/** How fiercely the natives of a region resist settlers (REGION hostility 0-3). */
export const HOSTILITY_NAME = ['Peaceful', 'Wary', 'Hostile', 'Fierce'];

export const GOOD_NAME: Record<Good, string> = {
  silver: 'Silver',
  gold: 'Gold',
  ivory: 'Ivory',
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
  ivory: 1.2,
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
  if (!unlocked(s, n, 'oceanColonies')) return `Your captains need ${advanceFor('oceanColonies').name} first (see Science).`;
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

/** Where a nation's colonists come from (each one settles one colony, or grows one region, at a time). */
export function colonistSources(s: GameState, n: NationId): ColonistPart[] {
  const nat = s.nations[n];
  if (!nat || isNativeNation(n)) return [];
  const out: ColonistPart[] = [];
  // Every Christian crown on the open ocean that has learned to cross it sends settlers; a great realm with
  // Galleons sends a second band.
  if (CHRISTIAN.has(nat.faith) && unlocked(s, n, 'oceanColonies') && hasOceanCoast(s, n)) {
    out.push({ label: `${advanceFor('oceanColonies').name} and an ocean coast`, value: 1 });
    if (hasAdvance(s, n, 'galleons') && homeDev(s, n) >= BASE_COLONIST_DEV) out.push({ label: 'Great realm with an ocean coast and Galleons', value: 1 });
  }
  for (const src of modifierSources(s, n)) if (src.mods.colonists) out.push({ label: src.name, value: src.mods.colonists });
  return out;
}
/** Development of a nation's Old World land (colonies don't make a realm great at home). */
export const homeDev = (s: GameState, n: NationId) => ownedRegions(s, n).reduce((t, r) => t + (REGION[r.id].nw ? 0 : r.dev), 0);
export const colonistsOf = (s: GameState, n: NationId) => colonistSources(s, n).reduce((t, p) => t + p.value, 0);
/** Does colonizing concern `n` at all: colonists, colonies or New World land, or an ocean coast and Caravels? */
export const colonialCrown = (s: GameState, n: NationId) =>
  colonistsOf(s, n) > 0 || coloniesOf(s, n).length > 0 || newWorldRegions(s, n).length > 0 || (hasOceanCoast(s, n) && unlocked(s, n, 'coastColonies'));
/** A nation's colonies being settled. */
export const coloniesOf = (s: GameState, n: NationId): Region[] => Object.values(s.regions).filter(r => r.colony?.by === n);
/** A nation's founded New World regions its colonists are growing (one lost in a peace frees its colonist at once). */
export const growingOf = (s: GameState, n: NationId): Region[] => Object.values(s.regions).filter(r => r.growing?.by === n && r.owner === n);
/** Colonists with nothing to do: neither settling a colony nor growing one. */
export const freeColonists = (s: GameState, n: NationId) => colonistsOf(s, n) - coloniesOf(s, n).length - growingOf(s, n).length;

const busyReason = (s: GameState, n: NationId) => (colonistsOf(s, n) ? 'All your colonists are busy.' : `You have no colonists yet (${advanceFor('oceanColonies').name} gives one).`);
const nextToOwn = (s: GameState, n: NationId, r: RegionId) => GRAPH[r].some(e => (e.kind === 'land' || e.kind === 'strait') && s.regions[e.to]?.owner === n);

/** Why `n` can't start a colony in region `r` (null if it can). */
export function canColonize(s: GameState, n: NationId, r: RegionId): string | null {
  const reg = s.regions[r];
  if (!reg || reg.owner) return 'Only uncolonized land can be settled.';
  if (!charted(s, r)) return 'These lands are uncharted.';
  if (reg.colony) return reg.colony.by === n ? 'Your settlers are already here.' : `${NATION[reg.colony.by]?.name ?? 'Someone'} is already settling here.`;
  if (isNativeNation(n)) return 'Your people do not send colonists.';
  const needs = REGION[r].nw ? advanceFor('oceanColonies') : advanceFor('coastColonies');
  if (!hasAdvance(s, n, needs.id)) return `Settling here needs ${needs.name} (see Science).`;
  if (freeColonists(s, n) <= 0) return busyReason(s, n);
  const coastal = MAP_REGION[r].seas.length > 0;
  if (!nextToOwn(s, n, r) && !(coastal && hasOceanCoast(s, n))) return coastal ? 'You need a coast on the open ocean to send settlers.' : 'Inland: settle a neighbouring region first.';
  if (s.nations[n].gold < COLONY_COST) return `You need ${COLONY_COST} gold.`;
  return null;
}

/** Start a colony. With natives on the land the settlers either trade with them or take it by force (the default,
 * and the only way where nobody lives). */
export function startColony(s: GameState, n: NationId, r: RegionId, policy: NativePolicy = 'force'): string | null {
  const why = canColonize(s, n, r);
  if (why) return why;
  const reg = s.regions[r];
  s.nations[n].gold -= COLONY_COST;
  reg.colony = { by: n, settlers: 0, started: s.day, policy: reg.natives > 0 ? policy : 'force', natives0: reg.natives };
  reg.lastRaid = undefined; // (a raid on an earlier colony here is not this one's)
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

/** Hire guards for a colony being settled (or dismiss them): COLONY_GUARD_UPKEEP gold a month, no native attacks. */
export function setGuard(s: GameState, n: NationId, r: RegionId, on: boolean): string | null {
  const c = s.regions[r]?.colony;
  if (c?.by !== n) return 'You have no colony there.';
  if (!!c.guard === on) return on ? 'The colony is already guarded.' : 'The colony has no guards to dismiss.';
  c.guard = on ? true : undefined;
  return null;
}

/** A trading colony may turn to force; once the land has been taken by force, there is no going back. */
export function setPolicy(s: GameState, n: NationId, r: RegionId, policy: NativePolicy): string | null {
  const c = s.regions[r]?.colony;
  if (c?.by !== n) return 'You have no colony there.';
  const now = c.policy ?? 'force';
  if (now === policy) return policy === 'trade' ? 'Your settlers already trade with the natives.' : 'Your settlers already take the land by force.';
  if (policy === 'trade') return 'After settlers have taken land by force, the natives will not trade with them again.';
  if (!(s.regions[r].natives > 0)) return 'No natives live here any more.';
  c.policy = 'force';
  return null;
}

/** Why `n` can't send a colonist to grow its New World region `r` (null if it can). */
export function canGrow(s: GameState, n: NationId, r: RegionId): string | null {
  const reg = s.regions[r];
  if (!reg || !REGION[r]?.nw) return 'Only New World colonies can be grown.';
  if (isNativeNation(n)) return 'Your people do not send colonists.';
  if (reg.owner !== n) return 'Only your own colonies can be grown.';
  if (reg.growing?.by === n) return 'Your settlers are already here.';
  if (reg.controller !== n) return 'The region is occupied.';
  if (reg.dev >= MAX_GROWN_DEV) return `Settlers can raise a colony's prosperity only to ${MAX_GROWN_DEV}.`;
  if (freeColonists(s, n) <= 0) return busyReason(s, n);
  return null;
}

/** Send a free colonist to grow a founded New World region: settlers raise its prosperity (COLONY_UPKEEP a month). */
export function startGrowing(s: GameState, n: NationId, r: RegionId): string | null {
  const why = canGrow(s, n, r);
  if (why) return why;
  s.regions[r].growing = { by: n, settlers: 0, started: s.day };
  return null;
}

export function stopGrowing(s: GameState, n: NationId, r: RegionId): string | null {
  const reg = s.regions[r];
  if (reg?.growing?.by !== n) return 'Your settlers are not growing that colony.';
  reg.growing = undefined;
  return null;
}

/** What colonies cost a nation each month, line by line (economy.ts adds these to its expenses). */
export function colonyExpenses(s: GameState, n: NationId): ColonistPart[] {
  const settling = coloniesOf(s, n);
  const guarded = settling.filter(r => r.colony!.guard).length;
  const growing = growingOf(s, n).length;
  const out: ColonistPart[] = [];
  if (settling.length) out.push({ label: `Colonies being settled (${settling.length})`, value: settling.length * COLONY_UPKEEP });
  if (guarded) out.push({ label: `Guards for colonies (${guarded})`, value: guarded * COLONY_GUARD_UPKEEP });
  if (growing) out.push({ label: `Colonies being grown (${growing})`, value: growing * COLONY_UPKEEP });
  return out;
}

// ---------------------------------------------------------------- growth

/**
 * Settlers `n` would gain each month in region `id`, line by line: settling it, with the natives treated by
 * `policy`; or, with `grow`, growing a founded region of its own (no natives then, nor a neighbour bonus).
 * Works for a colony not yet started, so the Colonies tab can show where settling pays.
 */
export function settlerGrowthFor(s: GameState, n: NationId, id: RegionId, policy: NativePolicy = 'force', grow = false): ColonistPart[] {
  const r = s.regions[id];
  if (!r) return [];
  const out: ColonistPart[] = [{ label: 'Settlers arriving', value: 9 }];
  if (!grow && nextToOwn(s, n, id)) out.push({ label: 'Next to your land', value: 3 });
  const base = out.reduce((t, p) => t + p.value, 0);
  const m = nationMods(s, n).settlerGrowth;
  if (m) out.push({ label: 'Traits, policies and modifiers', value: round1(base * m) });
  let left = base * (1 + m);
  if (!grow && r.natives > 0) {
    // Trading costs settlers' time; taking the land costs more the more people live on it.
    const cut = policy === 'trade' ? left * TRADE_SLOWDOWN : left * (1 - Math.max(0.5, 1 - 0.07 * r.natives));
    out.push({ label: policy === 'trade' ? 'Trading with the natives' : `Natives (${fmtK(r.natives)})`, value: -round1(cut) });
    left -= cut;
  }
  if (!MAP_REGION[id].seas.length) {
    const cut = left * 0.45;
    out.push({ label: 'Inland: settlers come overland', value: -round1(cut) });
    left -= cut;
  }
  // Every region you already hold across the ocean draws settlers too: big empires grow slower.
  const owned = newWorldRegions(s, n).length;
  if (owned > 0) {
    const cut = left * (1 - Math.max(0.4, 1 - SPREAD_THIN * owned));
    out.push({ label: `Settlers spread thin (${owned} New World region${owned > 1 ? 's' : ''})`, value: -round1(cut) });
  }
  return out;
}

/** Settlers a colony being settled (or a region being grown) gains each month, line by line. */
export function settlerGrowth(s: GameState, r: Region): ColonistPart[] {
  if (r.colony) return settlerGrowthFor(s, r.colony.by, r.id, r.colony.policy ?? 'force');
  if (r.growing) return settlerGrowthFor(s, r.growing.by, r.id, 'force', true);
  return [];
}
export const monthlySettlers = (s: GameState, r: Region) => Math.max(1, settlerGrowth(s, r).reduce((t, p) => t + p.value, 0));

/** Who keeps settlers safe from the natives: troops of the founder standing there (free), or paid guards. */
export type ColonyGuard = 'troops' | 'paid' | null;

/**
 * The natives' chance each month to attack a colony in region `id`, line by line: their numbers and hostility,
 * then what keeps them off (trading with them, unless they are fierce, then half; troops or guards, all of it).
 */
export function attackLinesFor(s: GameState, id: RegionId, policy: NativePolicy, guard: ColonyGuard): ColonistPart[] {
  const r = s.regions[id];
  if (!r || r.natives <= 0) return [];
  const hostility = REGION[id].hostility ?? 0;
  const base = Math.min(0.2, r.natives * hostility * 0.0025);
  const out: ColonistPart[] = [{ label: `Natives (${fmtK(r.natives)}, ${HOSTILITY_NAME[hostility].toLowerCase()})`, value: base }];
  let left = base;
  if (left > 0 && policy === 'trade') {
    const cut = hostility >= 3 ? left / 2 : left;
    out.push({ label: hostility >= 3 ? 'Trading with the natives (fierce: half)' : 'Trading with the natives', value: -cut });
    left -= cut;
  }
  if (left > 0 && guard) out.push({ label: guard === 'troops' ? 'Your troops are there' : 'Guards on the colony', value: -left });
  return out;
}
export const attackLines = (s: GameState, r: Region): ColonistPart[] => (r.colony ? attackLinesFor(s, r.id, r.colony.policy ?? 'force', guardOf(s, r)) : []);
/** Chance per month that the natives attack the colony (0 with your troops or paid guards there). */
export function attackChance(s: GameState, r: Region): number {
  const p = attackLines(s, r).reduce((t, x) => t + x.value, 0);
  return p > 1e-9 ? p : 0;
}
/** The same, if the colony had no paid guards (troops still count): is hiring guards worth it? */
export function riskWithoutGuards(s: GameState, r: Region): number {
  if (!r.colony) return 0;
  const p = attackLinesFor(s, r.id, r.colony.policy ?? 'force', troopsThere(s, r) ? 'troops' : null).reduce((t, x) => t + x.value, 0);
  return p > 1e-9 ? p : 0;
}
const troopsThere = (s: GameState, r: Region) => Object.values(s.armies).some(a => a.owner === r.colony?.by && a.node === r.id && !a.path.length && armyRegs(a) > 0);
export const guardOf = (s: GameState, r: Region): ColonyGuard => (troopsThere(s, r) ? 'troops' : r.colony?.guard ? 'paid' : null);
const fmtK = (k: number) => `${Math.round(k * 10) / 10}k`;

/** Prosperity a colony in region `id` starts with when founded: natives who traded join as they were at the start
 * (`natives0`), those whose land was taken as they are by then (`natives`). */
export function foundingDev(s: GameState, id: RegionId, policy: NativePolicy, natives0 = s.regions[id]?.natives ?? 0, natives = s.regions[id]?.natives ?? 0): number {
  return Math.min(10, REGION[id].dev + (policy === 'trade' ? Math.floor(natives0 / 2) : Math.floor(natives / 3)));
}

/** Natives lost each month where settlers take the land (disease and settlers push them back). */
export const NATIVE_DECLINE = 0.02;

/** The prosperity a colony `n` starts in region `id` today would have when founded: taking the land, the natives
 * dwindle by NATIVE_DECLINE a month until then (and a guard pushes them back faster still). */
export function expectedFoundingDev(s: GameState, n: NationId, id: RegionId, policy: NativePolicy): number {
  const natives = s.regions[id]?.natives ?? 0;
  if (policy === 'trade') return foundingDev(s, id, 'trade', natives, natives);
  const pace = Math.max(1, settlerGrowthFor(s, n, id, 'force').reduce((t, x) => t + x.value, 0));
  return foundingDev(s, id, 'force', natives, Math.max(0, natives - NATIVE_DECLINE * (SETTLERS_NEEDED / pace)));
}

// ---------------------------------------------------------------- where to settle

export interface ColonySite {
  id: RegionId;
  /** Why the nation can't settle here now (canColonize), or null. */
  blocked: string | null;
  natives: number;
  hostility: number;
  /** Settlers a month if the nation started here today, trading with the natives or taking their land. */
  perMonth: Record<NativePolicy, number>;
  /** Years to found the colony at that pace. */
  years: Record<NativePolicy, number>;
  good: Good | null;
  /** The quicker way to settle it (the pace, prosperity and exports shown are for this one). */
  best: NativePolicy;
  /** Prosperity at founding, settled the quicker way (expectedFoundingDev). */
  dev: number;
  /** Exports a month at that prosperity (as goodsIncome would pay). */
  value: number;
  /** The natives' chance a month to attack it, unguarded, taking their land by force. */
  risk: number;
}

/**
 * Every charted uncolonized region nobody is settling (the New World and the African coast), as `n` would find
 * it: settleable ones first, then the most worth having (exports, and how soon they come).
 */
export function colonySites(s: GameState, n: NationId): ColonySite[] {
  if (!s.nations[n] || isNativeNation(n)) return [];
  const out: (ColonySite & { worth: number })[] = [];
  for (const r of Object.values(s.regions)) {
    if (r.owner || r.colony || !charted(s, r.id)) continue;
    const def = REGION[r.id];
    const pace = (p: NativePolicy) => Math.max(1, settlerGrowthFor(s, n, r.id, p).reduce((t, x) => t + x.value, 0));
    const perMonth = { force: pace('force'), trade: pace('trade') };
    const yearsTo = (p: NativePolicy) => Math.round((SETTLERS_NEEDED / perMonth[p] / 12) * 10) / 10;
    const best: NativePolicy = r.natives > 0 && perMonth.trade > perMonth.force ? 'trade' : 'force';
    const dev = expectedFoundingDev(s, n, r.id, best);
    const value = def.good ? exportValue(s, n, def.good, dev) : 0;
    const site: ColonySite = {
      id: r.id,
      blocked: canColonize(s, n, r.id),
      natives: r.natives,
      hostility: def.hostility ?? 0,
      perMonth,
      years: { force: yearsTo('force'), trade: yearsTo('trade') },
      good: def.good ?? null,
      best,
      dev,
      value,
      risk: attackLinesFor(s, r.id, 'force', null).reduce((t, x) => t + x.value, 0),
    };
    // Exports a month per year of waiting (plus a little for any land at all).
    out.push({ ...site, worth: (value + 0.1) / (site.years[best] + 5) });
  }
  out.sort((a, b) => (a.blocked ? 1 : 0) - (b.blocked ? 1 : 0) || b.worth - a.worth || (a.id < b.id ? -1 : 1));
  return out.map(({ worth: _worth, ...site }) => site);
}

// ---------------------------------------------------------------- the monthly round

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
    if (raidColony(s, r)) continue;
    const force = (c.policy ?? 'force') === 'force';
    // Disease and settlers push the natives back (trading partners stay).
    if (force && r.natives > 0) r.natives = Math.max(0, r.natives - NATIVE_DECLINE);
    if (chance(s, attackChance(s, r))) {
      const loss = Math.round(50 + r.natives * 25);
      c.settlers -= loss;
      if (c.settlers <= 0) {
        r.colony = undefined;
        markMapDirty();
        if (c.by === s.player) log(s, 'colony', `Natives destroy your colony in ${regionName(r.id)}. Guard it or station troops there before you try again.`, { node: r.id, important: true });
        continue;
      }
      if (c.by === s.player) log(s, 'colony', `Natives attack your settlers in ${regionName(r.id)}: ${loss} killed. Guards or troops in the region would keep them safe.`, { node: r.id });
    } else if (force && guardOf(s, r) && r.natives > 0 && chance(s, 0.05)) {
      r.natives = Math.max(0, r.natives - 0.5);
    }
    c.settlers += monthlySettlers(s, r);
    if (c.settlers >= SETTLERS_NEEDED) foundColony(s, r);
  }

  // Colonists lost (a charter or a modifier ran out, the realm at home shrank): the newest colony being grown
  // calls its colonist back first; colonies being settled are left to finish.
  const grown = new Map<NationId, Region[]>();
  for (const r of Object.values(s.regions)) if (r.growing) grown.set(r.growing.by, [...(grown.get(r.growing.by) ?? []), r]);
  for (const [n, rs] of grown) {
    for (const r of rs.sort((a, b) => b.growing!.started - a.growing!.started)) {
      if (freeColonists(s, n) >= 0) break;
      r.growing = undefined;
      if (n === s.player) log(s, 'colony', `You have fewer colonists now: the settlers bound for ${regionName(r.id)} stay home.`, { node: r.id });
    }
  }

  // Colonists grow founded regions.
  for (const r of Object.values(s.regions)) {
    if (r.growing) growRegion(s, r);
  }

  // Finished colonies keep drawing settlers and slowly grow.
  for (const r of Object.values(s.regions)) {
    if (!r.owner || !REGION[r.id].nw || isNativeNation(r.owner) || r.dev >= NATURAL_GROWTH_DEV || r.controller !== r.owner) continue;
    if (chance(s, 1 / 180)) r.dev++;
  }
}

/**
 * Enemy armies standing in a colony being settled (at war with its founder, or rebels against it), with no army
 * of the founder or a friend of the founder there, kill RAID_PER_REG settlers per regiment (RAID_MAX at most).
 * True if the colony is gone.
 */
function raidColony(s: GameState, r: Region): boolean {
  const c = r.colony!;
  let regs = 0;
  const raiders: Army[] = [];
  for (const id in s.armies) {
    const a = s.armies[id];
    if (a.node !== r.id || a.retreating || armyRegs(a) <= 0) continue;
    if (a.owner === c.by || (a.owner !== REBELS && friendlyTo(s, c.by, a.owner))) return false; // defended
    if (!a.path.length && hostile(s, a.owner, c.by, a.rebelOf)) {
      regs += armyRegs(a);
      raiders.push(a);
    }
  }
  if (!regs) return false;
  const killed = Math.min(RAID_MAX, RAID_PER_REG * regs, Math.max(0, Math.ceil(c.settlers)));
  c.settlers -= Math.min(RAID_MAX, RAID_PER_REG * regs);
  r.lastRaid = s.day;
  const who = nationName(raiders[0].owner);
  const name = regionName(r.id);
  const playerRaids = raiders.some(a => a.owner === s.player);
  const adj = NATION[c.by]?.adj ?? nationName(c.by);
  if (c.settlers <= 0) {
    r.colony = undefined;
    markMapDirty();
    // Remembered, so the AI doesn't send settlers straight back into the raiders' arms (ai.ts).
    if (s.nations[c.by]) s.nations[c.by].flags[`_raidLost_${r.id}`] = s.day;
    if (c.by === s.player) log(s, 'colony', `${who} raid${raiders[0].owner === REBELS ? '' : 's'} your colony in ${name} and the last settlers flee. The colony is lost.`, { node: r.id, important: true });
    else if (playerRaids) log(s, 'colony', `Your troops drive the last ${adj} settlers out of ${name}. Their colony is lost.`, { node: r.id, important: true });
    return true;
  }
  if (c.by === s.player) log(s, 'colony', `${who} raid${raiders[0].owner === REBELS ? '' : 's'} your settlers in ${name}: ${killed} killed. Troops of yours there would stop it.`, { node: r.id });
  else if (playerRaids) log(s, 'colony', `Your troops raid the ${adj} settlers in ${name}: ${killed} killed.`, { node: r.id });
  return false;
}

/** A month of settlers for a region being grown; +1 prosperity every GROW_SETTLERS, up to MAX_GROWN_DEV. */
function growRegion(s: GameState, r: Region): void {
  const g = r.growing!;
  const name = regionName(r.id);
  const mine = g.by === s.player;
  if (!s.nations[g.by]?.alive || r.owner !== g.by || r.controller !== g.by) {
    r.growing = undefined;
    if (mine) log(s, 'colony', `Your settlers bound for ${name} turn back: ${r.owner === g.by ? 'it is occupied' : 'it is no longer yours'}. The colonist is free again.`, { node: r.id });
    return;
  }
  if (r.dev >= MAX_GROWN_DEV) {
    r.growing = undefined;
    if (mine) log(s, 'colony', `${name} is as prosperous as settlers can make it. The colonist is free again.`, { node: r.id });
    return;
  }
  g.settlers += monthlySettlers(s, r);
  if (g.settlers < GROW_SETTLERS) return;
  g.settlers = 0;
  r.dev++;
  if (r.dev >= MAX_GROWN_DEV) {
    r.growing = undefined;
    if (mine) log(s, 'colony', `New settlers raise ${name} to prosperity ${r.dev}, as far as settlers can take it. The colonist is free again.`, { node: r.id, important: true });
  } else if (mine) log(s, 'colony', `New settlers raise ${name} to prosperity ${r.dev}.`, { node: r.id });
}

function foundColony(s: GameState, r: Region): void {
  const c = r.colony!;
  const def = REGION[r.id];
  const nat = s.nations[c.by];
  const trade = (c.policy ?? 'force') === 'trade';
  r.colony = undefined;
  r.owner = c.by;
  r.controller = c.by;
  r.cores = [c.by];
  r.conquered = undefined;
  // Natives who traded with the settlers join the colony as they were at the start; those whose land was taken
  // join as they are now (fewer), may keep their faith, and resent it for a while.
  r.dev = foundingDev(s, r.id, trade ? 'trade' : 'force', c.natives0 ?? r.natives);
  if (r.natives < 3) r.faith = nat.faith;
  if (!trade && r.natives >= 2) r.unrestMods.push({ amount: 2, until: s.day + years(5) });
  r.natives = 0;
  bumpOwnership();
  markMapDirty();
  if (c.by === s.player) log(s, 'colony', `Your colony in ${def.name} is founded! It now counts as one of your regions.`, { node: r.id, important: true });
}

// ---------------------------------------------------------------- goods

/** Monthly gold a good brings nation `n` from a region of prosperity `dev` (half if not integrated). */
export function exportValue(s: GameState, n: NationId, good: Good, dev: number, cored = true): number {
  return GOOD_VALUE[good] * (0.5 + 0.1 * dev) * (cored ? 1 : 0.5) * (1 + nationMods(s, n).tradeIncome);
}

/** Monthly gold a region's trade good brings its owner. */
export function goodsIncome(s: GameState, r: Region): number {
  const good = REGION[r.id].good;
  if (!good || !r.owner || r.controller !== r.owner) return 0;
  let v = exportValue(s, r.owner, good, r.dev, r.cores.includes(r.owner));
  if (r.blockaded) v *= 0.5;
  return v;
}

/** Regions a nation owns in the New World. */
export const newWorldRegions = (s: GameState, n: NationId) => ownedRegions(s, n).filter(r => REGION[r.id].nw);
