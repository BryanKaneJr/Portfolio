/**
 * Learning streak (owner decision 2026-09-26): consecutive days, in the
 * learner's time zone, on which they cleared a new level or answered a review.
 * Derived from those records, never stored as a counter. Quiet by design:
 * missing a day resets `current`, `longest` is kept forever, and nothing ever
 * warns about losing it (docs/specs/SOCIAL_REWARDS.md). Mirrors SQL
 * `learning_streak`.
 */
export interface Streak {
  /** Days in the run that ends today, or yesterday if today isn't counted yet. */
  current: number;
  /** The longest run ever. */
  longest: number;
  /** Today already counts. */
  today: boolean;
}

const DAY = 86_400_000;
const dayNumber = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY);

/** `days`: local dates (YYYY-MM-DD) with learning; `today`: the learner's local date. */
export function streakFrom(days: Iterable<string>, today: string): Streak {
  const set = new Set([...days].map(dayNumber));
  const t = dayNumber(today);
  let longest = 0;
  for (const d of set) {
    if (set.has(d - 1)) continue;
    let n = 1;
    while (set.has(d + n)) n++;
    longest = Math.max(longest, n);
  }
  const end = set.has(t) ? t : set.has(t - 1) ? t - 1 : null;
  let current = 0;
  if (end !== null) while (set.has(end - current)) current++;
  return { current, longest, today: set.has(t) };
}

export const NO_STREAK: Streak = { current: 0, longest: 0, today: false };
