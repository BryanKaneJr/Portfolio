/**
 * Schema for the condition/effect mini-language used by events, missions and achievements.
 * The validator (scripts/validate-content.ts) and the evaluator (events.ts) both read this table,
 * so a new key has to be added here, implemented in events.ts, and documented in docs/content-guide.md.
 */
import { ADVANCE, NATION, REGION, EVENT } from './content';

type ArgName =
  | 'bool'
  | 'true'
  | 'number'
  | 'chance'
  | 'range'
  | 'region'
  | 'regionOrList'
  | 'regionList'
  | 'nation'
  | 'nationOrList'
  | 'nationOrTrue'
  | 'faith'
  | 'gov'
  | 'tier'
  | 'good'
  | 'string'
  | 'conds'
  | 'cond';
/** A plain argument, or an object whose fields are arguments (a trailing "?" marks a field optional). */
type Arg = ArgName | { [field: string]: string };

export const FAITHS = ['catholic', 'orthodox', 'muslim', 'protestant', 'native'];
const GOODS = ['silver', 'gold', 'ivory', 'sugar', 'tobacco', 'cocoa', 'dyes', 'furs', 'fish', 'grain'];
const GOVS = ['monarchy', 'republic', 'theocracy'];
const TIERS = ['major', 'hard', 'minor'];
const MODIFIER_KEYS = [
  'taxIncome', 'tradeIncome', 'manpower', 'morale', 'infantryPower', 'cavalryPower', 'artilleryPower', 'fortDefense',
  'siegeSpeed', 'attrition', 'upkeep', 'mercCost', 'devCost', 'coreCost', 'fortCost', 'shipCost', 'navalPower',
  'threatDecay', 'threatGain', 'opinion', 'diplomacy', 'holyWarMorale', 'unrest', 'techCost', 'movement',
  'prestigeGain', 'stabilityCost', 'colonists', 'settlerGrowth', 'science', 'forceLimit', 'warTechCost',
];
export const EVENT_IMAGES = [
  'crown', 'swords', 'siege', 'ship', 'church', 'plague', 'harvest', 'scroll', 'coins', 'castle', 'cannon', 'treaty',
  'book', 'rebels', 'marriage', 'death', 'horse', 'map',
];
const CB = ['claim', 'holy', 'rival', 'none', 'independence', 'coalition', 'reconquest'];

export const CONDITION_SCHEMA: Record<string, Arg> = {
  all: 'conds',
  any: 'conds',
  not: 'cond',
  year: 'range',
  isNation: 'nationOrList',
  isPlayer: 'bool',
  owns: 'regionOrList',
  ownsAny: 'regionList',
  controls: 'region',
  nationOwns: { nation: 'nation', region: 'region' },
  exists: 'nation',
  atWar: 'bool',
  atWarWith: 'nation',
  truceWith: 'nation',
  faith: 'faith',
  nationFaith: { nation: 'nation', faith: 'faith' },
  stability: 'range',
  goldAtLeast: 'number',
  prestigeAtLeast: 'number',
  threatAtLeast: 'number',
  regionsAtLeast: 'number',
  regimentsAtLeast: 'number',
  devAtLeast: 'number',
  capitalDevAtLeast: 'number',
  allied: 'nation',
  alliesAtLeast: 'number',
  borders: 'nation',
  rulerSkill: 'range',
  rulerAgeAtLeast: 'number',
  hasHeir: 'bool',
  eraAtLeast: 'number',
  flag: 'string',
  nationFlag: 'string',
  loansAtLeast: 'number',
  isEmperor: 'bool',
  isElector: 'bool',
  subjectOf: 'nationOrTrue',
  overlordOf: 'nationOrTrue',
  vassalsAtLeast: 'number',
  regionFaith: { region: 'region', faith: 'faith' },
  faithRegionsAtLeast: { faith: 'faith', count: 'number' },
  gov: 'gov',
  tier: 'tier',
  hasPolicy: 'string',
  hasAdvance: 'string',
  warsWonAtLeast: 'number',
  battlesWonAtLeast: 'number',
  stackWipesAtLeast: 'number',
  bestWinRatioAtLeast: 'number',
  regionsConqueredAtLeast: 'number',
  fleetsAtLeast: 'number',
  shipsAtLeast: 'number',
  coastal: 'bool',
  inCoalition: 'bool',
  coalitionAgainst: 'bool',
  hreMember: 'bool',
  papalFavorAtLeast: 'number',
  discovered: 'bool',
  coloniesAtLeast: 'number',
  colonizingAtLeast: 'number',
  ownsGood: 'good',
  native: 'bool',
  chance: 'chance',
};

