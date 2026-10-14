/**
 * Everything the player can do, validated. Each command returns { ok, msg } so the UI can show a toast.
 * Commands mutate the state in place; the UI re-renders from the store afterwards.
 */
import { ADVANCE, GRAPH, MAP_REGION, POLICY, UNITS, isSea, nationName, regionName } from './content';
import { COLONY_COST, COLONY_GUARD_UPKEEP, COLONY_UPKEEP, EXPEDITION_MONTHS, GROW_SETTLERS, MAX_GROWN_DEV, abandonColony, charted, sendExpedition, setGuard, setPolicy, startColony, startGrowing, stopGrowing as stopGrowingColony } from './colonies';
import {
  CONVERT_DAYS,
  FABRICATE_COST,
  FABRICATE_DAYS,
  LOAN_SIZE,
  RECRUIT_DAYS,
  SHIP_DAYS,
  convertCost,
  coreCost,
  devCost,
  fortCost,
  mercCost,
  shipCost,
  stabilityCost,
  unitCost,
} from './economy';
import { doDiplomacy, type DiploAction, addOpinion } from './diplomacy';
import { answerEvent } from './events';
import { canProclaim, crownTitle, proclaim } from './crowns';
import { log } from './log';
import { addRegiments, findPath, mergeArmies, orderMove, splitArmy } from './military';
import { completeMission } from './missions';
import { findSeaPath } from './navy';
import { attackOdds } from './forecast';
import { siegeInfo, storm, stormOdds } from './siege';
import {
  allied,
  armyMen,
  MAX_MARRIAGES,
  armyRegs,
  enemyArmyAt,
  invalidateMods,
  marriageCount,
  maxMorale,
  ownedRegions,
  sideOf,
  warBetween,
} from './queries';
import { excommunicate, sanctionTargets, SANCTION_COST } from './religion';
import { newGeneral, rulerAsGeneral, starBonus } from './rulers';
import { UNIVERSITY_MIN_DEV, UNIVERSITY_SCIENCE, advanceFor, availableAdvances, policySlots, universityCost, unlocked } from './science';
import { releaseSubject } from './territory';
import type { Army, GameState, NativePolicy, NodeId, PeaceTerms, ShipType, UnitType } from './types';
import { clamp, formatDate, months } from './util';
import {
  ULTIMATUM_SCORE,
  canDeclareWar,
  casusBelli,
  declareWar,
  joinWar,
  leaveWar,
  makePeace,
  offersOwnLand,
  peaceCost,
  proposalAnswer,
  refuseCall,
  scoreFor,
  ultimatumTerms,
} from './war';

export interface Result {
  ok: boolean;
  msg: string;
}
const ok = (msg: string): Result => ({ ok: true, msg });
const no = (msg: string): Result => ({ ok: false, msg });

const me = (s: GameState) => s.nations[s.player];
function pay(s: GameState, gold: number): boolean {
  const n = me(s);
  if (n.gold < gold) return false;
  n.gold -= gold;
  return true;
}

// ---------------------------------------------------------------- armies

export function moveArmy(s: GameState, armyId: string, to: NodeId): Result {
  const a = s.armies[armyId];
  if (!a || a.owner !== s.player) return no('Not your army.');
  if (a.battle) return no('The army is in battle.');
  if (a.retreating) return no('The army is retreating.');
  if (isSea(to)) return no('Armies need a destination on land.');
  if (!charted(s, to, s.player)) return no('These lands are uncharted. Send an expedition west first (Realm menu, Colonies).');
  const res = orderMove(s, a, to);
  if (!res) return no(`No route to ${regionName(to)}. You may need military access, transports, or to besiege a fort first.`);
  const odds = res.days ? attackOdds(s, a.id) : null;
  return ok(res.days ? `Marching to ${regionName(to)}: ${res.days} days.${odds ? ` Battle at ${regionName(odds.node)}: ${odds.verdict}.` : ''}` : 'Holding position.');
}

