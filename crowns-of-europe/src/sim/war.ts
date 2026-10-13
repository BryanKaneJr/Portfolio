/**
 * Wars: reasons for war, calls to arms, war score (0-100% from battles, occupation, blockades and the
 * war goal) and peace deals that spend war score on regions, vassals, gold or releasing nations.
 */
import { GRAPH, NATION, REGION, isNativeNation, nationName, regionName } from './content';
import { log, involvesPlayer, newsworthy, requestPause } from './log';
import {
  REBELS,
  allied,
  alliesOf,
  hasTruce,
  hostile,
  militaryPower,
  bumpWars,
  nationMods,
  ownedRegions,
  sideOf,
  subjectsOf,
  totalDev,
  topOverlord,
  warBetween,
  warsOf,
} from './queries';
import { addOpinion, isHreMember, opinion } from './diplomacy';
import { wantedRegions, wantsFrom } from './aims';
import { addThreat, coalitionAgainst, proximity } from './threat';
import { makeSubject, releaseNation, releaseSubject, transferRegion } from './territory';
import { sendHomeAfterPeace } from './military';
import type { CasusBelli, GameState, NationId, Offer, PeaceTerms, RegionId, War } from './types';
import { clamp, isIn, months, pairKey, yearOf, years } from './util';

export const TRUCE_YEARS = 10;

export interface CbOption {
  cb: CasusBelli;
  goal?: RegionId;
  label: string;
}

export const CB_LABEL: Record<CasusBelli, string> = {
  claim: 'Press a claim',
  reconquest: 'Reconquest of lost lands',
  holy: 'Holy war',
  rival: 'War against a rival',
  independence: 'War of independence',
  coalition: 'Coalition war',
  none: 'No reason (Threat and order penalty)',
};

const isChristian = (f: string) => f === 'catholic' || f === 'orthodox' || f === 'protestant';
export function holyWarAllowed(s: GameState, a: NationId, b: NationId): boolean {
  const fa = s.nations[a].faith;
  const fb = s.nations[b].faith;
  if (fa === fb) return false;
  if (fa === 'native' || fb === 'native') return true;
  if (isChristian(fa) !== isChristian(fb)) return true;
  return (fa === 'protestant' && fb === 'catholic') || (fa === 'catholic' && fb === 'protestant');
}

/** All reasons `a` has to attack `b`, best first. */
export function casusBelli(s: GameState, a: NationId, b: NationId): CbOption[] {
  const A = s.nations[a];
  const out: CbOption[] = [];
  if (A.overlord === b) out.push({ cb: 'independence', label: CB_LABEL.independence });
  const camp = [b, ...subjectsOf(s, b)];
  const theirRegions = Object.values(s.regions).filter(r => isIn(camp, r.owner));
  const cores = theirRegions.filter(r => r.cores.includes(a)).sort((x, y) => y.dev - x.dev);
  if (cores.length) out.push({ cb: 'reconquest', goal: cores[0].id, label: `${CB_LABEL.reconquest}: ${regionName(cores[0].id)}` });
  const claims = theirRegions.filter(r => r.id in A.claims).sort((x, y) => y.dev - x.dev);
  for (const c of claims.slice(0, 3)) out.push({ cb: 'claim', goal: c.id, label: `${CB_LABEL.claim}: ${regionName(c.id)}` });
  if (holyWarAllowed(s, a, b)) out.push({ cb: 'holy', label: CB_LABEL.holy });
  if (A.rivals.includes(b)) out.push({ cb: 'rival', label: CB_LABEL.rival });
  const c = s.coalitions.find(x => x.target === b && x.members.includes(a));
  if (c) out.push({ cb: 'coalition', label: CB_LABEL.coalition });
  out.push({ cb: 'none', label: CB_LABEL.none });
  return out;
}

export function canDeclareWar(s: GameState, a: NationId, b: NationId): string | null {
  const A = s.nations[a];
  const B = s.nations[b];
  if (!B?.alive) return 'They no longer exist.';
  if (a === b) return 'You cannot fight yourself.';
  if (warBetween(s, a, b)) return 'You are already at war.';
  if (A.overlord && A.overlord !== b) return 'Subjects cannot declare their own wars.';
  if (B.overlord && B.overlord !== a) return `They are protected by ${nationName(B.overlord)}. Declare on their overlord instead.`;
  if (B.overlord === a) return 'They are your subject.';
  if (allied(s, a, b)) return 'Break your alliance first.';
  return null;
}

