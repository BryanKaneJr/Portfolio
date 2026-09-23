import { DAILY_FREE_NEW_LEVELS, FIRST_DAY_NEW_LEVELS } from './constants';

/**
 * Daily new-level allowance. The server is authoritative and computes the
 * local date from the profile's stored IANA time zone, never the device clock.
 */

export interface DailyAllowanceInput {
  newLevelsUsedToday: number;
  hasUnlimited: boolean;
  isFirstDay: boolean;
}

export interface DailyAllowance {
  /** null = no cap (Unlimited). */
  cap: number | null;
  used: number;
  remaining: number | null;
  /** True when the next "learn new level" intent should route to Daily Complete. */
  dailyComplete: boolean;
}

export function dailyAllowance({ newLevelsUsedToday, hasUnlimited, isFirstDay }: DailyAllowanceInput): DailyAllowance {
  if (hasUnlimited) return { cap: null, used: newLevelsUsedToday, remaining: null, dailyComplete: false };
  const cap = isFirstDay ? FIRST_DAY_NEW_LEVELS : DAILY_FREE_NEW_LEVELS;
  const remaining = Math.max(cap - newLevelsUsedToday, 0);
  return { cap, used: newLevelsUsedToday, remaining, dailyComplete: remaining === 0 };
}

/** YYYY-MM-DD for an instant in an IANA time zone. */
export function localDate(at: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}