export const previewMove = (s: GameState, armyId: string, to: NodeId) => {
  const a = s.armies[armyId];
  return a ? findPath(s, a, to) : null;
};

export function stopArmy(s: GameState, armyId: string): Result {
  const a = s.armies[armyId];
  if (!a || a.owner !== s.player || a.retreating) return no('Cannot stop now.');
  // Finish the edge being walked so the army never ends up between regions.
  a.path = a.path.slice(0, a.progress > 0 ? 1 : 0);
  if (!a.path.length) {
    a.progress = 0;
    a.edgeDays = 0;
  }
  return ok('Halting.');
}

export function mergeAt(s: GameState, armyId: string): Result {
  const a = s.armies[armyId];
  if (!a || a.owner !== s.player) return no('Not your army.');
  const others = Object.values(s.armies).filter(o => o.owner === s.player && o.id !== a.id && o.node === a.node && !o.path.length && !o.battle && !o.retreating);
  if (!others.length) return no('No other army here to merge with.');
  if (a.path.length) return no('Stop the army first.');
  for (const o of others) mergeArmies(s, a, o);
  return ok(`Merged ${others.length + 1} armies: ${armyRegs(a)} regiments.`);
}

export function split(s: GameState, armyId: string, take: Record<UnitType, number>): Result {
  const a = s.armies[armyId];
  if (!a || a.owner !== s.player) return no('Not your army.');
  if (a.path.length) return no('Stop the army before splitting it.');
  const b = splitArmy(s, a, take);
  return b ? ok(`Split off the ${b.name}.`) : no('Choose some, but not all, regiments to split off.');
}

export function splitHalf(s: GameState, armyId: string): Result {
  const a = s.armies[armyId];
  if (!a) return no('No army.');
  const take = { inf: Math.floor(a.regs.inf.n / 2), cav: Math.floor(a.regs.cav.n / 2), art: Math.floor(a.regs.art.n / 2) };
  if (take.inf + take.cav + take.art === 0) {
    if (a.regs.inf.n >= 2) take.inf = 1;
    else return no('Too small to split.');
  }
  return split(s, armyId, take);
}

/**
 * What disbanding an army does, for the confirmation before it: half its men (not the mercenaries') go back to the
 * levies, its mercenary regiments are let go, and a general it has returns to your pool (a ruler, to court).
 */
export function disbandOutcome(a: Army): { levies: number; mercs: number; general?: { name: string; isRuler: boolean } } {
  const levies = Math.round(armyMen(a) * (1 - a.mercs / Math.max(1, armyRegs(a))) * 0.5);
  return { levies, mercs: a.mercs, ...(a.general ? { general: { name: a.general.name, isRuler: !!a.general.isRuler } } : {}) };
}

export function disband(s: GameState, armyId: string): Result {
  const a = s.armies[armyId];
  if (!a || a.owner !== s.player) return no('Not your army.');
  if (a.battle) return no('Not in the middle of a battle!');
  const back = disbandOutcome(a).levies;
  me(s).manpower += back;
  if (a.general && !a.general.isRuler) me(s).generals.push(a.general);
  delete s.armies[armyId];
  return ok(`The ${a.name} is disbanded; ${back.toLocaleString()} men return home.`);
}

export const GENERAL_COST = 50;
export function hireGeneral(s: GameState): Result {
  if (!pay(s, GENERAL_COST)) return no(`Hiring a general costs ${GENERAL_COST} gold.`);
  const g = newGeneral(s, s.player);
  me(s).generals.push(g);
  return ok(`${g.name} joins your service: a ${g.stars}-star general (+${Math.round(starBonus(g) * 100)}% to all the army does).`);
}

