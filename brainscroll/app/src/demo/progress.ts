import { dailyAllowance, knowledgeLevel, skillProgressView } from '@brainscroll/core';

/**
 * Placeholder progress until the Supabase client is wired (backlog #5, #9).
 * Screens read through this module so swapping in real data is one change.
 * Views are computed with @brainscroll/core — the same rules the server uses.
 */
const skills = [
  { id: 'skill.science.astronomy', subject: 'Science', name: 'Astronomy', highestCleared: 0 },
] as const;

export function useDemoProgress() {
  const skillViews = skills.map((s) => ({ ...s, view: skillProgressView(s.highestCleared) }));
  const total = skills.reduce((n, s) => n + s.highestCleared, 0);
  return {
    knowledgeLevel: knowledgeLevel(total),
    skills: skillViews,
    continueSkill: skillViews[0]!,
    today: dailyAllowance({ newLevelsUsedToday: 0, hasUnlimited: false, isFirstDay: false }),
    reviewsDue: 0,
  };
}