/** Who would fight on each side, before anyone answers a call to arms. */
/**
 * The Empire's defence against an outsider: the Emperor rides to defend a member, and the electors march to
 * defend the Emperor.
 */
export function imperialDefenders(s: GameState, a: NationId, b: NationId): NationId[] {
  const emp = s.hre.emperor;
  if (!emp || isHreMember(s, a) || emp === a) return [];
  if (emp !== b) return isHreMember(s, b) && !allied(s, emp, a) && emp !== s.player && opinion(s, emp, b) > -20 ? [emp] : [];
  return s.hre.electors.filter(
    e => e !== a && e !== b && e !== s.player && s.nations[e]?.alive && !s.nations[e].overlord && !allied(s, e, a) && warsOf(s, e).length < 2 && opinion(s, e, emp) > -20,
  );
}

/**
 * Who would likely fight on each side if `a` attacked `b`: both leaders' subjects, the coalition against `a` and the
 * Empire's defenders, and the allies who would answer the call (as `aiAnswersCall` decides; the player's answer
 * can't be known, so a player ally counts), with their subjects.
 */
export function likelySides(s: GameState, a: NationId, b: NationId): { attackers: NationId[]; defenders: NationId[] } {
  const attackers = [a, ...subjectsOf(s, a)];
  const defenders = [b, ...subjectsOf(s, b)];
  const join = (side: NationId[], n: NationId) => {
    for (const x of [n, ...subjectsOf(s, n)]) if (!attackers.includes(x) && !defenders.includes(x)) side.push(x);
  };
  // A truce binds: allies under truce with the other side stay out. Subjects come with their overlord, not as allies.
  const answers = (al: NationId, leader: NationId, enemy: NationId, defensive: boolean) =>
    !s.nations[al]?.overlord && !hasTruce(s, al, enemy) && ((defensive && al === s.player) || aiAnswersCall(s, al, leader, enemy, defensive));
  for (const al of alliesOf(s, b)) if (!attackers.includes(al) && !allied(s, al, a) && answers(al, b, a, true)) join(defenders, al);
  const c = coalitionAgainst(s, a);
  if (c?.members.includes(b)) for (const m of c.members) if (!defenders.includes(m) && !attackers.includes(m)) defenders.push(m);
  for (const m of imperialDefenders(s, a, b)) if (!defenders.includes(m) && !attackers.includes(m)) defenders.push(m);
  for (const al of alliesOf(s, a)) if (!defenders.includes(al) && !attackers.includes(al) && answers(al, a, b, false)) join(attackers, al);
  return { attackers, defenders };
}

const warName = (a: NationId, b: NationId, cb: CasusBelli) => {
  if (cb === 'independence') return `${NATION[a].adj} War of Independence`;
  if (cb === 'coalition') return `Coalition War against ${nationName(b)}`;
  if (cb === 'holy') return `${NATION[a].adj} Holy War on ${nationName(b)}`;
  return `${NATION[a].adj}–${NATION[b].adj} War`;
};

