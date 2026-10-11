/** Armies: pathfinding, movement, recruitment, merging/splitting, supply, attrition and reinforcement. */
import { GRAPH, MAP_REGION, REGION, UNITS, isSea, regionName, type Edge } from './content';
import { log, requestPause } from './log';
import {
  REBELS,
  armiesHostile,
  armyMen,
  armyRegs,
  canEnter,
  controllerHostile,
  friendlyTo,
  hostile,
  hostileFort,
  maxMorale,
  nationMods,
  fleetsOf,
} from './queries';
import { joinOrStartBattle } from './battle';
import { fleetPower, transportCapacity } from './navy';
import { makeArmy } from './state';
import type { Army, GameState, NationId, NodeId, RegionId, Terrain, UnitType } from './types';
import { dateOf } from './util';

export const TERRAIN_DAYS: Record<Terrain, number> = { plains: 8, forest: 11, hills: 11, marsh: 13, mountains: 16 };
export const FRONT_WIDTH: Record<Terrain, number> = { plains: 20, forest: 14, hills: 14, marsh: 12, mountains: 10 };
const SEA_DAYS = 4;
const STRAIT_DAYS = 6;

export const fullMen = (a: Army) => (a.regs.inf.n + a.regs.cav.n + a.regs.art.n) * 1000;

// ---------------------------------------------------------------- pathfinding

/** Fleets of `n` that can carry an army of `regs` regiments through sea `sea` right now. */
export function canSail(s: GameState, n: NationId, sea: string, regs: number): boolean {
  if (n === REBELS) return false;
  const own = fleetsOf(s, n).filter(f => f.sea === sea && f.path.length === 0);
  if (transportCapacity(own) < regs) return false;
  const ownPower = own.reduce((a, f) => a + fleetPower(s, f), 0);
  const enemy = Object.values(s.fleets).filter(f => f.sea === sea && hostile(s, n, f.owner));
  const enemyPower = enemy.reduce((a, f) => a + fleetPower(s, f), 0);
  return enemyPower <= ownPower;
}

/** A strait is closed if an enemy fleet sits in its sea and outguns yours there. */
export function straitOpen(s: GameState, n: NationId, sea: string): boolean {
  const enemy = Object.values(s.fleets).filter(f => f.sea === sea && hostile(s, n, f.owner));
  if (!enemy.length) return true;
  const enemyPower = enemy.reduce((a, f) => a + fleetPower(s, f), 0);
  const ownPower = fleetsOf(s, n)
    .filter(f => f.sea === sea)
    .reduce((a, f) => a + fleetPower(s, f), 0);
  return ownPower >= enemyPower;
}

export function edgeDays(s: GameState, a: Pick<Army, 'owner' | 'general' | 'rebelOf'>, from: NodeId, e: Edge, retreating = false): number {
  let d: number;
  if (e.kind === 'sea' || (e.kind === 'coast' && isSea(e.to))) d = SEA_DAYS;
  else if (e.kind === 'coast') d = SEA_DAYS;
  else if (e.kind === 'strait') d = STRAIT_DAYS;
  else d = TERRAIN_DAYS[REGION[e.to].terrain];
  if (!isSea(e.to) && a.owner !== REBELS) {
    const reg = s.regions[e.to];
    if (reg && controllerHostile(s, a.owner, reg)) d *= 1.25;
  }
  const maneuver = a.general?.maneuver ?? 0;
  const mov = a.owner === REBELS ? 0 : nationMods(s, a.owner).movement;
  d *= Math.max(0.5, 1 - maneuver * 0.04 - mov);
  if (retreating) d *= 0.7;
  return Math.max(2, Math.round(d));
}

export interface PathResult {
  path: NodeId[];
  days: number;
}

/**
 * Cheapest route for an army. Rules: no entering land you have no access to, hostile forts stop you
 * (you may end on one, not pass it), seas need your own transports, enemy fleets close straits.
 */
export interface PathTree {
  dist: Map<NodeId, number>;
  prev: Map<NodeId, NodeId>;
}

