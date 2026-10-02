import type { DailyAllowance } from '@brainscroll/core';

/** "🧠 7 / 10", or "🧠 ∞" with Unlimited. */
export function todayLabel(today: DailyAllowance): string {
  if (today.unlimited || today.brainpower === null) return '🧠 ∞ Brainpower';
  return `🧠 ${today.brainpower} / ${today.brainpowerMax}`;
}