export function assignGeneral(s: GameState, armyId: string, generalId: string | 'ruler' | null): Result {
  const a = s.armies[armyId];
  const nat = me(s);
  if (!a || a.owner !== s.player) return no('Not your army.');
  if (a.general && !a.general.isRuler) nat.generals.push(a.general);
  a.general = undefined;
  if (generalId === null) return ok('The army has no general.');
  if (generalId === 'ruler') {
    for (const o of Object.values(s.armies)) if (o.owner === s.player && o.general?.isRuler) o.general = undefined;
    a.general = rulerAsGeneral(s, s.player);
    return ok(`${nat.ruler.name} takes command in person. If they fall, the heir takes the throne.`);
  }
  const g = nat.generals.find(x => x.id === generalId);
  if (!g) return no('No such general.');
  nat.generals = nat.generals.filter(x => x.id !== generalId);
  a.general = g;
  return ok(`${g.name} now commands the ${a.name}.`);
}

export function recruit(s: GameState, region: string, type: UnitType, count = 1): Result {
  const nat = me(s);
  const reg = s.regions[region];
  if (!reg || reg.owner !== s.player || reg.controller !== s.player) return no('You can only recruit in regions you hold.');
  if (type === 'art' && !unlocked(s, s.player, 'artillery')) return no(`Artillery needs ${advanceFor('artillery').name} (see Science).`);
  const cost = unitCost(s, s.player, type) * count;
  if (nat.manpower < 1000 * count) return no(`Not enough levies (${count * 1000} men needed).`);
  if (!pay(s, cost)) return no(`Not enough gold (${cost} needed).`);
  nat.manpower -= 1000 * count;
  for (let i = 0; i < count; i++) nat.recruiting.push({ type, region, done: s.day + RECRUIT_DAYS });
  return ok(`${count} ${type === 'inf' ? 'infantry' : type === 'cav' ? 'cavalry' : 'artillery'} regiment${count > 1 ? 's' : ''} will be ready in ${RECRUIT_DAYS} days.`);
}

/** Why mercenaries cannot be hired in this region now (null: they can). */
export function mercBlocked(s: GameState, region: string): string | null {
  const reg = s.regions[region];
  if (!reg || reg.controller !== s.player) return 'Mercenaries muster in a region you hold.';
  if (enemyArmyAt(s, s.player, region)) return `An enemy army stands in ${regionName(region)}: hire mercenaries somewhere safe.`;
  return null;
}

export function hireMercenaries(s: GameState, region: string, regs: number): Result {
  const why = mercBlocked(s, region);
  if (why) return no(why);
  const cost = mercCost(s, s.player, regs);
  if (!pay(s, cost)) return no(`A company of ${regs} regiments costs ${cost} gold.`);
  const cav = Math.round(regs / 4);
  const a = addRegiments(s, s.player, region, { inf: regs - cav, cav }, regs);
  a.morale = maxMorale(s, s.player);
  return ok(`${regs} mercenary regiments join you at ${regionName(region)}.`);
}

export function setArmyMode(s: GameState, mode: 'peace' | 'war'): Result {
  me(s).armyMode = mode;
  return ok(mode === 'war' ? 'Wartime pay: full upkeep, fast reinforcement.' : 'Peacetime pay: half upkeep, slow reinforcement.');
}

// ---------------------------------------------------------------- regions

export function develop(s: GameState, region: string): Result {
  const reg = s.regions[region];
  if (!reg || reg.owner !== s.player) return no('Not your region.');
  if (reg.dev >= 10) return no('Already as prosperous as it can be.');
  if (reg.controller !== s.player) return no('The region is occupied.');
  const cost = devCost(s, reg);
  if (!pay(s, cost)) return no(`Investing here costs ${cost} gold.`);
  reg.dev++;
  reg.devBought++;
  return ok(`${regionName(region)} grows to prosperity ${reg.dev}.`);
}

