/** Evaluates conditions, applies effects, and fires events each month (see docs/content-guide.md). */
import { ACHIEVEMENTS, EVENT, EVENTS, MAP_REGION, NATION, REGION, nationName, regionName } from './content';
import { log, involvesPlayer, requestPause } from './log';
import {
  alliesOf,
  atWar,
  borders,
  fleetsOf,
  hasTruce,
  invalidateMods,
  isCoastal,
  ownedRegions,
  rulerAge,
  subjectsOf,
  totalDev,
  totalRegiments,
  totalShips,
  warBetween,
} from './queries';
import { addOpinion, isHreMember } from './diplomacy';
import { addThreat } from './threat';
import { annexNation, makeSubject, releaseSubject, transferRegion } from './territory';
import { addRegiments } from './military';
import { newGeneral, rulerDies } from './rulers';
import { spawnRebels } from './rebels';
import { canDeclareWar, declareWar, joinWar } from './war';
import { SETTLERS_NEEDED, coloniesOf, discoverNewWorld, newWorldRegions } from './colonies';
import type { Condition, Effect, EventDef, Faith, GameState, NationId } from './types';
import { chance, clamp, months, pick, pickWeighted, randInt, yearOf } from './util';

// ---------------------------------------------------------------- conditions

const range = (v: number, r: [number, number] | [number]) => v >= r[0] && (r.length < 2 || v <= (r as [number, number])[1]);
const list = <T>(x: T | T[]) => (Array.isArray(x) ? x : [x]);

