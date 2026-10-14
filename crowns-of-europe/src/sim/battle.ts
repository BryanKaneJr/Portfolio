/**
 * Battles run day by day so reinforcements can join. Each day both sides roll 1d10 (− terrain for an army that
 * marched in to attack); damage = roll × front-line strength × (1 + 10% per star of the general), which costs the
 * enemy men and morale (a general's stars also soften the morale their own side loses). A side at 0 morale retreats
 * (or, with nowhere to go, scatters); if the winner has five times the loser's remaining men, the loser is annihilated.
 */
import { NATION, REGION, regionName, nationName, riverBetween } from './content';
import { log, requestPause } from './log';
import { REBELS, armiesHostile, armyMen, armyRegs, liveUnseenReports, maxMorale, nationMods, sideOf, unitPower } from './queries';
import { FRONT_WIDTH, retreat } from './military';
import { rulerDies, starBonus } from './rulers';
import type { Army, Battle, BattleReport, BattleSide, GameState, NationId, NodeId, UnitType } from './types';
import { chance, clamp, randInt } from './util';

export const WIPE_RATIO = 5;
/** Men lost per point of damage dealt. */
export const CASUALTY_K = 6;
/** Morale lost per point of damage, before it is shared out over the regiments. */
export const MORALE_K = 0.069;
/** Three days of volleys (the guns tell), then three of charges (the horse tells), and so on. */
export type BattlePhase = 'volley' | 'charge';
const PHASE_FACTOR: Record<BattlePhase, Record<UnitType, number>> = {
  volley: { inf: 1.0, cav: 0.5, art: 1.6 },
  charge: { inf: 1.0, cav: 1.6, art: 0.3 },
};
export const battlePhase = (b: Battle): BattlePhase => ((b.days - 1) % 6 < 3 ? 'volley' : 'charge');

const sideArmies = (s: GameState, side: BattleSide): Army[] => side.armies.map(id => s.armies[id]).filter(Boolean);

function addToSide(s: GameState, b: Battle, i: 0 | 1, a: Army): void {
  const side = b.sides[i];
  if (side.armies.includes(a.id)) return;
  side.armies.push(a.id);
  if (!side.nations.includes(a.owner)) side.nations.push(a.owner);
  side.startMen += armyMen(a);
  a.battle = b.id;
  a.path = [];
  a.progress = 0;
  a.edgeDays = 0;
}

export function joinOrStartBattle(s: GameState, node: NodeId, a: Army): void {
  const existing = Object.values(s.battles).find(b => b.node === node);
  if (existing) {
    const hostileTo0 = sideArmies(s, existing.sides[0]).some(o => armiesHostile(s, a, o));
    const hostileTo1 = sideArmies(s, existing.sides[1]).some(o => armiesHostile(s, a, o));
    if (hostileTo0 && !hostileTo1) addToSide(s, existing, 1, a);
    else if (hostileTo1 && !hostileTo0) addToSide(s, existing, 0, a);
    return;
  }
  // Armies here, standing or still marching out.
  const here = Object.values(s.armies).filter(o => o.node === node && !o.retreating && !o.battle && o.id !== a.id);
  const enemies = here.filter(o => armiesHostile(s, a, o));
  if (!enemies.length) return;
  // The army that marched in today attacks, with the terrain (and any river it crossed) against it. If both sides
  // were already standing here (a war declared, rebels rising), the newcomer opens the battle and nobody suffers
  // the attacker's penalty.
  const since = (x: Army) => x.arrivedDay ?? x.rebelSince ?? -1;
  const atk = enemies.reduce((best, o) => (since(o) > since(best) ? o : best), a);
  const moved = atk.arrivedDay === s.day && !!atk.from; // (a new army has no road behind it)
  const river = moved && atk.from ? riverBetween(atk.from, node) : undefined;
  const b: Battle = {
    id: `b${++s.seq}`,
    node,
    started: s.day,
    days: 0,
    river: !!river,
    sides: [
      { armies: [], nations: [], startMen: 0, losses: 0, roll: 0 },
      { armies: [], nations: [], startMen: 0, losses: 0, roll: 0 },
    ],
    log: [],
  };
  if (!moved) b.pitched = true;
  s.battles[b.id] = b;
  const all = [a, ...here];
  const defenders = all.filter(o => armiesHostile(s, atk, o));
  addToSide(s, b, 0, atk);
  for (const o of defenders) addToSide(s, b, 1, o);
  // Friends of the attacker here join in too.
  for (const o of all) if (!o.battle && !armiesHostile(s, atk, o) && defenders.some(e => armiesHostile(s, o, e))) addToSide(s, b, 0, o);
  const involved = [...b.sides[0].nations, ...b.sides[1].nations];
  if (involved.includes(s.player)) {
    const [x, y] = b.sides.map(side => side.nations.map(nationName).join(', '));
    log(s, 'battle', `Battle of ${regionName(node)}: ${x} ${moved ? 'attack' : 'clash with'} ${y}${river ? ` across the ${river}` : ''}.`, {
      node,
      important: true,
    });
    requestPause(s, 'battleStarted');
  }
}

