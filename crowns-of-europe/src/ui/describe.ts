/** Plain-English descriptions of effects, goals and modifiers ("every number explained"). */
import { ADVANCE, ERA, EVENT, NATION, POLICY, REGION, TRAITS, nationName, regionName } from '../sim/content';
import { claimReason } from '../sim/war';
import { yearOf } from '../sim/util';
import { GOOD_NAME, coloniesOf } from '../sim/colonies';
import { defensiveCall } from '../sim/log';
import { effectDelta, effectRegion, walkEffects } from '../sim/events';
import type { BattleReport, Condition, Effect, GameState, Modifiers, NationId, Offer } from '../sim/types';

const reg = (r: string) => REGION[r]?.name ?? r;
const regs = (x: string | string[]) => (Array.isArray(x) ? x.map(reg).join(', ') : reg(x));
const nat = (n: string) => nationName(n);
const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`.replace('-', '−'));
const pctS = (n: number) => `${n > 0 ? '+' : '−'}${Math.round(Math.abs(n) * 100)}%`;
/** A whole number with thousands separators. */
const int = (n: number) => Math.round(n).toLocaleString('en-US');
/** To one decimal place, only when it has one. */
const dec = (n: number) => Math.round(n * 10) / 10;

const MOD_LABEL: Record<keyof Modifiers, [string, 'pct' | 'flat', boolean]> = {
  taxIncome: ['tax income', 'pct', true],
  tradeIncome: ['trade income', 'pct', true],
  manpower: ['levies', 'pct', true],
  morale: ['army morale', 'pct', true],
  infantryPower: ['infantry strength', 'pct', true],
  cavalryPower: ['cavalry strength', 'pct', true],
  artilleryPower: ['artillery strength', 'pct', true],
  fortDefense: ['fort defense', 'pct', true],
  siegeSpeed: ['siege speed', 'pct', true],
  attrition: ['attrition taken', 'pct', false],
  upkeep: ['army upkeep', 'pct', false],
  mercCost: ['mercenary cost', 'pct', false],
  devCost: ['cost to invest', 'pct', false],
  coreCost: ['cost to integrate', 'pct', false],
  fortCost: ['fort cost', 'pct', false],
  shipCost: ['ship cost', 'pct', false],
  navalPower: ['fleet strength', 'pct', true],
  threatDecay: ['Threat decay per month', 'flat', true],
  threatGain: ['Threat gained', 'pct', false],
  colonists: ['colonists', 'flat', true],
  settlerGrowth: ['settler growth', 'pct', true],
  opinion: ['opinion of you', 'flat', true],
  diplomacy: ['diplomatic reputation', 'flat', true],
  holyWarMorale: ['morale against other faiths', 'pct', true],
  unrest: ['unrest', 'flat', false],
  techCost: ['cost of advances', 'pct', false],
  movement: ['movement speed', 'pct', true],
  prestigeGain: ['renown gained', 'pct', true],
  stabilityCost: ['cost to raise order', 'pct', false],
  science: ['science', 'pct', true],
  forceLimit: ['army limit', 'pct', true],
  warTechCost: ['cost of war advances', 'pct', false],
};

export interface ModLine {
  text: string;
  good: boolean;
}

export function modLines(mods: Modifiers): ModLine[] {
  return (Object.entries(mods) as [keyof Modifiers, number][])
    .filter(([, v]) => v)
    .map(([k, v]) => {
      const [label, kind, higherIsGood] = MOD_LABEL[k] ?? [k, 'flat', true];
      const text = kind === 'pct' ? `${pctS(v)} ${label}` : `${sgn(Math.round(v * 100) / 100)} ${label}`;
      return { text, good: higherIsGood ? v > 0 : v < 0 };
    });
}
export const modsText = (mods: Modifiers) => modLines(mods).map(l => l.text).join(', ');

/** The game and the nation an effect would be applied to: with it, effects show what they would really do now. */
export interface EffectContext {
  s: GameState;
  n: NationId;
}

/** Gold paid or received, in coins: "Pay 84 gold", "+84 gold". */
const goldLine = (d: number): ModLine[] => [{ text: Math.round(d) < 0 ? `Pay ${int(-d)} gold` : `+${int(d)} gold`, good: d >= 0 }];

/**
 * An effect in plain words. Given the game (`ctx`), amounts are what applying it would change right now, as the sim
 * does it (effectDelta: gold per prosperity in coins, order or renown already at their limits...); without one (a
 * listing with no game), the rule as written.
 */
export function effectLines(e: Effect, ctx?: EffectContext): ModLine[] {
  const k = Object.keys(e)[0];
  const v = (e as any)[k];
  const L = (text: string, good = true): ModLine[] => [{ text, good }];
  const d = ctx ? effectDelta(ctx.s, ctx.n, e) : null;
  const realm = ctx?.s.nations[ctx.n];
  /**
   * With the game: the change it would make now (`text`), or, when a floor or ceiling leaves nothing to change,
   * `stays`. Null without the game. `up` is whether a rise is good.
   */
  const now = (text: (x: number) => string, stays: string, nominal: number, up = true, round = Math.round): ModLine[] | null => {
    if (d === null) return null;
    const x = round(d);
    return x === 0 && nominal !== 0 ? L(stays, up === (nominal > 0)) : L(text(x), up === (x > 0));
  };
  switch (k) {
    case 'gold':
      return goldLine(v);
    case 'goldPerDev':
      return d !== null ? goldLine(d) : L(`${v > 0 ? 'Gold' : 'Pay gold'}: ${Math.abs(v)} for each point of prosperity`, v > 0);
    case 'manpower':
      return now(x => `${x > 0 ? '+' : '−'}${int(Math.abs(x))} levies`, 'No levies left to lose', v) ?? L(`${sgn(v).replace(/(\d)(?=(\d{3})+$)/g, '$1,')} levies`, v > 0);
    case 'stability':
      return now(x => `Order ${sgn(x)}`, `Order stays at ${sgn(realm?.stability ?? 0)}`, v) ?? L(`Order ${sgn(v)}`, v > 0);
    case 'prestige':
      return now(x => `Renown ${sgn(x)}`, `Renown stays at ${Math.round(realm?.prestige ?? 0)}`, v) ?? L(`Renown ${sgn(v)}`, v > 0);
    case 'science':
      return now(x => `${sgn(x)} science`, 'No science left to lose', v) ?? L(`${sgn(v)} science`, v > 0);
    case 'threat':
      return now(x => `Threat ${sgn(x)}`, `Threat stays at ${dec(realm?.threat ?? 0)}`, v, false, dec) ?? L(`Threat ${sgn(v)}`, v < 0);
    case 'papalFavor':
      if (realm && realm.faith !== 'catholic') return L('No Papal Favor: your ruler is outside the Church', v > 0);
      return now(x => `Papal Favor ${sgn(x)}`, `Papal Favor stays at ${Math.round(realm?.papalFavor ?? 0)}`, v) ?? L(`Papal Favor ${sgn(v)}`, v > 0);
    case 'warExhaustion':
      return now(x => `War exhaustion ${sgn(x)}`, `War exhaustion stays at ${dec(realm?.warExhaustion ?? 0)}`, v, false, dec) ?? L(`War exhaustion ${sgn(v)}`, v < 0);
    case 'addClaim':
      return L(`Claim on ${regs(v)}`);
    case 'addCore':
      return L(`${regs(v)} becomes integrated`);
    case 'devRegion': {
      const r = ctx?.s.regions[v.region];
      return now(x => `${reg(v.region)} prosperity ${sgn(x)}`, `${reg(v.region)} prosperity stays at ${r?.dev}`, v.amount) ?? L(`${reg(v.region)} prosperity ${sgn(v.amount)}`, v.amount > 0);
    }
    case 'devCapital': {
      const cap = ctx ? effectRegion(ctx.s, ctx.n, e) : null;
      const name = cap ? reg(cap) : 'Capital';
      return now(x => `${name} prosperity ${sgn(x)}`, `${name} prosperity stays at ${cap ? ctx?.s.regions[cap]?.dev : ''}`, v) ?? L(`Capital prosperity ${sgn(v)}`, v > 0);
    }
    case 'fortRegion': {
      const r = ctx?.s.regions[v.region];
      return now(x => `${reg(v.region)} fort ${sgn(x)}`, `${reg(v.region)} fort stays at level ${r?.fort}`, v.amount) ?? L(`${reg(v.region)} fort ${sgn(v.amount)}`, v.amount > 0);
    }
    case 'unrestAll':
      return L(`Unrest ${sgn(v)} in all your regions (2 years)`, v < 0);
    case 'unrestRegion':
      return L(`Unrest ${sgn(v.amount)} in ${reg(v.region)} (2 years)`, v.amount < 0);
    case 'convertRegion':
      return L(`${reg(v.region)} becomes ${v.faith}`);
    case 'changeFaith':
      return L(`Your nation becomes ${v}`, true);
    case 'modifier': {
      const dur = v.months > 0 ? (v.months >= 24 ? `${Math.round(v.months / 12)} years` : `${v.months} months`) : 'permanent';
      const lines = modLines(v.mods);
      return [{ text: `“${v.name}” (${dur}): ${lines.map(l => l.text).join(', ')}`, good: lines.filter(l => l.good).length >= lines.length / 2 }];
    }
    case 'removeModifier':
      return L('Removes a modifier');
    case 'rebels': {
      const where = ctx ? effectRegion(ctx.s, ctx.n, e) : v.region;
      return L(`Rebels rise (${v.regiments} regiments)${where ? ` in ${reg(where)}` : ''}`, false);
    }
    case 'addRegiments': {
      const where = ctx ? effectRegion(ctx.s, ctx.n, e) : v.region;
      if (ctx && !where) return L('No free army: your capital is not in your hands', false);
      return L(`Free army${where ? ` at ${reg(where)}` : ''}: ${[v.inf && `${v.inf} infantry`, v.cav && `${v.cav} cavalry`, v.art && `${v.art} artillery`].filter(Boolean).join(', ')}`);
    }
    case 'hireGeneral':
      return L(`A ${v.stars}-star general joins you${v.name ? `: ${v.name}` : ''}`);
    case 'opinion':
      return L(`${nat(v.nation)}'s opinion of you ${sgn(v.amount)}`, v.amount > 0);
    case 'ally':
      return L(`Alliance with ${nat(v)}`);
    case 'breakAlliance':
      return L(`Alliance with ${nat(v)} ends`, false);
    case 'personalUnion':
      return L(`${nat(v)} becomes your junior partner`);
    case 'inherit':
      return L(`You inherit all of ${nat(v)}`);
    case 'independence':
      return L('Independence from your overlord');
    case 'releaseSubject':
      return L(`${nat(v)} is set free`, false);
    case 'transferRegion':
      return L(`${reg(v.region)} goes to ${nat(v.to)}`, true);
    case 'newRuler':
      return L(`New ruler: ${v.name} (skill ${v.skill})`);
    case 'rulerSkill':
      return now(x => `Ruler skill ${sgn(x)}`, `Ruler skill stays at ${realm?.ruler.skill}`, v) ?? L(`Ruler skill ${sgn(v)}`, v > 0);
    case 'rulerTrait':
      return L(`Ruler gains “${TRAITS.ruler[v]?.name ?? v}”`, !['spendthrift', 'cruel', 'craven', 'feeble'].includes(v));
    case 'killRuler':
      return L('Your ruler dies', false);
    case 'newHeir':
      return L(`New heir: ${v.name} (skill ${v.skill})`);
    case 'triggerEvent':
      return L(EVENT[v.id] ? `Later: ${EVENT[v.id].title}` : 'Something follows…');
    case 'reformation':
      return L('The Reformation spreads', false);
    case 'declareWar':
      return L(`War with ${nat(v.target)}${v.with ? `, joined by ${([] as string[]).concat(v.with).map(nat).join(', ')} if they are free to` : ''}`, false);
    case 'loans':
      return L(`${v} loan${v > 1 ? 's' : ''} (+${v * 100} gold, with interest)`, false);
    case 'emperor':
      return L('You become Holy Roman Emperor');
    case 'discoverNewWorld':
      return L('Your ships find the New World');
    case 'settlers': {
      const count = ctx ? coloniesOf(ctx.s, ctx.n).length : null;
      if (count === 0) return L('No colonies to send settlers to', v > 0);
      return L(`${sgn(v)} settlers in ${count === 1 ? 'your colony' : `each of your${count ? ` ${count}` : ''} colonies`}`, v > 0);
    }
    case 'settlersOne': {
      const count = ctx ? coloniesOf(ctx.s, ctx.n).length : null;
      if (count === 0) return L('No colonies to send settlers to', v > 0);
      return L(`${sgn(v)} settlers in ${count === 1 ? 'your colony' : 'one of your colonies'}`, v > 0);
    }
    default:
      return [];
  }
}
const linesMemo = new WeakMap<Effect[], { s: GameState; n: NationId; version: number; lines: ModLine[] }>();

