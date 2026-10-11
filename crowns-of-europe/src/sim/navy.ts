/** Light navy: fleets sail between sea zones, carry armies, blockade coasts and fight one-roll battles. */
import { GRAPH, INLAND_SEAS, MAP_REGION, SEA, UNITS, nationName } from './content';
import { log } from './log';
import { friendlyTo, hostile, nationMods, warsOf, sideOf } from './queries';
import type { Fleet, GameState, NationId, SeaId, ShipType } from './types';
import { randInt } from './util';

export const FLEET_EDGE_DAYS = 5;
export const shipCount = (f: Fleet) => f.ships.galley + f.ships.warship + f.ships.transport;

export function fleetPower(s: GameState, f: Fleet): number {
  const mods = s.nations[f.owner] ? nationMods(s, f.owner).navalPower : 0;
  const inland = INLAND_SEAS.has(f.sea);
  let p = 0;
  for (const t of Object.keys(f.ships) as ShipType[]) {
    let v = f.ships[t] * UNITS.ships[t].power;
    if (t === 'galley' && !inland) v *= 0.5; // galleys struggle in the open ocean
    p += v;
  }
  return p * (0.4 + 0.6 * f.hull) * (1 + mods);
}

export function transportCapacity(fleets: Fleet[]): number {
  let c = 0;
  for (const f of fleets) for (const t of Object.keys(f.ships) as ShipType[]) c += f.ships[t] * UNITS.ships[t].capacity;
  return c;
}

export function findSeaPath(from: SeaId, to: SeaId): SeaId[] | null {
  if (from === to) return [];
  const prev = new Map<SeaId, SeaId>();
  const q = [from];
  const seen = new Set(q);
  while (q.length) {
    const cur = q.shift()!;
    for (const e of GRAPH[cur]) {
      if (e.kind !== 'sea' || seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, cur);
      if (e.to === to) {
        const path: SeaId[] = [];
        for (let c: SeaId | undefined = to; c && c !== from; c = prev.get(c)) path.unshift(c);
        return path;
      }
      q.push(e.to);
    }
  }
  return null;
}

export function dailyFleets(s: GameState): void {
  for (const f of Object.values(s.fleets)) {
    if (!f.path.length) continue;
    f.progress++;
    if (f.edgeDays === 0) f.edgeDays = FLEET_EDGE_DAYS;
    if (f.progress < f.edgeDays) continue;
    f.sea = f.path.shift()!;
    f.progress = 0;
    f.edgeDays = 0;
    if (!f.path.length) f.retreating = false;
  }
  navalBattles(s);
}

function navalBattles(s: GameState): void {
  const bySea = new Map<SeaId, Fleet[]>();
  for (const f of Object.values(s.fleets)) {
    if (f.path.length || f.retreating) continue;
    const l = bySea.get(f.sea);
    if (l) l.push(f);
    else bySea.set(f.sea, [f]);
  }
  for (const [sea, fleets] of bySea) {
    if (fleets.length < 2) continue;
    const a = fleets[0];
    const enemies = fleets.filter(f => hostile(s, a.owner, f.owner));
    if (!enemies.length) {
      // Maybe two other fleets here are hostile to each other.
      const b = fleets.find(f => fleets.some(g => hostile(s, f.owner, g.owner)));
      if (!b) continue;
      resolveNaval(s, sea, fleets.filter(f => !hostile(s, b.owner, f.owner)), fleets.filter(f => hostile(s, b.owner, f.owner)));
      continue;
    }
    resolveNaval(s, sea, fleets.filter(f => !hostile(s, a.owner, f.owner)), enemies);
  }
}

