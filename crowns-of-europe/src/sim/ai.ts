/**
 * Rule-based AI: predictable enough to plan around, aggressive enough to feel alive.
 * Monthly (staggered per nation): economy, diplomacy, war and peace decisions, weighted by personality.
 * Every few days per army: attack beatable stacks, besiege enemy land, retreat from bigger stacks, merge.
 */
import { GRAPH, NATION, POLICIES, isSea } from './content';
import { log } from './log';
import {
  REBELS,
  allied,
  alliesOf,
  armiesHostile,
  armyRegs,
  atWar,
  availableEra,
  controllerHostile,
  forceLimit,
  friendlyTo,
  hasTruce,
  isCoastal,
  maxMorale,
  militaryPower,
  neighborsOf,
  ownedRegions,
  sideOf,
  subjectsOf,
  totalDev,
  totalRegiments,
  unitPower,
  warBetween,
  warsOf,
} from './queries';
import {
  coreCost,
  devCost,
  fortCost,
  ledger,
  mercCost,
  RECRUIT_DAYS,
  shipCost,
  SHIP_DAYS,
  stabilityCost,
  techCost,
  unitCost,
  LOAN_SIZE,
} from './economy';
import { acceptance, canRival, doDiplomacy, opinion } from './diplomacy';
import { buildDemands, casusBelli, declareWar, leaveWar, likelySides, makePeace, peaceAcceptance, scoreFor, canDeclareWar } from './war';
import { coalitionWarCheck, proximity } from './threat';
import { addRegiments, findPath, mergeArmies, orderMove, pathFromTree, pathTree, splitArmy, supplyLimit } from './military';
import { minSiegeRegs } from './siege';
import { fleetPower, findSeaPath } from './navy';
import type { Army, GameState, Nation, NationId, NodeId, PeaceTerms, Region, War } from './types';
import { chance, months, pick, years } from './util';

/** The player's nation is run by the AI only in spectator mode (dev tools, title-screen demo). */
export const isHuman = (s: GameState, n: NationId) => n === s.player && !('__spectate' in s.flags);

const REQUIRED_RATIO: Record<string, number> = { expansionist: 1.25, opportunist: 1.5, trader: 1.9, defensive: 2.3 };

export function monthlyAI(s: GameState): void {
  if ('__noAI' in s.flags) return;
  for (const nat of Object.values(s.nations)) {
    if (!nat.alive || isHuman(s, nat.id) || s.day < nat.ai.nextEval) continue;
    nat.ai.nextEval = s.day + 30;
    aiEconomy(s, nat);
    aiDiplomacy(s, nat);
    aiWar(s, nat);
    aiPeace(s, nat);
  }
  coalitionWarCheck(s, (attacker, target) => {
    const cbs = casusBelli(s, attacker, target);
    const cb = cbs.find(c => c.cb === 'coalition') ?? cbs[0];
    declareWar(s, attacker, target, cb.cb, cb.goal);
  });
}

// ---------------------------------------------------------------- economy

function reserve(s: GameState, nat: Nation): number {
  return 40 + Math.max(0, nat.lastMonthIncome) * 4;
}

