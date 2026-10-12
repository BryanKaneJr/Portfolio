/** Plain-English descriptions of effects, goals and modifiers ("every number explained"). */
import { ADVANCE, ERA, EVENT, NATION, POLICY, REGION, TRAITS, nationName } from '../sim/content';
import { GOOD_NAME } from '../sim/colonies';
import type { Condition, Effect, Modifiers } from '../sim/types';

const reg = (r: string) => REGION[r]?.name ?? r;
const regs = (x: string | string[]) => (Array.isArray(x) ? x.map(reg).join(', ') : reg(x));
const nat = (n: string) => nationName(n);
const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`.replace('-', '−'));
const pctS = (n: number) => `${n > 0 ? '+' : '−'}${Math.round(Math.abs(n) * 100)}%`;

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

export function effectLines(e: Effect): ModLine[] {
  const k = Object.keys(e)[0];
  const v = (e as any)[k];
  const L = (text: string, good = true): ModLine[] => [{ text, good }];
  switch (k) {
    case 'gold':
      return L(`${sgn(v)} gold`, v > 0);
    case 'goldPerDev':
      return L(`${v > 0 ? 'Gold' : 'Pay gold'} (${Math.abs(v)} × your prosperity)`, v > 0);
    case 'manpower':
      return L(`${sgn(v).replace(/(\d)(?=(\d{3})+$)/g, '$1,')} levies`, v > 0);
    case 'stability':
      return L(`Order ${sgn(v)}`, v > 0);
    case 'prestige':
      return L(`Renown ${sgn(v)}`, v > 0);
    case 'science':
      return L(`${sgn(v)} science`, v > 0);
    case 'threat':
      return L(`Threat ${sgn(v)}`, v < 0);
    case 'papalFavor':
      return L(`Papal Favor ${sgn(v)}`, v > 0);
    case 'warExhaustion':
      return L(`War exhaustion ${sgn(v)}`, v < 0);
    case 'addClaim':
      return L(`Claim on ${regs(v)}`);
    case 'addCore':
      return L(`${regs(v)} becomes integrated`);
    case 'devRegion':
      return L(`${reg(v.region)} prosperity ${sgn(v.amount)}`, v.amount > 0);
    case 'devCapital':
      return L(`Capital prosperity ${sgn(v)}`, v > 0);
    case 'fortRegion':
      return L(`${reg(v.region)} fort ${sgn(v.amount)}`, v.amount > 0);
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
    case 'rebels':
      return L(`Rebels rise (${v.regiments} regiments)${v.region ? ` in ${reg(v.region)}` : ''}`, false);
    case 'addRegiments':
      return L(`Free army: ${[v.inf && `${v.inf} infantry`, v.cav && `${v.cav} cavalry`, v.art && `${v.art} artillery`].filter(Boolean).join(', ')}`);
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
      return L(`Ruler skill ${sgn(v)}`, v > 0);
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
    case 'settlers':
      return L(`${sgn(v)} settlers in each of your colonies`, v > 0);
    default:
      return [];
  }
}
export const effectsLines = (effects: Effect[]) =>
  effects.flatMap(effectLines).filter(l => !/flag/i.test(l.text));

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

/** Split a goal into checkable parts for the mission list. */
export function goalParts(c: Condition): Condition[] {
  return 'all' in c ? c.all : [c];
}

export const nationAdj = (n: string) => NATION[n]?.adj ?? n;