/**
 * Cheapest routes from an army's position. Rules: no entering land you have no access to, hostile forts
 * stop you (you may end on one, not pass it), seas need your own transports, enemy fleets close straits.
 * With `to`, stops as soon as that node is settled.
 */
export function pathTree(
  s: GameState,
  army: Pick<Army, 'owner' | 'general' | 'rebelOf' | 'node' | 'regs'>,
  opts: { retreat?: boolean; ignoreAccess?: boolean; to?: NodeId; maxDays?: number } = {},
): PathTree {
  const from = army.node;
  const regs = armyRegs(army as Army);
  const n = army.owner;
  const dist = new Map<NodeId, number>([[from, 0]]);
  const prev = new Map<NodeId, NodeId>();
  const done = new Set<NodeId>();
  const open: NodeId[] = [from];
  const sailOk = new Map<string, boolean>();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist.get(open[i])! < dist.get(open[bi])!) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (done.has(cur)) continue;
    done.add(cur);
    if (cur === opts.to) break;
    if (opts.maxDays !== undefined && dist.get(cur)! > opts.maxDays) break;
    // Can't walk through a hostile fort (unless we start there).
    if (cur !== from && !isSea(cur) && !opts.retreat && hostileFort(s, n, cur)) continue;
    for (const e of GRAPH[cur]) {
      if (done.has(e.to)) continue;
      if (isSea(e.to)) {
        let ok = sailOk.get(e.to);
        if (ok === undefined) {
          ok = canSail(s, n, e.to, regs);
          sailOk.set(e.to, ok);
        }
        if (!ok) continue;
      } else {
        if (!opts.ignoreAccess && !opts.retreat && !canEnter(s, n, e.to, army.rebelOf)) continue;
        if (e.kind === 'strait' && e.sea && !straitOpen(s, n, e.sea)) continue;
      }
      const nd = dist.get(cur)! + edgeDays(s, army, cur, e, opts.retreat);
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, cur);
        open.push(e.to);
      }
    }
  }
  return { dist, prev };
}

export function pathFromTree(tree: PathTree, from: NodeId, to: NodeId): PathResult | null {
  if (!tree.dist.has(to) || isSea(to)) return null;
  const path: NodeId[] = [];
  for (let c: NodeId | undefined = to; c && c !== from; c = tree.prev.get(c)) path.unshift(c);
  return { path, days: tree.dist.get(to)! };
}

export function findPath(
  s: GameState,
  army: Pick<Army, 'owner' | 'general' | 'rebelOf' | 'node' | 'regs'>,
  to: NodeId,
  opts: { retreat?: boolean; ignoreAccess?: boolean } = {},
): PathResult | null {
  if (army.node === to) return { path: [], days: 0 };
  if (isSea(to)) return null;
  return pathFromTree(pathTree(s, army, { ...opts, to }), army.node, to);
}

export function orderMove(s: GameState, a: Army, to: NodeId): PathResult | null {
  if (a.battle || a.retreating) return null;
  const res = findPath(s, a, to);
  if (!res) return null;
  // Keep walking the current edge if the new route starts the same way.
  const keep = a.path.length > 0 && res.path[0] === a.path[0];
  a.path = res.path;
  if (!keep) {
    a.progress = 0;
    a.edgeDays = 0;
  }
  return res;
}

/** Days left until arrival along the current path. */
export function etaDays(s: GameState, a: Army): number {
  let total = Math.max(0, a.edgeDays - a.progress);
  let prev = a.path[0];
  for (let i = 1; i < a.path.length; i++) {
    const e = GRAPH[prev].find(x => x.to === a.path[i]);
    if (e) total += edgeDays(s, a, prev, e);
    prev = a.path[i];
  }
  if (a.edgeDays === 0 && a.path.length) {
    const e = GRAPH[a.node].find(x => x.to === a.path[0]);
    if (e) total += edgeDays(s, a, a.node, e);
  }
  return Math.round(total);
}

// ---------------------------------------------------------------- daily movement