function aiEconomy(s: GameState, nat: Nation): void {
  const n = nat.id;
  const war = atWar(s, n);
  const threatened = neighborsOf(s, n).some(x => militaryPower(s, x) > militaryPower(s, n) * 1.5 && opinion(s, x, n) < -20);
  nat.armyMode = war || threatened ? 'war' : 'peace';
  const res = reserve(s, nat);

  // Repay loans when flush.
  while (nat.loans > 0 && nat.gold > LOAN_SIZE + res * 0.5) {
    nat.loans--;
    nat.gold -= LOAN_SIZE;
  }
  // New era.
  const avail = availableEra(s);
  if (nat.era < avail) {
    const cost = techCost(s, n, nat.era + 1);
    if (nat.gold >= cost + res * 0.5) {
      nat.gold -= cost;
      nat.era++;
    }
  }
  // Policies: one slot per era.
  if (nat.policies.length < nat.era) {
    const p = NATION[n].personality;
    const wanted =
      p === 'expansionist'
        ? ['standing_army', 'conscription', 'artillery_corps', 'royal_administration', 'cavalry_tradition', 'tax_reform']
        : p === 'trader'
          ? ['mercantilism', 'naval_supremacy', 'diplomatic_corps', 'tax_reform', 'patronage']
          : p === 'defensive'
            ? ['fortress_doctrine', 'diplomatic_corps', 'conscription', 'religious_zeal', 'tax_reform']
            : ['tax_reform', 'standing_army', 'diplomatic_corps', 'royal_administration', 'conscription'];
    const choice = wanted.find(id => !nat.policies.includes(id) && (POLICIES.find(x => x.id === id)?.era ?? 9) <= nat.era);
    if (choice) nat.policies.push(choice);
  }
  // Stability.
  if (nat.stability < 0 && nat.gold > stabilityCost(s, n) + res * 0.5) {
    nat.gold -= stabilityCost(s, n);
    nat.stability++;
  }
  // Fiscal discipline: no mercenaries in peacetime, nothing over the force limit when money is short.
  const fl = forceLimit(s, n);
  const balance = ledger(s, n).balance;
  if (!war) disbandMercs(s, n);
  if ((!war && totalRegiments(s, n) > fl * 1.1) || (balance < 0 && nat.loans >= 2)) trimArmy(s, n, war ? fl : Math.round(fl * 0.9));
  if (balance < 0 && nat.loans >= 3 && !war) nat.armyMode = 'peace';
  const personalityShare = NATION[n].personality === 'expansionist' ? 0.85 : NATION[n].personality === 'trader' ? 0.6 : 0.7;
  const target = Math.round(fl * (war ? 1.05 : threatened ? 0.95 : personalityShare));
  const current = totalRegiments(s, n) + nat.recruiting.length;
  let toRecruit = Math.min(4, target - current);
  const capital = s.regions[nat.capital];
  const musterAt = capital && capital.controller === n ? capital.id : ownedRegions(s, n).find(r => r.controller === n)?.id;
  if (balance < 1.5 && !war) toRecruit = 0;
  while (toRecruit > 0 && musterAt) {
    const steppe = NATION[n].trait === 'steppe_horde';
    const roll = (current + toRecruit) % 10;
    const type = nat.era >= 2 && roll === 0 ? 'art' : roll < (steppe ? 6 : 3) ? 'cav' : 'inf';
    const cost = unitCost(s, n, type);
    if (nat.gold < cost + 15 || nat.manpower < 1000) break;
    nat.gold -= cost;
    nat.manpower -= 1000;
    nat.recruiting.push({ type, region: musterAt, done: s.day + RECRUIT_DAYS });
    toRecruit--;
  }
  // Losing a war with money in the bank: hire mercenaries.
  if (war && nat.manpower < 2000 && nat.gold > 300 && balance > 2 && totalRegiments(s, n) < fl * 1.15 && musterAt) {
    const regs = 4;
    const cost = mercCost(s, n, regs);
    if (nat.gold > cost + res) {
      nat.gold -= cost;
      addRegiments(s, n, musterAt, { inf: 3, cav: 1 }, regs);
    }
  }
  if (war) return;
  // Investments (peace only): core, develop, convert, fort, ships.
  const regions = ownedRegions(s, n);
  const uncored = regions.filter(r => !r.cores.includes(n)).sort((a, b) => b.dev - a.dev)[0];
  if (uncored && nat.gold > coreCost(s, uncored) + res) {
    nat.gold -= coreCost(s, uncored);
    uncored.cores.push(n);
    return;
  }
  const convert = regions.find(r => r.faith !== nat.faith && !r.converting && r.controller === n);
  if (convert && nat.gold > convert.dev * 6 + res * 1.5 && chance(s, 0.3)) {
    nat.gold -= convert.dev * 6;
    convert.converting = { to: nat.faith, done: s.day + 365 };
    return;
  }
  const dev = regions.filter(r => r.dev < 10 && r.controller === n).sort((a, b) => devCost(s, a) / (a.cores.includes(n) ? 1 : 0.5) - devCost(s, b) / (b.cores.includes(n) ? 1 : 0.5))[0];
  if (dev && nat.gold > devCost(s, dev) + res * 1.3) {
    nat.gold -= devCost(s, dev);
    dev.dev++;
    dev.devBought++;
    return;
  }
  if (NATION[n].personality === 'defensive' && chance(s, 0.2)) {
    const border = regions.filter(r => r.fort < 2 && neighborBorder(s, n, r)).sort((a, b) => b.dev - a.dev)[0];
    if (border && nat.gold > fortCost(s, border) + res * 1.5) {
      nat.gold -= fortCost(s, border);
      border.fort++;
      return;
    }
  }
  if (isCoastal(s, n) && (NATION[n].personality === 'trader' || chance(s, 0.3))) {
    const ships = Object.values(s.fleets).filter(f => f.owner === n).reduce((t, f) => t + f.ships.galley + f.ships.transport + f.ships.warship, 0);
    const want = Math.round(totalDev(s, n) / (NATION[n].personality === 'trader' ? 3 : 6));
    if (ships + nat.shipyard.length < want) {
      const coast = regions.find(r => GRAPH[r.id].some(e => e.kind === 'coast') && r.controller === n);
      const sea = coast && GRAPH[coast.id].find(e => e.kind === 'coast')?.to;
      if (coast && sea) {
        const type = nat.era >= 3 && chance(s, 0.4) ? 'warship' : chance(s, 0.3) ? 'transport' : 'galley';
        const cost = shipCost(s, n, type);
        if (nat.gold > cost + res) {
          nat.gold -= cost;
          nat.shipyard.push({ type, region: coast.id, sea, done: s.day + SHIP_DAYS });
        }
      }
    }
  }
}

