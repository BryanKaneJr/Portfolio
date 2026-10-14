/**
 * Rule-based AI: predictable enough to plan around, aggressive enough to feel alive.
 * Monthly (staggered per nation): economy, generals, diplomacy, war and peace decisions, weighted by personality.
 * Every few days per army: attack stacks the battle forecast says it beats, besiege enemy land, retreat from
 * fights it would lose, gather before walking out alone, merge.
 */
import { GRAPH, MAP_REGION, NATION, POLICIES, REGION, SEA_COAST, hops, isNativeNation, isSea, mapDistance } from './content';
import {
  COLONY_COST,
  COLONY_GUARD_UPKEEP,
  MAX_GROWN_DEV,
  EXPEDITION_COST,
  EXPEDITION_YEAR,
  GOOD_VALUE,
  canColonize,
  canGrow,
  canSendExpedition,
  charted,
  coloniesOf,
  colonistsOf,
  freeColonists,
  newWorldRegions,
  riskWithoutGuards,
  sendExpedition,
  setGuard,
  startColony,
  startGrowing,
} from './colonies';
import { log, requestPause } from './log';
import { FUNDING_SHARE, UNIVERSITY_MIN_DEV, policySlots, universityCost, unlocked } from './science';
import { wantedRegions, wantsFrom } from './aims';
import {
  REBELS,
  allied,
  alliesOf,
  armiesHostile,
  armiesOf,
  armyMen,
  armyRegs,
  atWar,
  controllerHostile,
  fleetsOf,
  forceLimit,
  friendlyTo,
  hasTruce,
  hostile,
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
  FABRICATE_COST,
  FABRICATE_DAYS,
  coreCost,
  devCost,
  fortCost,
  ledger,
  mercCost,
  RECRUIT_DAYS,
  shipCost,
  SHIP_DAYS,
  stabilityCost,
  unitCost,
  LOAN_SIZE,
  maxManpower,
} from './economy';
import { acceptance, canRival, doDiplomacy, isHreMember, opinion } from './diplomacy';
import { ULTIMATUM_SCORE, buildDemands, casusBelli, declareWar, fitTerms, imperialDefenders, leaveWar, likelySides, makePeace, peaceAcceptance, scoreFor, sendUltimatum, canDeclareWar, type CbOption } from './war';
import { COALITION_JOIN, coalitionAgainst, coalitionWarCheck, proximity } from './threat';
import { addRegiments, findPath, mergeArmies, orderMove, pathFromTree, pathTree, splitArmy, supplyLimit } from './military';
import { minSiegeRegs } from './siege';
import { fleetPower, findSeaPath, seaDistances, transportCapacity } from './navy';
import { forecast, type Forecast } from './forecast';
import { GENERAL_COST } from './commands';
import { newGeneral, rulerAsGeneral } from './rulers';
import type { Army, CasusBelli, GameState, Nation, NationId, NativePolicy, NodeId, PeaceTerms, Personality, Region, RegionId, Tier, UnitType, War } from './types';
import { DAYS_PER_YEAR, chance, clamp, isIn, months, pairKey, pick, rand, randomDayOfNextMonth, yearOf, years } from './util';

/** The player's nation is run by the AI only in spectator mode (dev tools, title-screen demo). */
export const isHuman = (s: GameState, n: NationId) => n === s.player && !('__spectate' in s.flags);

const REQUIRED_RATIO: Record<string, number> = { expansionist: 1.25, opportunist: 1.5, trader: 1.9, defensive: 2.3 };