export function dailyMovement(s: GameState): void {
  for (const a of Object.values(s.armies)) {
    if (!a.path.length || a.battle) continue;
    if (a.edgeDays === 0) {
      const e = GRAPH[a.node].find(x => x.to === a.path[0]);
      if (!e) {
        a.path = [];
        continue;
      }
      // Re-check the next step (a strait may have closed, access may have ended).
      if (!a.retreating && !isSea(e.to) && !canEnter(s, a.owner, e.to, a.rebelOf)) {
        a.path = [];
        continue;
      }
      a.edgeDays = edgeDays(s, a, a.node, e, a.retreating);
      a.progress = 0;
    }
    a.progress += 1;
    if (a.progress < a.edgeDays) continue;
    a.from = a.node;
    a.node = a.path.shift()!;
    a.progress = 0;
    a.edgeDays = 0;
    arrive(s, a);
  }
}

function arrive(s: GameState, a: Army): void {
  if (isSea(a.node)) return;
  if (a.retreating) {
    if (!a.path.length) a.retreating = false;
    return;
  }
  // Enemies here? Fight.
  const enemies = Object.values(s.armies).filter(o => o.node === a.node && o.id !== a.id && !o.retreating && o.path.length === 0 && armiesHostile(s, a, o));
  const battleHere = Object.values(s.battles).find(b => b.node === a.node);
  if (enemies.length || (battleHere && battleHasEnemyOf(s, battleHere.id, a))) {
    a.path = [];
    joinOrStartBattle(s, a.node, a);
    return;
  }
  // A hostile fort stops the march.
  if (a.path.length && hostileFort(s, a.owner, a.node)) {
    a.path = [];
    if (a.owner === s.player) log(s, 'war', `The ${a.name} is stopped by the fortress at ${regionName(a.node)}.`, { node: a.node });
  }
  if (!a.path.length && a.owner === s.player) {
    requestPause(s, 'armyArrived');
  }
}

function battleHasEnemyOf(s: GameState, battleId: string, a: Army): boolean {
  const b = s.battles[battleId];
  return b.sides.some(side => side.armies.some(id => s.armies[id] && armiesHostile(s, s.armies[id], a)));
}

/** Hostile armies standing in the same region (e.g. right after a war is declared) start fighting. */
export function dailyEngagements(s: GameState): void {
  const byNode = new Map<NodeId, Army[]>();
  for (const a of Object.values(s.armies)) {
    if (a.path.length || a.retreating || a.battle || isSea(a.node)) continue;
    const list = byNode.get(a.node);
    if (list) list.push(a);
    else byNode.set(a.node, [a]);
  }
  for (const [node, list] of byNode) {
    if (list.length < 2 && !Object.values(s.battles).some(b => b.node === node)) continue;
    for (const a of list) {
      if (a.battle) continue;
      if (list.some(o => o !== a && armiesHostile(s, a, o)) || Object.values(s.battles).some(b => b.node === node && battleHasEnemyOf(s, b.id, a))) {
        joinOrStartBattle(s, node, a);
      }
    }
  }
}

// ---------------------------------------------------------------- retreat

/** Send a beaten army to the nearest friendly region with no enemies in it. */
export function retreat(s: GameState, a: Army): void {
  const q: NodeId[] = [a.node];
  const seen = new Set(q);
  let target: NodeId | null = null;
  while (q.length && !target) {
    const cur = q.shift()!;
    for (const e of GRAPH[cur]) {
      if (seen.has(e.to) || isSea(e.to)) continue;
      seen.add(e.to);
      const reg = s.regions[e.to];
      const safe =
        a.owner === REBELS
          ? reg.owner === a.rebelOf
          : friendlyTo(s, a.owner, reg.controller) && !Object.values(s.armies).some(o => o.node === e.to && armiesHostile(s, a, o));
      if (safe && !Object.values(s.battles).some(b => b.node === e.to)) {
        target = e.to;
        break;
      }
      q.push(e.to);
    }
  }
  a.battle = undefined;
  if (!target) {
    // Nowhere to run: the army scatters.
    delete s.armies[a.id];
    return;
  }
  const res = findPath(s, a, target, { retreat: true });
  a.retreating = true;
  a.path = res?.path ?? [target];
  a.progress = 0;
  a.edgeDays = 0;
}

// ---------------------------------------------------------------- recruiting, merging, splitting