function disbandMercs(s: GameState, n: NationId): void {
  for (const a of Object.values(s.armies)) {
    if (a.owner !== n || !a.mercs || a.battle) continue;
    const drop = Math.min(a.mercs, a.regs.inf.n + a.regs.cav.n);
    const inf = Math.min(a.regs.inf.n, drop);
    const cav = drop - inf;
    a.regs.inf.men -= Math.round((a.regs.inf.men * inf) / Math.max(1, a.regs.inf.n));
    a.regs.inf.n -= inf;
    a.regs.cav.men -= Math.round((a.regs.cav.men * cav) / Math.max(1, a.regs.cav.n));
    a.regs.cav.n -= cav;
    a.mercs = 0;
    if (armyRegs(a) === 0) delete s.armies[a.id];
  }
}

/** Disband regiments (weakest, smallest armies first) down to `target`. */
function trimArmy(s: GameState, n: NationId, target: number): void {
  let excess = totalRegiments(s, n) - target;
  if (excess <= 0) return;
  const armies = Object.values(s.armies)
    .filter(a => a.owner === n && !a.battle && !a.retreating)
    .sort((a, b) => armyRegs(a) - armyRegs(b));
  for (const a of armies) {
    for (const t of ['inf', 'cav', 'art'] as const) {
      while (excess > 0 && a.regs[t].n > 0) {
        const per = a.regs[t].men / a.regs[t].n;
        a.regs[t].n--;
        a.regs[t].men -= Math.round(per);
        excess--;
      }
    }
    a.mercs = Math.min(a.mercs, armyRegs(a));
    if (armyRegs(a) === 0) delete s.armies[a.id];
    if (excess <= 0) break;
  }
}

function neighborBorder(s: GameState, n: NationId, r: Region): boolean {
  return GRAPH[r.id].some(e => (e.kind === 'land' || e.kind === 'strait') && s.regions[e.to] && s.regions[e.to].owner !== n);
}

// ---------------------------------------------------------------- diplomacy