export function buildFort(s: GameState, region: string): Result {
  const reg = s.regions[region];
  if (!reg || reg.owner !== s.player) return no('Not your region.');
  if (reg.fort >= 3) return no('The fortress is as strong as it gets.');
  if (reg.controller !== s.player) return no('The region is occupied.');
  const cost = fortCost(s, reg);
  if (!pay(s, cost)) return no(`Building costs ${cost} gold.`);
  reg.fort++;
  return ok(`${regionName(region)}'s fortress is now level ${reg.fort}.`);
}

export function makeCore(s: GameState, region: string): Result {
  const reg = s.regions[region];
  if (!reg || reg.owner !== s.player) return no('Not your region.');
  if (reg.cores.includes(s.player)) return no('Already integrated.');
  const cost = coreCost(s, reg);
  if (!pay(s, cost)) return no(`Integrating it costs ${cost} gold.`);
  reg.cores.push(s.player);
  return ok(`${regionName(region)} is now integrated: full taxes and levies.`);
}

export function convertRegion(s: GameState, region: string): Result {
  const reg = s.regions[region];
  const nat = me(s);
  if (!reg || reg.owner !== s.player) return no('Not your region.');
  if (reg.faith === nat.faith) return no('They already share your faith.');
  if (reg.converting) return no('Missionaries are already at work.');
  const cost = convertCost(s, reg);
  if (!pay(s, cost)) return no(`Missionaries cost ${cost} gold.`);
  reg.converting = { to: nat.faith, done: s.day + CONVERT_DAYS };
  return ok(`Missionaries set out for ${regionName(region)}. Unrest rises while they work (12 months).`);
}

export function fabricateClaim(s: GameState, region: string): Result {
  const nat = me(s);
  const reg = s.regions[region];
  if (!reg || reg.owner === s.player) return no('Pick a region you don’t own.');
  if (region in nat.claims) return no('You already have a claim there.');
  if (nat.fabricating) return no(`Your clerks are busy with ${regionName(nat.fabricating.region)}.`);
  const near = GRAPH[region].some(e => (e.kind === 'land' || e.kind === 'strait') && s.regions[e.to]?.owner === s.player);
  if (!near) return no('You can only forge claims on regions next to your own.');
  if (!pay(s, FABRICATE_COST)) return no(`Forging a claim costs ${FABRICATE_COST} gold.`);
  nat.fabricating = { region, done: s.day + FABRICATE_DAYS };
  return ok(`Your clerks start digging through old charters about ${regionName(region)} (1 year).`);
}

export function moveCapital(s: GameState, region: string): Result {
  const reg = s.regions[region];
  if (!reg || reg.owner !== s.player || !reg.cores.includes(s.player)) return no('Your capital must be an integrated region you own.');
  const cost = 100;
  if (!pay(s, cost)) return no(`Moving the court costs ${cost} gold.`);
  me(s).capital = region;
  return ok(`The court moves to ${regionName(region)}.`);
}

// ---------------------------------------------------------------- realm

export function boostStability(s: GameState): Result {
  const nat = me(s);
  if (nat.stability >= 3) return no('Order is already at its peak.');
  const cost = stabilityCost(s, s.player);
  if (!pay(s, cost)) return no(`It costs ${cost} gold to win over the estates.`);
  nat.stability++;
  return ok(`Order rises to ${nat.stability > 0 ? '+' : ''}${nat.stability}.`);
}

// ---------------------------------------------------------------- science

export function setResearch(s: GameState, id: string | null): Result {
  const nat = me(s);
  if (id === null) {
    nat.researching = null;
    return ok('Your scholars wait for a new subject.');
  }
  if (!availableAdvances(s, s.player).some(a => a.id === id)) return no('Your scholars cannot study that yet.');
  nat.researching = id;
  return ok(`Your scholars turn to ${ADVANCE[id].name}.`);
}

export function setScienceFunding(s: GameState, on: boolean): Result {
  me(s).scienceFunding = on ? 1 : 0;
  return ok(on ? 'You fund your scholars: a tenth of your income for a quarter more science.' : 'You stop funding your scholars.');
}

