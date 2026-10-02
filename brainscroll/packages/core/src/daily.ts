import type { BrainpowerEarned } from './brainpower';

/**
 * Today's pacing for new levels: Brainpower (brainpower.ts). The server is
 * authoritative and computes the local date from the profile's stored IANA
 * time zone, never the device clock. Mirrors SQL `daily_status_for`.
 */
export interface DailyAllowance {
  /** Brainpower capacity (MAX); null on Unlimited. */
  cap: number | null;
  /** New levels cleared today. */
  used: number;
  /** Brainpower left; null on Unlimited (∞). */
  remaining: number | null;
  /** No Brainpower left: the next "learn a new level" routes to the out-of-Brainpower screen. */
  dailyComplete: boolean;
  unlimited?: boolean;
  /** The same as `remaining`, by name. */
  brainpower: number | null;
  brainpowerMax: number;
  brainpowerRefill: number;
  /** What the action that returned this status awarded (empty on a plain read). */
  brainpowerEarned: BrainpowerEarned[];
}

/** YYYY-MM-DD for an instant in an IANA time zone. */
export function localDate(at: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** Days since 1970-01-01 in `timeZone`: a number that steps by one each local day (e.g. to vary a daily line). */
export function dayNumber(now: Date, timeZone: string): number {
  return Math.floor(Date.parse(localDate(now, timeZone)) / 86_400_000);
}