export const EFFECT_SCHEMA: Record<string, Arg> = {
  gold: 'number',
  goldPerDev: 'number',
  manpower: 'number',
  stability: 'number',
  prestige: 'number',
  science: 'number',
  threat: 'number',
  papalFavor: 'number',
  warExhaustion: 'number',
  addClaim: 'regionOrList',
  addCore: 'regionOrList',
  devRegion: { region: 'region', amount: 'number' },
  devCapital: 'number',
  fortRegion: { region: 'region', amount: 'number' },
  unrestAll: 'number',
  unrestRegion: { region: 'region', amount: 'number' },
  convertRegion: { region: 'region', faith: 'faith' },
  changeFaith: 'faith',
  setFlag: 'string',
  clearFlag: 'string',
  setNationFlag: 'string',
  modifier: { id: 'string', name: 'string', months: 'number', mods: 'string' }, // mods checked separately
  removeModifier: 'string',
  rebels: { region: 'region?', regiments: 'number' },
  addRegiments: { inf: 'number?', cav: 'number?', art: 'number?', region: 'region?' },
  hireGeneral: { fire: 'number', shock: 'number', maneuver: 'number', name: 'string?' },
  opinion: { nation: 'nation', amount: 'number' },
  ally: 'nation',
  breakAlliance: 'nation',
  personalUnion: 'nation',
  inherit: 'nation',
  independence: 'true',
  releaseSubject: 'nation',
  transferRegion: { region: 'region', to: 'nation' },
  newRuler: { name: 'string', skill: 'number', traits: 'string?', age: 'number?' },
  rulerSkill: 'number',
  rulerTrait: 'string',
  killRuler: 'true',
  newHeir: { name: 'string', skill: 'number', traits: 'string?', age: 'number?' },
  triggerEvent: { id: 'string', months: 'number?', nation: 'nation?' },
  reformation: 'number',
  declareWar: { target: 'nation', cb: 'string?', region: 'region?', with: 'nationOrList?' },
  loans: 'number',
  emperor: 'true',
  discoverNewWorld: 'true',
  settlers: 'number',
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkArg(arg: Arg, v: unknown, where: string, errs: string[], ctx: { conds: boolean }): void {
  const bad = (msg: string): void => {
    errs.push(`${where}: ${msg} (got ${JSON.stringify(v)})`);
  };
  if (typeof arg === 'object') {
    if (!isObj(v)) return bad('expected an object');
    for (const [field, spec] of Object.entries(arg)) {
      const optional = spec.endsWith('?');
      const base = (optional ? spec.slice(0, -1) : spec) as ArgName;
      if (!(field in v)) {
        if (!optional) bad(`missing "${field}"`);
        continue;
      }
      if (field === 'traits' && Array.isArray(v[field])) continue;
      checkArg(base, v[field], `${where}.${field}`, errs, ctx);
    }
    for (const k of Object.keys(v)) if (!(k in arg)) bad(`unknown field "${k}"`);
    return;
  }
  switch (arg) {
    case 'bool':
      if (typeof v !== 'boolean') bad('expected true/false');
      return;
    case 'true':
      if (v !== true) bad('expected true');
      return;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) bad('expected a number');
      return;
    case 'chance':
      if (typeof v !== 'number' || v <= 0 || v > 1) bad('expected a chance between 0 and 1');
      return;
    case 'range':
      if (!Array.isArray(v) || v.length < 1 || v.length > 2 || v.some(x => typeof x !== 'number')) bad('expected [min] or [min, max]');
      return;
    case 'region':
      if (typeof v !== 'string' || !REGION[v]) bad('unknown region');
      return;
    case 'regionList':
      if (!Array.isArray(v) || v.length === 0) return bad('expected a list of regions');
      v.forEach((x, i) => checkArg('region', x, `${where}[${i}]`, errs, ctx));
      return;
    case 'regionOrList':
      if (Array.isArray(v)) return checkArg('regionList', v, where, errs, ctx);
      return checkArg('region', v, where, errs, ctx);
    case 'nation':
      if (typeof v !== 'string' || !NATION[v]) bad('unknown nation');
      return;
    case 'nationOrList':
      if (Array.isArray(v)) return v.forEach((x, i) => checkArg('nation', x, `${where}[${i}]`, errs, ctx));
      return checkArg('nation', v, where, errs, ctx);
    case 'nationOrTrue':
      if (v === true) return;
      return checkArg('nation', v, where, errs, ctx);
    case 'faith':
      if (typeof v !== 'string' || !FAITHS.includes(v)) bad('unknown faith');
      return;
    case 'gov':
      if (typeof v !== 'string' || !GOVS.includes(v)) bad('unknown government');
      return;
    case 'tier':
      if (typeof v !== 'string' || !TIERS.includes(v)) bad('unknown tier');
      return;
    case 'good':
      if (typeof v !== 'string' || !GOODS.includes(v)) bad('unknown export good');
      return;
    case 'string':
      if (typeof v !== 'string' || !v) bad('expected text');
      return;
    case 'conds':
      if (!Array.isArray(v) || v.length === 0) return bad('expected a list of conditions');
      v.forEach((c, i) => validateCondition(c, `${where}[${i}]`, errs));
      return;
    case 'cond':
      return validateCondition(v, where, errs);
  }
}

