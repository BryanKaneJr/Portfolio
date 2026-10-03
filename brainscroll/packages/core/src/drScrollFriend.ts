import { knowledgeLevel } from './progression';
import { MILESTONE_TROPHIES, masteryTrophyId, STREAK_TROPHY_TIERS, subjectTrophyId, type TrophyCatalog } from './trophies';

/**
 * Dr. Scroll as everyone's first friend (owner, 2026-10-03): every learner is
 * friends with him from the start. He isn't an account: he lives in the app,
 * so he never joins a league, the weekly XP race or the feed, can't be
 * blocked, reported or removed, and holds no learner's data. His profile is
 * his own: the gold Dr. Scroll avatar, every level and trophy, and a fun line
 * that changes each time you tap it.
 */
export const DR_SCROLL_FRIEND = {
  /** A fixed id no account can have (accounts are UUIDs), so the profile route can tell him apart. */
  id: 'dr-scroll',
  name: 'Dr. Scroll',
  /** The golden Dr. Scroll (the Master of All avatar). */
  avatar: 'avatar.legendary.master_of_all',
} as const;

export const isDrScroll = (id: string | undefined) => id === DR_SCROLL_FRIEND.id;

/** What he says on his profile, one at a time, the next on each tap. Kind, curious, a little silly. */
export const DR_SCROLL_QUOTES = [
  'Every expert was once a beginner who kept going.',
  'Curiosity is a muscle. You are getting very strong.',
  'I have read every level in this app. Twice. Some of them three times, for fun.',
  'A wrong answer is just a right answer you have not met yet.',
  'Five minutes of learning a day adds up to a whole new brain by next year.',
  'The best time to learn something was yesterday. The second best is right now.',
  'I collect trophies the way some people collect stamps. Please do not tell the stamps.',
  'Your brain grows a little every time you get curious. Mine is mostly eyebrows now.',
  'Nobody remembers everything. Smart people just come back and review.',
  'Fun fact: you can learn anything, one small step at a time.',
  'I once spent a whole afternoon reading about octopuses. No regrets.',
  'Ask more questions. It is the cheapest way to get smarter.',
  'Proud of you for showing up today. Really.',
  'Knowledge is the only thing that gets bigger when you share it.',
  'Rest is part of learning too. Even I take tea breaks.',
] as const;

/** The quote after `index`, wrapping around. */
export const nextDrScrollQuote = (index: number) => (index + 1) % DR_SCROLL_QUOTES.length;

/** Every trophy in the catalog: milestones, each skill's mastery and each subject's (quest trophies are seasonal). */
export function drScrollTrophyIds(catalog: TrophyCatalog): string[] {
  return [...MILESTONE_TROPHIES.map((t) => t.id), ...catalog.skills.map((s) => masteryTrophyId(s.id)), ...catalog.subjects.map((s) => subjectTrophyId(s.id))];
}

/** His stats: every published level cleared, the longest streak tier, and the brain level that comes with it. */
export function drScrollStats(totalLevels: number) {
  return {
    levels: totalLevels,
    knowledgeLevel: knowledgeLevel(totalLevels),
    streakDays: STREAK_TROPHY_TIERS[STREAK_TROPHY_TIERS.length - 1]!,
  };
}