export function foundUniversity(s: GameState, region: string): Result {
  const reg = s.regions[region];
  if (!reg || reg.owner !== s.player) return no('Not your region.');
  if (reg.university) return no('It already has a university.');
  if (reg.dev < UNIVERSITY_MIN_DEV) return no(`A university needs prosperity ${UNIVERSITY_MIN_DEV}.`);
  const cost = universityCost(s, s.player);
  if (!pay(s, cost)) return no(`A university costs ${cost} gold.`);
  reg.university = true;
  return ok(`A university opens in ${regionName(region)}: +${UNIVERSITY_SCIENCE} science a month.`);
}

export function takeLoan(s: GameState): Result {
  const nat = me(s);
  if (nat.loans >= 10) return no('No banker will lend you more.');
  nat.loans++;
  nat.gold += LOAN_SIZE;
  return ok(`You borrow ${LOAN_SIZE} gold at 5% a year.`);
}

export function repayLoan(s: GameState): Result {
  const nat = me(s);
  if (!nat.loans) return no('You have no loans.');
  if (!pay(s, LOAN_SIZE)) return no(`Repaying a loan takes ${LOAN_SIZE} gold.`);
  nat.loans--;
  return ok('Loan repaid.');
}

export function choosePolicy(s: GameState, id: string, replace?: string): Result {
  const nat = me(s);
  const p = POLICY[id];
  if (!p) return no('Unknown policy.');
  if (p.requires && !nat.advances.includes(p.requires)) return no(`${p.name} needs ${ADVANCE[p.requires].name}.`);
  if (nat.policies.includes(id)) return no('Already adopted.');
  const slots = policySlots(nat);
  if (replace) {
    if (!nat.policies.includes(replace)) return no('Nothing to replace.');
    if (nat.policySwappedEra === slots) return no('You can only swap a policy once until your next policy slot.');
    nat.policies = nat.policies.filter(x => x !== replace);
    nat.policySwappedEra = slots;
    nat.stability = clamp(nat.stability - 1, -3, 3);
  } else if (nat.policies.length >= slots) return no('All policy slots are full. Swap one instead.');
  nat.policies.push(id);
  if (id === 'tax_reform') nat.modifiers.push({ id: 'tax_reform_unrest', name: 'Tax Reform grumbling', mods: { unrest: 1 }, until: s.day + months(60) });
  invalidateMods();
  return ok(`Policy adopted: ${p.name}${replace ? ' (order −1)' : ''}.`);
}

// ---------------------------------------------------------------- navy

export function buildShip(s: GameState, region: string, type: ShipType): Result {
  const nat = me(s);
  const reg = s.regions[region];
  if (!reg || reg.controller !== s.player) return no('Ships are built in a port you hold.');
  const sea = MAP_REGION[region].seas[0];
  if (!sea) return no(`${regionName(region)} has no coast.`);
  const needs = UNITS.ships[type].advance;
  if (needs && !nat.advances.includes(needs)) return no(`${UNITS.ships[type].name}s need ${ADVANCE[needs].name} (see Science).`);
  const cost = shipCost(s, s.player, type);
  if (!pay(s, cost)) return no(`A ${UNITS.ships[type].name.toLowerCase()} costs ${cost} gold.`);
  nat.shipyard.push({ type, region, sea, done: s.day + SHIP_DAYS });
  return ok(`A ${UNITS.ships[type].name.toLowerCase()} is laid down at ${regionName(region)} (${SHIP_DAYS} days).`);
}

export function moveFleet(s: GameState, fleetId: string, sea: string): Result {
  const f = s.fleets[fleetId];
  if (!f || f.owner !== s.player) return no('Not your fleet.');
  if (!isSea(sea)) return no('Fleets sail between sea zones.');
  if (!charted(s, sea)) return no('These waters are uncharted. Send an expedition west first (Realm menu, Colonies).');
  const path = findSeaPath(f.sea, sea, !!s.discovery);
  if (!path) return no('No sea route.');
  f.path = path;
  f.progress = 0;
  f.edgeDays = 0;
  return ok(`Sailing to the ${regionName(sea)}.`);
}