/**
 * A list of effects in plain words. Given the game, each amount is what it changes after the effects before it, as they
 * are applied in order (walkEffects: a new ruler's traits raise the Threat that follows). With `ctx.version` (the
 * store's), the lines are kept until the game changes, so a card can show them on every render.
 */
export function effectsLines(effects: Effect[], ctx?: EffectContext & { version?: number }): ModLine[] {
  if (!ctx) return effects.flatMap(e => effectLines(e)).filter(l => !/flag/i.test(l.text));
  const hit = ctx.version !== undefined ? linesMemo.get(effects) : undefined;
  if (hit && hit.s === ctx.s && hit.n === ctx.n && hit.version === ctx.version) return hit.lines;
  const lines: ModLine[] = [];
  walkEffects(ctx.s, ctx.n, effects, (s, e) => lines.push(...effectLines(e, { s, n: ctx.n })));
  const out = lines.filter(l => !/flag/i.test(l.text));
  if (ctx.version !== undefined) linesMemo.set(effects, { s: ctx.s, n: ctx.n, version: ctx.version, lines: out });
  return out;
}

export function conditionText(c: Condition): string {
  const k = Object.keys(c)[0];
  const v = (c as any)[k];
  switch (k) {
    case 'all':
      return (v as Condition[]).map(conditionText).join('; ');
    case 'any':
      return 'Either: ' + (v as Condition[]).map(conditionText).join(' or ');
    case 'not': {
      const inner = Object.keys(v)[0];
      if (inner === 'exists') return `${nat(v.exists)} no longer exists`;
      if (inner === 'atWar') return 'Be at peace';
      if (inner === 'loansAtLeast') return 'Have no debt';
      return `Not: ${conditionText(v)}`;
    }
    case 'year':
      return v.length > 1 ? `Between ${v[0]} and ${v[1]}` : `Reach the year ${v[0]}`;
    case 'owns':
      return `Own ${regs(v)}`;
    case 'ownsAny':
      return `Own any of ${regs(v)}`;
    case 'controls':
      return `Hold ${reg(v)}`;
    case 'nationOwns':
      return `${nat(v.nation)} owns ${reg(v.region)}`;
    case 'exists':
      return `${nat(v)} exists`;
    case 'atWar':
      return v ? 'Be at war' : 'Be at peace';
    case 'atWarWith':
      return `Be at war with ${nat(v)}`;
    case 'truceWith':
      return `Have a truce with ${nat(v)}`;
    case 'faith':
      return `Be ${v}`;
    case 'stability':
      return `Order of at least ${sgn(v[0])}`;
    case 'goldAtLeast':
      return `Have ${v} gold`;
    case 'prestigeAtLeast':
      return `Have ${v} renown`;
    case 'regionsAtLeast':
      return `Own ${v} regions`;
    case 'regimentsAtLeast':
      return `Have ${v} regiments`;
    case 'devAtLeast':
      return `Total prosperity of ${v}`;
    case 'capitalDevAtLeast':
      return `Capital prosperity of ${v}`;
    case 'allied':
      return `Be allied with ${nat(v)}`;
    case 'alliesAtLeast':
      return `Have ${v} allies`;
    case 'borders':
      return `Border ${nat(v)}`;
    case 'eraAtLeast':
      return `Troops of the ${ERA(v).name} age`;
    case 'isEmperor':
      return v ? 'Be Holy Roman Emperor' : 'Not be Emperor';
    case 'overlordOf':
      return v === true ? 'Have a subject' : `Have ${nat(v)} as a subject`;
    case 'subjectOf':
      return v === true ? 'Be a subject' : `Be a subject of ${nat(v)}`;
    case 'vassalsAtLeast':
      return `Have ${v} subjects`;
    case 'warsWonAtLeast':
      return `Win ${v} war${v > 1 ? 's' : ''}`;
    case 'battlesWonAtLeast':
      return `Win ${v} battle${v > 1 ? 's' : ''}`;
    case 'stackWipesAtLeast':
      return `Annihilate ${v} enemy arm${v > 1 ? 'ies' : 'y'}`;
    case 'bestWinRatioAtLeast':
      return `Win a battle with ${v}× the enemy's numbers`;
    case 'regionsConqueredAtLeast':
      return `Conquer ${v} regions`;
    case 'fleetsAtLeast':
      return `Have ${v} fleet${v > 1 ? 's' : ''}`;
    case 'shipsAtLeast':
      return `Have ${v} ships`;
    case 'hasAdvance':
      return `Know ${ADVANCE[v]?.name ?? v}`;
    case 'hasPolicy':
      return `Adopt the ${POLICY[v]?.name ?? v} policy`;
    case 'regionFaith':
      return `${reg(v.region)} is ${v.faith}`;
    case 'faithRegionsAtLeast':
      return `${v.count} ${v.faith} regions in Europe`;
    case 'loansAtLeast':
      return `Have ${v} loans`;
    case 'threatAtLeast':
      return `Threat of ${v}`;
    case 'papalFavorAtLeast':
      return `${v} Papal Favor`;
    case 'discovered':
      return v ? 'The New World has been found' : 'Before anyone finds the New World';
    case 'coloniesAtLeast':
      return `Own ${v} region${v > 1 ? 's' : ''} in the New World`;
    case 'colonizingAtLeast':
      return `Settle ${v} colon${v > 1 ? 'ies' : 'y'} at once`;
    case 'ownsGood':
      return `Own a region that trades in ${GOOD_NAME[v as keyof typeof GOOD_NAME].toLowerCase()}`;
    case 'native':
      return v ? 'Be a New World people' : 'Be a European crown';
    case 'hreMember':
      return v ? 'Be part of the Empire' : 'Be outside the Empire';
    case 'isNation':
      return `Be ${Array.isArray(v) ? v.map(nat).join(' or ') : nat(v)}`;
    case 'gov':
      return `Be a ${v}`;
    case 'coastal':
      return 'Have a coast';
    case 'rulerSkill':
      return `Ruler skill ${v[0]}+`;
    default:
      return k;
  }
}