interface SideStats {
  armies: Army[];
  regs: Record<UnitType, number>;
  men: Record<UnitType, number>;
  totalRegs: number;
  totalMen: number;
  morale: number; // men-weighted average
  maxMorale: number;
  general: { stars: number; name: string | null }; // the best general on the side leads it
  owner: NationId;
}

function stats(s: GameState, side: BattleSide): SideStats {
  const armies = sideArmies(s, side);
  const regs = { inf: 0, cav: 0, art: 0 };
  const men = { inf: 0, cav: 0, art: 0 };
  let moraleW = 0;
  let maxW = 0;
  let general = { stars: 0, name: null as string | null };
  for (const a of armies) {
    for (const t of ['inf', 'cav', 'art'] as UnitType[]) {
      regs[t] += a.regs[t].n;
      men[t] += a.regs[t].men;
    }
    const m = armyMen(a);
    moraleW += a.morale * m;
    maxW += maxMorale(s, a.owner) * m;
    const g = a.general;
    if (g && g.stars > general.stars) general = { stars: g.stars, name: g.name };
  }
  const totalMen = men.inf + men.cav + men.art;
  return {
    armies,
    regs,
    men,
    totalRegs: regs.inf + regs.cav + regs.art,
    totalMen,
    morale: totalMen ? moraleW / totalMen : 0,
    maxMorale: totalMen ? maxW / totalMen : 1,
    general,
    owner: side.nations[0],
  };
}

/** Damage one side deals today. Exported for the battle sheet's "expected damage" readout and tests. */
export function sidePower(s: GameState, st: SideStats, width: number, phase: BattlePhase): number {
  const f = PHASE_FACTOR[phase];
  const strength = (t: UnitType) => (st.regs[t] ? Math.min(1, st.men[t] / (st.regs[t] * 1000)) : 0);
  // Front row: cavalry takes the flanks (up to half the width), infantry fills the rest.
  const cavFront = Math.min(st.regs.cav, Math.ceil(width / 2));
  const infFront = Math.min(st.regs.inf, width - cavFront);
  const cavExtra = Math.min(st.regs.cav - cavFront, width - cavFront - infFront);
  const artBack = Math.min(st.regs.art, width);
  const owner = st.owner;
  return (
    (infFront * unitPower(s, owner, 'inf') * f.inf * strength('inf') +
      (cavFront + Math.max(0, cavExtra)) * unitPower(s, owner, 'cav') * f.cav * strength('cav') +
      artBack * unitPower(s, owner, 'art') * f.art * strength('art')) *
    (1 + starBonus(st.general))
  );
}

function faithOf(s: GameState, n: NationId): string {
  return n === REBELS ? 'rebel' : (s.nations[n]?.faith ?? '');
}

export function dailyBattles(s: GameState): void {
  for (const b of Object.values(s.battles)) {
    // Drop armies that vanished or walked away.
    for (const side of b.sides) side.armies = side.armies.filter(id => s.armies[id] && s.armies[id].node === b.node);
    const st = [stats(s, b.sides[0]), stats(s, b.sides[1])] as const;
    if (!st[0].armies.length || !st[1].armies.length || st[0].totalMen <= 0 || st[1].totalMen <= 0) {
      const loser = !st[0].armies.length || st[0].totalMen <= 0 ? 0 : 1;
      endBattle(s, b, (1 - loser) as 0 | 1, st);
      continue;
    }
    b.days++;
    const phase = battlePhase(b);
    const terrain = REGION[b.node].terrain;
    const width = FRONT_WIDTH[terrain];
    const terrainPenalty = terrain === 'mountains' ? 2 : terrain === 'plains' ? 0 : 1;
    const dmg: [number, number] = [0, 0];
    const rolls: [number, number] = [0, 0];
    for (const i of [0, 1] as const) {
      const me = st[i];
      const mod = i === 0 && !b.pitched ? -(terrainPenalty + (b.river ? 1 : 0)) : 0;
      const roll = randInt(s, 1, 10);
      rolls[i] = roll;
      const eff = Math.max(1, roll + mod);
      dmg[i] = eff * sidePower(s, me, width, phase);
      b.sides[i].roll = eff;
    }
    const losses: [number, number] = [0, 0];
    for (const i of [0, 1] as const) {
      const target = st[1 - i];
      const targetSide = b.sides[1 - i];
      const casualties = Math.min(target.totalMen, Math.round(dmg[i] * CASUALTY_K));
      // Holy war zeal softens morale damage against another faith.
      const holy = target.owner !== REBELS && faithOf(s, target.owner) !== faithOf(s, st[i].owner) ? nationMods(s, target.owner).holyWarMorale : 0;
      const moraleLoss = (dmg[i] * MORALE_K) / Math.max(1, target.totalRegs) / (1 + holy) / (1 + starBonus(target.general));
      applyCasualties(target, casualties);
      for (const a of target.armies) a.morale = Math.max(0, a.morale - moraleLoss);
      targetSide.losses += casualties;
      losses[1 - i] = casualties;
    }
    b.log.unshift({ day: s.day, rolls, losses });
    if (b.log.length > 20) b.log.length = 20;
    const after = [stats(s, b.sides[0]), stats(s, b.sides[1])] as const;
    const broken = after.map(x => x.totalMen <= 0 || x.morale <= 0.01);
    if (broken[0] || broken[1]) {
      let loser: 0 | 1;
      if (broken[0] && broken[1]) loser = after[0].morale / after[0].maxMorale <= after[1].morale / after[1].maxMorale ? 0 : 1;
      else loser = broken[0] ? 0 : 1;
      endBattle(s, b, (1 - loser) as 0 | 1, after);
    }
  }
}