// ---------------------------------------------------------------- the New World

/** Send a colonist to uncolonized land. Where natives live, choose to trade with them or take their land by force. */
export function colonize(s: GameState, region: string, policy: NativePolicy = 'force'): Result {
  const why = startColony(s, s.player, region, policy);
  if (why) return no(why);
  const trade = s.regions[region].colony?.policy === 'trade';
  return ok(`Settlers sail for ${regionName(region)} (−${COLONY_COST} gold)${trade ? ' to trade with the natives' : ''}. The colony is founded at 1,000 settlers.`);
}

/** Hire guards for a colony being settled, or dismiss them. */
export function setColonyGuard(s: GameState, region: string, on: boolean): Result {
  const why = setGuard(s, s.player, region, on);
  if (why) return no(why);
  return ok(on ? `Guards watch over ${regionName(region)} (${COLONY_GUARD_UPKEEP} gold a month): the natives will not attack it.` : `The guards in ${regionName(region)} are dismissed.`);
}

/** A colony trading with the natives turns to taking their land by force (there is no going back). */
export function setColonyPolicy(s: GameState, region: string, policy: NativePolicy): Result {
  const why = setPolicy(s, s.player, region, policy);
  if (why) return no(why);
  return ok(`Your settlers in ${regionName(region)} now take the land by force.`);
}

/** Send a free colonist to grow a founded New World region of yours. */
export function growColony(s: GameState, region: string): Result {
  const why = startGrowing(s, s.player, region);
  if (why) return no(why);
  return ok(`Settlers sail for ${regionName(region)} (${COLONY_UPKEEP} gold a month): +1 prosperity for every ${GROW_SETTLERS.toLocaleString()} who arrive, up to ${MAX_GROWN_DEV}.`);
}

export function stopGrowing(s: GameState, region: string): Result {
  const why = stopGrowingColony(s, s.player, region);
  if (why) return no(why);
  return ok(`No more settlers sail for ${regionName(region)}. The colonist is free again.`);
}

export function abandonPlayerColony(s: GameState, region: string): Result {
  const why = abandonColony(s, s.player, region);
  if (why) return no(why);
  return ok(`Your settlers leave ${regionName(region)}. The colonist is free again.`);
}

export function fundExpedition(s: GameState): Result {
  const why = sendExpedition(s, s.player);
  if (why) return no(why);
  return ok(`Your ships sail west into the unknown. They should be back in about ${EXPEDITION_MONTHS} months.`);
}

// ---------------------------------------------------------------- diplomacy & war

export function diplomacy(s: GameState, target: string, action: DiploAction): Result {
  if (target === s.player) return no('That’s you.');
  return doDiplomacy(s, s.player, target, action);
}

export function playerDeclareWar(s: GameState, target: string, cbIndex = 0): Result {
  const why = canDeclareWar(s, s.player, target);
  if (why) return no(why);
  const cbs = casusBelli(s, s.player, target);
  const cb = cbs[cbIndex] ?? cbs[0];
  const war = declareWar(s, s.player, target, cb.cb, cb.goal, 'player');
  if (!war) return no('War could not be declared.');
  if (me(s).armyMode === 'peace') me(s).armyMode = 'war';
  return ok(`War! ${war.attackers.length > 1 ? `Allies with you: ${war.attackers.slice(1).map(nationName).join(', ')}. ` : ''}${war.defenders.length > 1 ? `Against you: ${war.defenders.map(nationName).join(', ')}.` : ''}`);
}

