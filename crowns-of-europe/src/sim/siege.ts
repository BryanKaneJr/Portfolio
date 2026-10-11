/**
 * Sieges: an army standing in an enemy-held region takes it. Regions without a fort fall after a short
 * control timer; forts need enough regiments (3 per fort level) and time, sped up by artillery.
 */
import { REGION, nationName, regionName } from './content';
import { log, requestPause } from './log';
import { REBELS, armyRegs, controllerHostile, friendlyTo, nationMods } from './queries';
import { setController } from './territory';
import type { Army, GameState, NationId, RegionId } from './types';
import { chance } from './util';

export const CONTROL_DAYS = 15;
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
  if (reg.fort <= 0) daily = 1 / CONTROL_DAYS;
  else {
    const siegeMod = lead.owner === REBELS ? 0 : nationMods(s, lead.owner).siegeSpeed;
    const defMod = reg.controller === REBELS || !s.nations[reg.controller] ? 0 : nationMods(s, reg.controller).fortDefense;
    const speed = (1 + Math.min(1.5, art * 0.1)) * (1 + siegeMod) * (1 + Math.min(0.5, 0.02 * Math.max(0, regs - need))) / (1 + defMod);
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

function completeSiege(s: GameState, r: RegionId, by: NationId): void {
  const reg = s.regions[r];
  const prevController = reg.controller;
  // Liberating your own (or a friend's) region hands it back to its owner.
  const newController = by !== REBELS && friendlyTo(s, by, reg.owner) ? reg.owner : by === REBELS ? REBELS : by;
  setController(s, r, newController);
  const involved = [by, reg.owner, prevController].includes(s.player);
  if (involved) {
    const name = REGION[r].name;
    const fort = REGION[r].fort > 0 || reg.fort > 0;
    if (newController === s.player || (by === s.player && newController === reg.owner))
      log(s, 'siege', `${fort ? 'The fortress of ' : ''}${name} has fallen to your army.`, { node: r, important: reg.fort > 0 });
    else log(s, 'siege', `${name} has been taken by ${nationName(by)}.`, { node: r, important: true });
    if (reg.fort > 0) requestPause(s, 'siegeWon');
  }
}

export const regionLabel = (r: RegionId) => regionName(r);