export function declareWar(s: GameState, a: NationId, b: NationId, cb: CasusBelli, goal?: RegionId): War | null {
  if (canDeclareWar(s, a, b)) return null;
  const A = s.nations[a];
  // Breaking a truce or attacking without a reason has a price.
  if (hasTruce(s, a, b)) {
    A.stability = clamp(A.stability - 2, -3, 3);
    A.prestige = clamp(A.prestige - 20, 0, 100);
    addThreat(s, a, 10);
    delete s.truces[pairKey(a, b)];
  }
  if (cb === 'none') {
    A.stability = clamp(A.stability - 1, -3, 3);
    addThreat(s, a, 8);
    for (const o of Object.values(s.nations)) if (o.alive && o.id !== a && o.id !== b) addOpinion(s, o.id, a, 'warmonger', 'Unjust war', -15, 0.5);
  }
  const war: War = {
    id: `w${++s.seq}`,
    name: warName(a, b, cb),
    attackers: [a],
    defenders: [b],
    cb,
    goal,
    started: s.day,
    battleScore: 0,
    goalScore: 0,
  };
  s.wars[war.id] = war;
  bumpWars();
  const join = (side: 'attackers' | 'defenders', n: NationId) => {
    if (war.attackers.includes(n) || war.defenders.includes(n) || !s.nations[n]?.alive) return;
    war[side].push(n);
    bumpWars();
    if (s.nations[n].armyMode === 'peace' && n !== s.player) s.nations[n].armyMode = 'war';
  };
  // Subjects follow their overlords.
  for (const sub of subjectsOf(s, a)) if (sub !== b) join('attackers', sub);
  for (const sub of subjectsOf(s, b)) if (sub !== a) join('defenders', sub);
  if (A.overlord === b) {
    // A war of independence: other subjects of the overlord stay put.
  }
  A.armyMode = a === s.player ? A.armyMode : 'war';
  s.nations[b].armyMode = b === s.player ? s.nations[b].armyMode : 'war';
  if (newsworthy(s, a, b)) log(s, 'war', `${nationName(a)} declares war on ${nationName(b)}: the ${war.name}.`, { nation: a, important: involvesPlayer(s, a, b) });
  if (b === s.player) requestPause(s, 'warDeclaredOnYou');

  // Coalition members defend each other.
  const c = coalitionAgainst(s, a);
  if (c?.members.includes(b)) for (const m of c.members) if (m !== s.player) join('defenders', m);
  // The Emperor protects members of the Empire from outsiders, and the electors protect the Emperor.
  const emp = s.hre.emperor;
  const imperial = imperialDefenders(s, a, b).filter(m => !war.attackers.includes(m) && !war.defenders.includes(m));
  for (const m of imperial) join('defenders', m);
  if (imperial.length && emp) {
    const text = emp === b ? `The electors of the Empire march to defend the Emperor: ${imperial.map(nationName).join(', ')}.` : `The Emperor (${nationName(emp)}) rides to defend ${nationName(b)}.`;
    log(s, 'war', text, { important: involvesPlayer(s, a, b, ...imperial) });
  }
  callAllies(s, war, 'defenders');
  callAllies(s, war, 'attackers');
  return war;
}

function callAllies(s: GameState, war: War, side: 'attackers' | 'defenders'): void {
  const leader = war[side][0];
  const enemy = side === 'attackers' ? war.defenders[0] : war.attackers[0];
  for (const al of alliesOf(s, leader)) {
    if (war.attackers.includes(al) || war.defenders.includes(al)) continue;
    if (s.nations[al].overlord) continue;
    if (hasTruce(s, al, enemy)) continue; // a truce binds: it stays out, and nobody holds it against it
    if (al === s.player) {
      s.offers.push({ id: `o${++s.seq}`, kind: 'callToArms', from: leader, war: war.id, day: s.day });
      requestPause(s, 'offer');
      continue;
    }
    if (aiAnswersCall(s, al, leader, enemy, side === 'defenders')) {
      war[side].push(al);
      bumpWars();
      for (const sub of subjectsOf(s, al)) if (!war.attackers.includes(sub) && !war.defenders.includes(sub)) war[side].push(sub);
      if (involvesPlayer(s, leader, enemy)) log(s, 'war', `${nationName(al)} honours the alliance and joins the war.`, { nation: al });
    } else {
      refuseCall(s, al, leader, side === 'defenders');
    }
  }
}

export function aiAnswersCall(s: GameState, ally: NationId, leader: NationId, enemy: NationId, defensive: boolean): boolean {
  if (allied(s, ally, enemy) || topOverlord(s, ally) === topOverlord(s, enemy)) return false;
  if (warsOf(s, ally).length >= 2) return false;
  // A war of conquest is joined only by allies nearby with a stake in it: land they want from the enemy, or the
  // enemy is their rival. Nobody marches across Europe for someone else's conquest; defending an ally is another
  // matter.
  if (!defensive && (proximity(s, ally, enemy) < 0.75 || !(s.nations[ally].rivals.includes(enemy) || wantsFrom(s, ally, enemy).length))) return false;
  const op = opinion(s, ally, leader);
  const opEnemy = opinion(s, ally, enemy);
  const strength = (militaryPower(s, leader) + militaryPower(s, ally)) / Math.max(1, militaryPower(s, enemy));
  let score = defensive ? 30 : -10;
  score += op / 4 - opEnemy / 6;
  score += strength > 1 ? 10 : -15;
  if (s.nations[ally].rivals.includes(enemy)) score += 30;
  if (s.nations[ally].warExhaustion > 8) score -= 25;
  return score >= 10;
}

