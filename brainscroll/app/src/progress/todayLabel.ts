import { DAILY_FREE_NEW_LEVELS, FIRST_DAY_NEW_LEVELS, type DailyAllowance } from '@brainscroll/core';

/**
 * "Today 3 / 5", or "Bonus day 3 / 10" on the first day, so the extra
 * levels read as a gift rather than contradicting the 5-a-day deal.
 */
export function todayLabel(today: DailyAllowance): string {
  const bonus = today.cap !== null && today.cap !== DAILY_FREE_NEW_LEVELS && today.cap === FIRST_DAY_NEW_LEVELS;
  return `${bonus ? 'Bonus day' : 'Today'} ${today.used} / ${today.cap ?? '∞'}`;
}
