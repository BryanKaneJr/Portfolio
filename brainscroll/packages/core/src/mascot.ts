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
export const QUIET_MASCOT_POSES = ['pointing', 'thinking', 'idea', 'explaining', 'magnifier', 'whisper', 'thumbs-up', 'oops', 'checkpoint'] as const satisfies readonly MascotPose[];
export type QuietMascotPose = (typeof QUIET_MASCOT_POSES)[number];

/** Most a level should use: he stays special. More is a validator warning. */
export const MAX_MASCOT_ASIDES_PER_LEVEL = 2;

/** Longest line he says in one bubble. He's a sidekick, not a lecturer. */
export const MASCOT_LINE_MAX = 140;

/** His lines at fixed moments. Short, warm, never scolding. */
export const DR_SCROLL_LINES = {
  introHello: `Hi, I'm ${MASCOT_NAME}. Come in, sit down. We've got a lot to talk about.`,
  introLessons: 'Here is how it works. Every level is a short lesson and a few questions. Clear it, and that skill levels up for good.',
  introPromise: "I'll drop by now and then with a tip. Otherwise I stay out of your way. I'm old, not nosy.",
  introReply: 'Nice to meet you',
  levelPerfect: "Every question, first try. Beautiful. I'm telling everybody.",
  levelStrong: "Look at that. That one's yours now, and nobody takes it back.",
  levelReinforced: "You went back and fixed every miss. That's how it sticks. That's the whole secret.",
  levelHeavilyReinforced: "Cleared! The tricky ones come back in Review, and trust me, they'll feel easier.",
  levelMastery: 'A mastery star! Hold on, I need to find a frame for this.',
  levelReplay: 'A second visit. Good. Knowledge is like family: it likes it when you come back.',
  dailyComplete: "That's plenty for today. Go, enjoy. I'll save your seat for tomorrow.",
  reviewEmpty: "Nothing to refresh. Your memory's in great shape, so I'm taking a nap.",
  reviewReady: 'A few old friends came back to visit. Say hello before they wander off again.',
} as const;

/**
 * One-time tips: each shows once per account, the first time its moment comes
 * up, and can be dismissed. Inside lessons they use calm poses only.
 */
export const DR_SCROLL_TIPS = {
  'first-question': { pose: 'pointing', line: "Pick an answer, then tap Check. Only your first try counts toward XP, so no rush. Nobody's timing you." },
  'first-miss': { pose: 'explaining', line: "Missing one costs you nothing. The cards that explain it are right up there. Take another look, I'll wait." },
  'first-checkpoint': { pose: 'idea', line: "A checkpoint mixes the whole chapter together. It's a look back, not a test you can fail. Relax." },
  'first-review': { pose: 'thinking', line: "Review brings things back right before you'd forget them, and it never touches your daily levels. Good deal, right?" },
} as const satisfies Record<string, { pose: MascotPose; line: string }>;
export type DrScrollTipId = keyof typeof DR_SCROLL_TIPS;
export const DR_SCROLL_TIP_DISMISS = 'Got it';

/**
 * Every fixed place Dr. Scroll appears in the app, by a stable spot ID. Screens
 * ask for a spot, never a picture, so any spot's image can be swapped on its
 * own (app/src/components/ui/mascotArt.ts). `lesson: true` spots sit inside
 * lessons or review and must use a calm pose. Writer-placed card asides aren't
 * spots: their pose comes from the content.
 */
export const MASCOT_SPOTS = {
  'sign-in': { pose: 'reference', where: 'Sign-in screen, above the tagline (no speech: sign-in keeps the plain app voice)' },
  'onboarding.hello': { pose: 'wave', where: 'Onboarding, first screen: "Hi, I\'m Dr. Scroll."' },
  'tip.first-question': { pose: 'pointing', where: 'Lesson: tip on the first question ever', lesson: true },
  'tip.first-miss': { pose: 'explaining', where: 'Lesson: tip after the first wrong answer ever', lesson: true },
  'tip.first-checkpoint': { pose: 'idea', where: 'Lesson: tip on the first checkpoint level', lesson: true },
  'tip.first-review': { pose: 'thinking', where: 'Review session: tip on the first review', lesson: true },
  'checkpoint.intro': { pose: 'checkpoint', where: 'Lesson: beside the title of every checkpoint level', lesson: true },
  'feedback.correct': { pose: 'thumbs-up', where: 'Lesson and review: beside "Correct"', lesson: true },
  'feedback.wrong': { pose: 'oops', where: 'Lesson and review: beside "Not quite"', lesson: true },
  'level-complete.cleared': { pose: 'clapping', where: 'Level Complete, no level-up (replays)' },
  'level-complete.level-up': { pose: 'celebrate', where: 'Level Complete with a level-up' },
  'level-complete.mastery': { pose: 'mastery', where: 'Level Complete on a mastery star' },
  'review-complete': { pose: 'clapping', where: 'Review Complete screen' },
  'daily-complete': { pose: 'go-outside', where: 'Daily Knowledge Complete: "Go touch grass."' },
  'review.empty': { pose: 'sleeping', where: 'Review tab when nothing is due' },
  'loading': { pose: 'waiting', where: 'Loading a level or the review queue (after a short delay)' },
  'error.load': { pose: 'tangled', where: 'A level or screen that could not load (never about account or payment data)' },
  'level.locked': { pose: 'thinking', where: 'Opening a level that is not unlocked yet' },
  'home.path': { pose: 'reading', where: 'Home: beside the level path, reading along' },
  'review.ready': { pose: 'review', where: 'Review tab when concepts are due' },
  'not-found': { pose: 'tangled', where: 'A link to something that does not exist' },
} as const satisfies Record<string, { pose: MascotPose; where: string; lesson?: boolean }>;
export type MascotSpot = keyof typeof MASCOT_SPOTS;
