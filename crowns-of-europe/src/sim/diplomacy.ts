/**
 * Opinion (-200..200, with a breakdown), and the diplomatic actions on a nation's sheet:
 * improve relations, alliance, royal marriage, military access, rivalry, vassalization, gifts, insults.
 * Each action has a cooldown per target. Acceptance is a score with readable reasons.
 */
import { NATION, REGION, nationName } from './content';
import { log, involvesPlayer, newsworthy } from './log';
import {
  aliveNations,
  allied,
  alliesOf,
  atWar,
  borders,
  hasTruce,
  hostile,
  married,
  militaryPower,
  nationMods,
  neighborsOf,
  subjectsOf,
  topOverlord,
  totalDev,
  warBetween,
} from './queries';
import { addThreat, coalitionAgainst, coalitionOf, perceivedThreat, proximity } from './threat';
import { annexNation, makeSubject } from './territory';
import type { GameState, NationId } from './types';
import { clamp, dirKey, months, pairKey, years } from './util';

export interface Reason {
  label: string;
  value: number;
}

const CHRISTIAN = new Set(['catholic', 'orthodox', 'protestant']);
export function faithRelation(a: string, b: string): number {
  if (a === b) return 10;
  if (CHRISTIAN.has(a) && CHRISTIAN.has(b)) return -10;
  return -40;
}

export function opinionModsOf(s: GameState, from: NationId, to: NationId) {
  return s.relations[dirKey(from, to)]?.opinionMods ?? [];
}

export function addOpinion(s: GameState, from: NationId, to: NationId, id: string, name: string, value: number, decay = 1): void {
  const key = dirKey(from, to);
  const rel = (s.relations[key] ??= { opinionMods: [] });
  const existing = rel.opinionMods.find(m => m.id === id);
  if (existing) {
    existing.value = clamp(existing.value + value, -200, 200);
    existing.decay = decay;
  } else rel.opinionMods.push({ id, name, value, decay });
}

/** What `from` thinks of `to`, with the reasons. */
export function opinionBreakdown(s: GameState, from: NationId, to: NationId): Reason[] {
  const a = s.nations[from];
  const b = s.nations[to];
  if (!a || !b || from === to) return [];
  const out: Reason[] = [];
  const add = (label: string, value: number) => value && out.push({ label, value: Math.round(value) });
  add(a.faith === b.faith ? 'Same faith' : 'Different faith', faithRelation(a.faith, b.faith));
  if (allied(s, from, to)) add('Alliance', 50);
  if (married(s, from, to)) add('Royal marriage', 20);
  if (a.overlord === to) add('Our overlord', a.subjectType === 'union' ? 30 : -10);
  if (b.overlord === from) add('Our subject', 20);
  if (a.rivals.includes(to)) add('Our rival', -50);
  if (b.rivals.includes(from)) add('Rivals us', -30);
  const threat = perceivedThreat(s, from, to);
  if (threat >= 1) add('Threat', -Math.min(120, threat * 1.2));
  if (warBetween(s, from, to)) add('At war', -100);
  else if (hasTruce(s, from, to)) add('Recent war', -25);
  const c = coalitionAgainst(s, to);
  if (c?.members.includes(from)) add('In a league against them', -25);
  if (b.prestige >= 10) add('Renown', b.prestige / 5);
  const mods = nationMods(s, to).opinion;
  if (mods) add('Reputation', mods);
  if (s.hre.emperor && ((s.hre.emperor === to && isHreMember(s, from)) || (s.hre.emperor === from && isHreMember(s, to)))) add('Empire', 10);
  if (borders(s, from, to) && NATION[from].personality === 'expansionist') add('Border friction', -10);
  for (const m of opinionModsOf(s, from, to)) add(m.name, m.value);
  return out;
}

export function opinion(s: GameState, from: NationId, to: NationId): number {
  return clamp(
    opinionBreakdown(s, from, to).reduce((t, r) => t + r.value, 0),
    -200,
    200,
  );
}

export function isHreMember(s: GameState, n: NationId): boolean {
  const cap = s.nations[n]?.capital;
  return !!cap && !!REGION[cap]?.hre;
}

