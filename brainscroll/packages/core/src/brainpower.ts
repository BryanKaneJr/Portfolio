import { BRAINPOWER } from './constants';
import { localDate } from './daily';
import type { ProgressState } from './completion';

/**
 * Brainpower: free learners' pacing (constants.ts BRAINPOWER). Mirrors SQL
 * `brainpower_*` (migration 20261031000000); keep brainpower.test.ts in step
 * with brainpower.test.sql.
 *
 * The balance is stored with the local day it's for; a later day reads it
 * refilled (to DAILY_REFILL, more kept), and the next change saves that.
 * Every award is recorded once by key, so nothing pays twice: on Unlimited,
 * or at MAX, it's recorded as granted 0.
 */
export type BrainpowerAwardKind = 'streak' | 'trophy' | 'chapter_review' | 'perfect';
export interface BrainpowerAward {
  kind: BrainpowerAwardKind;
  /** 1 when it raised the balance; 0 when full or on Unlimited. */
  granted: 0 | 1;
  at: string;
}
export interface BrainpowerEarned {
  kind: BrainpowerAwardKind;
  key: string;
  granted: 0 | 1;
}

/** The balance now, today's refill included. A learner with no record starts at the refill. */
export function brainpowerBalance(state: Pick<ProgressState, 'brainpower' | 'timeZone'>, now: Date): number {
  const b = state.brainpower;
  if (!b) return BRAINPOWER.DAILY_REFILL;
  return b.asOf < localDate(now, state.timeZone) ? Math.max(b.balance, BRAINPOWER.DAILY_REFILL) : b.balance;
}

const withBalance = (state: ProgressState, balance: number, now: Date): ProgressState => ({
  ...state,
  brainpower: { balance, asOf: localDate(now, state.timeZone) },
});

/** A new level was cleared: spend LEVEL_COST (Unlimited spends nothing). */
export function spendBrainpower(state: ProgressState, now: Date): ProgressState {
  if (state.hasUnlimited) return state;
  return withBalance(state, Math.max(brainpowerBalance(state, now) - BRAINPOWER.LEVEL_COST, 0), now);
}

/** Award one thing, once ever: +1 unless full or on Unlimited (then noted at 0). */
export function grantBrainpower(state: ProgressState, key: string, kind: BrainpowerAwardKind, now: Date): ProgressState {
  if (state.brainpowerAwards?.[key]) return state;
  const at = now.toISOString();
  const balance = brainpowerBalance(state, now);
  const granted: 0 | 1 = !state.hasUnlimited && balance < BRAINPOWER.MAX ? 1 : 0;
  const noted = { ...state, brainpowerAwards: { ...state.brainpowerAwards, [key]: { kind, granted, at } } };
  return state.hasUnlimited ? noted : withBalance(noted, balance + granted, now);
}

/** What was awarded at exactly `now`: one action's earnings (SQL: created_at = now()). */
export function brainpowerEarnedAt(state: Pick<ProgressState, 'brainpowerAwards'>, now: Date): BrainpowerEarned[] {
  const at = now.toISOString();
  return Object.entries(state.brainpowerAwards ?? {})
    .filter(([, a]) => a.at === at)
    .map(([key, a]) => ({ kind: a.kind, key, granted: a.granted }))
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** The day before a YYYY-MM-DD date. */
function dayBefore(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** After a learning moment today: +1 if it extends a streak (yesterday was a learning day too). */
export function streakBrainpower(state: ProgressState, now: Date): ProgressState {
  const today = localDate(now, state.timeZone);
  return state.learningDays?.[dayBefore(today)] ? grantBrainpower(state, `streak:${today}`, 'streak', now) : state;
}

/** +1 for each trophy not yet awarded (the caller lists what's earned: quest trophies and milestones). */
export function trophyBrainpower(state: ProgressState, trophyIds: readonly string[], now: Date): ProgressState {
  return [...trophyIds].sort().reduce((s, id) => grantBrainpower(s, `trophy:${id}`, 'trophy', now), state);
}

/** A perfect first clear: a PERFECT_DROP_PERCENT chance of +1 (truly random, no pity). */
export function perfectDropBrainpower(state: ProgressState, levelId: string, now: Date, random: () => number = Math.random): ProgressState {
  return random() * 100 < BRAINPOWER.PERFECT_DROP_PERCENT ? grantBrainpower(state, `perfect:${levelId}`, 'perfect', now) : state;
}