export function addRegiments(s: GameState, n: NationId, node: RegionId, add: Partial<Record<UnitType, number>>, mercs = 0): Army {
  const here = Object.values(s.armies).find(a => a.owner === n && a.node === node && !a.path.length && !a.battle && !a.retreating);
  if (here) {
    for (const t of ['inf', 'cav', 'art'] as UnitType[]) {
      const k = add[t] ?? 0;
      here.regs[t].n += k;
      here.regs[t].men += k * 1000;
    }
    here.mercs += mercs;
    return here;
  }
  const a = makeArmy(s, n, node, add.inf ?? 0, add.cav ?? 0, add.art ?? 0, mercs);
  a.morale = maxMorale(s, n) * 0.5;
  s.armies[a.id] = a;
  return a;
}

export function dailyRecruitment(s: GameState): void {
  for (const nat of Object.values(s.nations)) {
    if (!nat.alive || !nat.recruiting.length) continue;
    const ready = nat.recruiting.filter(r => r.done <= s.day);
    if (!ready.length) continue;
    nat.recruiting = nat.recruiting.filter(r => r.done > s.day);
    for (const r of ready) {
      // Recruits only muster in a region you still hold.
      if (s.regions[r.region].controller !== nat.id) continue;
      addRegiments(s, nat.id, r.region, { [r.type]: 1 });
    }
    if (nat.id === s.player) log(s, 'war', `${ready.length} new regiment${ready.length > 1 ? 's are' : ' is'} ready.`, { node: ready[0].region });
  }
}

export function mergeArmies(s: GameState, into: Army, other: Army): boolean {
  if (into.owner !== other.owner || into.node !== other.node || into.battle || other.battle || into.id === other.id) return false;
  const menA = armyMen(into);
  const menB = armyMen(other);
  for (const t of ['inf', 'cav', 'art'] as UnitType[]) {
    into.regs[t].n += other.regs[t].n;
    into.regs[t].men += other.regs[t].men;
  }
  into.mercs += other.mercs;
  into.morale = menA + menB > 0 ? (into.morale * menA + other.morale * menB) / (menA + menB) : into.morale;
  if (!into.general && other.general) into.general = other.general;
  else if (other.general && !other.general.isRuler) s.nations[other.owner]?.generals.push(other.general);
  delete s.armies[other.id];
  return true;
}

export function splitArmy(s: GameState, a: Army, take: Record<UnitType, number>): Army | null {
  if (a.battle || a.retreating) return null;
  const total = take.inf + take.cav + take.art;
  if (total <= 0 || total >= armyRegs(a)) return null;
  for (const t of ['inf', 'cav', 'art'] as UnitType[]) if (take[t] > a.regs[t].n) return null;
  const b = makeArmy(s, a.owner, a.node, 0, 0, 0);
  for (const t of ['inf', 'cav', 'art'] as UnitType[]) {
    if (!take[t]) continue;
    const men = Math.round((a.regs[t].men * take[t]) / a.regs[t].n);
    a.regs[t].n -= take[t];
    a.regs[t].men -= men;
    b.regs[t].n = take[t];
    b.regs[t].men = men;
  }
  const mercMove = Math.min(a.mercs, Math.round((a.mercs * total) / (total + armyRegs(a))));
  a.mercs -= mercMove;
  b.mercs = mercMove;
  b.morale = a.morale;
  b.path = [];
  s.armies[b.id] = b;
  return b;
}

// ---------------------------------------------------------------- supply, attrition, reinforcement

const isWinter = (s: GameState) => {
  const m = dateOf(s.day).month;
  return m === 10 || m === 11 || m === 0 || m === 1;
};
const coldRegion = (r: RegionId) => {
  const [lon, lat] = MAP_REGION[r].lonlat;
  return lat > 50 || lon > 22;
};

export function supplyLimit(s: GameState, r: RegionId, n: NationId): number {
  const reg = s.regions[r];
  const base = { plains: 10, forest: 7, hills: 7, marsh: 5, mountains: 5 }[REGION[r].terrain];
  let v = base + reg.dev * 0.8;
  if (n !== REBELS && friendlyTo(s, n, reg.controller)) v += 3;
  if (isWinter(s) && coldRegion(r)) v *= 0.6;
  return Math.max(3, Math.round(v));
}