export function proposePeace(s: GameState, warId: string, terms: PeaceTerms): Result {
  const w = s.wars[warId];
  if (!w) return no('That war is over.');
  const side = sideOf(w, s.player);
  if (side === null) return no('You are not in that war.');
  const myLeader = side === 0 ? w.attackers[0] : w.defenders[0];
  const theirLeader = side === 0 ? w.defenders[0] : w.attackers[0];
  if (myLeader !== s.player) return no('Only the war leader can negotiate the peace. You can make a separate peace instead.');
  const leaders = [s.player, theirLeader];
  if (terms.winner === terms.loser || !leaders.includes(terms.winner) || !leaders.includes(terms.loser)) return no('Those terms are not for this war.');
  if (terms.loser === s.player && terms.gold > Math.max(0, me(s).gold)) return no('You don’t have that much gold.');
  if (terms.loser === s.player && !offersOwnLand(s, w, terms)) return no('You can only offer land of your own.');
  // The answer the war screen shows is the one acted on.
  if (!proposalAnswer(s, w, terms, s.player).accept) {
    if (terms.white || terms.winner !== s.player) return no(`${nationName(theirLeader)} refuses the offer.`);
    const cost = peaceCost(s, terms);
    if (cost > 100) return no('That deal costs more than 100% leverage.');
    return no(`${nationName(theirLeader)} refuses: your demands cost ${cost}% but your leverage is ${scoreFor(s, w, s.player)}%.`);
  }
  makePeace(s, w, terms);
  return ok('Peace is signed.');
}

export function separatePeace(s: GameState, warId: string): Result {
  const w = s.wars[warId];
  if (!w) return no('That war is over.');
  const side = sideOf(w, s.player);
  if (side === null) return no('You are not in that war.');
  const leader = side === 0 ? w.attackers[0] : w.defenders[0];
  if (leader === s.player) return no('You lead this war; negotiate a peace instead.');
  leaveWar(s, w, s.player);
  addOpinion(s, leader, s.player, 'separate_peace', 'Left us in the war', -30, 0.5);
  return ok('You make a separate peace.');
}

/** Storm the walls of a fort your armies besiege: the odds and the men it costs are stormOdds'. */
export function stormWalls(s: GameState, region: string): Result {
  const o = stormOdds(s, region);
  if (!o || o.by !== s.player) return no('You are not besieging it.');
  if (o.blocked) return no(`${o.blocked}.`);
  const name = regionName(region);
  // The men who fell: stormOdds' figure, or fewer when the besiegers' regiments are short of men.
  const armies = siegeInfo(s, region)?.besiegers ?? [];
  const before = armies.reduce((t, a) => t + armyMen(a), 0);
  const result = storm(s, region);
  if (!result) return no('The walls can’t be stormed now.');
  const men = (before - armies.reduce((t, a) => t + armyMen(a), 0)).toLocaleString();
  return result === 'won' ? ok(`The walls are stormed! ${name} falls (−${men} men).`) : ok(`Thrown back from the walls (−${men} men).`);
}