/** Split a goal into checkable parts for the mission list: moved to sim/goals.ts. */
export { goalParts } from '../sim/goals';

/** A realm's adjective as shown (a proclaimed crown's): moved to sim/content.ts. */
export { nationAdj } from '../sim/content';

/** An offer in a few words, for its notice and the messages: "Castile proposes peace". */
export function offerTitle(o: Offer): string {
  const from = nat(o.from);
  switch (o.kind) {
    case 'callToArms':
      return `${from} calls you to arms`;
    case 'peace':
      return o.ultimatum !== undefined ? `${from} sends you an ultimatum` : `${from} proposes peace`;
    case 'alliance':
      return `${from} proposes an alliance`;
    case 'marriage':
      return `${from} proposes a royal marriage`;
    case 'access':
      return `${from} asks to march through your lands`;
  }
}

/** The claims of `n` on `regions`, each with the year it lapses: "Normandy (1475), Gascony (1475)". */
export function claimsText(s: GameState, n: NationId, regions: string[]): string {
  return regions
    .map(r => {
      const until = s.nations[n].claims[r];
      return until >= 0 ? `${regionName(r)} (${yearOf(until)})` : regionName(r);
    })
    .join(', ');
}

/** The quarrels of 1444 behind those claims, each once: "The Hundred Years’ War: Normandy, Gascony." */
export function claimsWhy(s: GameState, n: NationId, regions: string[]): string {
  const by = new Map<string, string[]>();
  for (const r of regions) {
    const why = claimReason(s, n, r);
    if (why) by.set(why, [...(by.get(why) ?? []), regionName(r)]);
  }
  return [...by].map(([why, names]) => `${why}: ${names.join(', ')}.`).join(' ');
}

