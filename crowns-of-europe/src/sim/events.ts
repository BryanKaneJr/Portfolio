/** Evaluates conditions, applies effects, and fires events each month (see docs/content-guide.md). */
import { ACHIEVEMENTS, EVENT, EVENTS, MAP_REGION, NATION, REGION, nationName, regionName } from './content';
import { log, involvesPlayer, moment, requestPause, withoutPauses } from './log';
import {
  alliesOf,
  atWar,
  borders,
  fleetsOf,
  hasTruce,
  invalidateMods,
  isCoastal,
  nationMods,
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
import type { Condition, Effect, EventDef, Faith, GameState, NationId, RegionId } from './types';
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

/**
 * How much applying a numeric effect would change its number for nation `n` right now, exactly as applyEffect does
 * it (the realm's prosperity for gold per prosperity, the floors and ceilings of order, renown, levies..., Threat's
 * modifiers): what event cards and mission rewards show. Null for effects that are not one amount.
 */
export function effectDelta(s: GameState, n: NationId, e: Effect): number | null {
  const nat = s.nations[n];
  if (!nat) return null;
  const k = Object.keys(e)[0];
  const v = (e as any)[k];
  switch (k) {
    case 'gold':
      return v;
    case 'goldPerDev':
      return v * totalDev(s, n);
    case 'manpower':
      return Math.max(0, nat.manpower + v) - nat.manpower;
    case 'stability':
      return clamp(nat.stability + v, -3, 3) - nat.stability;
    case 'prestige':
      return clamp(nat.prestige + v, 0, 100) - nat.prestige;
    case 'science':
      return Math.max(0, nat.science + v) - nat.science;
    case 'threat':
      // As addThreat: a rise is scaled by the realm's Threat modifiers.
      return (v > 0 ? clamp(nat.threat + v * (1 + nationMods(s, n).threatGain), 0, 200) : Math.max(0, nat.threat + v)) - nat.threat;
    case 'papalFavor':
      return nat.faith === 'catholic' ? clamp(nat.papalFavor + v, 0, 100) - nat.papalFavor : 0;
    case 'warExhaustion':
      return clamp(nat.warExhaustion + v, 0, 20) - nat.warExhaustion;
    case 'devRegion': {
      const reg = s.regions[v.region];
      return reg ? clamp(reg.dev + v.amount, 1, 10) - reg.dev : 0;
    }
    case 'devCapital': {
      const reg = s.regions[nat.capital];
      return reg ? clamp(reg.dev + v, 1, 10) - reg.dev : 0;
    }
    case 'fortRegion': {
      const reg = s.regions[v.region];
      return reg ? clamp(reg.fort + v.amount, 0, 3) - reg.fort : 0;
    }
    case 'rulerSkill':
      return clamp(nat.ruler.skill + v, 1, 5) - nat.ruler.skill;
    default:
      return null;
  }
}

/**
 * Where an effect lands for nation `n`: rebels rise in the region named if it is theirs, else in the capital; a free
 * army musters in the region named if they hold it, else in the capital (null: they hold neither, and none comes).
 */
export function effectRegion(s: GameState, n: NationId, e: Effect): RegionId | null {
  const nat = s.nations[n];
  if (!nat) return null;
  if ('rebels' in e) return e.rebels.region && s.regions[e.rebels.region]?.owner === n ? e.rebels.region : nat.capital;
  if ('addRegiments' in e) {
    const v = e.addRegiments;
    const region = v.region && s.regions[v.region]?.controller === n ? v.region : nat.capital;
    return s.regions[region]?.controller === n ? region : null;
  }
  if ('devCapital' in e) return nat.capital;
  return null;
}

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
      spawnRebels(s, effectRegion(s, n, e)!, v.regiments);
      break;
    case 'addRegiments': {
      const region = effectRegion(s, n, e);
      if (region) addRegiments(s, n, region, { inf: v.inf ?? 0, cav: v.cav ?? 0, art: v.art ?? 0 });
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
      const war = declareWar(s, n, v.target, v.cb ?? 'claim', v.region, 'event');
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

/** Effects whose amount (or place) depends on the game: what an earlier effect in the same list can change. */
const READS = new Set(['goldPerDev', 'manpower', 'stability', 'prestige', 'science', 'threat', 'papalFavor', 'warExhaustion', 'devRegion', 'devCapital', 'fortRegion', 'rulerSkill', 'rebels', 'addRegiments', 'settlers', 'settlersOne']);
/** Effects that change nothing another effect reads (gold is added as written, whatever the treasury holds). */
const INERT = new Set(['gold', 'loans', 'addClaim', 'setFlag', 'clearFlag', 'setNationFlag', 'opinion', 'triggerEvent', 'hireGeneral', 'newHeir', 'unrestAll', 'unrestRegion', 'ally', 'breakAlliance']);
const kindOf = (e: Effect) => Object.keys(e)[0];

/**
 * Effects apply in order, each to what those before it left (a new ruler's traits raise the Threat that follows):
 * `visit` sees each effect with the game as it will stand just before it is applied. When an earlier effect can change
 * what a later one reads, that is a copy of the game with the earlier ones applied; the game itself is untouched, and
 * nothing done to the copy asks for a pause.
 */
export function walkEffects(s: GameState, n: NationId, effects: Effect[], visit: (s: GameState, e: Effect) => void): void {
  const sequential = effects.some((e, i) => READS.has(kindOf(e)) && effects.slice(0, i).some(p => !INERT.has(kindOf(p))));
  if (!sequential) {
    for (const e of effects) visit(s, e);
    return;
  }
  withoutPauses(() => {
    const c = JSON.parse(JSON.stringify(s)) as GameState;
    invalidateMods();
    try {
      effects.forEach((e, i) => {
        visit(c, e);
        if (i < effects.length - 1) {
          applyEffect(c, n, e);
          invalidateMods();
        }
      });
    } finally {
      invalidateMods();
    }
  });
}

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

/** Events marked `onPeace`, checked on the day a peace is signed rather than at the next monthly pass. */
export function peaceEvents(_s: GameState): void {}

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
      moment(s, { kind: 'achievement', card: true, tone: 'good', title: a.title, lines: [a.desc] });
    }
  }
  return got;
}

export const eventNationName = (n: NationId) => nationName(n);
export { regionName, involvesPlayer };
