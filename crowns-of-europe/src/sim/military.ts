/** Armies: pathfinding, movement, retreats, recruitment, merging/splitting, supply, attrition and reinforcement. */
import { GRAPH, MAP_REGION, REGION, SEA, UNITS, isSea, regionName, type Edge } from './content';
import { charted } from './colonies';
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
import { unitCost } from './economy';
import { starBonus } from './rulers';
import { fleetPower, transportCapacity } from './navy';
import { makeArmy } from './state';
import type { Army, Fleet, GameState, NationId, NodeId, RegionId, Terrain, UnitType } from './types';
import { dateOf } from './util';

export const TERRAIN_DAYS: Record<Terrain, number> = { plains: 8, forest: 11, hills: 11, marsh: 13, mountains: 16 };
export const FRONT_WIDTH: Record<Terrain, number> = { plains: 20, forest: 14, hills: 14, marsh: 12, mountains: 10 };
const SEA_DAYS = 4;
const STRAIT_DAYS = 6;

export const fullMen = (a: Army) => (a.regs.inf.n + a.regs.cav.n + a.regs.art.n) * 1000;

// ---------------------------------------------------------------- pathfinding

/** Fleets of `n` that can carry an army of `regs` regiments through sea `sea` right now. */
export function canSail(s: GameState, n: NationId, sea: string, regs: number, here?: Fleet[]): boolean {
  if (n === REBELS) return false;
  const inSea = here ?? Object.values(s.fleets).filter(f => f.sea === sea);
  const own = inSea.filter(f => f.owner === n && f.path.length === 0);
  if (transportCapacity(own) < regs) return false;
  const ownPower = own.reduce((a, f) => a + fleetPower(s, f), 0);
  const enemyPower = inSea.filter(f => hostile(s, n, f.owner)).reduce((a, f) => a + fleetPower(s, f), 0);
  return enemyPower <= ownPower;
}

/** A strait (or, for a convoy, a sea) is closed if an enemy fleet sits there and outguns yours. */
export function straitOpen(s: GameState, n: NationId, sea: string, here?: Fleet[]): boolean {
  const inSea = here ?? Object.values(s.fleets).filter(f => f.sea === sea);
  const enemy = inSea.filter(f => hostile(s, n, f.owner));
  if (!enemy.length) return true;
  const enemyPower = enemy.reduce((a, f) => a + fleetPower(s, f), 0);
  const ownPower = inSea.filter(f => f.owner === n).reduce((a, f) => a + fleetPower(s, f), 0);
  return ownPower >= enemyPower;
}