function aiDiplomacy(s: GameState, nat: Nation): void {
  const n = nat.id;
  if (nat.overlord) {
    // Subjects bide their time; strong, unhappy ones may break free.
    const over = nat.overlord;
    if (!atWar(s, over) || chance(s, 0.1)) {
      const ratio = militaryPower(s, n) / Math.max(1, militaryPower(s, over));
      if (ratio > 0.9 && opinion(s, n, over) < 0 && chance(s, 0.2) && !canDeclareWar(s, n, over)) declareWar(s, n, over, 'independence');
    }
    return;
  }
  const allies = alliesOf(s, n);
  // Drop allies who hate us.
  for (const al of allies) if (opinion(s, n, al) < -50 && al !== s.player && chance(s, 0.3)) doDiplomacy(s, n, al, 'breakAlliance');
  // Seek allies against threats and rivals.
  if (allies.length < 3 && chance(s, 0.25)) {
    const candidates = Object.values(s.nations)
      .filter(o => o.alive && o.id !== n && !o.overlord && !allied(s, n, o.id) && !warBetween(s, n, o.id) && !nat.rivals.includes(o.id) && proximity(s, n, o.id) >= 0.45)
      .map(o => ({ o, score: acceptance(s, n, o.id, 'alliance').score + acceptance(s, o.id, n, 'alliance').score }))
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (best && best.score > 0) {
      if (best.o.id === s.player) {
        if (!s.offers.some(x => x.from === n) && opinion(s, n, s.player) >= 50 && chance(s, 0.3)) s.offers.push({ id: `o${++s.seq}`, kind: 'alliance', from: n, day: s.day });
      } else if (acceptance(s, best.o.id, n, 'alliance').accept) doDiplomacy(s, n, best.o.id, 'alliance');
    }
  }
  // Royal marriages with friendly monarchies.
  if (NATION[n].gov === 'monarchy' && chance(s, 0.1)) {
    const m = Object.values(s.nations).find(o => o.alive && o.id !== n && o.id !== s.player && NATION[o.id].gov === 'monarchy' && acceptance(s, n, o.id, 'marriage').accept && opinion(s, n, o.id) > 0);
    if (m) doDiplomacy(s, n, m.id, 'marriage');
  }
  // Rivals.
  if (nat.rivals.length < 2 && chance(s, 0.1)) {
    const r = Object.values(s.nations)
      .filter(o => o.alive && o.id !== n && !canRival(s, n, o.id) && !allied(s, n, o.id))
      .sort((a, b) => opinion(s, n, a.id) - opinion(s, n, b.id))[0];
    if (r && opinion(s, n, r.id) < 0) doDiplomacy(s, n, r.id, 'rival');
  }
  // Keep friends friendly.
  if (allies.length && chance(s, 0.2)) {
    const al = pick(s, allies);
    if (al !== s.player) doDiplomacy(s, n, al, 'improve');
  }
  // Swallow loyal vassals.
  for (const sub of subjectsOf(s, n)) {
    if (sub === s.player) continue;
    const acc = acceptance(s, n, sub, 'annex');
    if (acc.accept && !acc.blocked && nat.gold > totalDev(s, sub) * 8 + reserve(s, nat) && chance(s, 0.15)) doDiplomacy(s, n, sub, 'annex');
  }
  // Vassalize small friendly neighbours.
  if (chance(s, 0.05)) {
    const v = neighborsOf(s, n).find(o => o !== s.player && acceptance(s, n, o, 'vassalize').accept);
    if (v) doDiplomacy(s, n, v, 'vassalize');
  }
}

// ---------------------------------------------------------------- war

export function sideStrength(s: GameState, nations: NationId[]): number {
  return nations.reduce((t, n) => t + militaryPower(s, n), 0);
}

