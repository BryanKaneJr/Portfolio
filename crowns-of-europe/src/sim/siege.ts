/**
 * Sieges: an army standing in an enemy-held region takes it. Regions without a fort fall after a short
 * control timer (longer for a founded New World colony: its settlers hold out in their stockades); forts need
 * enough regiments (3 per fort level) and time, sped up by artillery.
 */
import { REGION, isNativeNation, nationName, regionName } from './content';
import { log, moment, requestPause } from './log';
import { REBELS, armyRegs, controllerHostile, friendlyTo, hostile, nationMods } from './queries';
import { starBonus } from './rulers';
import { setController } from './territory';
import type { Army, GameState, NationId, RegionId } from './types';
import { chance } from './util';

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

export const regionLabel = (r: RegionId) => regionName(r);