export function evalCondition(s: GameState, n: NationId, c: Condition): boolean {
  const nat = s.nations[n];
  if (!nat) return false;
  const k = Object.keys(c)[0] as keyof Condition & string;
  const v = (c as any)[k];
  switch (k) {
    case 'all':
      return (v as Condition[]).every(x => evalCondition(s, n, x));
    case 'any':
      return (v as Condition[]).some(x => evalCondition(s, n, x));
    case 'not':
      return !evalCondition(s, n, v);
    case 'year':
      return range(yearOf(s.day), v);
    case 'isNation':
      return list(v).includes(n);
    case 'isPlayer':
      return (n === s.player) === v;
    case 'owns':
      return list<string>(v).every(r => s.regions[r]?.owner === n);
    case 'ownsAny':
      return (v as string[]).some(r => s.regions[r]?.owner === n);
    case 'controls':
      return s.regions[v]?.controller === n;
    case 'nationOwns':
      return s.regions[v.region]?.owner === v.nation;
    case 'exists':
      return !!s.nations[v]?.alive;
    case 'atWar':
      return atWar(s, n) === v;
    case 'atWarWith':
      return !!warBetween(s, n, v);
    case 'truceWith':
      return hasTruce(s, n, v);
    case 'faith':
      return nat.faith === v;
    case 'nationFaith':
      return s.nations[v.nation]?.alive === true && s.nations[v.nation].faith === v.faith;
    case 'stability':
      return range(nat.stability, v);
    case 'goldAtLeast':
      return nat.gold >= v;
    case 'prestigeAtLeast':
      return nat.prestige >= v;
    case 'threatAtLeast':
      return nat.threat >= v;
    case 'regionsAtLeast':
      return ownedRegions(s, n).length >= v;
    case 'regimentsAtLeast':
      return totalRegiments(s, n) >= v;
    case 'devAtLeast':
      return totalDev(s, n) >= v;
    case 'capitalDevAtLeast':
      return (s.regions[nat.capital]?.dev ?? 0) >= v;
    case 'allied':
      return alliesOf(s, n).includes(v);
    case 'alliesAtLeast':
      return alliesOf(s, n).length >= v;
    case 'borders':
      return borders(s, n, v);
    case 'rulerSkill':
      return range(nat.ruler.skill, v);
    case 'rulerAgeAtLeast':
      return rulerAge(s, n) >= v;
    case 'hasHeir':
      return !!nat.heir === v;
    case 'eraAtLeast':
      return nat.era >= v;
    case 'flag':
      return v in s.flags;
    case 'nationFlag':
      return v in nat.flags;
    case 'loansAtLeast':
      return nat.loans >= v;
    case 'isEmperor':
      return (s.hre.emperor === n) === v;
    case 'isElector':
      return s.hre.electors.includes(n) === v;
    case 'subjectOf':
      return v === true ? !!nat.overlord : nat.overlord === v;
    case 'overlordOf':
      return v === true ? subjectsOf(s, n).length > 0 : s.nations[v]?.overlord === n;
    case 'vassalsAtLeast':
      return subjectsOf(s, n).length >= v;
    case 'regionFaith':
      return s.regions[v.region]?.faith === v.faith;
    case 'faithRegionsAtLeast':
      return Object.values(s.regions).filter(r => r.faith === v.faith).length >= v.count;
    case 'gov':
      return NATION[n].gov === v;
    case 'tier':
      return NATION[n].tier === v;
    case 'hasPolicy':
      return nat.policies.includes(v);
    case 'hasAdvance':
      return nat.advances.includes(v);
    case 'warsWonAtLeast':
      return nat.record.warsWon >= v;
    case 'battlesWonAtLeast':
      return nat.record.battlesWon >= v;
    case 'stackWipesAtLeast':
      return nat.record.stackWipes >= v;
    case 'bestWinRatioAtLeast':
      return nat.record.bestRatio >= v;
    case 'regionsConqueredAtLeast':
      return nat.record.regionsTaken >= v;
    case 'fleetsAtLeast':
      return fleetsOf(s, n).length >= v;
    case 'shipsAtLeast':
      return totalShips(s, n) >= v;
    case 'coastal':
      return isCoastal(s, n) === v;
    case 'inCoalition':
      return s.coalitions.some(x => x.members.includes(n)) === v;
    case 'coalitionAgainst':
      return s.coalitions.some(x => x.target === n) === v;
    case 'hreMember':
      return isHreMember(s, n) === v;
    case 'papalFavorAtLeast':
      return nat.papalFavor >= v;
    case 'discovered':
      return !!s.discovery === v;
    case 'coloniesAtLeast':
      return newWorldRegions(s, n).length >= v;
    case 'colonizingAtLeast':
      return coloniesOf(s, n).length >= v;
    case 'ownsGood':
      return ownedRegions(s, n).some(r => REGION[r.id].good === v);
    case 'native':
      return !!NATION[n]?.native === v;
    case 'chance':
      return chance(s, v);
    default:
      return false;
  }
}

// ---------------------------------------------------------------- effects

const REFORMATION_ZONE = (r: string) => {
  const def = REGION[r];
  const [lon, lat] = MAP_REGION[r].lonlat;
  return def.hre || lat > 54 || ['bohemia', 'moravia', 'silesia', 'switzerland', 'lowlands', 'highlands', 'london', 'wessex', 'midlands', 'yorkshire', 'wales', 'hungary', 'transylvania', 'upper_hungary'].includes(r) || (lon > 13 && lon < 24 && lat > 51);
};