function aiWar(s: GameState, nat: Nation): void {
  const n = nat.id;
  if (atWar(s, n) || nat.overlord) return;
  if (nat.ai.lastWarDeclared && s.day - nat.ai.lastWarDeclared < years(3)) return;
  if (nat.stability < 0 || nat.warExhaustion > 5 || nat.loans > 3) return;
  const pers = NATION[n].personality;
  const aggression = s.settings.difficulty === 'hard' ? 0.85 : s.settings.difficulty === 'easy' ? 1.2 : 1;
  const evalChance = pers === 'expansionist' ? 0.3 : pers === 'opportunist' ? 0.2 : 0.1;
  if (!chance(s, evalChance)) return;
  let best: { target: NationId; cb: ReturnType<typeof casusBelli>[number]; score: number } | null = null;
  const targets = new Set(neighborsOf(s, n));
  for (const t of targets) {
    if (canDeclareWar(s, n, t) || hasTruce(s, n, t)) continue;
    const tn = s.nations[t];
    const realTarget = tn.overlord ?? t;
    if (realTarget !== t) continue;
    const cbs = casusBelli(s, n, t);
    const cb = cbs[0];
    if (cb.cb === 'none' && pers !== 'expansionist') continue;
    const sides = likelySides(s, n, t);
    const ratio = sideStrength(s, sides.attackers) / Math.max(1, sideStrength(s, sides.defenders));
    let need = REQUIRED_RATIO[pers] * aggression;
    if (cb.cb === 'none') need *= 1.8;
    if (t === s.player && s.settings.difficulty === 'easy') need *= 1.3;
    if (ratio < need) continue;
    const score = ratio + (cb.goal ? s.regions[cb.goal].dev / 5 : 0) + (nat.rivals.includes(t) ? 1 : 0);
    if (!best || score > best.score) best = { target: t, cb, score };
  }
  if (!best) return;
  const war = declareWar(s, n, best.target, best.cb.cb, best.cb.goal);
  if (war) nat.ai.lastWarDeclared = s.day;
}

// ---------------------------------------------------------------- peace

function aiPeace(s: GameState, nat: Nation): void {
  const n = nat.id;
  for (const w of warsOf(s, n)) {
    const side = sideOf(w, n)!;
    const leader = side === 0 ? w.attackers[0] : w.defenders[0];
    const enemyLeader = side === 0 ? w.defenders[0] : w.attackers[0];
    const years_ = (s.day - w.started) / 365;
    if (leader !== n) {
      // Allies drift out of long, hopeless wars.
      if ((nat.warExhaustion > 10 || (years_ > 4 && scoreFor(s, w, n) < -20)) && chance(s, 0.2) && enemyLeader !== s.player) leaveWar(s, w, n);
      continue;
    }
    const sc = scoreFor(s, w, n);
    if (enemyLeader === s.player) {
      // Talk to the player through offers.
      if (s.offers.some(o => o.kind === 'peace' && o.war === w.id)) continue;
      if (nat.flags[`_offered_${w.id}`] && s.day - nat.flags[`_offered_${w.id}`] < months(8)) continue;
      if (sc >= 35) {
        const terms = buildDemands(s, w, n, sc);
        if (terms.regions.length || terms.gold) offerPeace(s, nat, w, terms);
      } else if (sc <= -45 || (sc <= -20 && years_ > 4)) {
        const terms = buildDemands(s, w, s.player, Math.round(-sc * 0.7));
        terms.winner = s.player;
        terms.loser = n;
        if (terms.regions.length || terms.gold) offerPeace(s, nat, w, terms);
      } else if (Math.abs(sc) < 10 && years_ > 3 && nat.warExhaustion > 6) {
        offerPeace(s, nat, w, { regions: [], gold: 0, vassalize: false, release: [], white: true, winner: n, loser: s.player });
      }
      continue;
    }
    // AI vs AI.
    if (sc >= 25 || (sc >= 10 && years_ > 3)) {
      const terms = buildDemands(s, w, n, sc);
      if ((terms.regions.length || terms.gold) && peaceAcceptance(s, w, terms, enemyLeader).accept) makePeace(s, w, terms);
      else if (sc >= 60 && terms.regions.length) makePeace(s, w, terms); // forced
    } else if (Math.abs(sc) < 15 && years_ > 4) {
      const white: PeaceTerms = { regions: [], gold: 0, vassalize: false, release: [], white: true, winner: n, loser: enemyLeader };
      if (peaceAcceptance(s, w, white, enemyLeader).accept && peaceAcceptance(s, w, white, n).accept) makePeace(s, w, white);
    }
  }
}

