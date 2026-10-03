import type { MascotPose } from './mascot';
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

/**
 * Dr. Scroll in the feed (owner, 2026-10-03): once a learner has met him, his
 * pinned card goes away and he simply turns up in their feed, one little
 * off-duty moment a day, each with its own pose. Tapping one opens his
 * profile. Kind and silly, never a nudge to study and never a fact (facts
 * belong in levels, where they're sourced).
 */
export const DR_SCROLL_POSTS = [
  { pose: 'tea-pinky', line: 'took a tea break between chapters. Pinky up, obviously.' },
  { pose: 'book-tower', line: 'stacked up every book he’s reading this week. It’s taller than him now.' },
  { pose: 'coffee-jitter', line: 'had his third coffee before morning review. His answers are very fast today.' },
  { pose: 'cupcake-sneak', line: 'is celebrating his streak with a cupcake. Please don’t tell anyone.' },
  { pose: 'giant-sandwich', line: 'made a sandwich with one layer for every subject. No regrets.' },
  { pose: 'hiccups', line: 'got the hiccups halfway through explaining black holes. Still finished the level.' },
  { pose: 'paddling-pool', line: 'is reading about the oceans with his feet in a paddling pool. For research.' },
  { pose: 'pigeon-head', line: 'made a new friend in the park. It will not get off his head.' },
  { pose: 'sneeze', line: 'sneezed mid-lecture and lost his place. Back to card one.' },
  { pose: 'spaghetti', line: 'is untangling a tricky question. Also lunch.' },
  { pose: 'storm-umbrella', line: 'went for a walk to think. The weather had other plans.' },
  { pose: 'stuck-jar', line: 'has been opening this jar for ten minutes. He calls it practising patience.' },
  { pose: 'sun-reflector', line: 'says rest days count too, and he’s taking his in the sun.' },
  { pose: 'tape-measure', line: 'measured his bookshelf. It needs to be longer. Again.' },
  { pose: 'tiny-hat', line: 'found a very small hat. He’s wearing it anyway.' },
  { pose: 'trick-candle', line: 'blew out a candle. It came back. Twice.' },
  { pose: 'yoga-wobble', line: 'tried a new stretch between levels. Wobbly, but improving.' },
  { pose: 'bee-hello', line: 'said hello to a bee on his walk. It didn’t say anything back, but it seemed nice.' },
  { pose: 'bee-chase', line: 'said hello to a different bee. This one was less friendly.' },
  { pose: 'sandwich', line: 'is on a snack break. Brains need fuel too.' },
] as const satisfies readonly { pose: MascotPose; line: string }[];

export interface DrScrollPost {
  /** Stable per day, e.g. `dr-scroll:20363`. */
  key: string;
  /** When it went up (ISO). */
  at: string;
  pose: MascotPose;
  line: string;
}

/**
 * His posts for the last `days` days in the device's own time, newest first:
 * one a day, at a different time each morning (between 8 and 11), each day a
 * different moment, cycling through them all. Today's appears only once its
 * time has passed.
 */
export function drScrollPosts(now: Date, days = 3): DrScrollPost[] {
  const out: DrScrollPost[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const n = Math.round(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / 86_400_000);
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8 + (n % 3), (n * 17) % 60);
    if (at > now) continue;
    // Stepping by 7 (coprime with the 20 moments) visits every one before repeating.
    const post = DR_SCROLL_POSTS[(n * 7) % DR_SCROLL_POSTS.length]!;
    out.push({ key: `dr-scroll:${n}`, at: at.toISOString(), pose: post.pose, line: post.line });
  }
  return out;
}
