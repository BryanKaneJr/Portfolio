/** Small helpers shared by the simulation: deterministic RNG, the calendar, keys and clamps. */
import type { GameState, NationId } from './types';

// ---------------------------------------------------------------- RNG (mulberry32, state kept in GameState)

export function rand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randInt = (s: GameState, min: number, max: number): number => min + Math.floor(rand(s) * (max - min + 1));
export const chance = (s: GameState, p: number): boolean => rand(s) < p;
export function pick<T>(s: GameState, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length)];
}
export function pickWeighted<T>(s: GameState, items: readonly T[], weight: (t: T) => number): T | undefined {
  const total = items.reduce((sum, it) => sum + Math.max(0, weight(it)), 0);
  if (total <= 0) return undefined;
  let r = rand(s) * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------- calendar (day 0 = 1 January 1444)

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const yearDays = (y: number) => (isLeap(y) ? 366 : 365);
const monthDays = (y: number, m: number) => (m === 1 && isLeap(y) ? 29 : MONTH_DAYS[m]);

export interface DateParts {
  year: number;
  month: number; // 0-11
  day: number; // 1-31
}

let cacheDay = -1;
let cacheParts: DateParts = { year: 1444, month: 0, day: 1 };
export function dateOf(dayNumber: number): DateParts {
  if (dayNumber === cacheDay) return cacheParts;
  let d = dayNumber;
  let y = 1444;
  while (d >= yearDays(y)) d -= yearDays(y++);
  let m = 0;
  while (d >= monthDays(y, m)) d -= monthDays(y, m++);
  cacheDay = dayNumber;
  cacheParts = { year: y, month: m, day: d + 1 };
  return cacheParts;
}
export function dayOf(year: number, month: number, day: number): number {
  let d = 0;
  for (let y = 1444; y < year; y++) d += yearDays(y);
  for (let m = 0; m < month; m++) d += monthDays(year, m);
  return d + day - 1;
}
export const yearOf = (dayNumber: number) => dateOf(dayNumber).year;
export const formatDate = (dayNumber: number): string => {
  const p = dateOf(dayNumber);
  return `${p.day} ${MONTH_NAMES[p.month]} ${p.year}`;
};
export const formatShortDate = (dayNumber: number): string => {
  const p = dateOf(dayNumber);
  return `${p.day} ${MONTH_NAMES[p.month].slice(0, 3)} ${p.year}`;
};
export const DAYS_PER_YEAR = 365.25;
export const months = (n: number) => Math.round(n * 30.44);
export const years = (n: number) => Math.round(n * DAYS_PER_YEAR);

// ---------------------------------------------------------------- keys & misc

export const pairKey = (a: NationId, b: NationId) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const dirKey = (from: NationId, to: NationId) => `${from}>${to}`;
/** `list.includes(x)` for an owner or controller that may be null (uncolonized land). */
export const isIn = (list: readonly string[], x: string | null | undefined): boolean => !!x && list.includes(x);
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const nextId = (s: GameState, prefix: string) => `${prefix}${++s.seq}`;
export const sum = <T>(arr: readonly T[], f: (t: T) => number) => arr.reduce((acc, t) => acc + f(t), 0);
export const round1 = (n: number) => Math.round(n * 10) / 10;

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
