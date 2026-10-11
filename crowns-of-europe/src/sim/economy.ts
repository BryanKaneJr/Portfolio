/** Gold, manpower, stability and prestige: the monthly economy and the prices of everything. */
import { NATION, REGION, UNITS } from './content';
import { log, involvesPlayer } from './log';
import {
  armiesOf,
  atWar,
  fleetsOf,
  forceLimit,
  isCored,
  nationMods,
  ownedRegions,
  subjectsOf,
  totalDev,
} from './queries';
import type { GameState, NationId, Region, ShipType } from './types';
import { COLONY_UPKEEP, coloniesOf, goodsIncome } from './colonies';
import { FUNDING } from './science';
import { chance, clamp, years } from './util';

export const TAX_PER_DEV = 0.3;
export const LOAN_SIZE = 100;
export const LOAN_INTEREST = 0.05; // per year
export const MAX_LOANS = 10;

export interface LineItem {
  label: string;
  value: number;
}
export interface Ledger {
  income: LineItem[];
  expenses: LineItem[];
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export function taxMultiplier(s: GameState, n: NationId): number {
  const nat = s.nations[n];
  const m = nationMods(s, n);
  const ruler = (nat.ruler.skill - 3) * 0.05 - (nat.ruler.regency ? 0.05 : 0);
  return Math.max(0.2, 1 + nat.stability * 0.05 + m.taxIncome + ruler);
}

export function regionTax(s: GameState, r: Region): number {
  if (!r.owner || r.controller !== r.owner) return 0;
  const n = r.owner;
  const nat = s.nations[n];
  if (!nat) return 0;
  let v = r.dev * TAX_PER_DEV * (isCored(r) ? 1 : 0.5) * taxMultiplier(s, n);
  if (r.blockaded) v *= 0.5;
  if (r.unrest > 5) v *= 0.75;
  if (r.faith !== nat.faith) v *= 0.9;
  return v;
}

export function regionTrade(s: GameState, r: Region): number {
  if (!REGION[r.id].trade || !r.owner || r.controller !== r.owner) return 0;
  const m = nationMods(s, r.owner);
  let v = (1.2 + r.dev * 0.12) * (isCored(r) ? 1 : 0.5) * (1 + m.tradeIncome);
  if (r.blockaded) v *= 0.4;
  return v;
}

function grossIncome(s: GameState, n: NationId): { tax: number; trade: number; goods: number } {
  let tax = 0;
  let trade = 0;
  let goods = 0;
  for (const r of ownedRegions(s, n)) {
    tax += regionTax(s, r);
    trade += regionTrade(s, r);
    goods += goodsIncome(s, r);
  }
  return { tax, trade, goods };
}

export function tributeRate(s: GameState, n: NationId): number {
  const nat = s.nations[n];
  if (!nat.overlord) return 0;
  return nat.subjectType === 'union' ? 0.1 : 0.2;
}

export function armyUpkeep(s: GameState, n: NationId): { regular: number; mercs: number } {
  const nat = s.nations[n];
  const m = nationMods(s, n);
  const mode = nat.armyMode === 'war' ? 1 : 0.5;
  let regular = 0;
  let mercs = 0;
  let regs = 0;
  for (const a of armiesOf(s, n)) {
    const full = a.regs.inf.n * UNITS.unitUpkeep.inf + a.regs.cav.n * UNITS.unitUpkeep.cav + a.regs.art.n * UNITS.unitUpkeep.art;
    const count = a.regs.inf.n + a.regs.cav.n + a.regs.art.n;
    regs += count;
    if (!count) continue;
    const mercShare = a.mercs / count;
    regular += full * (1 - mercShare) * mode;
    mercs += full * mercShare * 1.5;
  }
  const fl = forceLimit(s, n);
  const over = regs > fl ? 1 + (regs - fl) / fl : 1;
  const k = (1 + m.upkeep) * over;
  return { regular: regular * k, mercs: mercs * k };
}

export function navyUpkeep(s: GameState, n: NationId): number {
  let v = 0;
  for (const f of fleetsOf(s, n)) for (const t of Object.keys(f.ships) as ShipType[]) v += f.ships[t] * UNITS.ships[t].upkeep;
  return v;
}

export function fortUpkeep(s: GameState, n: NationId): number {
  let levels = 0;
  for (const r of ownedRegions(s, n)) levels += r.fort - (r.id === s.nations[n].capital ? Math.min(1, r.fort) : 0);
  return levels * 0.35;
}

export function ledger(s: GameState, n: NationId): Ledger {
  const nat = s.nations[n];
  const { tax, trade, goods } = grossIncome(s, n);
  let tributeIn = 0;
  for (const sub of subjectsOf(s, n)) {
    const g = grossIncome(s, sub);
    tributeIn += (g.tax + g.trade + g.goods) * tributeRate(s, sub);
  }
  const tributeOut = (tax + trade + goods) * tributeRate(s, n);
  const army = armyUpkeep(s, n);
  const income: LineItem[] = [
    { label: 'Taxes', value: tax },
    { label: 'Trade', value: trade },
  ];
  if (goods > 0) income.push({ label: 'Colonial goods', value: goods });
  if (tributeIn > 0) income.push({ label: 'Tribute from subjects', value: tributeIn });
  const generals = (armiesOf(s, n).filter(a => a.general && !a.general.isRuler).length + nat.generals.length) * 0.25;
  const expenses: LineItem[] = [
    { label: nat.armyMode === 'war' ? 'Army (wartime pay)' : 'Army (peacetime pay)', value: army.regular },
  ];
  if (army.mercs > 0) expenses.push({ label: 'Mercenaries', value: army.mercs });
  const navy = navyUpkeep(s, n);
  if (navy > 0) expenses.push({ label: 'Navy', value: navy });
  const forts = fortUpkeep(s, n);
  if (forts > 0) expenses.push({ label: 'Forts', value: forts });
  if (generals > 0) expenses.push({ label: 'Generals', value: generals });
  const funding = FUNDING[nat.scienceFunding]?.gold ?? 0;
  if (funding > 0) expenses.push({ label: 'Science funding', value: funding });
  const colonies = coloniesOf(s, n).length;
  if (colonies > 0) expenses.push({ label: `Colonies being settled (${colonies})`, value: colonies * COLONY_UPKEEP });
  if (nat.loans > 0) expenses.push({ label: `Interest on ${nat.loans} loan${nat.loans > 1 ? 's' : ''}`, value: (nat.loans * LOAN_SIZE * LOAN_INTEREST) / 12 });
  if (tributeOut > 0) expenses.push({ label: `Tribute to ${NATION[nat.overlord!]?.name}`, value: tributeOut });
  const totalIncome = income.reduce((a, i) => a + i.value, 0);
  const totalExpenses = expenses.reduce((a, i) => a + i.value, 0);
  return { income, expenses, totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
}

export function maxManpower(s: GameState, n: NationId): number {
  const m = nationMods(s, n);
  let base = 3000;
  for (const r of ownedRegions(s, n)) base += r.dev * 400 * (isCored(r) ? 1 : 0.5) * (r.controller === n ? 1 : 0.5);
  return Math.round(base * (1 + m.manpower));
}
export const manpowerRecovery = (s: GameState, n: NationId) =>
  (maxManpower(s, n) / 60) * Math.max(0.3, 1 - s.nations[n].warExhaustion / 30);

// ---------------------------------------------------------------- prices

export function devCost(s: GameState, r: Region): number {
  const m = nationMods(s, r.owner ?? '');
  return Math.round((20 + 8 * Math.pow(r.dev + 1, 1.5)) * (1 + 0.05 * r.devBought) * (1 + m.devCost));
}
export function fortCost(s: GameState, r: Region): number {
  const m = nationMods(s, r.owner ?? '');
  return Math.round(60 * (r.fort + 1) * (1 + m.fortCost));
}
export function coreCost(s: GameState, r: Region): number {
  const m = nationMods(s, r.owner ?? '');
  return Math.round(r.dev * 8 * (1 + m.coreCost));
}
export const convertCost = (s: GameState, r: Region) => Math.round(r.dev * 6);
export const CONVERT_DAYS = 365;
export const FABRICATE_COST = 40;
export const FABRICATE_DAYS = 365;
export function stabilityCost(s: GameState, n: NationId): number {
  const nat = s.nations[n];
  return Math.round((60 + 25 * (nat.stability + 3)) * (1 + 0.15 * (totalDev(s, n) / 40)) * (1 + nationMods(s, n).stabilityCost));
}
export function unitCost(s: GameState, n: NationId, t: 'inf' | 'cav' | 'art'): number {
  const era = s.nations[n].era;
  return Math.round(UNITS.unitCost[t] * (1 + 0.25 * (era - 1)));
}
export function mercCost(s: GameState, n: NationId, regs: number): number {
  return Math.round(regs * unitCost(s, n, 'inf') * 3 * (1 + nationMods(s, n).mercCost));
}
export function shipCost(s: GameState, n: NationId, t: ShipType): number {
  return Math.round(UNITS.ships[t].cost * (1 + nationMods(s, n).shipCost));
}
export const RECRUIT_DAYS = 30;
export const SHIP_DAYS = 60;

// ---------------------------------------------------------------- monthly

export function monthlyEconomy(s: GameState): void {
  for (const nat of Object.values(s.nations)) {
    if (!nat.alive) continue;
    const n = nat.id;
    const l = ledger(s, n);
    nat.lastMonthIncome = l.totalIncome;
    nat.lastMonthExpenses = l.totalExpenses;
    nat.gold += l.balance;
    if (nat.gold < 0) {
      const need = Math.ceil(-nat.gold / LOAN_SIZE);
      nat.loans += need;
      nat.gold += need * LOAN_SIZE;
      if (n === s.player) log(s, 'economy', `The treasury is empty: you take ${need} loan${need > 1 ? 's' : ''} of ${LOAN_SIZE} gold.`, { important: true });
      if (nat.loans > MAX_LOANS) bankruptcy(s, n);
    }
    // Manpower.
    const max = maxManpower(s, n);
    nat.manpower = Math.min(max, nat.manpower + manpowerRecovery(s, n));
    // Stability drifts toward what the ruler can hold.
    const skill = nat.ruler.skill;
    if (nat.stability < 0 && skill >= 3 && chance(s, 0.03)) nat.stability++;
    else if (nat.stability > 1 && skill <= 2 && chance(s, 0.02)) nat.stability--;
    // Prestige fades; war exhaustion builds at war and heals in peace.
    nat.prestige = clamp(nat.prestige * 0.99, 0, 100);
    nat.warExhaustion = clamp(nat.warExhaustion + (atWar(s, n) ? 0.08 : -0.2), 0, 20);
    // Fabricated claims expire after 25 years.
    for (const [r, until] of Object.entries(nat.claims)) if (until >= 0 && until < s.day) delete nat.claims[r];
    // Timed modifiers run out.
    if (nat.modifiers.some(m => m.until >= 0 && m.until <= s.day)) nat.modifiers = nat.modifiers.filter(m => m.until < 0 || m.until > s.day);
  }
  // Regions: cores after 20 years, conversions complete.
  for (const r of Object.values(s.regions)) {
    if (!r.owner) continue;
    if (!r.cores.includes(r.owner) && r.conquered !== undefined && s.day - r.conquered >= years(20)) {
      r.cores.push(r.owner);
      if (r.owner === s.player) log(s, 'economy', `${REGION[r.id].name} is now fully integrated into your realm.`, { node: r.id });
    }
    if (r.converting && r.converting.done <= s.day) {
      r.faith = r.converting.to;
      r.converting = undefined;
      if (r.owner === s.player) log(s, 'economy', `${REGION[r.id].name} has converted.`, { node: r.id });
    }
  }
}

export function bankruptcy(s: GameState, n: NationId): void {
  const nat = s.nations[n];
  nat.loans = 0;
  nat.gold = 0;
  nat.stability = -3;
  nat.prestige = Math.max(0, nat.prestige - 30);
  nat.modifiers.push({ id: 'bankrupt', name: 'Bankruptcy', mods: { taxIncome: -0.25, morale: -0.2 }, until: s.day + years(5) });
  for (const a of armiesOf(s, n)) {
    a.morale = 0;
    if (a.mercs > 0) {
      const share = a.mercs / Math.max(1, a.regs.inf.n);
      const drop = Math.min(a.regs.inf.n, a.mercs);
      a.regs.inf.men = Math.round(a.regs.inf.men * (1 - Math.min(1, share)));
      a.regs.inf.n -= drop;
      a.mercs = 0;
    }
  }
  for (const id of Object.keys(s.armies)) {
    const a = s.armies[id];
    if (a.owner === n && a.regs.inf.n + a.regs.cav.n + a.regs.art.n === 0) delete s.armies[id];
  }
  log(s, 'economy', `${NATION[n].name} declares bankruptcy! Debts are wiped out, but order collapses and the armies lose heart.`, {
    nation: n,
    important: involvesPlayer(s, n),
  });
}