export function refuseCall(s: GameState, ally: NationId, leader: NationId, defensive: boolean): void {
  if (defensive) {
    delete s.alliances[pairKey(ally, leader)];
    s.nations[ally].prestige = clamp(s.nations[ally].prestige - 10, 0, 100);
    addOpinion(s, leader, ally, 'refused_call', 'Abandoned us', -50, 0.5);
    log(s, 'war', `${nationName(ally)} refuses the call to arms. The alliance with ${nationName(leader)} is broken.`, {
      important: involvesPlayer(s, ally, leader),
    });
  } else {
    addOpinion(s, leader, ally, 'refused_call', 'Refused our call', -15, 0.5);
  }
}

/** Join a war in progress (the player accepting a call to arms). */
export function joinWar(s: GameState, n: NationId, warId: string, side: 0 | 1): boolean {
  const war = s.wars[warId];
  if (!war || sideOf(war, n) !== null) return false;
  (side === 0 ? war.attackers : war.defenders).push(n);
  bumpWars();
  for (const sub of subjectsOf(s, n)) if (sideOf(war, sub) === null) (side === 0 ? war.attackers : war.defenders).push(sub);
  return true;
}

// ---------------------------------------------------------------- war score

export interface WarScore {
  total: number; // attacker perspective, -100..100
  battles: number;
  occupation: number;
  blockade: number;
  goal: number;
}

function sideDev(s: GameState, leader: NationId): number {
  return [leader, ...subjectsOf(s, leader)].reduce((t, n) => t + totalDev(s, n), 0);
}

export function warScore(s: GameState, w: War): WarScore {
  const occupiedValue = (owners: NationId[], occupiers: NationId[]) => {
    let v = 0;
    for (const r of Object.values(s.regions)) if (isIn(owners, r.owner) && isIn(occupiers, r.controller)) v += r.dev;
    return v;
  };
  const attOcc = occupiedValue(w.defenders, w.attackers) / Math.max(1, sideDev(s, w.defenders[0]));
  const defOcc = occupiedValue(w.attackers, w.defenders) / Math.max(1, sideDev(s, w.attackers[0]));
  const occupation = clamp((attOcc - defOcc) * 80, -80, 80);
  let blockAtt = 0;
  let blockDef = 0;
  for (const r of Object.values(s.regions)) {
    if (!r.blockaded) continue;
    if (isIn(w.defenders, r.owner)) blockAtt++;
    if (isIn(w.attackers, r.owner)) blockDef++;
  }
  const blockade = clamp(blockAtt - blockDef, -10, 10);
  const total = clamp(w.battleScore + occupation + blockade + w.goalScore, -100, 100);
  return { total: Math.round(total), battles: Math.round(w.battleScore), occupation: Math.round(occupation), blockade, goal: Math.round(w.goalScore) };
}

/** War score from `n`'s point of view. */
export function scoreFor(s: GameState, w: War, n: NationId): number {
  const t = warScore(s, w).total;
  return sideOf(w, n) === 1 ? -t : t;
}

export function monthlyWars(s: GameState): void {
  for (const w of Object.values(s.wars)) {
    // The war goal ticks: holding it pushes the attacker ahead, failing to take it slowly helps the defender.
    if (w.goal) {
      const holder = s.regions[w.goal].controller;
      if (isIn(w.attackers, holder)) w.goalScore = Math.min(25, w.goalScore + 1);
      else if (s.day - w.started > months(12)) w.goalScore = Math.max(-10, w.goalScore - 0.5);
    }
    if (s.day - w.started > years(20)) {
      // Endless wars fizzle out.
      makePeace(s, w, { regions: [], gold: 0, vassalize: false, release: [], white: true, winner: w.attackers[0], loser: w.defenders[0] });
    }
  }
}

