/**
 * Sieges: an army standing in an enemy-held region takes it. Regions without a fort fall after a short
 * control timer (longer for a founded New World colony: its settlers hold out in their stockades); forts need
 * enough regiments (3 per fort level) and time, sped up by artillery. A fort siege a month old may be stormed:
 * odds that grow with the siege, guns and generals, paid for in men win or lose (stormOdds, storm).
 */
import { REGION, isNativeNation, nationName, regionName } from './content';
import { involvesPlayer, log, moment, newsworthy, requestPause } from './log';
import { REBELS, armyMen, armyRegs, controllerHostile, friendlyTo, hostile, nationMods } from './queries';
import { starBonus } from './rulers';
import { setController } from './territory';
import type { Army, GameState, Nation, NationId, RegionId, UnitType } from './types';
import { chance, clamp } from './util';

export const CONTROL_DAYS = 15;
/** Days to occupy a founded New World colony of a crown without a fort: its settlers hold out in their stockades. */
export const COLONY_HOLD_DAYS = 60;
export const FORT_DAYS = 75; // per fort level at normal speed
export const minSiegeRegs = (fort: number) => Math.max(1, fort * 3);

export interface SiegeInfo {
  besiegers: Army[];
  regs: number;
  artillery: number;
  enough: boolean;
  daily: number; // progress per day (0..1 scale)
  by: NationId;
}

/** Armies currently able to besiege region `r`, and how fast. */
export function siegeInfo(s: GameState, r: RegionId, here?: Army[]): SiegeInfo | null {
  const reg = s.regions[r];
  const standing = (here ?? Object.values(s.armies).filter(a => a.node === r)).filter(a => !a.path.length && !a.battle && !a.retreating);
  if (!standing.length) return null;
  const attackers = standing.filter(a => (a.owner === REBELS ? a.rebelOf === reg.owner && reg.controller !== REBELS : controllerHostile(s, a.owner, reg)));
  if (!attackers.length) return null;
  // Defenders on the field stop the siege (a battle will sort it out).
  const defenders = standing.filter(a => !attackers.includes(a) && attackers.some(x => x.owner !== a.owner && (x.owner === REBELS || a.owner === REBELS || !friendlyTo(s, x.owner, a.owner))));
  if (defenders.length) return null;
  const lead = attackers[0];
  const group = attackers.filter(a => a.owner === lead.owner || (a.owner !== REBELS && lead.owner !== REBELS && friendlyTo(s, a.owner, lead.owner)));
  const regs = group.reduce((t, a) => t + armyRegs(a), 0);
  const art = group.reduce((t, a) => t + a.regs.art.n, 0);
  const need = minSiegeRegs(reg.fort);
  let daily: number;
  if (reg.fort <= 0) daily = 1 / controlDays(s, r);
  else {
    const siegeMod = lead.owner === REBELS ? 0 : nationMods(s, lead.owner).siegeSpeed;
    const defMod = !reg.controller || reg.controller === REBELS || !s.nations[reg.controller] ? 0 : nationMods(s, reg.controller).fortDefense;
    const stars = Math.max(0, ...group.map(a => a.general?.stars ?? 0)); // the best general there runs the siege
    const speed = ((1 + Math.min(1.5, art * 0.1)) * (1 + siegeMod) * (1 + Math.min(0.5, 0.02 * Math.max(0, regs - need))) * (1 + starBonus({ stars }))) / (1 + defMod);
    daily = speed / (FORT_DAYS * reg.fort);
  }
  return { besiegers: group, regs, artillery: art, enough: regs >= need, daily, by: lead.owner };
}

export function dailySieges(s: GameState): void {
  const byNode = new Map<string, Army[]>();
  for (const a of Object.values(s.armies)) {
    const l = byNode.get(a.node);
    if (l) l.push(a);
    else byNode.set(a.node, [a]);
  }
  for (const reg of Object.values(s.regions)) {
    const here = byNode.get(reg.id);
    if (!here && !reg.siege) continue;
    const info = here ? siegeInfo(s, reg.id, here) : null;
    if (!info || !info.enough) {
      // A battle at the walls (a relief army) pauses the siege; it does not undo it.
      if (reg.siege && here?.some(a => a.battle && a.owner === reg.siege!.by)) continue;
      if (reg.siege) reg.siege = undefined;
      continue;
    }
    if (!reg.siege || reg.siege.by !== info.by) reg.siege = { by: info.by, progress: 0, started: s.day };
    reg.siege.progress += info.daily;
    // A breach now and then.
    if (reg.fort > 0 && chance(s, 0.003)) reg.siege.progress += 0.1;
    if (reg.siege.progress >= 1) completeSiege(s, reg.id, info.by);
  }
}

/**
 * Days an army needs to take region `r` if it has no fort: CONTROL_DAYS, or COLONY_HOLD_DAYS for a New World region
 * a crown (not a native realm) owns and still holds, its settlers holding out (taking it back once occupied is quick).
 * The region and army sheets show the time left from siegeInfo's `daily`, so they follow this too.
 */