export function monthlyDiplomacy(s: GameState): void {
  for (const key of Object.keys(s.relations)) {
    const rel = s.relations[key];
    for (const m of rel.opinionMods) {
      if (m.value > 0) m.value = Math.max(0, m.value - m.decay);
      else m.value = Math.min(0, m.value + m.decay);
    }
    rel.opinionMods = rel.opinionMods.filter(m => m.value !== 0);
    if (!rel.opinionMods.length) delete s.relations[key];
  }
  // Access lapses after 10 years; marriages last.
  for (const [k, since] of Object.entries(s.access)) if (s.day - since > years(10)) delete s.access[k];
  for (const [k, until] of Object.entries(s.truces)) if (until <= s.day) delete s.truces[k];
  for (const [k, until] of Object.entries(s.cooldowns)) if (until <= s.day) delete s.cooldowns[k];
}

// ---------------------------------------------------------------- actions

export type DiploAction =
  | 'improve'
  | 'alliance'
  | 'marriage'
  | 'access'
  | 'rival'
  | 'vassalize'
  | 'gift'
  | 'insult'
  | 'breakAlliance'
  | 'annex'
  | 'unrival';

export const ACTION_COOLDOWN: Record<DiploAction, number> = {
  improve: months(12),
  alliance: months(6),
  marriage: months(12),
  access: months(6),
  rival: months(24),
  vassalize: months(12),
  gift: months(6),
  insult: months(12),
  breakAlliance: months(1),
  annex: months(1),
  unrival: months(1),
};

export const cooldownLeft = (s: GameState, from: NationId, to: NationId, action: DiploAction) =>
  Math.max(0, (s.cooldowns[`${from}>${to}:${action}`] ?? 0) - s.day);
const setCooldown = (s: GameState, from: NationId, to: NationId, action: DiploAction) => {
  s.cooldowns[`${from}>${to}:${action}`] = s.day + ACTION_COOLDOWN[action];
};

export interface Acceptance {
  score: number;
  reasons: Reason[];
  accept: boolean;
  blocked?: string; // a hard reason it can't happen at all
}

const relStrength = (s: GameState, a: NationId, b: NationId) => {
  const pa = militaryPower(s, a) + totalDev(s, a);
  const pb = militaryPower(s, b) + totalDev(s, b);
  return pa / Math.max(1, pb);
};

