/**
 * Unrest (0-10) per region from foreign faith, uncored land, war exhaustion and low stability.
 * Above 7, rebels may rise. They are kept rare: a region can only rise once every few years.
 */
import { NATION, regionName, nationName } from './content';
import { log, involvesPlayer, newsworthy } from './log';
import { REBELS, armyRegs, isCored, nationMods } from './queries';
import { makeArmy } from './state';
import { setController, releaseNation } from './territory';
import type { GameState, NationId, Region, RegionId } from './types';
import { chance, clamp, months, years } from './util';
import { newGeneral } from './rulers';

export interface UnrestPart {
  label: string;
  value: number;
}

export function unrestBreakdown(s: GameState, r: Region): UnrestPart[] {
  if (!r.owner) return [];
  const nat = s.nations[r.owner];
  if (!nat) return [];
  const out: UnrestPart[] = [];
  const add = (label: string, value: number) => value && out.push({ label, value: Math.round(value * 10) / 10 });
  if (r.faith !== nat.faith) {
    const tolerant = nat.flags.tolerance ? 1 : 0;
    add('Different faith', 3 - tolerant);
  }
  if (!isCored(r)) add('Recently conquered', 2);
  add('War exhaustion', nat.warExhaustion / 4);
  add('Stability', -nat.stability * 0.75);
  add('Modifiers', nationMods(s, r.owner).unrest);
  if (r.converting) add('Conversion under way', 2);
  for (const m of r.unrestMods) if (m.until > s.day) add('Recent events', m.amount);
  return out;
}

export function monthlyUnrest(s: GameState): void {
  const quiet = '__noEvents' in s.flags;
  for (const r of Object.values(s.regions)) {
    if (!r.owner) continue;
    r.unrestMods = r.unrestMods.filter(m => m.until > s.day);
    r.unrest = clamp(
      unrestBreakdown(s, r).reduce((t, p) => t + p.value, 0),
      0,
      10,
    );
    if (r.unrest > 7 && r.controller === r.owner && !(s.day - (s.nations[r.owner]?.flags[`_rebels_${r.id}`] ?? -99999) < years(6))) {
      if (!quiet && chance(s, 0.04)) {
        s.nations[r.owner].flags[`_rebels_${r.id}`] = s.day;
        spawnRebels(s, r.id, Math.max(4, Math.round(r.dev * 1.3)));
      }
    }
  }
  rebelOutcomes(s);
}

export function spawnRebels(s: GameState, region: RegionId, regiments: number): void {
  const reg = s.regions[region];
  if (!reg?.owner) return;
  const target = reg.owner;
  const cav = Math.round(regiments * 0.2);
  const a = makeArmy(s, REBELS, region, regiments - cav, cav, 0);
  a.name = `${regionName(region)} Rebels`;
  a.rebelOf = target;
  a.rebelSince = s.day;
  a.morale = 2;
  if (regiments >= 6) a.general = newGeneral(s, REBELS);
  s.armies[a.id] = a;
  if (newsworthy(s, target))
    log(s, 'rebels', `Rebels rise in ${regionName(region)} against ${nationName(target)} (${regiments} regiments).`, {
      node: region,
      important: involvesPlayer(s, target),
    });
}

/** Rebels who hold their region for a year force their demands, then go home. */
function rebelOutcomes(s: GameState): void {
  for (const reg of Object.values(s.regions)) {
    if (reg.controller !== REBELS || !reg.owner) continue;
    const owner = reg.owner;
    const flagKey = `_rebelheld_${reg.id}`;
    const nat = s.nations[owner];
    if (!nat) {
      reg.controller = reg.owner;
      continue;
    }
    nat.flags[flagKey] ??= s.day;
    if (s.day - nat.flags[flagKey] < months(12)) continue;
    delete nat.flags[flagKey];
    // A region with the core of a fallen (or subject) nation breaks away; otherwise the crown gives in.
    const breakaway = reg.cores.find(c => c !== owner && s.nations[c] && !s.nations[c].alive && NATION[c]);
    if (breakaway && releaseNation(s, owner, breakaway)) {
      log(s, 'rebels', `Rebels in ${regionName(reg.id)} win: ${nationName(breakaway)} is restored!`, { node: reg.id, important: true });
    } else {
      setController(s, reg.id, owner);
      nat.stability = clamp(nat.stability - 1, -3, 3);
      for (const r of Object.values(s.regions)) if (r.owner === owner) r.unrestMods.push({ amount: -3, until: s.day + years(5) });
      if (owner === s.player) log(s, 'rebels', `You give in to the rebels of ${regionName(reg.id)}. Stability -1, but the land calms down.`, { node: reg.id, important: true });
    }
    for (const id of Object.keys(s.armies)) {
      const a = s.armies[id];
      if (a.owner === REBELS && a.rebelOf === owner && a.node === reg.id) delete s.armies[id];
    }
  }
  // Rebel armies whose target died or who wandered too long disband.
  for (const id of Object.keys(s.armies)) {
    const a = s.armies[id];
    if (a.owner !== REBELS) continue;
    if (!a.rebelOf || !s.nations[a.rebelOf]?.alive || s.day - (a.rebelSince ?? s.day) > years(6) || armyRegs(a) === 0) delete s.armies[id];
  }
}

export const isRebelArmyOf = (s: GameState, n: NationId) => Object.values(s.armies).some(a => a.owner === REBELS && a.rebelOf === n);