export function applyEffect(s: GameState, n: NationId, e: Effect): void {
  const nat = s.nations[n];
  if (!nat) return;
  const k = Object.keys(e)[0];
  const v = (e as any)[k];
  switch (k) {
    case 'gold':
      nat.gold += v;
      break;
    case 'goldPerDev':
      nat.gold += v * totalDev(s, n);
      break;
    case 'manpower':
      nat.manpower = Math.max(0, nat.manpower + v);
      break;
    case 'stability':
      nat.stability = clamp(nat.stability + v, -3, 3);
      break;
    case 'prestige':
      nat.prestige = clamp(nat.prestige + v, 0, 100);
      break;
    case 'science':
      nat.science = Math.max(0, nat.science + v);
      break;
    case 'threat':
      if (v > 0) addThreat(s, n, v);
      else nat.threat = Math.max(0, nat.threat + v);
      break;
    case 'papalFavor':
      if (nat.faith === 'catholic') nat.papalFavor = clamp(nat.papalFavor + v, 0, 100);
      break;
    case 'warExhaustion':
      nat.warExhaustion = clamp(nat.warExhaustion + v, 0, 20);
      break;
    case 'addClaim':
      for (const r of list<string>(v)) if (s.regions[r]?.owner !== n) nat.claims[r] = -1;
      break;
    case 'addCore':
      for (const r of list<string>(v)) {
        const reg = s.regions[r];
        if (!reg) continue;
        if (!reg.cores.includes(n)) reg.cores.push(n);
        if (reg.owner !== n) nat.claims[r] = -1;
      }
      break;
    case 'devRegion': {
      const reg = s.regions[v.region];
      if (reg) reg.dev = clamp(reg.dev + v.amount, 1, 10);
      break;
    }
    case 'devCapital': {
      const reg = s.regions[nat.capital];
      if (reg) reg.dev = clamp(reg.dev + v, 1, 10);
      break;
    }
    case 'fortRegion': {
      const reg = s.regions[v.region];
      if (reg) reg.fort = clamp(reg.fort + v.amount, 0, 3);
      break;
    }
    case 'unrestAll':
      for (const r of ownedRegions(s, n)) r.unrestMods.push({ amount: v, until: s.day + months(24) });
      break;
    case 'unrestRegion': {
      const reg = s.regions[v.region];
      if (reg) reg.unrestMods.push({ amount: v.amount, until: s.day + months(24) });
      break;
    }
    case 'convertRegion': {
      const reg = s.regions[v.region];
      if (reg) reg.faith = v.faith as Faith;
      break;
    }
    case 'changeFaith':
      nat.faith = v;
      if (v !== 'catholic') nat.papalFavor = 0;
      invalidateMods();
      break;
    case 'setFlag':
      s.flags[v] = s.day;
      break;
    case 'clearFlag':
      delete s.flags[v];
      delete nat.flags[v];
      break;
    case 'setNationFlag':
      nat.flags[v] = s.day;
      break;
    case 'modifier':
      nat.modifiers = nat.modifiers.filter(m => m.id !== v.id);
      nat.modifiers.push({ id: v.id, name: v.name, mods: v.mods, until: v.months > 0 ? s.day + months(v.months) : -1 });
      invalidateMods();
      break;
    case 'removeModifier':
      nat.modifiers = nat.modifiers.filter(m => m.id !== v);
      invalidateMods();
      break;
    case 'rebels':
      spawnRebels(s, v.region && s.regions[v.region]?.owner === n ? v.region : nat.capital, v.regiments);
      break;
    case 'addRegiments': {
      const region = v.region && s.regions[v.region]?.controller === n ? v.region : nat.capital;
      if (s.regions[region]?.controller === n) addRegiments(s, n, region, { inf: v.inf ?? 0, cav: v.cav ?? 0, art: v.art ?? 0 });
      break;
    }
    case 'hireGeneral':
      nat.generals.push(newGeneral(s, n, v));
      break;
    case 'opinion':
      if (s.nations[v.nation]) addOpinion(s, v.nation, n, `event_${s.day}`, 'Recent events', v.amount, 1);
      break;
    case 'ally':
      if (s.nations[v]?.alive && v !== n && !warBetween(s, n, v)) s.alliances[[n, v].sort().join('|')] = s.day;
      break;
    case 'breakAlliance':
      delete s.alliances[[n, v].sort().join('|')];
      break;
    case 'personalUnion':
      if (s.nations[v]?.alive && v !== n && !nat.overlord) makeSubject(s, n, v, 'union');
      break;
    case 'inherit':
      if (s.nations[v]?.alive && v !== n) annexNation(s, n, v);
      break;
    case 'independence':
      if (nat.overlord) releaseSubject(s, n);
      break;
    case 'releaseSubject':
      if (s.nations[v]?.overlord === n) releaseSubject(s, v);
      break;
    case 'transferRegion':
      if (s.regions[v.region] && s.nations[v.to]?.alive) transferRegion(s, v.region, v.to);
      break;
    case 'newRuler':
      // The old ruler no longer commands any army (as when a ruler dies).
      for (const a of Object.values(s.armies)) if (a.owner === n && a.general?.isRuler) a.general = undefined;
      nat.ruler = { name: v.name, skill: clamp(v.skill, 1, 5), traits: v.traits ?? [], born: yearOf(s.day) - (v.age ?? 30) };
      invalidateMods();
      break;
    case 'rulerSkill':
      nat.ruler.skill = clamp(nat.ruler.skill + v, 1, 5);
      break;
    case 'rulerTrait':
      if (!nat.ruler.traits.includes(v)) nat.ruler.traits.push(v);
      invalidateMods();
      break;
    case 'killRuler':
      rulerDies(s, n, 'misfortune');
      break;
    case 'newHeir':
      nat.heir = { name: v.name, skill: clamp(v.skill, 1, 5), traits: v.traits ?? [], born: yearOf(s.day) - (v.age ?? 10) };
      break;
    case 'triggerEvent':
      s.scheduledEvents.push({ event: v.id, nation: v.nation ?? n, day: s.day + months(v.months ?? 1) });
      break;
    case 'reformation': {
      const candidates = Object.values(s.regions).filter(r => r.faith === 'catholic' && REFORMATION_ZONE(r.id));
      for (let left = v as number; left > 0 && candidates.length; left--) {
        const r = candidates.splice(randInt(s, 0, candidates.length - 1), 1)[0];
        r.faith = 'protestant';
      }
      break;
    }
    case 'declareWar': {
      if (!s.nations[v.target]?.alive) break;
      const war = declareWar(s, n, v.target, v.cb ?? 'claim', v.region);
      // A league: the named crowns join the attack if they are free to (independent, no truce, not allied to the
      // enemy). The player is asked like any ally would be.
      for (const m of war && v.with ? ([] as NationId[]).concat(v.with) : []) {
        if (!s.nations[m]?.alive || m === n || s.nations[m].overlord || canDeclareWar(s, m, v.target) || hasTruce(s, m, v.target)) continue;
        if (m === s.player) {
          s.offers.push({ id: `o${++s.seq}`, kind: 'callToArms', from: n, war: war!.id, day: s.day });
          requestPause(s, 'offer');
        } else if (joinWar(s, m, war!.id, 0)) s.nations[m].armyMode = 'war';
      }
      break;
    }
    case 'loans':
      nat.loans += v;
      nat.gold += v * 100;
      break;
    case 'emperor':
      s.hre.emperor = n;
      break;
    case 'discoverNewWorld':
      discoverNewWorld(s, n);
      break;
    case 'settlers':
      for (const r of coloniesOf(s, n)) r.colony!.settlers = Math.max(0, Math.min(SETTLERS_NEEDED - 1, r.colony!.settlers + v));
      break;
    case 'settlersOne': {
      // Something that happens in one place (a storm, a fever, a good harvest): one colony, picked at random.
      const all = coloniesOf(s, n);
      if (!all.length) break;
      const r = pick(s, all);
      const before = r.colony!.settlers;
      r.colony!.settlers = Math.max(0, Math.min(SETTLERS_NEEDED - 1, before + v));
      const change = Math.round(r.colony!.settlers - before);
      if (n === s.player && change)
        log(s, 'colony', change > 0 ? `${change} more settlers in ${regionName(r.id)}.` : `${-change} settlers lost in ${regionName(r.id)}.`, { node: r.id });
      break;
    }
  }
}

