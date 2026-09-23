/**
 * Stage 5 — deliberately simple review scheduling (no research-grade SRS in V1).
 *
 * Concept strength is an integer step 0..MAX_STRENGTH. A correct answer moves up
 * one step, a wrong answer drops back to 0. Each step maps to a due interval.
 * Missing a review never removes levels or stars; items simply stay due.
 * Mirrored in SQL `review_interval()`.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Interval until the next review, indexed by strength after the answer. */
export const REVIEW_INTERVALS_MS = [
  10 * MINUTE, // 0: soon — just missed it
  1 * DAY, // 1: tomorrow
  3 * DAY, // 2: several days
  7 * DAY, // 3: a week
  21 * DAY, // 4: later
  60 * DAY, // 5: long-term
] as const;

export const MAX_STRENGTH = REVIEW_INTERVALS_MS.length - 1;

/** Minimum gap since the concept was last seen for a correct review to count as delayed recall. */
export const DELAYED_RECALL_MIN_GAP_MS = 20 * 60 * MINUTE;

export function nextStrength(current: number, correct: boolean): number {
  if (!correct) return 0;
  return Math.min(current + 1, MAX_STRENGTH);
}

export function nextDue(now: Date, strength: number): Date {
  const i = Math.min(Math.max(strength, 0), MAX_STRENGTH);
  return new Date(now.getTime() + REVIEW_INTERVALS_MS[i]!);
}

export function isDelayedRecall(lastSeenAt: Date, now: Date, correct: boolean): boolean {
  return correct && now.getTime() - lastSeenAt.getTime() >= DELAYED_RECALL_MIN_GAP_MS;
}