/**
 * What letting an offer lapse does, when it does something: an unanswered call to arms counts as refusing it, and
 * refusing an ally under attack breaks the alliance. Read after "Lapses 1 Mar 1445".
 */
export function lapseMeans(s: GameState, o: Offer): string | null {
  if (o.kind !== 'callToArms') return null;
  return defensiveCall(s, o) ? 'as a refusal: the alliance breaks' : 'as a refusal';
}

/** A battle and how it went, for its notice: "Battle of Granada: victory". */
export function battleResult(r: BattleReport): string {
  const you = r.playerSide;
  const won = you !== null && r.winner === you;
  const how =
    you === null
      ? `${r.nations[r.winner].map(n => (NATION[n] ? nat(n) : 'Rebels')).join(', ')} won`
      : r.wiped
        ? won
          ? 'the enemy is annihilated'
          : 'your army is destroyed'
        : r.scattered
          ? won
            ? 'the enemy scatters'
            : 'your army scatters'
          : won
            ? 'victory'
            : 'defeat';
  return `Battle of ${reg(r.node)}: ${how}`;
}

const GROUND_NAME: Record<string, string> = { mountains: 'the mountains', hills: 'the hills', forest: 'the forest', marsh: 'the marsh', plains: 'open ground' };
const stars = (n: number) => (n ? `${n} star${n > 1 ? 's' : ''}` : 'no general');