// ---------------------------------------------------------------- peace

/** The capital of a realm of three or more regions: it gives it up only when utterly beaten, at twice the cost.
 * (A city state's capital is most of what it has, and costs the usual.) */
export const isCapitalAtStake = (s: GameState, r: RegionId) => {
  const owner = s.regions[r]?.owner;
  return !!owner && s.nations[owner]?.capital === r && ownedRegions(s, owner).length >= 3;
};

/** War score each part of a deal costs. */
export function regionPeaceCost(s: GameState, winner: NationId, r: RegionId): number {
  const reg = s.regions[r];
  const claimed = r in s.nations[winner].claims || reg.cores.includes(winner);
  return Math.max(3, Math.round(reg.dev * 3 * (claimed ? 0.7 : 1) * (isCapitalAtStake(s, r) ? 2 : 1)));
}

export function peaceCost(s: GameState, terms: PeaceTerms): number {
  if (terms.white) return 0;
  let c = 0;
  for (const r of terms.regions) c += regionPeaceCost(s, terms.winner, r);
  if (terms.vassalize) {
    const keep = ownedRegions(s, terms.loser).filter(r => !terms.regions.includes(r.id));
    c += Math.round(keep.reduce((t, r) => t + r.dev, 0) * 2);
  }
  c += Math.round(terms.gold / 10);
  for (const n of terms.release) {
    if (s.nations[n]?.overlord === terms.loser) c += 25;
    else c += 10 + Object.values(s.regions).filter(r => r.owner === terms.loser && r.cores.includes(n)).reduce((t, r) => t + r.dev * 1.5, 0);
  }
  return Math.round(c);
}

/** Regions the winner may demand: owned by the loser's side and occupied, or the war goal, or claimed. */
export function demandableRegions(s: GameState, w: War, winner: NationId): RegionId[] {
  const winSide = sideOf(w, winner);
  if (winSide === null) return [];
  const loserSide = winSide === 0 ? w.defenders : w.attackers;
  const winners = winSide === 0 ? w.attackers : w.defenders;
  return Object.values(s.regions)
    .filter(r => isIn(loserSide, r.owner) && (isIn(winners, r.controller) || r.id === w.goal || r.id in s.nations[winner].claims || r.cores.includes(winner)))
    .map(r => r.id);
}

export interface PeaceAnswer {
  accept: boolean;
  reasons: { label: string; value: number }[];
}

/** Would the AI leader on the other side accept these terms? */
export function peaceAcceptance(s: GameState, w: War, terms: PeaceTerms, decider: NationId): PeaceAnswer {
  const reasons: { label: string; value: number }[] = [];
  const add = (label: string, value: number) => reasons.push({ label, value: Math.round(value) });
  const yearsOfWar = (s.day - w.started) / 365;
  const D = s.nations[decider];
  if (terms.white) {
    const sc = scoreFor(s, w, decider);
    add('Leverage they hold', -Math.max(0, sc));
    add('War exhaustion', D.warExhaustion * 2);
    add('Length of war', Math.min(20, yearsOfWar * 3));
    add('Base', 5);
  } else if (decider === terms.loser) {
    const cost = peaceCost(s, terms);
    const sc = scoreFor(s, w, terms.winner);
    add('Leverage', sc);
    add('Cost of your demands', -cost);
    add('War exhaustion', D.warExhaustion * 1.5);
    add('Length of war', Math.min(15, yearsOfWar * 2));
    if (terms.regions.includes(D.capital)) add('Their capital', -15);
  } else {
    // The decider would be the winner: the player is offering concessions.
    const cost = peaceCost(s, terms);
    const sc = scoreFor(s, w, decider);
    add('What you offer', cost);
    add('Leverage they hold', -Math.max(0, sc));
    add('War exhaustion', D.warExhaustion);
    add('Base', 5);
  }
  const total = reasons.reduce((t, r) => t + r.value, 0);
  return { accept: total >= 0, reasons };
}