export function monthlyAI(s: GameState): void {
  if ('__noAI' in s.flags) return;
  for (const nat of Object.values(s.nations)) {
    if (!nat.alive || isHuman(s, nat.id) || s.day < nat.ai.nextEval) continue;
    nat.ai.nextEval = s.day + 30;
    aiEconomy(s, nat);
    aiGenerals(s, nat);
    aiPeace(s, nat);
    // New World peoples defend their land but never start wars or court European crowns.
    if (isNativeNation(nat.id)) continue;
    aiColonies(s, nat);
    aiDiplomacy(s, nat);
    aiClaims(s, nat);
    // (Wars are weighed on each crown's own day of the month: dailyWarRolls.)
  }
  coalitionWarCheck(s, (attacker, target) => {
    const cbs = casusBelli(s, attacker, target);
    const cb = cbs.find(c => c.cb === 'coalition') ?? cbs[0];
    declareWar(s, attacker, target, cb.cb, cb.goal, 'coalition');
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
  const native = isNativeNation(n);
  if (!native) aiScience(s, nat, res);
  // Policies: one slot, and one more for every five advances.
  if (nat.policies.length < policySlots(nat)) {
    const p = NATION[n].personality;
    const wanted =
      p === 'expansionist'
        ? ['standing_army', 'conscription', 'artillery_corps', 'royal_administration', 'cavalry_tradition', 'tax_reform']
        : p === 'trader'
          ? ['mercantilism', 'naval_supremacy', 'diplomatic_corps', 'tax_reform', 'patronage']
          : p === 'defensive'
            ? ['fortress_doctrine', 'diplomatic_corps', 'conscription', 'religious_zeal', 'tax_reform']
            : ['tax_reform', 'standing_army', 'diplomatic_corps', 'royal_administration', 'conscription'];
    // Atlantic crowns want colonists once there is somewhere to send them.
    if (s.discovery && p !== 'defensive' && ['POR', 'CAS', 'ENG', 'FRA', 'BUR'].includes(n)) wanted.unshift('overseas_charters');
    const choice = wanted.find(id => {
      const pol = POLICIES.find(x => x.id === id);
      return pol && !nat.policies.includes(id) && (!pol.requires || nat.advances.includes(pol.requires));
    });
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
  const musterAt = musterRegion(s, n, war);
  if (balance < 1.5 && !war) toRecruit = 0;
  while (toRecruit > 0 && musterAt) {
    const steppe = NATION[n].trait === 'steppe_horde';
    const roll = (current + toRecruit) % 10;
    const type = native ? 'inf' : roll === 0 && unlocked(s, n, 'artillery') ? 'art' : roll < (steppe ? 6 : 3) ? 'cav' : 'inf';
    if (nat.gold < unitCost(s, n, type) + 15 || nat.manpower < 1000) break;
    queueRecruit(s, nat, type, musterAt);
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
  // A crown with colonists leaves its New World land below MAX_GROWN_DEV to its settlers (aiColonies grows it).
  const settlersGrow = colonistsOf(s, n) > 0;
  const dev = regions.filter(r => r.dev < 10 && r.controller === n && !(settlersGrow && REGION[r.id].nw && r.dev < MAX_GROWN_DEV)).sort((a, b) => devCost(s, a) / (a.cores.includes(n) ? 1 : 0.5) - devCost(s, b) / (b.cores.includes(n) ? 1 : 0.5))[0];
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
  if (!native && isCoastal(s, n) && (NATION[n].personality === 'trader' || chance(s, 0.3))) {
    const ships = Object.values(s.fleets).filter(f => f.owner === n).reduce((t, f) => t + f.ships.galley + f.ships.transport + f.ships.warship, 0);
    const want = Math.round(totalDev(s, n) / (NATION[n].personality === 'trader' ? 3 : 6));
    if (ships + nat.shipyard.length < want) {
      const coast = regions.find(r => GRAPH[r.id].some(e => e.kind === 'coast') && r.controller === n);
      const sea = coast && GRAPH[coast.id].find(e => e.kind === 'coast')?.to;
      if (coast && sea) {
        const type = unlocked(s, n, 'warships') && chance(s, 0.4) ? 'warship' : chance(s, 0.3) ? 'transport' : 'galley';
        const cost = shipCost(s, n, type);
        if (nat.gold > cost + res) {
          nat.gold -= cost;
          nat.shipyard.push({ type, region: coast.id, sea, done: s.day + SHIP_DAYS });
        }
      }
    }
  }
}

/** Pay for a regiment (gold and levies) and start training it in `region` (it musters after RECRUIT_DAYS). */
function queueRecruit(s: GameState, nat: Nation, type: UnitType, region: string): void {
  nat.gold -= unitCost(s, nat.id, type);
  nat.manpower -= 1000;
  nat.recruiting.push({ type, region, done: s.day + RECRUIT_DAYS });
}

/**
 * Where new regiments gather: the capital, unless the war is overseas (no land route from the capital to
 * the enemy), then the region of ours closest to the enemy by land.
 */
function musterRegion(s: GameState, n: NationId, war: boolean): string | undefined {
  const nat = s.nations[n];
  const capital = s.regions[nat.capital];
  const home = capital && capital.controller === n ? capital.id : ownedRegions(s, n).find(r => r.controller === n)?.id;
  if (!war || !home) return home;
  const enemies = enemiesOf(s, n);
  const targets = Object.values(s.regions).filter(r => !!r.controller && enemies.has(r.controller)).map(r => r.id);
  if (!targets.length || targets.some(t => hops(home, t) < 99)) return home;
  let best: string | undefined;
  let bestHops = 99;
  for (const r of ownedRegions(s, n)) {
    if (r.controller !== n) continue;
    for (const t of targets) {
      const h = hops(r.id, t);
      if (h < bestHops) {
        bestHops = h;
        best = r.id;
      }
    }
  }
  return best ?? home;
}

// ---------------------------------------------------------------- generals

/** The ruler takes the field in person only with this many stars as a general (and an heir to succeed). */
const RULER_LEADS_STARS = 3;
/** At war, an army this big without a general gets one hired, at the price the player pays. */
const HIRE_FOR_REGS = 8;
/** An army this big is worth taking a general away from a small one, and gets one hired even in peace. */
const BIG_ARMY = 10;

/**
 * Generals take the field. The idle ones (hired, given by events and missions, freed by a merge) go to the largest
 * armies without a commander; a skilled ruler leads the largest army of 8+ regiments in person when an heir stands
 * ready (taking it from a lesser general, who goes back to the pool), and comes home when the succession is no
 * longer safe. At war (or bracing for one), a general is hired for an army of 8+ regiments that has none; in peace
 * only for one of 10+, and from a full treasury.
 */
function aiGenerals(s: GameState, nat: Nation): void {
  const n = nat.id;
  const all = armiesOf(s, n);
  const armies = all.filter(a => !a.retreating);
  const rulerMayLead = !!nat.heir && !nat.ruler.regency && rulerAsGeneral(s, n).stars >= RULER_LEADS_STARS;
  // Home comes the ruler when the succession is unsafe (even from a rout), and any stale ruler-general.
  for (const a of all) if (a.general?.isRuler && (!rulerMayLead || a.general.name !== nat.ruler.name)) a.general = undefined;
  if (rulerMayLead && !all.some(a => a.general?.isRuler)) {
    const ruler = rulerAsGeneral(s, n);
    const host = armies
      .filter(a => !a.battle && armyRegs(a) >= HIRE_FOR_REGS && (!a.general || a.general.stars < ruler.stars))
      .sort((x, y) => armyRegs(y) - armyRegs(x))[0];
    if (host) {
      if (host.general) nat.generals.push(host.general);
      host.general = ruler;
    }
  }
  const leaderless = armies.filter(a => !a.general).sort((x, y) => armyRegs(y) - armyRegs(x));
  if (!leaderless.length) return;
  // The best idle commanders to the biggest armies.
  const pool = [...nat.generals].sort((x, y) => y.stars - x.stars);
  let hires = 0;
  for (const a of leaderless) {
    const g = pool.shift();
    if (g) {
      nat.generals = nat.generals.filter(x => x.id !== g.id);
      a.general = g;
      continue;
    }
    const regs = armyRegs(a);
    // A big army with nobody to lead it takes the general of a far smaller one.
    if (regs >= BIG_ARMY) {
      const spare = armies.filter(o => o.general && !o.general.isRuler && !o.battle && armyRegs(o) * 2 <= regs).sort((x, y) => armyRegs(x) - armyRegs(y))[0];
      if (spare) {
        a.general = spare.general;
        spare.general = undefined;
        continue;
      }
    }
    const atArms = nat.armyMode === 'war';
    if (regs < (atArms ? HIRE_FOR_REGS : BIG_ARMY) || isNativeNation(n) || hires >= 2 || nat.gold < GENERAL_COST + reserve(s, nat) * (atArms ? 0.5 : 1.5)) break;
    nat.gold -= GENERAL_COST;
    a.general = newGeneral(s, n);
    hires++;
  }
}

// ---------------------------------------------------------------- science

/** Fund scholars when the treasury allows it, and found universities in rich regions. (What to study is chosen in science.ts.) */
function aiScience(s: GameState, nat: Nation, res: number): void {
  const n = nat.id;
  const balance = ledger(s, n).balance;
  const war = atWar(s, n);
  // Fund scholars when the treasury can spare a tenth of the income, never into debt.
  const income = ledger(s, n).totalIncome;
  const spare = balance + (nat.scienceFunding ? income * FUNDING_SHARE : 0);
  nat.scienceFunding = nat.loans === 0 && nat.gold > res * 0.5 && spare > income * FUNDING_SHARE * (war ? 3 : 2) ? 1 : 0;
  // A university in the richest region without one, a few per realm.
  const owned = ownedRegions(s, n);
  const unis = owned.filter(r => r.university).length;
  if (!war && unis < Math.min(4, 1 + Math.floor(totalDev(s, n) / 80)) && nat.gold > universityCost(s, n) + res && chance(s, 0.1)) {
    const site = owned.filter(r => !r.university && r.dev >= UNIVERSITY_MIN_DEV && r.controller === n).sort((a, b) => b.dev - a.dev)[0];
    if (site) {
      nat.gold -= universityCost(s, n);
      site.university = true;
    }
  }
}

// ---------------------------------------------------------------- the New World

/** Below this a free plot of land isn't worth a colonist when one of ours could be grown instead. */
const SETTLE_WORTH = 2;
/** At most one levy for the colonies' defence per crown in this many days. */
const COLONY_LEVY_DAYS = 180;

function aiColonies(s: GameState, nat: Nation): void {
  const n = nat.id;
  const res = reserve(s, nat);
  // Atlantic crowns gamble on a voyage west; Portugal and Castile most of all.
  if (!s.discovery && !canSendExpedition(s, n) && nat.gold > EXPEDITION_COST + res) {
    const keen = n === 'POR' || n === 'CAS' ? 4 : NATION[n].tier === 'minor' ? 0.25 : 1;
    const ripe = 1 + (yearOf(s.day) - EXPEDITION_YEAR) / 8;
    if (chance(s, 0.0006 * keen * ripe)) sendExpedition(s, n);
  }
  aiColonyGuards(s, nat, res);
  aiColonialDefence(s, nat, res);
  if (freeColonists(s, n) <= 0 || nat.gold < COLONY_COST + res * 0.5 || nat.lastMonthIncome - nat.lastMonthExpenses < 0.5) return;
  let best: string | null = null;
  let bestScore = -Infinity;
  const mine = Object.values(s.regions).filter(r => r.owner === n && REGION[r.id].nw).map(r => r.id);
  const sphere = COLONIAL_SPHERE[n];
  // Never where, or next to where, hostile troops stand: they would raid the settlers out again.
  const danger = new Set<NodeId>();
  for (const id in s.armies) {
    const a = s.armies[id];
    if (isSea(a.node) || !hostile(s, n, a.owner, undefined, a.rebelOf)) continue;
    danger.add(a.node);
    for (const e of GRAPH[a.node]) if (e.kind === 'land' || e.kind === 'strait') danger.add(e.to);
  }
  for (const r of Object.values(s.regions)) {
    if (r.owner || r.colony || danger.has(r.id) || canColonize(s, n, r.id)) continue;
    // Nor, for five years, where raiders wiped out a colony of ours.
    const lost = nat.flags[`_raidLost_${r.id}`];
    if (lost !== undefined && s.day - lost < years(5)) continue;
    const def = REGION[r.id];
    const nextToOwn = GRAPH[r.id].some(e => (e.kind === 'land' || e.kind === 'strait') && s.regions[e.to]?.owner === n);
    // Crowns build compact empires: near what they hold, in the part of the Americas they reached first.
    const nearOwn = !nextToOwn && mine.some(m => hops(m, r.id) <= 3);
    const [lon, lat] = MAP_REGION[r.id].lonlat;
    const inSphere = sphere ? sphere(lon, lat) : false;
    const score =
      (def.good ? GOOD_VALUE[def.good] * 3 : 0) + def.dev - r.natives * 0.8 - (def.hostility ?? 0) + (nextToOwn ? 4 : nearOwn ? 2 : 0) + (inSphere ? 3 : 0) + (r.id.charCodeAt(0) % 7) * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = r.id;
    }
  }
  // No land worth a colonist in reach: grow the founded colony whose exports gain most from more settlers.
  const grow = bestScore < SETTLE_WORTH ? bestToGrow(s, n) : null;
  if (grow) startGrowing(s, n, grow);
  else if (best) startColony(s, n, best, nativePolicyFor(s, best));
}

/** Trade with natives who would fight (hostile, and numerous enough to matter) unless they are fierce: then take the land. */
function nativePolicyFor(s: GameState, r: string): NativePolicy {
  const hostility = REGION[r].hostility ?? 0;
  return hostility >= 2 && hostility < 3 && s.regions[r].natives >= 2 ? 'trade' : 'force';
}

/** The New World region of ours a colonist would add most exports to (+1 prosperity is worth GOOD_VALUE / 10). */
function bestToGrow(s: GameState, n: NationId): string | null {
  let best: string | null = null;
  let bestValue = -Infinity;
  for (const r of newWorldRegions(s, n)) {
    if (canGrow(s, n, r.id)) continue;
    const good = REGION[r.id].good;
    const value = (good ? GOOD_VALUE[good] : 0) * (r.cores.includes(n) ? 1 : 0.5) - r.dev * 0.01;
    if (value > bestValue) {
      bestValue = value;
      best = r.id;
    }
  }
  return best;
}

/** Paid guards on the colonies the natives would attack, while the treasury allows; dismissed when not needed. */
function aiColonyGuards(s: GameState, nat: Nation, res: number): void {
  const n = nat.id;
  for (const r of coloniesOf(s, n)) {
    const c = r.colony!;
    const risk = riskWithoutGuards(s, r) > 0;
    if (c.guard && !risk) setGuard(s, n, r.id, false);
    else if (!c.guard && risk && nat.gold > res * 0.3 && nat.lastMonthIncome - nat.lastMonthExpenses > COLONY_GUARD_UPKEEP + 0.25) setGuard(s, n, r.id, true);
  }
}

/**
 * At war, a crown whose New World land (or a colony it is settling) has an enemy army in it or next door raises a
 * regiment or two in its nearest New World region with no enemy in or beside it, if it can afford them; at most
 * once every COLONY_LEVY_DAYS.
 */
function aiColonialDefence(s: GameState, nat: Nation, res: number): void {
  const n = nat.id;
  if (s.day - (nat.ai.colonyLevy ?? -Infinity) < COLONY_LEVY_DAYS || !atWar(s, n)) return;
  const enemies = enemiesOf(s, n);
  const enemyAt = new Set<NodeId>();
  const hostileAt = new Set<NodeId>();
  for (const id in s.armies) {
    const a = s.armies[id];
    if (a.retreating || !hostile(s, n, a.owner, undefined, a.rebelOf)) continue;
    hostileAt.add(a.node);
    if (enemies.has(a.owner)) enemyAt.add(a.node);
  }
  if (!enemyAt.size) return;
  const near = (at: Set<NodeId>, id: string) => at.has(id) || GRAPH[id].some(e => (e.kind === 'land' || e.kind === 'strait') && at.has(e.to));
  const threatened = Object.values(s.regions).find(r => REGION[r.id].nw && (r.owner === n || r.colony?.by === n) && near(enemyAt, r.id));
  if (!threatened) return;
  // Not past the army limit, and not if our troops on that shore already match the enemy's near it.
  if (totalRegiments(s, n) >= forceLimit(s, n)) return;
  const regsNear = (mine: boolean) =>
    Object.values(s.armies)
      .filter(a => (mine ? a.owner === n : enemies.has(a.owner)) && !a.retreating && !isSea(a.node) && hops(a.node, threatened.id) <= (mine ? 3 : 1))
      .reduce((t, a) => t + armyRegs(a), 0);
  if (regsNear(true) >= regsNear(false)) return;
  // Raised where they can march to the threat over land: the threatened region itself if we hold it and no enemy
  // army stands there, else the nearest such region of ours on that shore.
  const safe = newWorldRegions(s, n)
    .filter(r => r.controller === n && !hostileAt.has(r.id) && hops(r.id, threatened.id) < 99)
    .sort((a, b) => hops(a.id, threatened.id) - hops(b.id, threatened.id) || mapDistance(a.id, threatened.id) - mapDistance(b.id, threatened.id));
  if (!safe.length) return;
  const cost = unitCost(s, n, 'inf');
  let raised = 0;
  while (raised < 2 && nat.gold >= cost + res * 0.5 && nat.manpower >= 1000) {
    queueRecruit(s, nat, 'inf', safe[0].id);
    raised++;
  }
  if (raised) nat.ai.colonyLevy = s.day;
}

/** Where each colonial crown looks first (by the region's longitude and latitude). */
const COLONIAL_SPHERE: Record<NationId, (lon: number, lat: number) => boolean> = {
  POR: (_lon, lat) => lat < 0, // Brazil
  CAS: (lon, lat) => lat >= 0 && lat < 31 && lon > -100, // the Caribbean, Mexico and the Spanish Main
  ENG: (lon, lat) => lat >= 31 && lat < 52 && lon > -82, // the Atlantic seaboard
  SCO: (lon, lat) => lat >= 40 && lon > -75, // Nova Scotia
  FRA: (lon, lat) => lat >= 43 || (lat >= 28 && lat < 34 && lon < -88), // Canada and Louisiana
  BUR: (lon, lat) => (lat >= 39 && lat < 43) || (lat > 0 && lat < 20 && lon > -70), // New Netherland and the Antilles
  DAN: (lon, lat) => lat > 10 && lat < 20 && lon > -70, // the West Indies
};

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
      if (ratio > 0.9 && opinion(s, n, over) < 0 && chance(s, 0.2) && !canDeclareWar(s, n, over)) declareWar(s, n, over, 'independence', undefined, 'independence');
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
        if (!s.offers.some(x => x.from === n) && opinion(s, n, s.player) >= 50 && chance(s, 0.3)) {
          s.offers.push({ id: `o${++s.seq}`, kind: 'alliance', from: n, day: s.day });
          requestPause(s, 'offer');
        }
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

/**
 * Forge a claim on land the crown wants (aims, missions) next to its own, as the player can. A crown with nothing
 * it wants next door and no reason for war on any neighbour eyes the richest border region of a clearly weaker
 * neighbour instead (how much weaker depends on its bent; a great crown's land is not fair game, and a great crown
 * does not do this).
 */
function aiClaims(s: GameState, nat: Nation): void {
  const n = nat.id;
  if (nat.fabricating || nat.overlord || nat.gold < FABRICATE_COST + reserve(s, nat) * 0.5 || !chance(s, 0.25)) return;
  let best: { r: string; score: number } | null = null;
  for (const [r, w] of wantedRegions(s, n)) {
    const o = s.regions[r]?.owner;
    if (!o || o === n || r in nat.claims || s.nations[o].overlord === n || allied(s, n, o)) continue;
    if (!bordersOwn(s, n, r)) continue;
    const score = w * 10 + s.regions[r].dev;
    if (!best || score > best.score) best = { r, score };
  }
  // (Only a lesser crown: a great crown that eyed its weaker neighbours' land too would swallow them one by one,
  // and needs no help finding wars: its aims, rivals and faith give it enough.)
  if (!best && !hasCause(s, n) && NATION[n].tier !== 'major') {
    const mine = militaryPower(s, n);
    for (const r of Object.values(s.regions)) {
      const o = r.owner;
      // Not a fellow prince of the Empire (the Emperor keeps the peace inside it), nor a crown under truce (the
      // claim could not be pressed).
      if (!o || o === n || r.id in nat.claims || NATION[o]?.tier === 'major' || canDeclareWar(s, n, o) || (isHreMember(s, n) && isHreMember(s, o)) || hasTruce(s, n, o)) continue;
      if (militaryPower(s, o) * (WEAKER_NEIGHBOUR[NATION[n].personality] ?? 2) > mine || !bordersOwn(s, n, r.id)) continue;
      if (!best || r.dev > best.score) best = { r: r.id, score: r.dev };
    }
  }
  if (!best) return;
  nat.gold -= FABRICATE_COST;
  nat.fabricating = { region: best.r, done: s.day + FABRICATE_DAYS };
}

/** A neighbour this many times weaker (or more) is fair game for a forged claim: the ambitious look sooner. */
const WEAKER_NEIGHBOUR: Record<string, number> = { expansionist: 1.5, opportunist: 1.5, trader: 2, defensive: 3 };

/** Does region `r` touch land `n` owns (by land or a strait)? */
function bordersOwn(s: GameState, n: NationId, r: string): boolean {
  return GRAPH[r].some(e => (e.kind === 'land' || e.kind === 'strait') && s.regions[e.to]?.owner === n);
}

/** Has `n` a reason for war (a claim, a holy war, a rival...) on a neighbour it may attack? */
function hasCause(s: GameState, n: NationId): boolean {
  return neighborsOf(s, n).some(t => !canDeclareWar(s, n, t) && !hasTruce(s, n, t) && casusBelli(s, n, t)[0].cb !== 'none');
}

// ---------------------------------------------------------------- war

/**
 * The might a side brings to a war. Given its leader and the enemy, it counts all of the leader's and its subjects'
 * (and of those `sworn` to come, the Empire's defenders) and less of a distant ally's (its armies come late, and not
 * all of them): 1 next door, two thirds five regions off, a third from across the map.
 */
export function sideStrength(s: GameState, nations: NationId[], leader?: NationId, enemy?: NationId, sworn: NationId[] = []): number {
  return nations.reduce((t, x) => {
    const own = !leader || !enemy || x === leader || s.nations[x]?.overlord === leader || sworn.includes(x);
    const near = own ? 1 : proximity(s, x, enemy);
    return t + militaryPower(s, x) * (0.35 + 0.65 * near);
  }, 0);
}

/** A limited war, for one region on the border (a claim, a lost core, land it wants), needs this much less might
 * (nobody fights to the last man over one region), but still a clear edge: a war at even odds is lost half the time. */
const LIMITED_WAR = 0.75;
const LIMITED_WAR_FLOOR = 1.15;

// War chance. Once a month, on a day of its own (dailyWarRolls), each AI crown weighs a war on the neighbour it most
// wants to fight (bestWarTarget: the ranking and the might it needs are unchanged). Its chance is a yearly figure in
// %: its bent's base times its crown factors (warMood) times the factors of that target (targetFactors), divided by
// 12 for the month and capped at MAX_MONTHLY.

/** Yearly war chance (%) of a fully rested crown with every other factor at 1. (The old order: 0.3/0.2/0.1.) */
export const WAR_BASE: Record<Personality, number> = { expansionist: 40, opportunist: 25, trader: 12, defensive: 8 };
/** Great crowns have the reach and treasury for regular wars; small expansionists (Crimea, the Golden Horde) are tamed. */
export const WAR_SIZE: Record<Tier, number> = { major: 1, hard: 0.85, minor: 0.7 };
/** Years with no war at all after a war it declared or any peace it signed (armies come home). */
export const REST_MIN = 1.5;
/** Years by which the appetite is fully back: the old fixed rest, so no crown has full appetite sooner than before. */
export const REST_FULL: Record<Personality, number> = { expansionist: 3, opportunist: 3, trader: 4, defensive: 5 };
/** At most 15% a month (86% within a year): the cap on the eager crowns, and the main lever for the Ottoman opening. */
export const MAX_MONTHLY = 0.15;
/** Each loan ×(1 − 0.15); more than 3 loans stays a hard gate. */
const LOAN_DRAG = 0.15;
/** Order 0 → ×0.9 … 3 → ×1.2 (below 0 stays a hard gate); the starting order of 1 → ×1. */
const ORDER_STEP = 0.1;
/** War exhaustion 0 → ×1, 5 → ×0.5 (above 5 stays a hard gate). */
const WEARY_DIV = 10;
/** The ruler sets the pace (Charles the Bold, Mehmed II). */
const RULER_WAR: Record<string, number> = { warrior: 1.25, ambitious: 1.25, craven: 0.6 };
/** A council of regents starts few wars. */
const REGENCY_WAR = 0.6;
/** A coalition is formed against it: it holds back (the Threat brake on the might it needs stays as well). */
const FEARED = 0.5;
/** Exactly the might it needs: a coin-flip war, half the appetite. */
const EDGE_AT_NEED = 0.5;
/** 1.5× the might needed → ×1.0. */
const EDGE_SLOPE = 1;
/** 2.5× or more → ×2.0: overwhelming odds double it. */
const EDGE_MAX = 2;
/** A named region to press counts most; a faith difference alone least (holy wars were 25-30 of ~100 a game); none:
 * it would only forge a claim. */
const REASON_WAR: Record<CasusBelli, number> = { reconquest: 1, claim: 1, independence: 1, coalition: 0.8, rival: 0.7, holy: 0.6, none: 0.5 };
/** Desire 0..4 (aims 2, missions 1) → ×1..×2: crowns follow their history. */
const WANT_STEP = 0.25;
/** Two members of the Empire, the war for a claim or lost land: the Emperor tolerates it. */
const EMPIRE_LAWFUL = 0.6;
/** Two members of the Empire, any other reason: the Emperor's peace. */
const EMPIRE_UNLAWFUL = 0.3;
/** The most any target can multiply a crown's chance by (4): what the decision draw is checked against first. */
export const MAX_TARGET = EDGE_MAX * Math.max(...Object.values(REASON_WAR)) * (1 + 4 * WANT_STEP);

/** Why a crown weighs no war at all. */
export type WarBlock = 'dead' | 'human' | 'native' | 'subject' | 'war' | 'rest' | 'waiting' | 'order' | 'weariness' | 'debt';
/** One part of a war chance: `x` multiplies it (the bent's base is in % a year). */
export interface WarFactor {
  key: string;
  label: string;
  x: number;
}
/** The neighbour a crown most wants to fight, and why it may. */
export interface WarTarget {
  target: NationId;
  cb: CbOption;
  goal?: RegionId;
  limited: boolean;
  /** Its might against the defenders', and the ratio it needs. */
  ratio: number;
  need: number;
  /** How much it wants the target's land (0-4). */
  desire: number;
  score: number;
}
export interface WarMood {
  blocked?: WarBlock;
  /** While blocked by its rest, or waiting for a truce to end: the day it ends. */
  restUntil?: number;
  /** While waiting: the crown whose truce it waits out (it holds a claim on its land). */
  waitingFor?: NationId;
  /** The crown's own chance (% a year) before its target's factors. */
  crown: number;
  factors: WarFactor[];
}
export interface WarOdds extends WarMood {
  best?: WarTarget & { edge: number; reason: number; want: number; empire: number };
  /** % a year (may read above 100: the figure before it is divided by 12). */
  yearly: number;
  /** The chance on its roll day this month (0-MAX_MONTHLY). */
  monthly: number;
}

const REASON_LABEL: Record<CasusBelli, string> = {
  claim: 'a claim',
  reconquest: 'lost land',
  holy: 'faith',
  rival: 'a rival',
  independence: 'independence',
  coalition: 'a coalition',
  none: 'none yet',
};

/** Years before a truce ends in which a crown with a claim on the other side waits for that war instead of another. */
export const TRUCE_WAIT = 2;

/** The neighbour whose truce `n` waits out, holding a claim on its land, and the day it ends (the soonest). */
function truceToWaitOut(s: GameState, n: NationId): { holder: NationId; until: number } | undefined {
  const soon = s.day + years(TRUCE_WAIT);
  let best: { holder: NationId; until: number } | undefined;
  for (const [r, lapses] of Object.entries(s.nations[n].claims)) {
    const o = s.regions[r]?.owner;
    if (!o || o === n || (lapses >= 0 && lapses <= soon)) continue;
    const until = s.truces[pairKey(n, o)];
    if (until !== undefined && until > s.day && until <= soon && (!best || until < best.until)) best = { holder: o, until };
  }
  return best;
}

/** The gates and the crown's own factors (its bent, size, rest, treasury...). Pure: no draws. */
function warMood(s: GameState, nat: Nation): WarMood {
  const n = nat.id;
  const stop = (blocked: WarBlock, restUntil?: number): WarMood => ({ blocked, restUntil, crown: 0, factors: [] });
  if (!nat.alive) return stop('dead');
  if (isHuman(s, n)) return stop('human');
  if (isNativeNation(n)) return stop('native');
  if (nat.overlord) return stop('subject');
  if (atWar(s, n)) return stop('war');
  // A crown rests after it declared a war or made peace: no war at all for REST_MIN years, then its appetite returns.
  const last = Math.max(nat.ai.lastWarDeclared ?? -Infinity, nat.ai.lastPeace ?? -Infinity);
  const since = (s.day - last) / DAYS_PER_YEAR;
  if (since < REST_MIN) return stop('rest', last + years(REST_MIN));
  if (nat.stability < 0) return stop('order');
  if (nat.warExhaustion > 5) return stop('weariness');
  if (nat.loans > 3) return stop('debt');
  // A crown that holds a claim on a neighbour whose truce with it ends within TRUCE_WAIT years keeps its powder dry
  // for that war (France in 1447, with Tours running out on the English): no other war, no claim forged elsewhere.
  const wait = truceToWaitOut(s, n);
  if (wait) return { blocked: 'waiting', restUntil: wait.until, waitingFor: wait.holder, crown: 0, factors: [] };
  const def = NATION[n];
  const pers = def.personality;
  const traits = nat.ruler.traits.filter(t => t in RULER_WAR);
  let ruler = traits.reduce((x, t) => x * RULER_WAR[t], 1);
  if (nat.ruler.regency) ruler *= REGENCY_WAR;
  const rulerWhy = [...traits, ...(nat.ruler.regency ? ['regency'] : [])].join(', ');
  // The reserve the economy keeps (40 + 4 months' income). Before the first month's books are in (a new game, until
  // 1 December 1444) it uses what that month will record, as the first roll will see it.
  const income = nat.lastMonthIncome || ledger(s, n).totalIncome;
  const res = 40 + Math.max(0, income) * 4;
  const factors: WarFactor[] = [
    { key: 'base', label: `Bent (${pers})`, x: WAR_BASE[pers] },
    { key: 'size', label: 'Size', x: WAR_SIZE[def.tier] },
    { key: 'rest', label: 'Still resting from its last war', x: clamp((since - REST_MIN) / (REST_FULL[pers] - REST_MIN), 0, 1) },
    { key: 'treasury', label: 'Treasury', x: clamp(0.5 + (0.5 * nat.gold) / res, 0.5, 1.5) },
    { key: 'debt', label: 'Debts', x: 1 - LOAN_DRAG * nat.loans },
    { key: 'order', label: 'Order', x: 1 + ORDER_STEP * (nat.stability - 1) },
    { key: 'weariness', label: 'War exhaustion', x: 1 - nat.warExhaustion / WEARY_DIV },
    { key: 'levies', label: 'Levies', x: clamp(0.4 + (0.8 * nat.manpower) / Math.max(1, maxManpower(s, n)), 0.4, 1.2) },
    { key: 'ruler', label: rulerWhy ? `Ruler (${rulerWhy})` : 'Ruler', x: ruler },
    { key: 'feared', label: 'A coalition against it', x: coalitionAgainst(s, n) ? FEARED : 1 },
  ];
  return { crown: factors.reduce((p, f) => p * f.x, 1), factors };
}

/**
 * The neighbour `nat` most wants to fight among those it has the might for, or null. Pure: no draws. A target with no
 * reason for war counts only for an expansionist (it would forge a claim first).
 */
function bestWarTarget(s: GameState, nat: Nation): WarTarget | null {
  const n = nat.id;
  const pers = NATION[n].personality;
  const aggression = s.settings.difficulty === 'hard' ? 0.85 : s.settings.difficulty === 'easy' ? 1.2 : 1;
  let best: WarTarget | null = null;
  const wanted = wantedRegions(s, n);
  const targets = new Set(neighborsOf(s, n));
  for (const t of targets) {
    if (canDeclareWar(s, n, t) || hasTruce(s, n, t)) continue;
    const tn = s.nations[t];
    const realTarget = tn.overlord ?? t;
    if (realTarget !== t) continue;
    const cbs = casusBelli(s, n, t);
    const cb = cbs[0];
    if (cb.cb === 'none' && pers !== 'expansionist') continue;
    // Only the allies who would answer the call count, the distant ones for less (not the Empire's sworn defenders).
    // A crown leads only a war it could carry at least halfway itself: its allies count for no more than its own
    // might (else a small crown with a great friend would take a great crown's heartland on the friend's back).
    const sides = likelySides(s, n, t);
    const own = [n, ...subjectsOf(s, n)];
    const ownMight = sideStrength(s, sides.attackers.filter(x => own.includes(x)), n, t);
    const alliesMight = sideStrength(s, sides.attackers.filter(x => !own.includes(x)), n, t);
    const ratio = (ownMight + Math.min(alliesMight, ownMight)) / Math.max(1, sideStrength(s, sides.defenders, t, n, imperialDefenders(s, n, t)));
    // Crowns follow their history: land they want makes a war worth more and worth more risk.
    const wants = wantsFrom(s, n, t);
    const desire = Math.min(4, wants.reduce((sum, r) => sum + (wanted.get(r) ?? 0), 0));
    // A war for one border region (the claim, or the land it wants most) is a limited one.
    const goal = cb.goal ?? wants.find(r => bordersOwn(s, n, r));
    const limited = !!goal && bordersOwn(s, n, goal);
    // A feared crown holds back: past the Threat at which coalitions form, each 10 more asks a tenth more might.
    let need = REQUIRED_RATIO[pers] * aggression * (1 + Math.max(0, nat.threat - COALITION_JOIN) / 100);
    // Without a reason for war it takes far more might; a great crown, whose every move the others watch, more still.
    if (cb.cb === 'none') need *= NATION[n].tier === 'major' ? 2.5 : 1.8;
    if (limited) need = Math.max(LIMITED_WAR_FLOOR, need * LIMITED_WAR);
    else if (desire) need *= 0.85;
    if (t === s.player && s.settings.difficulty === 'easy') need *= 1.3;
    if (ratio < need) continue;
    // Past three to one, better odds add nothing: the land a crown wants decides which war it picks.
    const score = Math.min(3, ratio) + (goal ? s.regions[goal].dev / 5 : 0) + (nat.rivals.includes(t) ? 1 : 0) + desire * 0.75;
    if (!best || score > best.score) best = { target: t, cb, goal, limited, ratio, need, desire, score };
  }
  return best;
}

/** What the chosen target multiplies the crown's chance by: the edge in might, the reason, the land it wants, the
 * Empire. Pure: no draws. */
function targetFactors(s: GameState, n: NationId, best: WarTarget) {
  const x = best.ratio / best.need; // at least 1: bestWarTarget skips a target it lacks the might for
  const edge = Math.min(EDGE_MAX, EDGE_AT_NEED + EDGE_SLOPE * (x - 1));
  const reason = REASON_WAR[best.cb.cb];
  const want = 1 + WANT_STEP * best.desire;
  const lawful = best.cb.cb === 'claim' || best.cb.cb === 'reconquest';
  const empire = isHreMember(s, n) && isHreMember(s, best.target) ? (lawful ? EMPIRE_LAWFUL : EMPIRE_UNLAWFUL) : 1;
  const factors: WarFactor[] = [
    { key: 'edge', label: 'Might against theirs', x: edge },
    { key: 'reason', label: `Reason for war: ${REASON_LABEL[best.cb.cb]}`, x: reason },
    { key: 'want', label: 'Land it wants there', x: want },
    { key: 'empire', label: 'The Emperor’s peace', x: empire },
  ];
  return { edge, reason, want, empire, product: edge * reason * want * empire, factors };
}

/** A crown's chance of war this month and what makes it up (for its sheet and the tests). Pure: no draws. */
export function warOdds(s: GameState, n: NationId): WarOdds {
  const nat = s.nations[n];
  if (!nat) return { blocked: 'dead', crown: 0, factors: [], yearly: 0, monthly: 0 };
  const mood = warMood(s, nat);
  if (mood.blocked) return { ...mood, yearly: 0, monthly: 0 };
  const best = bestWarTarget(s, nat);
  if (!best) return { ...mood, yearly: 0, monthly: 0 };
  const tf = targetFactors(s, n, best);
  const yearly = mood.crown * tf.product;
  return {
    ...mood,
    factors: [...mood.factors, ...tf.factors],
    best: { ...best, edge: tf.edge, reason: tf.reason, want: tf.want, empire: tf.empire },
    yearly,
    monthly: Math.min(MAX_MONTHLY, yearly / 1200),
  };
}

/**
 * On its roll day a crown weighs war on the neighbour it most wants to fight. One draw, and only when it is past
 * every gate (`forced` stands in for it in tests). The draw is first checked against the most any target could give
 * (MAX_TARGET), so the neighbours are scanned only when a war is possible: the result is the same as scanning first.
 */
function aiWar(s: GameState, nat: Nation, forced?: number): void {
  const n = nat.id;
  const mood = warMood(s, nat);
  if (mood.blocked || mood.crown <= 0) return;
  const r = forced ?? rand(s);
  if (r >= Math.min(MAX_MONTHLY, (mood.crown * MAX_TARGET) / 1200)) return;
  const best = bestWarTarget(s, nat);
  if (!best) return;
  if (r >= Math.min(MAX_MONTHLY, (mood.crown * targetFactors(s, n, best).product) / 1200)) return;
  // No crown marches without a reason: an ambitious one has its clerks forge one first (a year's work) on the land it
  // wants there, or the richest region on the border, and goes to war for it next year if the odds still hold.
  if (best.cb.cb === 'none') {
    const forge = best.goal ?? richestOnBorder(s, n, best.target);
    if (!forge || nat.fabricating || nat.gold < FABRICATE_COST) return;
    nat.gold -= FABRICATE_COST;
    nat.fabricating = { region: forge, done: s.day + FABRICATE_DAYS };
    return;
  }
  const war = declareWar(s, n, best.target, best.cb.cb, best.goal, 'ai');
  if (war && best.limited) war.limited = true;
}

/**
 * Every AI crown weighs war once a calendar month, on a day of its own drawn the month before (`ai.warRoll`; drawn
 * the first time it is missing, in a new game or an older save). Runs daily, after the monthly systems.
 */
export function dailyWarRolls(s: GameState): void {
  if ('__noAI' in s.flags) return;
  for (const nat of Object.values(s.nations)) {
    if (!nat.alive || isHuman(s, nat.id) || isNativeNation(nat.id)) continue;
    if (nat.ai.warRoll === undefined) {
      nat.ai.warRoll = randomDayOfNextMonth(s, s.day);
      continue;
    }
    if (s.day < nat.ai.warRoll) continue;
    nat.ai.warRoll = randomDayOfNextMonth(s, s.day); // the next one first (one draw)
    aiWar(s, nat); // at most one more draw
  }
}

/** The most prosperous region of `t` touching `n`'s land. */
function richestOnBorder(s: GameState, n: NationId, t: NationId): string | undefined {
  let best: Region | undefined;
  for (const r of Object.values(s.regions)) if (r.owner === t && bordersOwn(s, n, r.id) && (!best || r.dev > best.dev)) best = r;
  return best?.id;
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
      // Talk to the player through offers. All but totally beaten, the player gets an ultimatum: terms worth no more
      // than the leverage held, imposed after ULTIMATUM_DAYS. It stands until its day (checkUltimatums).
      if (w.ultimatum) continue;
      if (sc >= ULTIMATUM_SCORE) {
        const terms = fitTerms(s, w, buildDemands(s, w, n, sc), sc);
        if (terms.regions.length || terms.gold) {
          offerPeace(s, nat, w, terms, true);
          continue;
        }
      }
      if (s.offers.some(o => o.kind === 'peace' && o.war === w.id)) continue;
      if (nat.flags[`_offered_${w.id}`] && s.day - nat.flags[`_offered_${w.id}`] < months(8)) continue;
      if (sc >= 35) {
        const terms = buildDemands(s, w, n, sc);
        if (terms.regions.length || terms.gold || (w.cb === 'independence' && side === 0)) offerPeace(s, nat, w, terms);
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
    const white: PeaceTerms = { regions: [], gold: 0, vassalize: false, release: [], white: true, winner: n, loser: enemyLeader };
    // A war neither side can carry to the other is let go after a year.
    if (years_ >= 1 && !inReach(s, w)) {
      makePeace(s, w, white);
      continue;
    }
    if (sc >= 25 || (sc >= 10 && years_ > 3)) {
      const terms = buildDemands(s, w, n, sc);
      // Winning a young war of conquest but the war goal is not yet affordable: fight on for it.
      const goalHeld = side === 0 && !!w.goal && isIn(w.defenders, s.regions[w.goal]?.owner) && !terms.regions.includes(w.goal);
      if (goalHeld && years_ < 3 && sc < 60) continue;
      // A subject winning its war of independence asks for its freedom (a peace that is not white frees it).
      const freedom = w.cb === 'independence' && side === 0;
      const any = terms.regions.length > 0 || terms.gold > 0 || terms.vassalize || freedom;
      if (any && peaceAcceptance(s, w, terms, enemyLeader).accept) makePeace(s, w, terms);
      else if (sc >= 60 && (terms.regions.length || terms.vassalize || freedom)) makePeace(s, w, terms); // forced
      else if (!any && years_ >= 1) {
        // Winning with nothing in reach to ask for: whatever gold the loser can spare, or a white peace.
        const gold = Math.min(sc * 10, Math.floor(s.nations[enemyLeader].gold / 2));
        const settle = gold >= 10 ? { ...terms, gold } : white;
        if (peaceAcceptance(s, w, settle, enemyLeader).accept) makePeace(s, w, settle);
      }
    } else if (Math.abs(sc) < 15 && years_ > 4) {
      if (peaceAcceptance(s, w, white, enemyLeader).accept && peaceAcceptance(s, w, white, n).accept) makePeace(s, w, white);
    }
  }
}

/**
 * Can either side of a war get at the other: fighting on the other's land already, a road (or strait) between their
 * lands, or ships to carry an army from a coast of its own to an enemy coast?
 */
function inReach(s: GameState, w: War): boolean {
  const lands: [Region[], Region[]] = [[], []];
  for (const r of Object.values(s.regions)) {
    const side = isIn(w.attackers, r.owner) ? 0 : isIn(w.defenders, r.owner) ? 1 : null;
    if (side === null) continue;
    if (r.controller !== r.owner && isIn(side === 0 ? w.defenders : w.attackers, r.controller)) return true;
    lands[side].push(r);
  }
  for (const x of lands[0]) for (const y of lands[1]) if (hops(x.id, y.id) < 99) return true;
  const coast = (rs: Region[]) => rs.some(r => charted(s, r.id) && GRAPH[r.id].some(e => e.kind === 'coast'));
  for (const i of [0, 1] as const) {
    const ships = (i === 0 ? w.attackers : w.defenders).some(x => transportCapacity(fleetsOf(s, x)) > 0);
    if (ships && coast(lands[i]) && coast(lands[1 - i])) return true;
  }
  return false;
}

function offerPeace(s: GameState, nat: Nation, w: War, terms: PeaceTerms, ultimatum = false): void {
  nat.flags[`_offered_${w.id}`] = s.day;
  if (ultimatum) sendUltimatum(s, w, nat.id, terms);
  else {
    s.offers.push({ id: `o${++s.seq}`, kind: 'peace', from: nat.id, war: w.id, day: s.day, terms });
    log(s, 'peace', `${NATION[nat.id].name} sends a peace proposal.`, { important: true });
  }
  requestPause(s, ultimatum ? 'ultimatum' : 'peaceOffer');
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

// The margins below compare how long each side would hold out (the forecast's ratio), which grows about as the
// square of the odds on even ground: 1.5 is roughly a quarter more might, 2 two fifths more, 3 three quarters more.
/** Attack only a fight the forecast gives us clearly: we would hold out this many times longer than they would. */
const ATTACK_MARGIN = 1.5;
/** An enemy stack that would beat us this clearly, attacking where we stand, is a danger: join up or fall back. */
const DANGER_MARGIN = 2;
/** A stack the nearest enemy stack in reach would beat this clearly gathers with our other armies before it walks
 * out alone. */
const ALONE_MARGIN = 3;
/** How far (days of march) the AI looks for enemies to fight, and for enemies too strong to walk out against. */
const REACH_DAYS = 40;
/** How far a stack too weak to walk out alone goes to join a bigger one (farther, and it would leave its land open). */
const GATHER_DAYS = 20;

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
  // Across the ocean with enemies on the same shore, an army stays there to fight rather than sail home mid-war.
  const shoreFight = !isSea(a.node) && !!REGION[a.node]?.nw && Object.values(s.armies).some(o => !o.retreating && !isSea(o.node) && armiesHostile(s, a, o) && hops(o.node, a.node) < 99);
  const tree = pathTree(s, a, { maxDays: 90, land: shoreFight });
  const myStrength = armyStrength(s, a);
  const hostileArmies = Object.values(s.armies).filter(o => o.id !== a.id && !o.retreating && armiesHostile(s, a, o) && !isSea(o.node));

  // 1) Danger: an enemy stack nearby that would beat us attacking here → join up with our other armies if together
  // we would hold, otherwise fall back toward friends or a fort.
  const here = [a, ...Object.values(s.armies).filter(o => o.id !== a.id && o.node === a.node && isIdle(o) && o.owner !== REBELS && n !== REBELS && friendlyTo(s, o.owner, n))];
  const threats = hostileArmies
    .filter(o => !o.battle && (tree.dist.get(o.node) ?? 999) <= 20)
    .map(o => ({ o, f: forecast(s, stackOf(s, o, a), here, a.node) }))
    .filter(x => x.f.winner === 0 && x.f.ratio >= DANGER_MARGIN)
    .sort((x, y) => y.f.ratio - x.f.ratio);
  if (threats.length && !a.battle) {
    const friends = Object.values(s.armies).filter(o => o.owner === n && !here.includes(o) && !o.battle && !o.retreating && (tree.dist.get(o.node) ?? 999) <= 15);
    if (friends.length && forecast(s, stackOf(s, threats[0].o, a), [...here, ...friends], a.node).winner === 1) {
      mergeWithNearby(s, a, tree);
      return;
    }
    const safe = safeSpot(s, a, tree, threats.map(x => x.o));
    if (safe && safe !== a.node && pathFromTree(tree, a.node, safe)) {
      move(s, a, safe, tree); // keeps the march going if the first step is the same
      return;
    }
  }
  // 2) Attack a stack the forecast says we beat clearly (rebels count; terrain, rivers, generals and morale all
  // weigh), but not far off; an army besieging its war goal only turns on enemies who come close (a relief army),
  // never chases off after others.
  const goals = new Set(Object.values(s.wars).filter(w => sideOf(w, n) !== null).map(w => w.goal));
  const onGoal = goals.has(a.node) && !!s.regions[a.node]?.siege && s.regions[a.node].siege!.by === n;
  // Our other stacks standing here join in when the fight needs them (and only then: one great stack starves and
  // besieges one city at a time).
  const mates = a.path.length ? [] : armiesOf(s, n).filter(o => o.id !== a.id && o.node === a.node && isIdle(o));
  const matesStrength = mates.reduce((t, x) => t + armyStrength(s, x), 0);
  const clear = (x: Odds) => x.win && x.ratio >= ATTACK_MARGIN;
  // Enemy stacks standing in a region, and whether the road to a region runs through one we would not clearly beat
  // (an army passing through fights whoever stands there).
  const guards = new Map<NodeId, Army>();
  for (const o of hostileArmies) if (isIdle(o)) guards.set(o.node, o);
  const roadBlocked = (to: NodeId) => {
    const res = pathFromTree(tree, a.node, to);
    if (!res) return true;
    for (let i = 0; i < res.path.length - 1; i++) {
      const g = guards.get(res.path[i]);
      if (g && !clear(attackOdds(s, [a], g, i ? res.path[i - 1] : a.node))) return true;
    }
    return false;
  };
  let bestTarget: { node: NodeId; score: number; together: boolean } | null = null;
  for (const o of hostileArmies) {
    const d = tree.dist.get(o.node);
    if (d === undefined || d > (onGoal ? 10 : REACH_DAYS)) continue;
    const theirs = stackOf(s, o, a).reduce((t, x) => t + armyStrength(s, x), 0);
    if (theirs > (myStrength + matesStrength) * 3) continue; // hopeless whatever the ground: no need to ask
    const from = tree.prev.get(o.node);
    const together = !clear(attackOdds(s, [a], o, from));
    if (together && (!mates.length || !clear(attackOdds(s, [a, ...mates], o, from)))) continue;
    const score = theirs / (d + 5);
    if (bestTarget && score <= bestTarget.score) continue;
    if (roadBlocked(o.node)) continue;
    bestTarget = { node: o.node, score, together };
  }
  if (bestTarget) {
    if (bestTarget.together) for (const m of mates) mergeArmies(s, a, m);
    move(s, a, bestTarget.node, tree);
    return;
  }
  // 3) Gather: in our own (or friendly) land, a stack the nearest enemy stack in reach would crush does not walk out
  // alone: it joins a bigger army of ours close by, or holds its ground (and falls back if the enemy comes, above).
  if (!a.battle && friendlyTo(s, n, s.regions[a.node]?.controller ?? null)) {
    let nearest: Army | null = null;
    let nearestDays = REACH_DAYS + 1;
    for (const o of hostileArmies) {
      const d = tree.dist.get(o.node);
      if (d !== undefined && d < nearestDays) {
        nearestDays = d;
        nearest = o;
      }
    }
    const f = nearest && forecast(s, stackOf(s, nearest, a), [a], a.node);
    if (f && f.winner === 0 && f.ratio >= ALONE_MARGIN) {
      if (armiesOf(s, n).some(o => o.id !== a.id && armyRegs(o) >= armyRegs(a) && (tree.dist.get(o.node) ?? 999) < GATHER_DAYS)) mergeWithNearby(s, a, tree, GATHER_DAYS);
      else a.path = [];
      return;
    }
  }
  // 4) Besiege: enemy-held regions we can reach, preferring the war goal, low forts and our own lost land; not
  // where, or past where, an enemy stack stands that the forecast says we would not beat.
  const regs = armyRegs(a);
  let bestSiege: { node: NodeId; score: number } | null = null;
  const takenBy = new Set(Object.values(s.armies).filter(x => x.owner === n && x.id !== a.id).map(x => (x.path.length ? x.path[x.path.length - 1] : x.node)));
  const sieges: { node: NodeId; score: number }[] = [];
  for (const r of Object.values(s.regions)) {
    if (!controllerHostile(s, n, r)) continue;
    const d = tree.dist.get(r.id);
    if (d === undefined) continue;
    if (regs < minSiegeRegs(r.fort)) continue;
    if (takenBy.has(r.id) && r.id !== a.node) continue;
    const guard = r.id !== a.node && guards.get(r.id);
    if (guard && !clear(attackOdds(s, [a], guard, tree.prev.get(r.id)))) continue;
    const ownLand = r.owner === n ? 25 : 0;
    const goal = goals.has(r.id) ? 30 : 0;
    sieges.push({ node: r.id, score: (r.dev * 2 + ownLand + goal + (r.fort === 0 ? 6 : 0) - r.fort * 4) / (d + 8) });
  }
  // Raids: an enemy's colony being settled on this shore (no army sails off just to raid), with nobody of theirs
  // (or their friends') there to defend it; the army stands in it and the settlers die month by month (colonies.ts).
  if (n !== REBELS) {
    for (const r of Object.values(s.regions)) {
      const c = r.colony;
      if (!c || !hostile(s, n, c.by) || hops(a.node, r.id) >= 99) continue;
      const d = tree.dist.get(r.id);
      if (d === undefined || (takenBy.has(r.id) && r.id !== a.node)) continue;
      if (Object.values(s.armies).some(o => o.node === r.id && o.owner !== REBELS && (o.owner === c.by || friendlyTo(s, c.by, o.owner)))) continue;
      sieges.push({ node: r.id, score: (3 + c.settlers / 250) / (d + 8) });
    }
  }
  // The best siege whose road is open.
  for (const x of sieges.sort((p, q) => q.score - p.score)) {
    if (x.node === a.node || !roadBlocked(x.node)) {
      bestSiege = x;
      break;
    }
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
  // 5) Nothing to do. With enemies in reach, join the biggest friendly army; with the war out of reach
  // (overseas, say), wait as in peacetime, spread out so the troops don't starve.
  if (hostileArmies.some(o => tree.dist.has(o.node))) mergeWithNearby(s, a, tree);
  else peaceStation(s, a);
}

/** Standing still: not marching, retreating or fighting. */
const isIdle = (o: Army) => !o.path.length && !o.retreating && !o.battle;

/** The stack `o` stands in: itself and the armies beside it that are hostile to `me` too, standing or marching out
 * (a battle there catches both: joinOrStartBattle). */
function stackOf(s: GameState, o: Army, me: Army): Army[] {
  return [o, ...Object.values(s.armies).filter(x => x.id !== o.id && x.node === o.node && !x.retreating && !x.battle && armiesHostile(s, me, x))];
}

/** A fight seen from our side: do we win, and how many times longer would we hold out than they would. */
interface Odds {
  win: boolean;
  ratio: number;
  forecast: Forecast;
}

/** The odds if `ours` march on `target` (and whoever stands with it) from `from`, or join a battle already raging
 * around it, on the other side. */
export function attackOdds(s: GameState, ours: Army[], target: Army, from?: NodeId): Odds {
  const b = target.battle ? s.battles[target.battle] : undefined;
  if (b) {
    const theirs = b.sides[0].armies.includes(target.id) ? 0 : 1;
    // An army hostile to both sides could never join (joinOrStartBattle): no odds worth marching for.
    const other = b.sides[1 - theirs].armies.map(id => s.armies[id]).filter(Boolean);
    if (ours[0] && other.some(o => armiesHostile(s, ours[0], o))) return { win: false, ratio: 0, forecast: forecast(s, ours, [target], b.node) };
    const them = b.sides[theirs].armies.map(id => s.armies[id]).filter(Boolean);
    const us = [...b.sides[1 - theirs].armies.map(id => s.armies[id]).filter(Boolean), ...ours];
    const river = b.river ? s.armies[b.sides[0].armies[0]]?.from : undefined;
    const [att, def] = theirs === 1 ? [us, them] : [them, us];
    const f = forecast(s, att, def, b.node, river, !!b.pitched);
    const side = theirs === 1 ? 0 : 1;
    return { win: f.winner === side, ratio: side === 0 ? f.ratio : 1 / f.ratio, forecast: f };
  }
  const f = forecast(s, ours, stackOf(s, target, ours[0]), target.node, from);
  return { win: f.winner === 0, ratio: f.ratio, forecast: f };
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
  const friendsAt = new Map<NodeId, number>();
  for (const id in s.armies) {
    const o = s.armies[id];
    if (o.owner === a.owner && o.id !== a.id) friendsAt.set(o.node, (friendsAt.get(o.node) ?? 0) + armyStrength(s, o));
  }
  for (const [node, d] of tree.dist) {
    if (isSea(node) || d > 40) continue;
    const reg = s.regions[node];
    if (!friendlyTo(s, a.owner, reg.controller)) continue;
    const near = danger.reduce((t, o) => t + Math.max(0, 25 - (pathDistanceGuess(o.node, node) * 8)), 0);
    const friends = friendsAt.get(node) ?? 0;
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

function mergeWithNearby(s: GameState, a: Army, tree: ReturnType<typeof pathTree>, maxDays = 40): void {
  const own = Object.values(s.armies).filter(o => o.owner === a.owner && o.id !== a.id && !o.battle && !o.retreating);
  const here = own.find(o => o.node === a.node && !o.path.length && !a.path.length);
  if (here) {
    const [big, small] = armyRegs(here) >= armyRegs(a) ? [here, a] : [a, here];
    mergeArmies(s, big, small);
    return;
  }
  const biggest = own.filter(o => tree.dist.has(o.node) && (tree.dist.get(o.node) ?? 999) < maxDays).sort((x, y) => armyRegs(y) - armyRegs(x))[0];
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
  // Regiments of ours in (or marching to) each region.
  const regsAt = new Map<NodeId, number>();
  for (const id in s.armies) {
    const o = s.armies[id];
    if (o.owner !== a.owner) continue;
    const at = o.path.length ? o.path[o.path.length - 1] : o.node;
    regsAt.set(at, (regsAt.get(at) ?? 0) + armyRegs(o));
  }
  const here = (node: NodeId) => regsAt.get(node) ?? 0;
  // Send as many regiments as fit to the nearest region of ours with food to spare.
  const spread = (all: boolean) => {
    let best: { to: NodeId; room: number; d: number } | null = null;
    const tree = pathTree(s, a, { maxDays: 60 });
    for (const [node, d] of tree.dist) {
      if (node === home || node === a.node || isSea(node) || s.regions[node]?.owner !== a.owner) continue;
      const room = supplyLimit(s, node, a.owner) - here(node);
      if (room >= 3 && (!best || d < best.d)) best = { to: node, room, d };
    }
    if (!best) return;
    const share = all ? 1 : Math.min(1, best.room / Math.max(1, armyRegs(a)));
    if (share >= 1) {
      orderMove(s, a, best.to);
      return;
    }
    const b = splitArmy(s, a, { inf: Math.floor(a.regs.inf.n * share), cav: Math.floor(a.regs.cav.n * share), art: Math.floor(a.regs.art.n * share) });
    if (b) orderMove(s, b, best.to);
  };
  // Across the ocean with no road home, a garrison stays on that shore (two regiments, or one for every two regions
  // of ours there); the rest sail home if we have the ships, or disband as in peacetime.
  if (a.node !== home && !isSea(a.node) && hops(a.node, home) >= 99) {
    const there = Object.values(s.armies)
      .filter(o => o.owner === a.owner && !isSea(o.node) && hops(o.node, a.node) < 99)
      .reduce((t, o) => t + armyRegs(o), 0);
    const garrison = Math.max(2, Math.ceil(ownedRegions(s, a.owner).filter(r => hops(r.id, a.node) < 99).length / 2));
    const excess = Math.min(armyRegs(a), there - garrison);
    if (excess > 0) {
      let k = excess;
      const take = { inf: 0, cav: 0, art: 0 };
      for (const t of ['inf', 'cav', 'art'] as const) {
        take[t] = Math.min(a.regs[t].n, k);
        k -= take[t];
      }
      const part = excess >= armyRegs(a) ? a : splitArmy(s, a, take);
      if (part && !orderMove(s, part, home)) {
        nat.manpower += Math.round(armyMen(part) * (1 - part.mercs / Math.max(1, armyRegs(part))) * 0.5);
        if (part.general && !part.general.isRuler) nat.generals.push(part.general);
        delete s.armies[part.id];
      }
      if (part === a) return;
    }
  }
  if (a.node !== home && !isSea(a.node)) {
    // Stay in our own land while it can feed us; otherwise go home (now and then, also to regroup).
    const reg = s.regions[a.node];
    const ok = reg && reg.owner === a.owner && here(a.node) <= supplyLimit(s, a.node, a.owner);
    if (!ok || chance(s, 0.05)) {
      // Stranded overseas with no ships home: find a region of ours that can feed the troops instead.
      if (!orderMove(s, a, home) && !ok) spread(false);
    }
  } else if (armyRegs(a) > supplyLimit(s, home, a.owner) * 1.2) {
    spread(false);
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
  const bySea = new Map<string, typeof s.fleets[string][]>();
  for (const g of Object.values(s.fleets)) {
    const l = bySea.get(g.sea);
    if (l) l.push(g);
    else bySea.set(g.sea, [g]);
  }
  for (const f of Object.values(s.fleets)) {
    if (isHuman(s, f.owner) || f.path.length || f.retreating) continue;
    const n = f.owner;
    const enemies = enemiesOf(s, n);
    if (!enemies.size) continue;
    const myPower = fleetPower(s, f);
    const hopsTo = seaDistances(f.sea, !!s.discovery);
    let best: { sea: string; score: number } | null = null;
    for (const [sea, d] of hopsTo) {
      const enemyPower = (bySea.get(sea) ?? []).filter(g => enemies.has(g.owner)).reduce((t, g) => t + fleetPower(s, g), 0);
      if (enemyPower > myPower * 0.8) continue;
      let coast = 0;
      for (const id of SEA_COAST[sea] ?? []) {
        const r = s.regions[id];
        if (r.controller && enemies.has(r.controller)) coast += r.dev;
      }
      if (!coast) continue;
      const score = coast / (d + 1);
      if (!best || score > best.score) best = { sea, score };
    }
    if (best && best.sea !== f.sea) {
      const route = findSeaPath(f.sea, best.sea, !!s.discovery);
      if (route) f.path = route;
    }
  }
}


export const debugAI = { armyAI, aiWar, warOdds, aiEconomy, aiPeace, aiGenerals, aiColonies };