/** Would `to` accept `action` from `from`? */
export function acceptance(s: GameState, from: NationId, to: NationId, action: DiploAction): Acceptance {
  const A = s.nations[from];
  const B = s.nations[to];
  const reasons: Reason[] = [];
  const add = (label: string, value: number) => value && reasons.push({ label, value: Math.round(value) });
  const fail = (blocked: string): Acceptance => ({ score: -999, reasons, accept: false, blocked });
  if (!B?.alive) return fail('They no longer exist.');
  if (B.overlord && action !== 'improve' && action !== 'gift' && action !== 'insult' && action !== 'rival' && action !== 'annex')
    if (B.overlord !== from) return fail(`They answer to ${nationName(B.overlord)}.`);
  const op = opinion(s, to, from);
  const dip = nationMods(s, from).diplomacy * 5;
  const cd = cooldownLeft(s, from, to, action);
  if (cd > 0) return fail(`Wait ${Math.ceil(cd / 30)} more month${cd > 45 ? 's' : ''}.`);
  // New World peoples keep no envoys at European courts: no treaties either way.
  if ((NATION[from]?.native || NATION[to]?.native) && ['alliance', 'marriage', 'access', 'vassalize', 'annex'].includes(action))
    return fail(NATION[to]?.native ? `${nationName(to)} make no treaties with distant crowns.` : 'Your people make no treaties with distant crowns.');
  switch (action) {
    case 'alliance': {
      if (allied(s, from, to)) return fail('Already allied.');
      if (hostile(s, from, to)) return fail('You are at war.');
      if (B.overlord === from || A.overlord === to) return fail('Subjects fight for their overlord anyway.');
      add('Base', -20);
      add('Opinion of you', op / 3);
      add('Diplomatic skill', dip);
      const sharedRival = A.rivals.some(r => B.rivals.includes(r));
      if (sharedRival) add('Shared rival', 30);
      if (A.faith !== B.faith) add('Different faith', A.faith === 'muslim' || B.faith === 'muslim' ? -40 : -10);
      const st = relStrength(s, from, to);
      add(st >= 1 ? 'You are strong' : 'You are weak', clamp((st - 1) * 15, -25, 25));
      const allies = alliesOf(s, to).length;
      if (allies >= 2) add('Already has allies', -10 * (allies - 1));
      const dist = proximity(s, from, to);
      if (dist < 0.3) add('Too far away', -20);
      const common = aliveNations(s).find(x => perceivedThreat(s, to, x.id) >= 40 && perceivedThreat(s, from, x.id) >= 20);
      if (common) add(`Fear of ${nationName(common.id)}`, 20);
      if (atWar(s, from)) add('You are at war', -15);
      break;
    }
    case 'marriage': {
      if (married(s, from, to)) return fail('Already married into their dynasty.');
      if (NATION[from].gov !== 'monarchy' || NATION[to].gov !== 'monarchy') return fail('Only monarchies arrange royal marriages.');
      if (hostile(s, from, to)) return fail('You are at war.');
      add('Base', 0);
      add('Opinion of you', op / 3);
      add('Diplomatic skill', dip);
      if (A.faith !== B.faith) add('Different faith', A.faith === 'muslim' || B.faith === 'muslim' ? -100 : -20);
      add('Your renown', A.prestige / 10);
      break;
    }
    case 'access': {
      if (`${to}>${from}` in s.access) return fail('You already have access.');
      if (hostile(s, from, to)) return fail('You are at war.');
      add('Base', 5);
      add('Opinion of you', op / 2);
      add('Diplomatic skill', dip);
      const threat = perceivedThreat(s, to, from);
      if (threat > 10) add('Your Threat', -threat / 2);
      break;
    }
    case 'vassalize': {
      if (hostile(s, from, to)) return fail('You are at war.');
      if (B.overlord) return fail('They already have an overlord.');
      if (A.overlord) return fail('Subjects cannot take subjects.');
      const ratio = totalDev(s, from) / Math.max(1, totalDev(s, to));
      if (ratio < 3) return fail('They are not weak enough (you need three times their prosperity).');
      add('Base', -75);
      add('Opinion of you', op / 2);
      add('Your size', Math.min(40, (ratio - 3) * 5));
      add('Diplomatic skill', dip);
      if (alliesOf(s, to).some(x => x !== from && relStrength(s, x, from) > 0.8)) add('Strong allies', -40);
      if (A.faith !== B.faith) add('Different faith', -20);
      break;
    }
    case 'annex': {
      if (B.overlord !== from) return fail('Only your own subjects.');
      if (B.subjectType === 'union') {
        if (s.day - (B.subjectSince ?? s.day) < years(50)) return fail('A junior partner can be integrated after 50 years.');
      } else if (s.day - (B.subjectSince ?? s.day) < years(15)) return fail('A vassal can be annexed after 15 years.');
      if (op < 50) return fail('They must like you (opinion 50+).');
      add('Ready', 100);
      break;
    }
    case 'improve':
    case 'gift':
    case 'insult':
    case 'rival':
    case 'unrival':
    case 'breakAlliance':
      add('Always possible', 100);
      break;
  }
  const score = reasons.reduce((t, r) => t + r.value, 0);
  return { score, reasons, accept: score >= 0 };
}

export const annexCost = (s: GameState, n: NationId) => Math.round(totalDev(s, n) * 8);
export const GIFT_AMOUNT = (s: GameState, from: NationId) => Math.max(25, Math.round(s.nations[from].lastMonthIncome * 3 / 5) * 5);

/** Rivals must be nearby and of similar size. */
export function canRival(s: GameState, from: NationId, to: NationId): string | null {
  if (s.nations[from].rivals.includes(to)) return 'Already your rival.';
  if (s.nations[from].rivals.length >= 3) return 'You can have at most three rivals.';
  if (proximity(s, from, to) < 0.2) return 'Too far away to be a rival.';
  const r = totalDev(s, to) / Math.max(1, totalDev(s, from));
  if (r < 0.4 || r > 3) return 'Rivals must be roughly your size.';
  return null;
}