export const applyEffects = (s: GameState, n: NationId, effects: Effect[]) => effects.forEach(e => applyEffect(s, n, e));

// ---------------------------------------------------------------- firing

const isOnce = (e: EventDef) => e.once ?? e.pool !== 'generic';

function eligible(s: GameState, n: NationId, e: EventDef, year: number, ignoreHidden = false): boolean {
  if (e.hidden && !ignoreHidden) return false;
  if (e.nations && !e.nations.includes(n)) return false;
  if (e.window && (year < e.window[0] || year > e.window[1])) return false;
  if (isOnce(e) && (s.firedEvents[e.id] ?? 0) > 0 && !(e.pool === 'era' && e.once === false)) return false;
  if (e.pool === 'era' && e.once === false && s.nations[n].flags[`_ev_${e.id}`]) return false;
  return evalCondition(s, n, e.trigger);
}

export function fireEvent(s: GameState, n: NationId, e: EventDef): void {
  s.firedEvents[e.id] = (s.firedEvents[e.id] ?? 0) + 1;
  const nat = s.nations[n];
  if (e.pool === 'era') nat.flags[`_ev_${e.id}`] = s.day;
  nat.lastEventDay = s.day;
  if (e.pool === 'generic') nat.flags._lastGeneric = s.day;
  if (n === s.player) {
    s.pendingEvents.push({ event: e.id, nation: n, day: s.day });
    requestPause(s, 'event');
    return;
  }
  const choice = pickWeighted(s, e.choices, c => c.ai ?? 1) ?? e.choices[0];
  applyEffects(s, n, choice.effects);
  if (e.news) log(s, 'news', e.news, { nation: n });
}