function applyCasualties(st: SideStats, casualties: number): void {
  if (casualties <= 0 || st.totalMen <= 0) return;
  // Front-line infantry and cavalry take most of the losses, the guns in the back row a third as much.
  const weight = { inf: st.men.inf, cav: st.men.cav, art: st.men.art / 3 };
  const wsum = weight.inf + weight.cav + weight.art;
  for (const t of ['inf', 'cav', 'art'] as UnitType[]) {
    if (!st.men[t]) continue;
    const typeLoss = Math.min(st.men[t], (casualties * weight[t]) / wsum);
    for (const a of st.armies) {
      if (!a.regs[t].men) continue;
      const share = a.regs[t].men / st.men[t];
      a.regs[t].men = Math.max(0, Math.round(a.regs[t].men - typeLoss * share));
    }
    st.men[t] = Math.max(0, st.men[t] - typeLoss);
  }
  st.totalMen = st.men.inf + st.men.cav + st.men.art;
}

function endBattle(s: GameState, b: Battle, winner: 0 | 1, st: readonly [SideStats, SideStats]): void {
  const loser = (1 - winner) as 0 | 1;
  const W = st[winner];
  const L = st[loser];
  const winnerMen = W.armies.reduce((a, x) => a + armyMen(x), 0);
  let loserMen = L.armies.reduce((a, x) => a + armyMen(x), 0);
  const wiped = L.armies.length > 0 && winnerMen >= WIPE_RATIO * Math.max(1, loserMen);
  let extra = 0;
  const scattered: Army[] = [];
  if (wiped) {
    extra = loserMen;
    for (const a of L.armies) {
      if (a.general?.isRuler && a.owner !== REBELS) rulerDies(s, a.owner, 'killed in battle');
      delete s.armies[a.id];
    }
    loserMen = 0;
  } else if (L.armies.length) {
    // Pursuit: cavalry cuts down the fleeing.
    const pursuit = Math.min(0.3, 0.05 + (0.15 * W.regs.cav) / Math.max(1, L.totalRegs));
    for (const a of L.armies) {
      for (const t of ['inf', 'cav', 'art'] as UnitType[]) {
        const l = Math.round(a.regs[t].men * pursuit);
        a.regs[t].men -= l;
        extra += l;
      }
      if (a.general && chance(s, 0.03)) {
        if (a.general.isRuler) rulerDies(s, a.owner, 'killed in battle');
        else if (a.owner === s.player) log(s, 'battle', `General ${a.general.name} fell at ${regionName(b.node)}.`, { node: b.node });
        a.general = undefined;
      }
      a.battle = undefined;
      if (!retreat(s, a)) scattered.push(a);
    }
    // Cut off with nowhere to run: the army scatters, and every man left counts as lost.
    for (const a of scattered) {
      extra += armyMen(a);
      delete s.armies[a.id];
    }
  }
  b.sides[loser].losses += extra;
  for (const a of W.armies) {
    a.battle = undefined;
    if (a.general && chance(s, 0.01)) {
      if (a.general.isRuler) rulerDies(s, a.owner, 'killed in battle');
      a.general = undefined;
    }
  }
  delete s.battles[b.id];

  const lossW = b.sides[winner].losses;
  const lossL = b.sides[loser].losses;
  // War score and prestige.
  const points = Math.min(25, ((lossL + (wiped ? 5000 : 0)) / 1000) * 0.6);
  for (const w of Object.values(s.wars)) {
    const wl = sideOf(w, b.sides[winner].nations[0]);
    const ll = sideOf(w, b.sides[loser].nations[0]);
    if (wl === null || ll === null || wl === ll) continue;
    w.battleScore = clamp(w.battleScore + (wl === 0 ? points : -points), -40, 40);
  }
  const ratio = winnerMen / Math.max(1, loserMen + (wiped ? 0 : 0));
  for (const n of b.sides[winner].nations) {
    const nat = s.nations[n];
    if (!nat) continue;
    nat.prestige = clamp(nat.prestige + Math.min(8, points / 3) * (1 + nationMods(s, n).prestigeGain), 0, 100);
    nat.record.battlesWon++;
    if (wiped) nat.record.stackWipes++;
    const r = b.sides[winner].startMen / Math.max(1, b.sides[loser].startMen);
    if (r > nat.record.bestRatio) nat.record.bestRatio = r;
    nat.warExhaustion = clamp(nat.warExhaustion + (lossW / 1000) * 0.08 / b.sides[winner].nations.length, 0, 20);
  }
  for (const n of b.sides[loser].nations) {
    const nat = s.nations[n];
    if (!nat) continue;
    nat.prestige = clamp(nat.prestige - Math.min(8, points / 3), 0, 100);
    nat.record.battlesLost++;
    nat.warExhaustion = clamp(nat.warExhaustion + (lossL / 1000) * 0.1 / b.sides[loser].nations.length, 0, 20);
  }

  const playerSide = b.sides[0].nations.includes(s.player) ? 0 : b.sides[1].nations.includes(s.player) ? 1 : null;
  const report: BattleReport = {
    id: `r${++s.seq}`,
    day: s.day,
    node: b.node,
    winner,
    leaders: [b.sides[0].nations[0], b.sides[1].nations[0]],
    nations: [b.sides[0].nations, b.sides[1].nations],
    startMen: [b.sides[0].startMen, b.sides[1].startMen],
    losses: [b.sides[0].losses, b.sides[1].losses],
    wiped,
    ...(scattered.length ? { scattered: true } : {}),
    days: b.days,
    generals: [st[0].general.name, st[1].general.name],
    warScore: Math.round(points),
    playerSide,
  };
  s.reports.unshift(report);
  if (s.reports.length > 25) {
    s.reports.length = 25;
    // A report that drops out of the list can no longer be opened: it is no longer waiting to be read either.
    s.unseenReports = liveUnseenReports(s);
  }
  if (playerSide !== null) {
    s.unseenReports.push(report.id);
    const won = playerSide === winner;
    if (won) {
      s.stats.battlesWon++;
      if (wiped) s.stats.stackWipes++;
      s.stats.bestWinRatio = Math.max(s.stats.bestWinRatio, b.sides[winner].startMen / Math.max(1, b.sides[loser].startMen));
    } else s.stats.battlesLost++;
    s.stats.menLost += b.sides[playerSide].losses;
    s.stats.enemiesKilled += b.sides[1 - playerSide].losses;
    const name = `Battle of ${regionName(b.node)}`;
    log(
      s,
      'battle',
      won
        ? `${name} won${wiped ? ': the enemy army is annihilated!' : '.'} Enemy losses ${lossL.toLocaleString()}, ours ${lossW.toLocaleString()}.`
        : `${name} lost${wiped ? ': our army is annihilated.' : '.'} Our losses ${lossL.toLocaleString()}, theirs ${lossW.toLocaleString()}.`,
      { node: b.node, important: true },
    );
    for (const a of scattered) {
      const whose = a.owner === s.player || a.owner === REBELS ? 'The' : `The ${NATION[a.owner]?.adj ?? nationName(a.owner)}`;
      log(s, 'battle', `${whose} ${a.name} has nowhere to retreat from ${regionName(b.node)} and scatters: ${armyMen(a).toLocaleString()} men lost.`, { node: b.node, important: true });
    }
  } else if (wiped && ratio > 0) {
    const big = b.sides[loser].startMen >= 15000;
    if (big)
      log(s, 'news', `${NATION[b.sides[winner].nations[0]]?.name ?? 'Rebels'} annihilate a ${NATION[b.sides[loser].nations[0]]?.adj ?? 'rebel'} army at ${regionName(b.node)}.`, {
        node: b.node,
      });
  }
}

export const battleSides = (s: GameState, b: Battle) => [stats(s, b.sides[0]), stats(s, b.sides[1])] as const;
export { armyRegs };