export function controlDays(s: GameState, r: RegionId): number {
  const reg = s.regions[r];
  const colony = !!REGION[r]?.nw && !!reg?.owner && reg.controller === reg.owner && !isNativeNation(reg.owner);
  return colony ? COLONY_HOLD_DAYS : CONTROL_DAYS;
}

function completeSiege(s: GameState, r: RegionId, by: NationId): void {
  const reg = s.regions[r];
  const prevController = reg.controller;
  // Liberating your own (or a friend's) region hands it back to its owner; not one you are at war with as well (an
  // old ally fighting on its overlord's side), which you take.
  const newController = by !== REBELS && !!reg.owner && friendlyTo(s, by, reg.owner) && !hostile(s, by, reg.owner) ? reg.owner : by === REBELS ? REBELS : by;
  setController(s, r, newController);
  const involved = [by, reg.owner, prevController].includes(s.player);
  if (involved) {
    const name = REGION[r].name;
    const fort = REGION[r].fort > 0 || reg.fort > 0;
    if (newController === s.player || (by === s.player && newController === reg.owner))
      log(s, 'siege', `${fort ? 'The fortress of ' : ''}${name} has fallen to your army.`, { node: r, important: reg.fort > 0 });
    else log(s, 'siege', `${name} has been taken by ${nationName(by)}.`, { node: r, important: true });
    if (reg.fort > 0) requestPause(s, 'siegeWon');
    if (reg.fort > 0 || (!!reg.owner && s.nations[reg.owner]?.capital === r)) siegeMoment(s, r, by, prevController, newController);
  }
}

/** A fortress or a capital taken by or from the player, as a banner. */
function siegeMoment(s: GameState, r: RegionId, by: NationId, prev: NationId | null, now: NationId | null): void {
  const p = s.player;
  const name = REGION[r].name;
  if ((now === p || by === p) && prev !== p) moment(s, { kind: 'fortress', card: false, tone: 'good', title: now === s.regions[r].owner ? `${name} is retaken` : `${name} falls to our army`, node: r });
  else if (prev === p) moment(s, { kind: 'fortress', card: false, tone: 'bad', title: `${name} falls to ${nationName(by)}`, node: r });
}

// ---------------------------------------------------------------- storming the walls

/** A siege must have run this long before its walls can be stormed, and this long between two storms. */
export const STORM_MIN_DAYS = 30;
/** Men lost per fort level, win or lose (a level 3 fort: 2,250). */
export const STORM_MEN_PER_FORT = 750;
/** Siege progress lost when the storm is thrown back. */
export const STORM_SETBACK = 0.1;
export const STORM_MIN = 0.05;
export const STORM_MAX = 0.85;
/** The AI storms only at these odds or better. */
export const AI_STORM_CHANCE = 0.75;

export interface StormOdds {
  chance: number; // 0..1
  men: number;
  parts: { label: string; value: number }[]; // percentage points, for the "?" breakdown
  blocked: string | null;
  by: NationId | null; // who leads the siege (only they may storm)
}

/** Dev-only counters (scripts/dev/sieges.ts); the game never reads them. */
export const COUNTS = { tried: 0, won: 0, men: 0, wonAt: {} as Record<RegionId, number> };

/**
 * The odds of storming region `r`'s walls now, and the men it costs: 5%, plus 70% of the siege's progress, 5% per
 * gun (+25% at most), 2% per regiment over the minimum (+10% at most) and 3% per star of the best general there;
 * 5% to 85%. `blocked` says why it can't be done yet. Null when nobody besieges anything here.
 */
export function stormOdds(s: GameState, r: RegionId): StormOdds | null {
  const reg = s.regions[r];
  if (!reg) return null;
  const info = siegeInfo(s, r);
  if (!reg.siege && !info) return null;
  const progress = reg.siege?.progress ?? 0;
  const need = minSiegeRegs(reg.fort);
  const guns = info?.artillery ?? 0;
  const spare = Math.max(0, (info?.regs ?? 0) - need);
  const stars = Math.max(0, ...(info?.besiegers ?? []).map(a => a.general?.stars ?? 0));
  const parts = [
    { label: 'Base', value: 5 },
    { label: `Siege ${Math.round(progress * 100)}% done`, value: Math.round(70 * progress) },
    { label: `Guns (${guns})`, value: 5 * Math.min(5, guns) },
    { label: `Regiments over the ${need} needed (${spare})`, value: 2 * Math.min(5, spare) },
    { label: `General (${stars} star${stars === 1 ? '' : 's'})`, value: 3 * stars },
  ].filter(p => p.value || p.label === 'Base');
  const sum = parts.reduce((t, p) => t + p.value, 0) / 100;
  const odds = clamp(sum, STORM_MIN, STORM_MAX);
  const men = STORM_MEN_PER_FORT * Math.max(0, reg.fort);
  const battle = Object.values(s.armies).some(a => a.node === r && a.battle);
  let blocked: string | null = null;
  if (reg.fort <= 0) blocked = 'No walls to storm';
  else if (battle) blocked = 'Battle under way';
  else if (!info || !info.enough) blocked = `Needs ${need} regiments`;
  else if (!reg.siege || s.day - reg.siege.started < STORM_MIN_DAYS) blocked = `Siege only ${reg.siege ? s.day - reg.siege.started : 0} days old`;
  else if (reg.siege.stormed !== undefined && s.day - reg.siege.stormed < STORM_MIN_DAYS) blocked = `Ready again in ${STORM_MIN_DAYS - (s.day - reg.siege.stormed)} days`;
  return { chance: odds, men, parts, blocked, by: info?.by ?? reg.siege?.by ?? null };
}