/**
 * Why a battle went as it did, from the player's side: at most three lines, the weightiest first (the ground, the
 * generals, the men's morale at the start, numbers, the troops' age). Reports from before this was kept say nothing.
 */
export function battleWhy(r: BattleReport): string[] {
  const w = r.why;
  const me = r.playerSide;
  if (!w || me === null) return [];
  const them = (1 - me) as 0 | 1;
  const out: { w: number; text: string }[] = [];
  if (w.penalty > 0) {
    const where = `${GROUND_NAME[w.terrain]}${w.river ? ', across a river' : ''}`;
    out.push({ w: w.penalty, text: me === 0 ? `We attacked into ${where}: −${w.penalty} to our rolls.` : `They attacked into ${where}: −${w.penalty} to their rolls.` });
  }
  const st = w.stars[me] - w.stars[them];
  if (st) out.push({ w: Math.abs(st), text: `Our general: ${stars(w.stars[me])}; theirs: ${stars(w.stars[them])}.` });
  const [m0, m1] = [w.morale[me], w.morale[them]];
  if (Math.max(m0, m1) > 0 && Math.abs(m0 - m1) / Math.max(m0, m1) >= 0.2) out.push({ w: 1.5, text: `Morale at the start: ${dec(m0)} against their ${dec(m1)}.` });
  const [g0, g1] = [w.regs[me], w.regs[them]];
  if (Math.max(g0, g1) >= 1.5 * Math.max(1, Math.min(g0, g1))) out.push({ w: 2.5, text: `We had ${g0} regiment${g0 === 1 ? '' : 's'} to their ${g1}.` });
  const era = w.era[me] - w.era[them];
  if (era) out.push({ w: 1.5 * Math.abs(era), text: era > 0 ? 'Our troops were an age ahead.' : 'Their troops were an age ahead.' });
  return out
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map(x => x.text);
}
