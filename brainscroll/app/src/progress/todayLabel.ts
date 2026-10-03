import type { DailyAllowance } from '@brainscroll/core';

/** "7 / 10 Brainpower", or "∞ Brainpower" with Unlimited (BrainpowerLabel puts the brain beside it). */
export function todayLabel(today: DailyAllowance): string {
  if (today.unlimited || today.brainpower === null) return '∞ Brainpower';
  return `${today.brainpower} / ${today.brainpowerMax} Brainpower`;
}

/** Which brain to show: resting at 0, the Unlimited brain on Unlimited, lit otherwise. */
export function brainState(today: DailyAllowance): 'lit' | 'empty' | 'unlimited' {
  if (today.unlimited || today.brainpower === null) return 'unlimited';
  return today.brainpower > 0 ? 'lit' : 'empty';
}
