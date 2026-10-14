/**
 * The realm's one-tap acts (fun batch 2): crack down on a restless region, seize the estates for a year's taxes,
 * and once a game proclaim a golden age. Abdication lives in rulers.ts. Each is one button with its price shown
 * before the tap, and nothing to manage afterwards. `aiRealm` is the AI's rule for each.
 */
import { isNativeNation, nationName } from './content';
import { LOAN_SIZE, maxManpower, regionTax } from './economy';
import { log, moment, newsworthy } from './log';
import { atWar, invalidateMods, ownedRegions } from './queries';
import { unrestBreakdown } from './rebels';
import { ABDICATE, abdicate, canAbdicate } from './rulers';
import type { GameState, Modifiers, Nation, NationId, Region, RegionId } from './types';
import { clamp, sum, yearOf, years } from './util';

export { ABDICATE, abdicate, canAbdicate };

/** What the AI did with these acts, for the dev scripts only (the game never reads it). */
export const COUNTS = { crackdowns: 0, seized: 0, abdications: 0, golden: [] as { n: NationId; year: number }[] };

/** 3000 → "3,000". */
export const commas = (v: number): string => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** A region's unrest worked out again at once (as monthlyUnrest does), so its sheet shows the change. */
function recomputeUnrest(s: GameState, r: Region): void {
  r.unrest = clamp(sum(unrestBreakdown(s, r), p => p.value), 0, 10);
}

// ---------------------------------------------------------------- crack down

/** Soldiers keep order in one region: −3 unrest for 5 years, paid in levies. */
export const CRACKDOWN = { unrest: -3, years: 5, menPerProsperity: 500, minMen: 1000 };
export const CRACKDOWN_WHY = 'Crackdown';

export const crackdownCost = (r: Region): number => Math.max(CRACKDOWN.minMen, CRACKDOWN.menPerProsperity * r.dev);

/** The day the crackdown under way here ends, or null. */
export function crackdownUntil(s: GameState, r: Region): number | null {
  const m = r.unrestMods.find(x => x.why === CRACKDOWN_WHY && x.until > s.day);
  return m ? m.until : null;
}

/** Why `n` may not crack down in `id` now, or null if it may. */
export function crackdownBlocked(s: GameState, n: NationId, id: RegionId): string | null {
  const r = s.regions[id];
  const nat = s.nations[n];
  if (!r || !nat || r.owner !== n) return 'Not your region';
  if (r.controller !== n) return 'The region is occupied';
  const until = crackdownUntil(s, r);
  if (until !== null) return `Crackdown until ${yearOf(until)}`;
  if (r.unrest < 1) return 'No unrest to put down';
  const cost = crackdownCost(r);
  if (nat.manpower < cost) return `Needs ${commas(cost)} levies`;
  return null;
}

export function crackDown(s: GameState, n: NationId, id: RegionId): boolean {
  if (crackdownBlocked(s, n, id)) return false;
  const r = s.regions[id];
  s.nations[n].manpower -= crackdownCost(r);
  r.unrestMods.push({ amount: CRACKDOWN.unrest, until: s.day + years(CRACKDOWN.years), why: CRACKDOWN_WHY });
  recomputeUnrest(s, r);
  return true;
}

// ---------------------------------------------------------------- seize estates

/** A year's taxes at once, taken from the estates: order −1 and +2 unrest everywhere for 5 years; once in 10 years. */
export const SEIZE = { months: 12, order: -1, unrest: 2, unrestYears: 5, cooldownYears: 10 };
export const SEIZE_WHY = 'Estates seized';
const seizeKey = (n: NationId) => `${n}>${n}:seize`;

/** The gold a seizure brings now: twelve months of today's taxes (occupation and unrest count; trade and exports don't). */
export const seizeGold = (s: GameState, n: NationId): number => Math.round(SEIZE.months * sum(ownedRegions(s, n), r => regionTax(s, r)));

/** The day `n` may seize the estates again (0: now). */
export const seizeReady = (s: GameState, n: NationId): number => s.cooldowns[seizeKey(n)] ?? 0;

export function seizeBlocked(s: GameState, n: NationId): string | null {
  const nat = s.nations[n];
  if (!nat?.alive) return 'No realm';
  const ready = seizeReady(s, n);
  if (ready > s.day) return `Seize estates again in ${yearOf(ready)}`;
  if (nat.stability < -1) return 'Order too low';
  return null;
}

/** Returns the gold taken, or null when refused. */
export function seizeEstates(s: GameState, n: NationId): number | null {
  if (seizeBlocked(s, n)) return null;
  const nat = s.nations[n];
  const gold = seizeGold(s, n);
  nat.gold += gold;
  nat.stability = Math.max(-3, nat.stability + SEIZE.order);
  const until = s.day + years(SEIZE.unrestYears);
  for (const r of ownedRegions(s, n)) {
    r.unrestMods.push({ amount: SEIZE.unrest, until, why: SEIZE_WHY });
    recomputeUnrest(s, r);
  }
  s.cooldowns[seizeKey(n)] = s.day + years(SEIZE.cooldownYears);
  return gold;
}

// ---------------------------------------------------------------- golden age

/** What it takes: renown, order, peace and learning; once a game. Measured (seeds 1–3, AI only): 4–7 crowns a game. */
export const GOLDEN = { renown: 40, order: 1, advances: 4, years: 50 };
/** Fifty years of plenty (science left out, so the Ottoman science gap stays as tuned). */
export const GOLDEN_MODS: Modifiers = { taxIncome: 0.1, devCost: -0.1, manpower: 0.1, unrest: -1 };
export const GOLDEN_ID = 'golden_age';

