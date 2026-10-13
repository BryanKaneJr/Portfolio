/**
 * Battle forecast: how a fight would go if these armies met here today, by battle.ts's own rules played out with
 * the average roll instead of dice. The attackers lose 1 from the roll in rough terrain (2 in mountains) and 1 more
 * across a river, unless it is a pitched battle (both sides already standing there when it broke out); each side's
 * front line, unit power, generals' stars and present morale count as in a real battle.
 * The AI asks it before marching on an enemy and when an enemy draws near.
 */
import { REGION, isSea, riverBetween } from './content';
import { CASUALTY_K, MORALE_K, WIPE_RATIO, sidePower, type BattlePhase } from './battle';
import { FRONT_WIDTH } from './military';
import { REBELS, armyMen, maxMorale, nationMods } from './queries';
import { starBonus } from './rulers';
import type { Army, GameState, NationId, NodeId, UnitType } from './types';

/** A forecast looks this many days ahead at most (real battles last days, a few weeks at worst). */
const HORIZON = 60;

export interface Forecast {
  /** 0: the attackers are expected to win; 1: the defenders. */
  winner: 0 | 1;
  /** How many times longer the attackers would hold out than the defenders (days until each side's morale breaks):
   * above 1 the attackers win, 2 is a clear win. */
  ratio: number;
  /** Expected length of the battle, in days. */
  days: number;
  /** How near the loser comes to being annihilated (the winner keeping five times its men): 1 = expected. */
  wipeRisk: number;
  /** Men left on each side when it ends. */
  men: [number, number];
}

type SideStats = Parameters<typeof sidePower>[1];

/** A side as battle.ts sums it up: men-weighted morale, the best general leads, the first army's owner fights. */
function sideStats(s: GameState, armies: Army[]): SideStats {
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
    const max = maxMorale(s, a.owner);
    moraleW += Math.min(a.morale, max) * m;
    maxW += max * m;
    if (a.general && a.general.stars > general.stars) general = { stars: a.general.stars, name: a.general.name };
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
    owner: armies[0]?.owner ?? REBELS,
  };
}

/** The average of a d10 roll with `penalty` taken off (never below 1), as battle.ts rolls it. */
export function averageRoll(penalty: number): number {
  let t = 0;
  for (let r = 1; r <= 10; r++) t += Math.max(1, r - penalty);
  return t / 10;
}

/** What the attackers lose from their roll here: rough terrain, mountains, and a river crossed on the way in. */
export function attackPenalty(node: NodeId, fromNode?: NodeId): number {
  const terrain = REGION[node]?.terrain ?? 'plains';
  return (terrain === 'mountains' ? 2 : terrain === 'plains' ? 0 : 1) + (fromNode && riverBetween(fromNode, node) ? 1 : 0);
}

const faithOf = (s: GameState, n: NationId) => (n === REBELS ? 'rebel' : (s.nations[n]?.faith ?? ''));

/** Takes men off a side as battle.ts does: the front line most, the guns a third as much. */
function bleed(st: SideStats, casualties: number): void {
  if (casualties <= 0 || st.totalMen <= 0) return;
  const weight = { inf: st.men.inf, cav: st.men.cav, art: st.men.art / 3 };
  const wsum = weight.inf + weight.cav + weight.art;
  for (const t of ['inf', 'cav', 'art'] as UnitType[]) st.men[t] = Math.max(0, st.men[t] - Math.min(st.men[t], (casualties * weight[t]) / wsum));
  st.totalMen = st.men.inf + st.men.cav + st.men.art;
}

/**
 * How a battle between `attackers` (walking into `node`, from `fromNode` if given, for the river) and `defenders`
 * (standing there) would go, by battle.ts's daily exchange at the average roll. A `pitched` battle (both sides
 * already standing there when it broke out: a war declared, rebels rising) carries no penalty for the attackers.
 */
export function forecast(
  s: GameState,
  attackers: Army[],
  defenders: Army[],
  node: NodeId,
  fromNode?: NodeId,
  pitched = false,
): Forecast {
  const st = [sideStats(s, attackers), sideStats(s, defenders)] as const;
  if (st[0].totalMen <= 0 || st[1].totalMen <= 0) {
    const winner = st[0].totalMen > 0 ? 0 : 1;
    return { winner, ratio: winner === 0 ? Infinity : 0, days: 0, wipeRisk: 1, men: [st[0].totalMen, st[1].totalMen] };
  }
  const width = isSea(node) ? FRONT_WIDTH.plains : FRONT_WIDTH[REGION[node].terrain];
  const roll = [averageRoll(pitched ? 0 : attackPenalty(node, fromNode)), averageRoll(0)];
  // Holy war zeal softens the morale a side loses to another faith.
  const zeal = [0, 1].map(i => {
    const me = st[i].owner;
    return me !== REBELS && faithOf(s, me) !== faithOf(s, st[1 - i].owner) ? nationMods(s, me).holyWarMorale : 0;
  });
  const morale = [st[0].morale, st[1].morale];
  const breaks: (number | null)[] = [null, null];
  const lastLoss = [0, 0];
  let end = 0;
  for (let day = 1; day <= HORIZON && breaks[0] === null && breaks[1] === null; day++) {
    const phase: BattlePhase = (day - 1) % 6 < 3 ? 'volley' : 'charge';
    const dmg = [roll[0] * sidePower(s, st[0], width, phase), roll[1] * sidePower(s, st[1], width, phase)];
    for (const i of [0, 1] as const) {
      const target = st[1 - i];
      const loss = (dmg[i] * MORALE_K) / Math.max(1, target.totalRegs) / (1 + zeal[1 - i]) / (1 + starBonus(target.general));
      bleed(target, Math.min(target.totalMen, dmg[i] * CASUALTY_K));
      lastLoss[1 - i] = loss;
      const before = morale[1 - i];
      morale[1 - i] = Math.max(0, before - loss);
      // When during the day it broke (fractional), so close fights still compare smoothly.
      if (morale[1 - i] <= 0.01 || target.totalMen <= 0) breaks[1 - i] = day - 1 + Math.min(1, before / Math.max(1e-9, loss));
    }
    end = day;
  }
  // Whoever held: how much longer it would have lasted at the last day's pace.
  const holdOut = (i: 0 | 1) => breaks[i] ?? end + morale[i] / Math.max(1e-9, lastLoss[i]);
  const tAtt = holdOut(0);
  const tDef = holdOut(1);
  let winner: 0 | 1;
  if (breaks[0] !== null && breaks[1] !== null) winner = morale[0] / st[0].maxMorale <= morale[1] / st[1].maxMorale ? 1 : 0;
  else if (breaks[0] !== null) winner = 1;
  else if (breaks[1] !== null) winner = 0;
  else winner = tAtt > tDef ? 0 : 1; // nobody breaks within the horizon: the defenders hold the field unless outlasted
  const w = st[winner].totalMen;
  const l = st[1 - winner].totalMen;
  return {
    winner,
    ratio: tAtt / Math.max(1e-9, tDef),
    days: Math.max(1, Math.round(Math.min(tAtt, tDef))),
    wipeRisk: Math.min(1, w / (WIPE_RATIO * Math.max(1, l))),
    men: [Math.round(st[0].totalMen), Math.round(st[1].totalMen)],
  };
}