export function answerOffer(s: GameState, offerId: string, accept: boolean): Result {
  const o = s.offers.find(x => x.id === offerId);
  if (!o) return no('That offer has lapsed.');
  s.offers = s.offers.filter(x => x.id !== offerId);
  const from = nationName(o.from);
  // Offers wait while time runs: one from a crown now at war with you has lapsed (a peace offer keeps its own checks).
  if (o.kind !== 'peace' && warBetween(s, s.player, o.from)) return no(`You are at war with ${from}: the offer has lapsed.`);
  switch (o.kind) {
    case 'callToArms': {
      const w = s.wars[o.war];
      if (!w) return no('That war is already over.');
      const side = sideOf(w, o.from);
      if (side === null) return no('They are no longer in that war.');
      if (sideOf(w, s.player) !== null) return no('You are already in that war.');
      if (accept) {
        joinWar(s, s.player, o.war, side);
        if (me(s).armyMode === 'peace') me(s).armyMode = 'war';
        addOpinion(s, o.from, s.player, 'honoured_call', 'Honoured our alliance', 25, 0.5);
        log(s, 'war', `You join ${from} in the ${w.name}.`, { important: true });
        return ok(`You join the ${w.name}.`);
      }
      refuseCall(s, s.player, o.from, side === 1);
      return ok(side === 1 ? `You refuse. Your alliance with ${from} is broken.` : `You refuse; ${from} is disappointed.`);
    }
    case 'peace': {
      const w = s.wars[o.war];
      if (!w) return no('That war is already over.');
      if (accept) {
        // An ultimatum signs its terms as they stand today (the land still theirs to take, the gold you have).
        makePeace(s, w, (o.ultimatum !== undefined && w.ultimatum?.from === o.from && ultimatumTerms(s, w)) || o.terms);
        return ok('Peace is signed.');
      }
      // Refusing an ultimatum doesn't stop its clock: it still takes effect on its day if they hold the leverage.
      if (o.ultimatum !== undefined) return ok(`You refuse. ${from} will impose its terms on ${formatDate(o.ultimatum)} unless its leverage falls below ${ULTIMATUM_SCORE}%.`);
      return ok('You reject the proposal. The war goes on.');
    }
    case 'alliance':
      if (accept) {
        s.alliances[[s.player, o.from].sort().join('|')] = s.day;
        return ok(`You are now allied with ${from}.`);
      }
      addOpinion(s, o.from, s.player, 'rejected', 'Rejected our proposal', -15, 0.5);
      return ok('You politely decline.');
    case 'marriage':
      if (accept) {
        if (marriageCount(s, s.player) >= MAX_MARRIAGES) return no('Your house has no one left to marry: at most four royal marriages.');
        if (marriageCount(s, o.from) >= MAX_MARRIAGES) return no('Their house already has four royal marriages.');
        s.marriages[[s.player, o.from].sort().join('|')] = s.day;
        return ok(`A royal marriage with ${from}.`);
      }
      return ok('You decline.');
    case 'access':
      if (accept) s.access[`${s.player}>${o.from}`] = s.day;
      return ok(accept ? 'Access granted.' : 'Access refused.');
  }
}

export function playerAnswerEvent(s: GameState, index: number, choice: number): Result {
  return answerEvent(s, index, choice) ? ok('') : no('That event has passed.');
}

export function playerCompleteMission(s: GameState, id: string): Result {
  return completeMission(s, s.player, id) ? ok('Mission complete!') : no('Not ready yet.');
}

export function requestSanction(s: GameState, region: string): Result {
  const nat = me(s);
  if (nat.faith !== 'catholic') return no('Only Catholic rulers can petition the Pope.');
  if (nat.papalFavor < SANCTION_COST) return no(`You need ${SANCTION_COST} Papal Favor.`);
  if (!sanctionTargets(s, s.player).includes(region)) return no('The Pope will only sanction claims on neighbouring heretics, infidels or excommunicated rulers.');
  nat.papalFavor -= SANCTION_COST;
  nat.claims[region] = -1;
  return ok(`The Pope blesses your claim on ${regionName(region)}.`);
}

export function playerExcommunicate(s: GameState, target: string): Result {
  const why = excommunicate(s, s.player, target);
  return why ? no(why) : ok(`${nationName(target)}'s ruler is excommunicated.`);
}

export function freeSubject(s: GameState, subject: string): Result {
  if (s.nations[subject]?.overlord !== s.player) return no('Not your subject.');
  releaseSubject(s, subject);
  addOpinion(s, subject, s.player, 'freed', 'Set us free', 50, 0.5);
  return ok(`${nationName(subject)} is free.`);
}

export const playerRegions = (s: GameState) => ownedRegions(s, s.player);
export { allied };

/** Proclaim a greater crown (crowns.ts): its name, arms and lasting bonus. */
export function proclaimCrown(s: GameState, id: string): Result {
  const why = canProclaim(s, s.player, id);
  if (why) return no(why);
  proclaim(s, s.player, id);
  return ok(`Long live ${crownTitle(id)}!`);
}