export function answerEvent(s: GameState, index: number, choice: number): boolean {
  const pe = s.pendingEvents[index];
  if (!pe) return false;
  const e = EVENT[pe.event];
  s.pendingEvents.splice(index, 1);
  if (!e || !e.choices[choice]) return false;
  applyEffects(s, pe.nation, e.choices[choice].effects);
  log(s, 'event', `${e.title}: ${e.choices[choice].text}.`, { nation: pe.nation });
  return true;
}

export function monthlyEvents(s: GameState): void {
  if ('__noEvents' in s.flags) return;
  const year = yearOf(s.day);
  // Scheduled chain events first.
  const due = s.scheduledEvents.filter(x => x.day <= s.day);
  s.scheduledEvents = s.scheduledEvents.filter(x => x.day > s.day);
  const gotOne = new Set<NationId>();
  for (const d of due) {
    const e = EVENT[d.event];
    if (!e || !s.nations[d.nation]?.alive) continue;
    if (!evalCondition(s, d.nation, e.trigger)) continue;
    fireEvent(s, d.nation, e);
    gotOne.add(d.nation);
  }
  for (const nat of Object.values(s.nations)) {
    if (!nat.alive || gotOne.has(nat.id)) continue;
    // The player never has more than two cards waiting.
    if (nat.id === s.player && s.pendingEvents.length >= 2) continue;
    const genericReady = s.day - (nat.flags._lastGeneric ?? -9999) > months(14);
    for (const e of shuffledEvents(s)) {
      if (e.pool === 'generic' && !genericReady) continue;
      const mtth = Math.max(1, e.mtth ?? 36);
      // Cheap roll before the (more expensive) trigger check.
      if (!chance(s, 1 / mtth)) continue;
      if (!eligible(s, nat.id, e, year)) continue;
      fireEvent(s, nat.id, e);
      break;
    }
  }
}

let order: EventDef[] = [];
function shuffledEvents(s: GameState): EventDef[] {
  if (order.length !== EVENTS.length) order = [...EVENTS];
  // Rotate the starting point each call so no event always gets the first roll.
  const start = randInt(s, 0, order.length - 1);
  return [...order.slice(start), ...order.slice(0, start)];
}

// ---------------------------------------------------------------- achievements

export function checkAchievements(s: GameState): string[] {
  const got: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.includes(a.id)) continue;
    if (a.nations && !a.nations.includes(s.player)) continue;
    if (!s.nations[s.player]?.alive) continue;
    if (evalCondition(s, s.player, a.goal)) {
      s.achievements.push(a.id);
      got.push(a.id);
      log(s, 'mission', `Achievement unlocked: ${a.title}!`, { important: true });
    }
  }
  return got;
}

export const eventNationName = (n: NationId) => nationName(n);
export { regionName, involvesPlayer };