export function monthlyAttrition(s: GameState): void {
  const groups = new Map<string, Army[]>();
  for (const a of Object.values(s.armies)) {
    if (isSea(a.node) || a.owner === REBELS) continue;
    const key = `${a.node}|${a.owner}`;
    const list = groups.get(key);
    if (list) list.push(a);
    else groups.set(key, [a]);
  }
  for (const [key, list] of groups) {
    const [node, n] = key.split('|');
    // Friendly armies in the same region share the supply.
    let regs = 0;
    for (const o of Object.values(s.armies)) if (o.node === node && o.owner !== REBELS && friendlyTo(s, n, o.owner)) regs += armyRegs(o);
    const limit = supplyLimit(s, node, n);
    const reg = s.regions[node];
    let pct = 0;
    if (regs > limit) pct = Math.min(0.1, 0.01 + 0.04 * (regs / limit - 1));
    if (controllerHostile(s, n, reg)) pct += 0.01;
    pct *= Math.max(0, 1 + nationMods(s, n).attrition);
    if (pct <= 0) continue;
    let lost = 0;
    for (const a of list) {
      for (const t of ['inf', 'cav', 'art'] as UnitType[]) {
        const l = Math.round(a.regs[t].men * pct);
        a.regs[t].men -= l;
        lost += l;
      }
    }
    if (n === s.player && lost >= 300) log(s, 'war', `Attrition at ${regionName(node)}: ${lost.toLocaleString()} men lost to hunger and disease.`, { node });
  }
}

export function monthlyReinforce(s: GameState): void {
  for (const a of Object.values(s.armies)) {
    if (a.owner === REBELS || a.battle || a.retreating || isSea(a.node)) continue;
    const nat = s.nations[a.owner];
    if (!nat) continue;
    const reg = s.regions[a.node];
    if (controllerHostile(s, a.owner, reg)) continue; // no reinforcements deep in enemy land
    const full = fullMen(a);
    const missing = full - armyMen(a);
    if (missing <= 0) continue;
    const rate = (nat.armyMode === 'war' ? 0.25 : 0.1) * full;
    const regs = armyRegs(a);
    const mercShare = regs ? a.mercs / regs : 0;
    let want = Math.min(missing, rate);
    const fromManpower = Math.min(want * (1 - mercShare), nat.manpower);
    const fromGold = want * mercShare;
    const goldCost = (fromGold / 1000) * UNITS.unitCost.inf * 0.5;
    const paid = nat.gold >= goldCost ? fromGold : 0;
    if (paid) nat.gold -= goldCost;
    nat.manpower -= fromManpower;
    want = fromManpower + paid;
    // Spread the men over regiment types by what each is missing.
    for (const t of ['inf', 'cav', 'art'] as UnitType[]) {
      const m = a.regs[t].n * 1000 - a.regs[t].men;
      if (m <= 0) continue;
      a.regs[t].men += Math.round((want * m) / missing);
      a.regs[t].men = Math.min(a.regs[t].n * 1000, a.regs[t].men);
    }
  }
}

export function dailyMorale(s: GameState): void {
  for (const a of Object.values(s.armies)) {
    const max = maxMorale(s, a.owner);
    if (a.morale > max) {
      a.morale = max;
      continue;
    }
    if (a.battle || isSea(a.node)) continue;
    let gain = max / 30;
    if (a.owner !== REBELS) {
      const reg = s.regions[a.node];
      if (reg && controllerHostile(s, a.owner, reg)) gain *= 0.5;
    }
    a.morale = Math.min(max, a.morale + gain);
  }
}

/** Remove armies that have melted away. */
export function cleanupArmies(s: GameState): void {
  for (const id of Object.keys(s.armies)) {
    const a = s.armies[id];
    if (armyMen(a) < 50 && !a.battle) {
      if (a.owner === s.player) log(s, 'war', `The ${a.name} has melted away.`, { node: a.node });
      delete s.armies[id];
    }
  }
}