export function makePeace(s: GameState, w: War, terms: PeaceTerms): void {
  if (!s.wars[w.id]) return;
  const winSide = sideOf(w, terms.winner);
  const winners = winSide === 1 ? w.defenders : w.attackers;
  const losers = winSide === 1 ? w.attackers : w.defenders;
  const winner = terms.winner;
  const loser = terms.loser;
  let threat = 0;
  if (!terms.white) {
    for (const r of terms.regions) {
      const reg = s.regions[r];
      if (!isIn(losers, reg.owner)) continue;
      const claimed = r in s.nations[winner].claims || reg.cores.includes(winner);
      // Europe barely notices land taken from New World peoples.
      threat += reg.dev * 2.5 * (claimed ? 0.6 : 1) * (isNativeNation(reg.owner!) ? 0.3 : 1);
      transferRegion(s, r, winner, { conquest: true });
      if (winner === s.player) s.stats.regionsConquered++;
    }
    if (terms.gold > 0) {
      const paid = terms.gold;
      s.nations[loser].gold -= paid;
      s.nations[winner].gold += paid;
    }
    for (const n of terms.release) {
      if (s.nations[n]?.overlord === loser) releaseSubject(s, n);
      else releaseNation(s, loser, n);
    }
    if (terms.vassalize && s.nations[loser]?.alive) {
      makeSubject(s, winner, loser, 'vassal');
      threat += totalDev(s, loser) * 0.5;
    }
    if (w.cb === 'independence' && winSide === 0) releaseSubject(s, w.attackers[0]);
  }
  if (threat > 0) addThreat(s, winner, threat);
  // Occupations end and everyone gets a truce.
  const all = [...w.attackers, ...w.defenders];
  for (const r of Object.values(s.regions)) {
    if (r.controller !== r.owner && isIn(all, r.owner) && isIn(all, r.controller)) {
      r.controller = r.owner;
      r.siege = undefined;
    }
  }
  for (const a of winners) for (const b of losers) s.truces[pairKey(a, b)] = s.day + years(TRUCE_YEARS);
  delete s.wars[w.id];
  bumpWars();
  sendHomeAfterPeace(s, all);
  const W = s.nations[winner];
  const L = s.nations[loser];
  if (!terms.white) {
    const rivalBonus = W.rivals.includes(loser) ? 10 : 0;
    W.prestige = clamp(W.prestige + (10 + rivalBonus) * (1 + nationMods(s, winner).prestigeGain), 0, 100);
    if (L) L.prestige = clamp(L.prestige - 10, 0, 100);
    W.record.warsWon++;
    if (L) L.record.warsLost++;
    if (winners.includes(s.player)) s.stats.warsWon++;
    if (losers.includes(s.player)) s.stats.warsLost++;
  }
  for (const n of all) {
    const nat = s.nations[n];
    if (nat?.alive && !Object.values(s.wars).some(x => x.attackers.includes(n) || x.defenders.includes(n)) && n !== s.player) nat.armyMode = 'peace';
  }
  const parts: string[] = [];
  if (terms.white) parts.push('a white peace');
  if (terms.regions.length) parts.push(terms.regions.map(regionName).join(', ') + ` to ${nationName(winner)}`);
  if (terms.gold) parts.push(`${terms.gold} gold`);
  if (terms.vassalize) parts.push(`${nationName(loser)} becomes a vassal`);
  for (const n of terms.release) parts.push(`${nationName(n)} is freed`);
  if (newsworthy(s, winner, loser) || all.includes(s.player)) log(s, 'peace', `Peace ends the ${w.name}: ${parts.join('; ') || 'nothing changes'}.`, { important: all.includes(s.player) });
}

/** A participant (not a war leader) signs a white peace and leaves. */
export function leaveWar(s: GameState, w: War, n: NationId): void {
  const side = sideOf(w, n);
  if (side === null) return;
  const enemies = side === 0 ? w.defenders : w.attackers;
  if (side === 0) w.attackers = w.attackers.filter(x => x !== n);
  else w.defenders = w.defenders.filter(x => x !== n);
  for (const sub of subjectsOf(s, n)) {
    w.attackers = w.attackers.filter(x => x !== sub);
    w.defenders = w.defenders.filter(x => x !== sub);
  }
  for (const r of Object.values(s.regions)) {
    if ((r.owner === n && isIn(enemies, r.controller)) || (isIn(enemies, r.owner) && r.controller === n)) {
      r.controller = r.owner;
      r.siege = undefined;
    }
  }
  for (const e of enemies) s.truces[pairKey(n, e)] = s.day + years(5);
  if (!w.attackers.length || !w.defenders.length) delete s.wars[w.id];
  bumpWars();
  sendHomeAfterPeace(s, [n, ...subjectsOf(s, n), ...enemies]);
  if (newsworthy(s, n) || [...w.attackers, ...w.defenders].includes(s.player)) log(s, 'peace', `${nationName(n)} makes a separate peace and leaves the ${w.name}.`, { important: involvesPlayer(s, n) });
}