function offerPeace(s: GameState, nat: Nation, w: War, terms: PeaceTerms): void {
  nat.flags[`_offered_${w.id}`] = s.day;
  s.offers.push({ id: `o${++s.seq}`, kind: 'peace', from: nat.id, war: w.id, day: s.day, terms });
  log(s, 'peace', `${NATION[nat.id].name} sends a peace proposal.`, { important: true });
}

// ---------------------------------------------------------------- armies

export function armyStrength(s: GameState, a: Army): number {
  const m = Math.max(0.2, a.morale / Math.max(0.1, maxMorale(s, a.owner)));
  return ((a.regs.inf.men * unitPower(s, a.owner, 'inf') + a.regs.cav.men * unitPower(s, a.owner, 'cav') + a.regs.art.men * unitPower(s, a.owner, 'art')) / 1000) * Math.sqrt(m);
}

const AI_ARMY_INTERVAL = 5;

export function dailyArmyAI(s: GameState): void {
  if ('__noAI' in s.flags) return;
  const armies = Object.values(s.armies);
  for (const a of armies) {
    if (isHuman(s, a.owner) || a.battle || a.retreating || !s.armies[a.id]) continue;
    if (a.aiUntil && s.day < a.aiUntil) continue;
    a.aiUntil = s.day + AI_ARMY_INTERVAL + (a.id.charCodeAt(a.id.length - 1) % 3);
    if (a.owner === REBELS) rebelAI(s, a);
    else armyAI(s, a);
  }
}

function enemiesOf(s: GameState, n: NationId): Set<NationId> {
  const out = new Set<NationId>();
  for (const w of warsOf(s, n)) {
    const side = sideOf(w, n);
    for (const e of side === 0 ? w.defenders : w.attackers) out.add(e);
  }
  return out;
}

function armyAI(s: GameState, a: Army): void {
  const n = a.owner;
  const nat = s.nations[n];
  if (!nat) return;
  const enemies = enemiesOf(s, n);
  const rebels = Object.values(s.armies).filter(r => r.owner === REBELS && r.rebelOf === n && !r.retreating);
  if (!enemies.size && !rebels.length) {
    peaceStation(s, a);
    return;
  }
  const tree = pathTree(s, a, { maxDays: 90 });
  const myStrength = armyStrength(s, a) + friendlyStrengthAt(s, a);
  const hostileArmies = Object.values(s.armies).filter(o => o.id !== a.id && !o.retreating && armiesHostile(s, a, o) && !isSea(o.node));

  // 1) Danger: a much bigger enemy stack nearby → fall back toward friends or a fort.
  const danger = hostileArmies.filter(o => (tree.dist.get(o.node) ?? 999) <= 20 && armyStrength(s, o) > myStrength * 1.4);
  if (danger.length && !a.battle) {
    const safe = safeSpot(s, a, tree, danger);
    if (safe && safe !== a.node) {
      const res = pathFromTree(tree, a.node, safe);
      if (res) {
        a.path = res.path;
        a.progress = 0;
        a.edgeDays = 0;
        return;
      }
    }
  }
  // 2) Attack a stack we can beat (rebels count).
  let bestTarget: { node: NodeId; score: number } | null = null;
  for (const o of hostileArmies) {
    const d = tree.dist.get(o.node);
    if (d === undefined || d > 60) continue;
    const theirs = armyStrength(s, o) + Object.values(s.armies).filter(x => x.node === o.node && x.id !== o.id && x.owner === o.owner).reduce((t, x) => t + armyStrength(s, x), 0);
    if (myStrength < theirs * 1.25) continue;
    const score = theirs / (d + 5);
    if (!bestTarget || score > bestTarget.score) bestTarget = { node: o.node, score };
  }
  if (bestTarget) {
    move(s, a, bestTarget.node, tree);
    return;
  }
  // 3) Besiege: enemy-held regions we can reach, preferring the war goal, low forts and our own lost land.
  const regs = armyRegs(a);
  const goals = new Set(Object.values(s.wars).filter(w => sideOf(w, n) !== null).map(w => w.goal));
  let bestSiege: { node: NodeId; score: number } | null = null;
  const takenBy = new Set(Object.values(s.armies).filter(x => x.owner === n && x.id !== a.id).map(x => (x.path.length ? x.path[x.path.length - 1] : x.node)));
  for (const r of Object.values(s.regions)) {
    if (!controllerHostile(s, n, r)) continue;
    const d = tree.dist.get(r.id);
    if (d === undefined) continue;
    if (regs < minSiegeRegs(r.fort)) continue;
    if (takenBy.has(r.id) && r.id !== a.node) continue;
    const ownLand = r.owner === n ? 25 : 0;
    const goal = goals.has(r.id) ? 30 : 0;
    const score = (r.dev * 2 + ownLand + goal + (r.fort === 0 ? 6 : 0) - r.fort * 4) / (d + 8);
    if (!bestSiege || score > bestSiege.score) bestSiege = { node: r.id, score };
  }
  if (bestSiege) {
    // Big stacks split so two sieges run at once (and attrition stays down).
    if (regs >= 24 && bestSiege.node !== a.node && a.node === nat.capital) {
      const b = splitArmy(s, a, { inf: Math.floor(a.regs.inf.n / 2), cav: Math.floor(a.regs.cav.n / 2), art: Math.floor(a.regs.art.n / 2) });
      if (b) b.aiUntil = s.day;
    }
    move(s, a, bestSiege.node, tree);
    return;
  }
  // 4) Nothing to do: join the biggest friendly army.
  mergeWithNearby(s, a, tree);
}

