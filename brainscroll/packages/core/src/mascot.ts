/**
 * Dr. Scroll, the BrainScroll mascot (docs/mascot.md). He speaks at fun,
 * low-stakes moments: onboarding, first-time tips, answer reactions, rewards
 * and empty states. Accounts, errors about data, payments, deletion and legal
 * text stay in the plain app voice. He never guilt-trips.
 */
export const MASCOT_NAME = 'Dr. Scroll';

/** Every pose in docs/mascot.md. Image IDs are `mascot.<pose>`. */
export const MASCOT_POSES = [
  'reference',
  'wave',
  'pointing',
  'thinking',
  'idea',
  'explaining',
  'chalkboard',
  'reading',
  'magnifier',
  'surprised',
  'whisper',
  'waiting',
  'tangled',
  'thumbs-up',
  'oops',
  'encourage',
  'clapping',
  'celebrate',
  'checkpoint',
  'review',
  'mastery',
  'go-outside',
  'sleeping',
  'history',
  'science',
  'geography',
  'money',
  'arts',
  'world-systems',
] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

/** Calm poses allowed inside a lesson. Learning mode stays quiet; the big poses belong to progress screens. */
export const QUIET_MASCOT_POSES: readonly MascotPose[] = ['pointing', 'thinking', 'idea', 'explaining', 'magnifier', 'whisper', 'thumbs-up', 'oops'];

/** Longest line he says in one bubble. He's a sidekick, not a lecturer. */
export const MASCOT_LINE_MAX = 140;

/** His lines at fixed moments. Short, warm, never scolding. */
export const DR_SCROLL_LINES = {
  introHello: `Hi, I'm ${MASCOT_NAME}.`,
  introLessons: 'Every level here is a short lesson with a few questions. Clear it, and that skill levels up for good.',
  introPromise: "I'll pop in now and then with a tip. Mostly I'll stay out of your way.",
  introReply: 'Nice to meet you',
  levelPerfect: 'First try on every question. Beautiful.',
  levelStrong: "Nicely done. That one's yours now.",
  levelReinforced: "You fixed every miss. That's exactly how it sticks.",
  levelHeavilyReinforced: "Cleared! The tricky ones come back in Review, and they'll feel easier.",
  levelMastery: "A mastery star! I'm framing this one.",
  levelReplay: 'Good refresher. Knowledge likes a second visit.',
  dailyComplete: "I'll save your spot for tomorrow.",
  reviewEmpty: "Nothing to refresh. Your memory's in good shape.",
} as const;