/**
 * AI winners build terms within the war score they have: the war goal, claims and land they want first, then land
 * next to their own (or the loser's capital or last region, wherever it lies), then gold. A great crown down to its
 * heartland (four regions or fewer) gives up one region a peace. With nothing of that in reach, a small realm (never
 * the Emperor or a great crown) is made a vassal if the leverage covers it.
 */
export function buildDemands(s: GameState, w: War, winner: NationId, budget: number): PeaceTerms {
  const winSide = sideOf(w, winner)!;
  const loser = winSide === 0 ? w.defenders[0] : w.attackers[0];
  const terms: PeaceTerms = { regions: [], gold: 0, vassalize: false, release: [], winner, loser };
  if (w.cb === 'independence' && winSide === 0) return terms;
  const winnerRegions = new Set(ownedRegions(s, winner).map(r => r.id));
  // Land the winner wants (historical aims, missions) comes first after the war goal and claims.
  const wanted = wantedRegions(s, winner);
  const candidates = demandableRegions(s, w, winner)
    .map(r => ({ r, cost: regionPeaceCost(s, winner, r), dev: s.regions[r].dev }))
    .sort((a, b) => {
      const prio = (x: { r: string }) => (x.r === w.goal ? 100 : 0) + (x.r in s.nations[winner].claims || s.regions[x.r].cores.includes(winner) ? 50 : 0) + (wanted.get(x.r) ?? 0) * 30;
      return prio(b) - prio(a) || b.dev - a.dev;
    });
  let left = budget;
  for (const c of candidates) {
    if (c.cost > left) continue;
    // Prefer regions that touch what the winner holds (or will hold). The loser's capital or last region may lie
    // anywhere: without it, a war against a far-off realm could never end.
    const touches = REGION[c.r] && (winnerRegions.size === 0 || [...winnerRegions, ...terms.regions].some(x => x === c.r || isNeighbor(c.r, x)));
    const owner = s.regions[c.r].owner!;
    const heart = owner === loser && (s.nations[loser].capital === c.r || ownedRegions(s, loser).length === 1);
    if (!touches && c.r !== w.goal && !wanted.has(c.r) && !heart) continue;
    // A great crown down to its heartland gives up one region a peace.
    if (NATION[owner]?.tier === 'major' && ownedRegions(s, owner).length <= 4 && terms.regions.some(x => s.regions[x].owner === owner)) continue;
    terms.regions.push(c.r);
    left -= c.cost;
    if (terms.regions.length >= 4) break;
  }
  if (left >= 10 && s.nations[loser].gold > 50) terms.gold = Math.min(Math.floor(left / 2) * 10, Math.floor(s.nations[loser].gold / 2));
  const mayVassalize =
    !terms.regions.length && !terms.gold && loser !== s.player && NATION[loser]?.tier !== 'major' && !isNativeNation(loser) && !s.nations[loser]?.overlord && !s.nations[winner].overlord && s.hre.emperor !== loser;
  if (mayVassalize && peaceCost(s, { ...terms, vassalize: true }) <= budget) terms.vassalize = true;
  return terms;
}

function isNeighbor(a: RegionId, b: RegionId): boolean {
  return GRAPH[a].some(e => e.to === b && (e.kind === 'land' || e.kind === 'strait'));
}

export const warsWithPlayer = (s: GameState) => warsOf(s, s.player);
export const isRebel = (n: NationId) => n === REBELS;
export { hostile, yearOf };

export function pendingOffer(s: GameState, kind: Offer['kind']): Offer | undefined {
  return s.offers.find(o => o.kind === kind);
}