function friendlyStrengthAt(s: GameState, a: Army): number {
  return Object.values(s.armies)
    .filter(o => o.id !== a.id && o.node === a.node && o.owner !== REBELS && a.owner !== REBELS && friendlyTo(s, o.owner, a.owner) && !o.path.length)
    .reduce((t, o) => t + armyStrength(s, o), 0);
}

function move(s: GameState, a: Army, node: NodeId, tree: ReturnType<typeof pathTree>): void {
  if (a.node === node) {
    a.path = [];
    return;
  }
  const res = pathFromTree(tree, a.node, node);
  if (!res) return;
  const keep = a.path.length > 0 && res.path[0] === a.path[0];
  a.path = res.path;
  if (!keep) {
    a.progress = 0;
    a.edgeDays = 0;
  }
}

function safeSpot(s: GameState, a: Army, tree: ReturnType<typeof pathTree>, danger: Army[]): NodeId | null {
  let best: NodeId | null = null;
  let bestScore = -Infinity;
  for (const [node, d] of tree.dist) {
    if (isSea(node) || d > 40) continue;
    const reg = s.regions[node];
    if (!friendlyTo(s, a.owner, reg.controller)) continue;
    const near = danger.reduce((t, o) => t + Math.max(0, 25 - (pathDistanceGuess(o.node, node) * 8)), 0);
    const friends = Object.values(s.armies).filter(o => o.node === node && o.owner === a.owner && o.id !== a.id).reduce((t, o) => t + armyStrength(s, o), 0);
    const score = reg.fort * 10 + friends * 2 - near - d / 4;
    if (score > bestScore) {
      bestScore = score;
      best = node;
    }
  }
  return best;
}

function pathDistanceGuess(a: NodeId, b: NodeId): number {
  if (a === b) return 0;
  if (GRAPH[a]?.some(e => e.to === b)) return 1;
  return 2;
}