/**
 * Its besiegers storm region `r`'s walls: one roll at stormOdds' chance. Win or lose, 750 men per fort level fall,
 * taken from the besieging armies by their men (a regiment left with none refills from levies, as after a battle),
 * with the war exhaustion of a lost battle. Won, the fort falls now; thrown back, the siege loses a tenth of its
 * progress and can't be stormed again for STORM_MIN_DAYS. Null when it can't be done.
 */
export function storm(s: GameState, r: RegionId): 'won' | 'lost' | null {
  const reg = s.regions[r];
  const o = stormOdds(s, r);
  const info = siegeInfo(s, r);
  if (!o || o.blocked || !info || !reg.siege) return null;
  const won = chance(s, o.chance);
  const lost = takeMen(info.besiegers, o.men);
  for (const [n, men] of lost) {
    const nat: Nation | undefined = s.nations[n];
    if (nat) nat.warExhaustion = clamp(nat.warExhaustion + (men / 1000) * 0.1, 0, 20);
    if (n === s.player) s.stats.menLost += men;
  }
  const total = [...lost.values()].reduce((t, m) => t + m, 0);
  COUNTS.tried++;
  COUNTS.men += total;
  const name = REGION[r].name;
  const by = info.by;
  // An ally leading the siege spends the player's men beside its own: say so.
  const mine = by !== s.player ? (lost.get(s.player) ?? 0) : 0;
  const yours = mine ? ` (−${mine.toLocaleString()} of your men)` : '';
  const theirs = [reg.owner, reg.controller].includes(s.player);
  if (won) {
    COUNTS.won++;
    COUNTS.wonAt[r] = s.day;
    if (by !== s.player && (theirs || mine)) log(s, 'siege', `${nationName(by)} storms the walls of ${name}${yours}.`, { node: r, important: true });
    completeSiege(s, r, by);
    return 'won';
  }
  reg.siege.progress = Math.max(0, reg.siege.progress - STORM_SETBACK);
  reg.siege.stormed = s.day;
  if (by === s.player) log(s, 'siege', `The assault on ${name} is thrown back (−${total.toLocaleString()} men).`, { node: r, important: true });
  else if (mine || involvesPlayer(s, reg.owner ?? undefined, reg.controller ?? undefined) || newsworthy(s, by, reg.owner ?? undefined))
    log(s, 'siege', `${nationName(by)} storms the walls of ${name} and is thrown back${yours}.`, { node: r, important: theirs || !!mine });
  return 'lost';
}

/** Takes `men` from the armies in proportion to their men, and within each across its kinds of troops. */
function takeMen(armies: Army[], men: number): Map<NationId, number> {
  const pools: { a: Army; t: UnitType }[] = [];
  for (const a of armies) for (const t of ['inf', 'cav', 'art'] as const) if (a.regs[t].men > 0) pools.push({ a, t });
  let left = Math.min(men, armies.reduce((t, a) => t + armyMen(a), 0));
  let rest = pools.reduce((t, p) => t + p.a.regs[p.t].men, 0);
  const out = new Map<NationId, number>();
  for (const { a, t } of pools) {
    const have = a.regs[t].men;
    const l = Math.min(have, Math.round((left * have) / Math.max(1, rest)));
    a.regs[t].men -= l;
    left -= l;
    rest -= have;
    out.set(a.owner, (out.get(a.owner) ?? 0) + l);
  }
  return out;
}

/** Monthly, for an AI crown: storm the walls of each fort it besieges once the odds reach AI_STORM_CHANCE. */
export function aiStorms(s: GameState, nat: Nation): void {
  for (const reg of Object.values(s.regions)) {
    if (reg.siege?.by !== nat.id || reg.fort <= 0) continue;
    const o = stormOdds(s, reg.id);
    if (o && !o.blocked && o.by === nat.id && o.chance >= AI_STORM_CHANCE) storm(s, reg.id);
  }
}

export const regionLabel = (r: RegionId) => regionName(r);
