/**
 * Threat: taking land alarms everyone who can see it. Nearby nations that feel threatened band together
 * in a Coalition, a defensive league that joins any war you start against a member, or attacks you if you
 * look weak. It's the main brake on steamrolling.
 */
import { NATION, hops, isNativeNation, nationName } from './content';
import { log, involvesPlayer } from './log';
import {
  aliveNations,
  allied,
  hasTruce,
  militaryPower,
  nationMods,
  ownedRegions,
  ownershipVersion,
  topOverlord,
  totalDev,
  warBetween,
} from './queries';
import type { GameState, NationId } from './types';
import { chance, clamp } from './util';

export const COALITION_JOIN = 40;
export const COALITION_LEAVE = 28;

export function addThreat(s: GameState, n: NationId, amount: number): void {
  const nat = s.nations[n];
  if (!nat) return;
  const k = amount > 0 ? 1 + nationMods(s, n).threatGain : 1;
  nat.threat = clamp(nat.threat + amount * k, 0, 200);
}

const proxCache = new Map<string, number>();
let proxVersion = -1;
let proxState: GameState | null = null;

/** How close two nations are: 1 for neighbours, fading with distance. Cached until borders change. */
export function proximity(s: GameState, a: NationId, b: NationId): number {
  if (ownershipVersion() !== proxVersion || proxState !== s) {
    proxCache.clear();
    proxVersion = ownershipVersion();
    proxState = s;
  }
  const key = a < b ? `${a}|${b}` : `${b}|${a}`;
  const hit = proxCache.get(key);
  if (hit !== undefined) return hit;
  const v = computeProximity(s, a, b);
  proxCache.set(key, v);
  return v;
}

function computeProximity(s: GameState, a: NationId, b: NationId): number {
  const ca = s.nations[a]?.capital;
  const cb = s.nations[b]?.capital;
  if (!ca || !cb) return 0;
  let best = hops(ca, cb);
  if (best > 1) {
    const rb = ownedRegions(s, b);
    for (const x of ownedRegions(s, a))
      for (const y of rb) {
        const h = hops(x.id, y.id);
        if (h < best) best = h;
        if (best <= 1) break;
      }
  }
  if (best <= 1) return 1;
  if (best <= 3) return 0.75;
  if (best <= 5) return 0.45;
  if (best <= 8) return 0.2;
  return 0.05;
}

/** The Threat that `observer` feels from `target` (0..200). */
export function perceivedThreat(s: GameState, observer: NationId, target: NationId): number {
  const t = s.nations[target];
  if (!t || observer === target) return 0;
  if (topOverlord(s, observer) === topOverlord(s, target)) return 0;
  const sameFaith = s.nations[observer]?.faith === t.faith;
  return t.threat * proximity(s, observer, target) * (sameFaith ? 1 : 1.25);
}

export function monthlyThreat(s: GameState): void {
  for (const nat of aliveNations(s)) {
    const decay = 0.12 + nat.prestige / 500 + nationMods(s, nat.id).threatDecay;
    nat.threat = Math.max(0, nat.threat - decay);
  }
  updateCoalitions(s);
}

function updateCoalitions(s: GameState): void {
  // Members leave when they calm down; coalitions under two members dissolve.
  for (const c of s.coalitions) c.members = c.members.filter(m => s.nations[m]?.alive && perceivedThreat(s, m, c.target) >= COALITION_LEAVE);
  const before = s.coalitions.map(c => c.target);
  s.coalitions = s.coalitions.filter(c => c.members.length >= 2 && s.nations[c.target]?.alive);
  for (const t of before) if (!s.coalitions.some(c => c.target === t) && involvesPlayer(s, t)) log(s, 'diplomacy', 'The coalition against you has dissolved.', { important: true });

  for (const target of aliveNations(s)) {
    if (target.threat < 25 || isNativeNation(target.id)) continue;
    const candidates = aliveNations(s).filter(
      o =>
        o.id !== target.id &&
        !o.overlord &&
        !isNativeNation(o.id) &&
        !allied(s, o.id, target.id) &&
        !s.coalitions.some(c => c.members.includes(o.id)) &&
        perceivedThreat(s, o.id, target.id) >= COALITION_JOIN,
    );
    let c = s.coalitions.find(x => x.target === target.id);
    if (!c) {
      if (candidates.length < 3) continue;
      c = { target: target.id, members: [], formed: s.day };
      s.coalitions.push(c);
      log(s, 'diplomacy', `A coalition forms against ${nationName(target.id)}: ${candidates.map(m => nationName(m.id)).join(', ')}.`, {
        nation: target.id,
        important: involvesPlayer(s, target.id, ...candidates.map(m => m.id)),
      });
    } else if (candidates.length && involvesPlayer(s, target.id)) {
      log(s, 'diplomacy', `${candidates.map(m => nationName(m.id)).join(', ')} join${candidates.length === 1 ? 's' : ''} the coalition against you.`, { important: true });
    }
    for (const m of candidates) if (!c.members.includes(m.id)) c.members.push(m.id);
  }
}

/** Coalitions may strike first when the target looks beatable. Called from the AI's monthly pass. */
export function coalitionWarCheck(s: GameState, declare: (attacker: NationId, target: NationId) => void): void {
  for (const c of s.coalitions) {
    if (c.members.length < 2 || !chance(s, 0.06)) continue;
    const target = c.target;
    if (c.members.some(m => warBetween(s, m, target))) continue;
    const leader = [...c.members].sort((a, b) => totalDev(s, b) - totalDev(s, a))[0];
    if (leader === s.player || hasTruce(s, leader, target)) continue;
    const power = c.members.filter(m => m !== s.player).reduce((a, m) => a + militaryPower(s, m), 0);
    if (power > militaryPower(s, target) * 1.3) declare(leader, target);
  }
}

export const coalitionAgainst = (s: GameState, n: NationId) => s.coalitions.find(c => c.target === n);
export const coalitionOf = (s: GameState, n: NationId) => s.coalitions.find(c => c.members.includes(n));
export { NATION };