function mergeWithNearby(s: GameState, a: Army, tree: ReturnType<typeof pathTree>): void {
  const own = Object.values(s.armies).filter(o => o.owner === a.owner && o.id !== a.id && !o.battle && !o.retreating);
  const here = own.find(o => o.node === a.node && !o.path.length && !a.path.length);
  if (here) {
    const [big, small] = armyRegs(here) >= armyRegs(a) ? [here, a] : [a, here];
    mergeArmies(s, big, small);
    return;
  }
  const biggest = own.filter(o => tree.dist.has(o.node) && (tree.dist.get(o.node) ?? 999) < 40).sort((x, y) => armyRegs(y) - armyRegs(x))[0];
  if (biggest && armyRegs(biggest) >= armyRegs(a)) move(s, a, biggest.node, tree);
}

/** At peace: gather at the capital (or the most threatened border region), merge, and stay within supply. */
function peaceStation(s: GameState, a: Army): void {
  const nat = s.nations[a.owner];
  if (a.path.length) return;
  const home = nat.capital;
  if (!home || s.regions[home]?.controller !== a.owner) return;
  const others = Object.values(s.armies).filter(o => o.owner === a.owner && o.id !== a.id && o.node === a.node && !o.path.length && !o.battle);
  for (const o of others) mergeArmies(s, a, o);
  if (a.node !== home && !isSea(a.node)) {
    // Return home unless standing in our own land within supply.
    const reg = s.regions[a.node];
    const ok = reg && reg.owner === a.owner && armyRegs(a) <= supplyLimit(s, a.node, a.owner);
    if (!ok || chance(s, 0.1)) orderMove(s, a, home);
  } else if (armyRegs(a) > supplyLimit(s, home, a.owner) * 1.2) {
    // Too big for the capital: park half next door.
    const next = GRAPH[home].find(e => e.kind === 'land' && s.regions[e.to].owner === a.owner);
    if (next) {
      const b = splitArmy(s, a, { inf: Math.floor(a.regs.inf.n / 2), cav: Math.floor(a.regs.cav.n / 2), art: 0 });
      if (b) orderMove(s, b, next.to);
    }
  }
}

function rebelAI(s: GameState, a: Army): void {
  const reg = s.regions[a.node];
  const target = a.rebelOf;
  if (!target || !reg) return;
  // Stay and besiege until the region is ours, then march on a neighbour.
  if (reg.owner === target && reg.controller !== REBELS) return;
  const next = GRAPH[a.node].find(e => (e.kind === 'land' || e.kind === 'strait') && s.regions[e.to]?.owner === target && s.regions[e.to].controller !== REBELS);
  if (next && chance(s, 0.3)) {
    const res = findPath(s, a, next.to, { ignoreAccess: true });
    if (res) a.path = res.path;
  }
}

/** Naval AI: fleets at war go blockade enemy coasts they can hold; outmatched fleets go home. */
export function monthlyFleetAI(s: GameState): void {
  for (const f of Object.values(s.fleets)) {
    if (isHuman(s, f.owner) || f.path.length || f.retreating) continue;
    const n = f.owner;
    const enemies = enemiesOf(s, n);
    if (!enemies.size) continue;
    const myPower = fleetPower(s, f);
    let best: { sea: string; score: number } | null = null;
    for (const sea of Object.keys(GRAPH).filter(isSea)) {
      const enemyPower = Object.values(s.fleets).filter(g => g.sea === sea && enemies.has(g.owner)).reduce((t, g) => t + fleetPower(s, g), 0);
      if (enemyPower > myPower * 0.8) continue;
      const coast = Object.values(s.regions).filter(r => enemies.has(r.controller) && GRAPH[r.id].some(e => e.to === sea)).reduce((t, r) => t + r.dev, 0);
      if (!coast) continue;
      const route = findSea(f.sea, sea);
      if (route === null) continue;
      const score = coast / (route.length + 1);
      if (!best || score > best.score) best = { sea, score };
    }
    if (best && best.sea !== f.sea) {
      const route = findSea(f.sea, best.sea);
      if (route) f.path = route;
    }
  }
}

const findSea = (from: string, to: string) => findSeaPath(from, to);

export const debugAI = { armyAI, aiWar, aiEconomy, aiPeace };