/** How each of GOLDEN_MODS reads on the golden age's card (the Realm tab lists them through ui/describe). */
const GOLDEN_WORDS: Partial<Record<keyof Modifiers, (v: number) => string>> = {
  taxIncome: v => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}% tax income`,
  devCost: v => `${Math.round(Math.abs(v) * 100)}% ${v < 0 ? 'cheaper' : 'dearer'} to invest`,
  manpower: v => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}% levies`,
  unrest: v => `${v > 0 ? '+' : '−'}${Math.abs(v)} unrest`,
};
/** The card's line of bonuses, read from GOLDEN_MODS so the two never drift apart. */
export const goldenLine = () =>
  (Object.entries(GOLDEN_MODS) as [keyof Modifiers, number][]).map(([k, v]) => GOLDEN_WORDS[k]?.(v) ?? `${k} ${v}`).join(', ') + '.';

export interface GoldenCheck {
  label: string;
  ok: boolean;
}

export function goldenChecks(s: GameState, n: NationId): GoldenCheck[] {
  const nat = s.nations[n];
  return [
    { label: `Renown ${GOLDEN.renown} or more`, ok: nat.prestige >= GOLDEN.renown },
    { label: `Order +${GOLDEN.order} or better`, ok: nat.stability >= GOLDEN.order },
    { label: 'At peace', ok: !atWar(s, n) },
    { label: `${GOLDEN.advances} advances known`, ok: nat.advances.length >= GOLDEN.advances },
  ];
}

/** Is a golden age under way for `n` now? */
export const inGoldenAge = (s: GameState, n: NationId): boolean => {
  const g = s.nations[n]?.golden;
  return !!g && g.until > s.day;
};

export function canProclaimGolden(s: GameState, n: NationId): boolean {
  const nat = s.nations[n];
  return !!nat?.alive && !nat.golden && !isNativeNation(n) && goldenChecks(s, n).every(c => c.ok);
}

export function proclaimGoldenAge(s: GameState, n: NationId): boolean {
  if (!canProclaimGolden(s, n)) return false;
  const nat = s.nations[n];
  const until = s.day + years(GOLDEN.years);
  nat.golden = { since: s.day, until };
  nat.modifiers.push({ id: GOLDEN_ID, name: 'Golden age', mods: GOLDEN_MODS, until });
  invalidateMods();
  if (n === s.player) {
    moment(s, {
      kind: 'golden',
      card: true,
      tone: 'good',
      title: `A Golden Age for ${nationName(n)}`,
      lines: ['Fifty years of plenty begin.', goldenLine(), `Until ${yearOf(until)}.`],
      nation: n,
    });
    log(s, 'ruler', `A golden age begins for ${nationName(n)}, until ${yearOf(until)}.`, { nation: n, important: true });
  } else if (newsworthy(s, n)) {
    moment(s, { kind: 'golden', card: false, tone: 'info', title: `A golden age dawns in ${nationName(n)}`, nation: n });
    log(s, 'news', `A golden age dawns in ${nationName(n)}.`, { nation: n });
  }
  return true;
}

/** Monthly: a golden age that has run its course is told once (its modifier runs out by itself). */
export function monthlyGolden(s: GameState): void {
  for (const nat of Object.values(s.nations)) {
    const g = nat.golden;
    if (!g || g.over || g.until > s.day) continue;
    g.over = true;
    if (nat.id === s.player && nat.alive) {
      log(s, 'ruler', 'Your golden age ends. It will be remembered.', { nation: nat.id, important: true });
      moment(s, { kind: 'golden', card: false, tone: 'info', title: 'The golden age ends', nation: nat.id });
    }
  }
}

// ---------------------------------------------------------------- AI

/**
 * Monthly, for each AI crown: crack down where unrest is worst (above 6) while levies are over half full; at 3 loans
 * or more with order 0 or better, seize the estates when that brings at least a loan's worth, and pay loans off with
 * it; the worst ruler (skill 1), 50 or older, steps down for a grown heir of skill 4 or more; proclaim a golden age
 * as soon as it may.
 */
export function aiRealm(s: GameState, nat: Nation): void {
  const n = nat.id;
  let worst: Region | null = null;
  for (const r of ownedRegions(s, n)) if (r.unrest > 6 && (!worst || r.unrest > worst.unrest)) worst = r;
  if (worst && nat.manpower > maxManpower(s, n) * 0.5 && crackDown(s, n, worst.id)) COUNTS.crackdowns++;
  if (nat.loans >= 3 && nat.stability >= 0 && seizeGold(s, n) >= LOAN_SIZE) {
    const gold = seizeEstates(s, n);
    if (gold !== null) {
      COUNTS.seized++;
      for (let k = Math.floor(gold / LOAN_SIZE); k > 0 && nat.loans > 0; k--) {
        nat.loans--;
        nat.gold -= LOAN_SIZE;
      }
    }
  }
  const old = yearOf(s.day) - nat.ruler.born >= ABDICATE.minAge;
  if (nat.heir && old && nat.ruler.skill === 1 && nat.heir.skill >= 4 && nat.stability >= 0 && abdicate(s, n)) COUNTS.abdications++;
  if (proclaimGoldenAge(s, n)) COUNTS.golden.push({ n, year: yearOf(s.day) });
}