/** A small binary min-heap of [priority, node] for route searches. */
class NodeHeap {
  private items: [number, NodeId][] = [];
  get size() {
    return this.items.length;
  }
  push(p: number, node: NodeId): void {
    const a = this.items;
    a.push([p, node]);
    let i = a.length - 1;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (a[up][0] <= a[i][0]) break;
      [a[up], a[i]] = [a[i], a[up]];
      i = up;
    }
  }
  pop(): [number, NodeId] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export function edgeDays(s: GameState, a: Pick<Army, 'owner' | 'general' | 'rebelOf'>, from: NodeId, e: Edge, retreating = false): number {
  let d: number;
  if (e.kind === 'sea' || (e.kind === 'coast' && isSea(e.to))) d = SEA[e.to]?.days ?? SEA_DAYS;
  else if (e.kind === 'coast') d = SEA_DAYS;
  else if (e.kind === 'strait') d = STRAIT_DAYS;
  else d = TERRAIN_DAYS[REGION[e.to].terrain];
  if (!isSea(e.to) && a.owner !== REBELS) {
    const reg = s.regions[e.to];
    if (reg && controllerHostile(s, a.owner, reg)) d *= 1.25;
  }
  const mov = a.owner === REBELS ? 0 : nationMods(s, a.owner).movement;
  d *= Math.max(0.5, 1 - mov) / (1 + starBonus(a.general)); // a general's stars quicken the march
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
 * stop you (you may end on one, not pass it), boarding at a coast needs your own transports in that sea
 * (they then sail along with the army, so one fleet can carry it across the ocean), a stronger enemy fleet
 * bars a sea, enemy fleets close straits, and the New World is closed until it is discovered.
 * With `to`, stops as soon as that node is settled; with `land`, never takes to the sea.
 */
export function pathTree(
  s: GameState,
  army: Pick<Army, 'owner' | 'general' | 'rebelOf' | 'node' | 'regs'>,
  opts: { retreat?: boolean; ignoreAccess?: boolean; land?: boolean; to?: NodeId; maxDays?: number } = {},
): PathTree {
  const from = army.node;
  const regs = armyRegs(army as Army);
  const n = army.owner;
  const dist = new Map<NodeId, number>([[from, 0]]);
  const prev = new Map<NodeId, NodeId>();
  const done = new Set<NodeId>();
  const open = new NodeHeap();
  open.push(0, from);
  const sailOk = new Map<string, boolean>();
  const seaOpen = new Map<string, boolean>();
  const bySea = new Map<string, Fleet[]>();
  for (const id in s.fleets) {
    const f = s.fleets[id];
    const l = bySea.get(f.sea);
    if (l) l.push(f);
    else bySea.set(f.sea, [f]);
  }
  while (open.size) {
    const cur = open.pop()[1];
    if (done.has(cur)) continue;
    done.add(cur);
    if (cur === opts.to) break;
    if (opts.maxDays !== undefined && dist.get(cur)! > opts.maxDays) break;
    // Can't walk through a hostile fort (unless we start there).
    if (cur !== from && !isSea(cur) && !opts.retreat && hostileFort(s, n, cur)) continue;
    for (const e of GRAPH[cur]) {
      if (done.has(e.to)) continue;
      if (!charted(s, e.to)) continue;
      if (isSea(e.to)) {
        if (opts.land) continue;
        // Boarding needs transports here; once aboard, the fleet comes along unless an enemy bars the way.
        const boarding = !isSea(cur);
        const cache = boarding ? sailOk : seaOpen;
        let ok = cache.get(e.to);
        if (ok === undefined) {
          const here = bySea.get(e.to) ?? [];
          ok = boarding ? canSail(s, n, e.to, regs, here) : straitOpen(s, n, e.to, here);
          cache.set(e.to, ok);
        }
        if (!ok) continue;
      } else {
        if (!opts.ignoreAccess && !opts.retreat && !canEnter(s, n, e.to, army.rebelOf)) continue;
        if (e.kind === 'strait' && e.sea && !straitOpen(s, n, e.sea, bySea.get(e.sea) ?? [])) continue;
      }
      const nd = dist.get(cur)! + edgeDays(s, army, cur, e, opts.retreat);
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, cur);
        open.push(nd, e.to);
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
  setPath(a, res.path);
  a.homeward = undefined;
  return res;
}

/** Give an army a new route, still walking the current edge if the new route starts the same way. */
function setPath(a: Army, path: NodeId[]): void {
  const keep = a.path.length > 0 && path[0] === a.path[0];
  a.path = path;
  if (!keep) {
    a.progress = 0;
    a.edgeDays = 0;
  }
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

type Stop = 'strait' | 'ships' | 'access';
const STOPPED: Record<Stop, string> = {
  strait: 'an enemy fleet holds the strait to',
  ships: 'no transports to carry it into the',
  access: 'no access to',
};

/** Why an army can't set out along edge `e` now (a strait closed, its transports gone, access ended), or null. */
function blocked(s: GameState, a: Army, e: Edge): Stop | null {
  if (e.kind === 'strait' && e.sea && !straitOpen(s, a.owner, e.sea)) return 'strait';
  if (isSea(e.to) && !isSea(a.node) && !canSail(s, a.owner, e.to, armyRegs(a))) return 'ships';
  // A rout, and a march home at peace, may cross land the army has no access to.
  const exempt = a.retreating || (a.homeward !== undefined && a.path[a.path.length - 1] === a.homeward);
  if (!exempt && !isSea(e.to) && !canEnter(s, a.owner, e.to, a.rebelOf)) return 'access';
  return null;
}

/** An army that reached a node today, with where it had come from before (to turn it back if need be). */
interface Arrival {
  army: Army;
  from?: NodeId;
  day?: number;
  /** Was it in a rout on this road (arrive() clears the flag at its refuge)? A rout is never turned back. */
  routed: boolean;
}

export function dailyMovement(s: GameState): void {
  // Today's arrivals by road ("from>to"), to catch hostile armies that pass each other on it.
  const arrivals = new Map<string, Arrival[]>();
  for (const a of Object.values(s.armies)) {
    if (a.battle) continue;
    if (!a.path.length) {
      // A retreat that lost its road (a strait an enemy fleet closed behind it, say) ends where it stands.
      if (a.retreating) a.retreating = false;
      continue;
    }
    if (a.edgeDays === 0) {
      // Re-check the next step: a strait may have closed, the transports sailed off, access ended.
      const e = GRAPH[a.node].find(x => x.to === a.path[0]);
      const why = e ? blocked(s, a, e) : null;
      if (!e || why) {
        if (why && a.owner === s.player) log(s, 'war', `The ${a.name} stopped at ${regionName(a.node)}: ${STOPPED[why]} ${regionName(a.path[0])}.`, { node: a.node });
        a.path = [];
        a.retreating = false;
        a.homeward = undefined;
        continue;
      }
      a.edgeDays = edgeDays(s, a, a.node, e, a.retreating);
      a.progress = 0;
    }
    a.progress += 1;
    if (a.progress < a.edgeDays) continue;
    const before: Arrival = { army: a, from: a.from, day: a.arrivedDay, routed: !!a.retreating };
    a.from = a.node;
    a.node = a.path.shift()!;
    a.progress = 0;
    a.edgeDays = 0;
    a.arrivedDay = s.day;
    if (isSea(a.from) && isSea(a.node)) convoy(s, a, a.from, a.node);
    if (metOnTheRoad(s, a, arrivals)) continue;
    const road = `${a.from}>${a.node}`;
    const list = arrivals.get(road);
    if (list) list.push(before);
    else arrivals.set(road, [before]);
    arrive(s, a);
  }
}

/**
 * Hostile armies that passed each other on one road today (one went X→Y, the others Y→X, say boarding ships as it
 * landed) meet at Y: those going the other way are turned back as if they had not yet left. (One still in Y and
 * marching out is caught by arrive().)
 */
function metOnTheRoad(s: GameState, a: Army, arrivals: Map<string, Arrival[]>): boolean {
  if (a.retreating || isSea(a.node)) return false;
  const met = (arrivals.get(`${a.node}>${a.from}`) ?? []).filter(x => x.army.node === a.from && !x.army.battle && !x.routed && armiesHostile(s, a, x.army));
  if (!met.length) return false;
  for (const m of met) {
    const b = m.army;
    b.node = a.node;
    b.from = m.from;
    b.arrivedDay = m.day;
    b.path = [];
  }
  a.path = [];
  joinOrStartBattle(s, a.node, a);
  return true;
}

/** The transports carrying an army sail on with it from one sea zone to the next. */
function convoy(s: GameState, a: Army, from: string, to: string): void {
  let need = armyRegs(a);
  for (const f of fleetsOf(s, a.owner)) {
    if (need <= 0) break;
    if (f.sea !== from || f.path.length || f.retreating) continue;
    const cap = transportCapacity([f]);
    if (cap <= 0) continue;
    f.sea = to;
    need -= cap;
  }
}

function arrive(s: GameState, a: Army): void {
  if (!a.path.length) a.homeward = undefined;
  if (isSea(a.node)) return;
  if (a.retreating) {
    if (!a.path.length) a.retreating = false;
    return;
  }
  // Enemies here, standing or still marching out? Fight.
  const enemies = Object.values(s.armies).filter(o => o.node === a.node && o.id !== a.id && !o.retreating && armiesHostile(s, a, o));
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

/**
 * Hostile armies in the same region (e.g. right after a war is declared) start fighting. An army standing in a
 * region also catches enemies still marching out of it.
 */
export function dailyEngagements(s: GameState): void {
  const byNode = new Map<NodeId, Army[]>();
  for (const a of Object.values(s.armies)) {
    if (a.retreating || a.battle || isSea(a.node)) continue;
    const list = byNode.get(a.node);
    if (list) list.push(a);
    else byNode.set(a.node, [a]);
  }
  for (const [node, list] of byNode) {
    if (list.length < 2 && !Object.values(s.battles).some(b => b.node === node)) continue;
    for (const a of list) {
      if (a.battle || a.path.length) continue; // the standing army starts it; marching ones are caught
      const caught = list.filter(o => o !== a && !o.battle && armiesHostile(s, a, o));
      if (caught.length || Object.values(s.battles).some(b => b.node === node && battleHasEnemyOf(s, b.id, a))) {
        for (const o of caught) {
          o.path = [];
          o.progress = 0;
          o.edgeDays = 0;
        }
        joinOrStartBattle(s, node, a);
      }
    }
  }
}

// ---------------------------------------------------------------- retreat

/** Where a beaten army may rest: land its side holds (rebels: their target's land), with no enemy or battle there. */
function refugeTest(s: GameState, a: Army): (node: NodeId) => boolean {
  const unsafe = new Set<NodeId>();
  for (const id in s.armies) if (armiesHostile(s, a, s.armies[id])) unsafe.add(s.armies[id].node);
  for (const id in s.battles) unsafe.add(s.battles[id].node);
  return node => {
    if (isSea(node) || node === a.node || unsafe.has(node)) return false;
    const reg = s.regions[node];
    return a.owner === REBELS ? reg.owner === a.rebelOf : friendlyTo(s, a.owner, reg.controller);
  };
}

/** The nearest refuge by days on the roads a rout can take, over land only or by sea too. */
function nearestRefuge(s: GameState, a: Army, safe: (node: NodeId) => boolean, land: boolean): PathResult | null {
  const tree = pathTree(s, a, { retreat: true, land });
  let best: NodeId | null = null;
  for (const [node, d] of tree.dist) if (safe(node) && (best === null || d < tree.dist.get(best)!)) best = node;
  return best === null ? null : pathFromTree(tree, a.node, best);
}

/**
 * Send a beaten army to the nearest safe region by days on the roads a march could take (access and forts don't
 * stop a rout), so it can always get there: over land if it can, otherwise aboard its own idle transports to the
 * nearest friendly coast. Returns false if there is no way out; the battle then counts the army as scattered.
 */
export function retreat(s: GameState, a: Army): boolean {
  a.battle = undefined;
  const safe = refugeTest(s, a);
  const res = nearestRefuge(s, a, safe, true) ?? nearestRefuge(s, a, safe, false);
  if (!res) return false;
  a.retreating = true;
  a.homeward = undefined;
  a.path = res.path;
  a.progress = 0;
  a.edgeDays = 0;
  return true;
}

// ---------------------------------------------------------------- home at peace

/**
 * After a peace between these realms (or one leaving a war): battles between realms no longer at war break off, and
 * their armies standing in, or marching through, land they may no longer enter march back to their nearest own
 * region, access ignored on the way out (by sea on their own transports if need be). Armies left at sea with no
 * orders go home too. An army with no way home disbands into the levies.
 */
export function sendHomeAfterPeace(s: GameState, nations: NationId[]): void {
  for (const b of Object.values(s.battles)) {
    const sides = b.sides.map(side => side.armies.map(id => s.armies[id]).filter(Boolean));
    // An army no longer at war with anyone across the field leaves it (one of several wars fought here has ended);
    // whoever was fighting only it may then have nobody left to fight either.
    const left: Army[] = [];
    for (let changed = true; changed; ) {
      changed = false;
      for (const i of [0, 1] as const) {
        const out = sides[i].filter(a => !sides[1 - i].some(o => armiesHostile(s, a, o)));
        if (!out.length) continue;
        sides[i] = sides[i].filter(a => !out.includes(a));
        left.push(...out);
        changed = true;
      }
    }
    if (!left.length) continue;
    for (const a of left) a.battle = undefined;
    if (!sides[0].length || !sides[1].length) {
      for (const a of [...sides[0], ...sides[1]]) a.battle = undefined;
      delete s.battles[b.id];
      if ([...left, ...sides[0], ...sides[1]].some(a => a.owner === s.player)) log(s, 'battle', `The peace ends the battle of ${regionName(b.node)}.`, { node: b.node });
      continue;
    }
    for (const i of [0, 1] as const) {
      const side = b.sides[i];
      side.armies = sides[i].map(a => a.id);
      // Those still fighting lead the side (its leader's war takes the score); those gone stay on the report.
      const here = new Set(sides[i].map(a => a.owner));
      side.nations = [...side.nations.filter(n => here.has(n)), ...side.nations.filter(n => !here.has(n))];
    }
    for (const a of left) if (a.owner === s.player) log(s, 'battle', `The peace takes the ${a.name} out of the battle of ${regionName(b.node)}.`, { node: b.node });
  }
  for (const a of Object.values(s.armies)) {
    if (!nations.includes(a.owner) || a.battle || a.retreating) continue;
    const barred = (node: NodeId) => !isSea(node) && !canEnter(s, a.owner, node, a.rebelOf);
    const adrift = isSea(a.node) && !a.path.length;
    if (adrift || barred(a.node) || a.path.some(barred)) withdraw(s, a);
  }
}

/**
 * Monthly: an army left standing in land it may no longer enter some other way (a war that ended with a realm's
 * fall, an alliance broken, access lapsed) goes home the same way.
 */
export function monthlyStrays(s: GameState): void {
  for (const a of Object.values(s.armies)) {
    if (a.owner === REBELS || a.battle || a.retreating || a.path.length || isSea(a.node)) continue;
    if (!canEnter(s, a.owner, a.node, a.rebelOf)) withdraw(s, a);
  }
}

function withdraw(s: GameState, a: Army): void {
  const tree = pathTree(s, a, { ignoreAccess: true });
  let home: NodeId | null = null;
  for (const [node, d] of tree.dist) if (s.regions[node]?.owner === a.owner && (home === null || d < tree.dist.get(home)!)) home = node;
  const res = home === null ? null : pathFromTree(tree, a.node, home);
  if (res) {
    setPath(a, res.path);
    a.homeward = res.path.length ? home! : undefined;
    if (a.homeward && a.owner === s.player) log(s, 'war', `The ${a.name} marches home to ${regionName(a.homeward)}.`, { node: a.node });
    return;
  }
  // No way home (an island with no ships to fetch it): the army disbands, and as with any disband half the
  // levies in it come back.
  const nat = s.nations[a.owner];
  const back = Math.round(armyMen(a) * (1 - a.mercs / Math.max(1, armyRegs(a))) * 0.5);
  nat.manpower += back;
  if (a.general && !a.general.isRuler) nat.generals.push(a.general);
  delete s.armies[a.id];
  if (a.owner === s.player) log(s, 'war', `The ${a.name} has no way home from ${regionName(a.node)} and disbands: ${back.toLocaleString()} men return to the levies.`, { node: a.node, important: true });
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
  a.arrivedDay = s.day; // the newest army here, though it marched in from nowhere
  s.armies[a.id] = a;
  return a;
}

/**
 * The nearest region `n` owns and holds with no enemy army in it, in steps over land and straits from `from`, or
 * null if none is in reach.
 */
function nearestHeld(s: GameState, n: NationId, from: RegionId): RegionId | null {
  const enemyAt = new Set<NodeId>();
  for (const id in s.armies) {
    const o = s.armies[id];
    if (hostile(s, n, o.owner, undefined, o.rebelOf)) enemyAt.add(o.node);
  }
  const q = [from];
  const seen = new Set(q);
  for (let i = 0; i < q.length; i++) {
    for (const e of GRAPH[q[i]]) {
      if (seen.has(e.to) || isSea(e.to)) continue;
      seen.add(e.to);
      const r = s.regions[e.to];
      if (r?.owner === n && r.controller === n && !enemyAt.has(e.to)) return e.to;
      q.push(e.to);
    }
  }
  return null;
}

export function dailyRecruitment(s: GameState): void {
  for (const nat of Object.values(s.nations)) {
    if (!nat.alive || !nat.recruiting.length) continue;
    const ready = nat.recruiting.filter(r => r.done <= s.day);
    if (!ready.length) continue;
    nat.recruiting = nat.recruiting.filter(r => r.done > s.day);
    let mustered = 0;
    let refunded = 0;
    let first: RegionId | null = null;
    const movedTo = new Map<RegionId, number>(); // where recruits mustered instead, and how many
    const lost = new Set<RegionId>(); // where they trained, no longer yours
    const stranded = new Set<RegionId>(); // ... with none of your land in reach
    // Where enemy armies stand (a siege, say): recruits never muster under their noses.
    const enemyAt = new Set<NodeId>();
    for (const id in s.armies) {
      const o = s.armies[id];
      if (hostile(s, nat.id, o.owner, undefined, o.rebelOf)) enemyAt.add(o.node);
    }
    for (const r of ready) {
      // Recruits muster where they trained if you still hold it with no enemy army there, else in the nearest such
      // region; with none in reach over land, their gold (at today's price) and levies come back.
      let at: RegionId | null = r.region;
      if (s.regions[r.region].controller !== nat.id || enemyAt.has(r.region)) {
        at = nearestHeld(s, nat.id, r.region);
        if (!at) {
          nat.gold += unitCost(s, nat.id, r.type);
          nat.manpower += 1000;
          refunded++;
          stranded.add(r.region);
          continue;
        }
        movedTo.set(at, (movedTo.get(at) ?? 0) + 1);
        lost.add(r.region);
      }
      addRegiments(s, nat.id, at, { [r.type]: 1 });
      mustered++;
      first ??= at;
    }
    if (nat.id !== s.player) continue;
    const lines: string[] = [];
    const names = (rs: Iterable<RegionId>) => [...rs].map(regionName).join(', ');
    const instead = [...movedTo].map(([at, k]) => `${k} at ${regionName(at)}`).join(', ');
    // (Not safe: no longer yours, held by the enemy, or an enemy army stands there.)
    const unsafe = (rs: Set<RegionId>) => `${names(rs)} ${rs.size > 1 ? 'are' : 'is'} not safe`;
    if (mustered) lines.push(`${mustered} new regiment${mustered > 1 ? 's are' : ' is'} ready${movedTo.size ? `, ${instead}, as ${unsafe(lost)}` : ''}.`);
    if (refunded) lines.push(`${refunded} could not muster (${unsafe(stranded)}, and none of your land is in reach): gold and levies returned.`);
    log(s, 'war', lines.join(' '), { node: first ?? ready[0].region });
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