export function validateCondition(c: unknown, where: string, errs: string[]): void {
  if (!isObj(c)) return void errs.push(`${where}: a condition must be an object with one key`);
  const keys = Object.keys(c);
  if (keys.length !== 1) return void errs.push(`${where}: a condition must have exactly one key, got ${keys.join(', ')}`);
  const key = keys[0];
  const arg = CONDITION_SCHEMA[key];
  if (!arg) return void errs.push(`${where}: unknown condition "${key}"`);
  checkArg(arg, c[key], `${where}.${key}`, errs, { conds: true });
  if (key === 'hasAdvance' && !ADVANCE[c[key] as string]) errs.push(`${where}.hasAdvance: unknown advance "${c[key]}"`);
}

export function validateEffect(e: unknown, where: string, errs: string[]): void {
  if (!isObj(e)) return void errs.push(`${where}: an effect must be an object with one key`);
  const keys = Object.keys(e);
  if (keys.length !== 1) return void errs.push(`${where}: an effect must have exactly one key, got ${keys.join(', ')}`);
  const key = keys[0];
  const arg = EFFECT_SCHEMA[key];
  if (!arg) return void errs.push(`${where}: unknown effect "${key}"`);
  const v = e[key];
  if (key === 'modifier') {
    if (!isObj(v)) return void errs.push(`${where}.modifier: expected an object`);
    for (const f of ['id', 'name']) if (typeof v[f] !== 'string') errs.push(`${where}.modifier: missing ${f}`);
    if (typeof v.months !== 'number') errs.push(`${where}.modifier: missing months`);
    if (!isObj(v.mods) || !Object.keys(v.mods).length) errs.push(`${where}.modifier: mods must be a non-empty object`);
    else for (const [mk, mv] of Object.entries(v.mods)) {
      if (!MODIFIER_KEYS.includes(mk)) errs.push(`${where}.modifier.mods: unknown modifier "${mk}"`);
      if (typeof mv !== 'number') errs.push(`${where}.modifier.mods.${mk}: expected a number`);
    }
    return;
  }
  checkArg(arg, v, `${where}.${key}`, errs, { conds: false });
  if (key === 'triggerEvent' && isObj(v) && typeof v.id === 'string' && !EVENT[v.id]) errs.push(`${where}.triggerEvent: unknown event "${v.id}"`);
  if (key === 'declareWar' && isObj(v) && v.cb && !CB.includes(v.cb as string)) errs.push(`${where}.declareWar: unknown cb`);
}

export { MODIFIER_KEYS };