export interface ActionResult {
  ok: boolean;
  msg: string;
}

export function doDiplomacy(s: GameState, from: NationId, to: NationId, action: DiploAction): ActionResult {
  const acc = acceptance(s, from, to, action);
  if (acc.blocked) return { ok: false, msg: acc.blocked };
  const A = s.nations[from];
  const B = s.nations[to];
  const name = nationName(to);
  switch (action) {
    case 'improve':
      addOpinion(s, to, from, 'improved', 'Improved relations', 30, 0.5);
      setCooldown(s, from, to, action);
      return { ok: true, msg: `Your envoys are welcomed at the court of ${name}.` };
    case 'gift': {
      const amt = GIFT_AMOUNT(s, from);
      if (A.gold < amt) return { ok: false, msg: `You need ${amt} gold.` };
      A.gold -= amt;
      B.gold += amt;
      addOpinion(s, to, from, 'gift', 'Gifts', Math.min(40, 10 + amt / 4), 1);
      setCooldown(s, from, to, action);
      return { ok: true, msg: `${name} gratefully accepts ${amt} gold.` };
    }
    case 'insult':
      addOpinion(s, to, from, 'insulted', 'Insulted us', -50, 1);
      A.prestige = clamp(A.prestige + 3, 0, 100);
      setCooldown(s, from, to, action);
      return { ok: true, msg: `${name} is furious at your insult.` };
    case 'rival': {
      const why = canRival(s, from, to);
      if (why) return { ok: false, msg: why };
      A.rivals.push(to);
      setCooldown(s, from, to, action);
      return { ok: true, msg: `${name} is now your rival. Beating them earns extra renown and a reason for war.` };
    }
    case 'unrival':
      A.rivals = A.rivals.filter(r => r !== to);
      return { ok: true, msg: `${name} is no longer your rival.` };
    case 'breakAlliance':
      if (!allied(s, from, to)) return { ok: false, msg: 'You are not allied.' };
      delete s.alliances[pairKey(from, to)];
      addOpinion(s, to, from, 'broke_alliance', 'Broke our alliance', -40, 0.5);
      return { ok: true, msg: `Your alliance with ${name} is over.` };
    case 'annex': {
      const cost = annexCost(s, to);
      if (A.gold < cost) return { ok: false, msg: `Annexing costs ${cost} gold.` };
      A.gold -= cost;
      addThreat(s, from, totalDev(s, to) * 0.3);
      annexNation(s, from, to);
      return { ok: true, msg: `${name} is now part of your realm.` };
    }
    default:
      break;
  }
  setCooldown(s, from, to, action);
  if (!acc.accept) {
    return { ok: false, msg: `${name} refuses.` };
  }
  switch (action) {
    case 'alliance':
      s.alliances[pairKey(from, to)] = s.day;
      if (newsworthy(s, from, to)) log(s, 'diplomacy', `${nationName(from)} and ${name} form an alliance.`, { important: involvesPlayer(s, from, to) });
      return { ok: true, msg: `${name} agrees to an alliance.` };
    case 'marriage':
      s.marriages[pairKey(from, to)] = s.day;
      return { ok: true, msg: `A royal marriage binds your house to ${name}.` };
    case 'access':
      s.access[`${to}>${from}`] = s.day;
      return { ok: true, msg: `${name} grants your armies passage.` };
    case 'vassalize':
      makeSubject(s, from, to, 'vassal');
      addThreat(s, from, totalDev(s, to) * 0.5);
      if (newsworthy(s, from, to)) log(s, 'diplomacy', `${name} becomes a vassal of ${nationName(from)}.`, { important: involvesPlayer(s, from, to) });
      return { ok: true, msg: `${name} bends the knee and becomes your vassal.` };
    default:
      return { ok: false, msg: 'Nothing happens.' };
  }
}

export const relationsSummary = (s: GameState, n: NationId) => ({
  allies: alliesOf(s, n),
  subjects: subjectsOf(s, n),
  neighbors: neighborsOf(s, n),
  rivals: s.nations[n].rivals,
  coalition: coalitionOf(s, n),
  topOverlord: topOverlord(s, n),
});