function resolveNaval(s: GameState, sea: SeaId, sideA: Fleet[], sideB: Fleet[]): void {
  const pa = sideA.reduce((t, f) => t + fleetPower(s, f), 0) * (randInt(s, 1, 10) + 5);
  const pb = sideB.reduce((t, f) => t + fleetPower(s, f), 0) * (randInt(s, 1, 10) + 5);
  const [win, lose, pw, pl] = pa >= pb ? [sideA, sideB, pa, pb] : [sideB, sideA, pb, pa];
  const ratio = pw / Math.max(0.01, pl);
  const destroyed = ratio >= 5;
  let lostL = 0;
  let lostW = 0;
  for (const f of lose) {
    const frac = destroyed ? 1 : Math.min(0.7, 0.25 + 0.1 * ratio);
    for (const t of Object.keys(f.ships) as ShipType[]) {
      const l = Math.ceil(f.ships[t] * frac);
      f.ships[t] -= l;
      lostL += l;
    }
    f.hull = Math.max(0.2, f.hull - 0.4);
    if (shipCount(f) <= 0) delete s.fleets[f.id];
    else retreatFleet(s, f);
  }
  for (const f of win) {
    const frac = Math.max(0.02, 0.2 / ratio);
    for (const t of Object.keys(f.ships) as ShipType[]) {
      const l = Math.floor(f.ships[t] * frac);
      f.ships[t] -= l;
      lostW += l;
    }
    f.hull = Math.max(0.2, f.hull - 0.15);
  }
  const owners = (fs: Fleet[]) => [...new Set(fs.map(f => f.owner))];
  const involved = [...owners(win), ...owners(lose)].includes(s.player);
  const text = `Naval battle in the ${SEA[sea].name}: ${owners(win).map(nationName).join(', ')} defeat ${owners(lose).map(nationName).join(', ')}${destroyed ? ', sinking the whole fleet' : ''}. Ships lost: ${lostW} to ${lostL}.`;
  if (involved) log(s, 'battle', text, { node: sea, important: true });
  // A naval victory counts for a little war score.
  for (const w of Object.values(s.wars)) {
    const ws = sideOf(w, win[0].owner);
    const ls = sideOf(w, lose[0].owner);
    if (ws === null || ls === null || ws === ls) continue;
    const pts = Math.min(8, lostL * 0.4);
    w.battleScore = Math.max(-40, Math.min(40, w.battleScore + (ws === 0 ? pts : -pts)));
  }
}

function retreatFleet(s: GameState, f: Fleet): void {
  const options = GRAPH[f.sea].filter(e => e.kind === 'sea').map(e => e.to);
  // Prefer a sea next to your own coast.
  const home = options.find(sea => Object.values(MAP_REGION).some(r => r.seas.includes(sea) && s.regions[r.id].owner === f.owner));
  const to = home ?? options[0];
  if (!to) return;
  f.path = [to];
  f.progress = 0;
  f.edgeDays = 0;
  f.retreating = true;
}

/** Monthly: blockades and repairs. */
export function monthlyNavy(s: GameState): void {
  for (const r of Object.values(s.regions)) r.blockaded = false;
  for (const f of Object.values(s.fleets)) {
    // Repairs near your own coast.
    const homeCoast = Object.values(MAP_REGION).some(r => r.seas.includes(f.sea) && s.regions[r.id].owner === f.owner);
    if (homeCoast) f.hull = Math.min(1, f.hull + 0.2);
    if (f.path.length || !warsOf(s, f.owner).length) continue;
    const myPower = fleetPower(s, f);
    for (const mr of Object.values(MAP_REGION)) {
      if (!mr.seas.includes(f.sea)) continue;
      const reg = s.regions[mr.id];
      if (!hostile(s, f.owner, reg.controller)) continue;
      const guard = Object.values(s.fleets).filter(g => g.sea === f.sea && friendlyTo(s, g.owner, reg.controller));
      const guardPower = guard.reduce((t, g) => t + fleetPower(s, g), 0);
      if (guardPower < myPower) reg.blockaded = true;
    }
  }
}

export function dailyShipyards(s: GameState): void {
  for (const nat of Object.values(s.nations)) {
    if (!nat.alive || !nat.shipyard.length) continue;
    const ready = nat.shipyard.filter(x => x.done <= s.day);
    if (!ready.length) continue;
    nat.shipyard = nat.shipyard.filter(x => x.done > s.day);
    for (const order of ready) {
      let fleet = Object.values(s.fleets).find(f => f.owner === nat.id && f.sea === order.sea && !f.path.length);
      if (!fleet) {
        fleet = { id: `f${++s.seq}`, name: `${nationName(nat.id)} Squadron`, owner: nat.id, sea: order.sea, ships: { galley: 0, warship: 0, transport: 0 }, hull: 1, path: [], progress: 0, edgeDays: 0 };
        s.fleets[fleet.id] = fleet;
      }
      fleet.ships[order.type]++;
    }
    if (nat.id === s.player) log(s, 'war', `${ready.length} new ship${ready.length > 1 ? 's are' : ' is'} ready.`, { node: ready[0].sea });
  }
}

export const isAtWarWith = (s: GameState, a: NationId, b: NationId) => hostile(s, a, b);
