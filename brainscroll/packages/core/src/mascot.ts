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
  // Props and costumes: Dr. Scroll dressed for a topic.
  'archaeologist',
  'ballot',
  'bicycle',
  'binoculars',
  'camera',
  'conducting',
  'cooking',
  'crown',
  'diving',
  'doctor',
  'drums',
  'easel',
  'exercise',
  'fishing',
  'gardening',
  'goggles',
  'guitar',
  'hard-hat',
  'headphones',
  'hiking',
  'juggling-planets',
  'knight',
  'laptop',
  'laurel',
  'map',
  'market-stall',
  'piano',
  'piggy-bank',
  'podium',
  'sailboat',
  'sculpting',
  'shopping',
  'space-helmet',
  'telescope',
  'toga',
  'torch',
  'umbrella',
  'violin',
] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

/**
 * The costume Dr. Scroll wears on each skill's map (spot `home.path`), so he
 * looks like he belongs there: a telescope for Astronomy, a toga for Rome.
 * Skills not listed keep the spot's default pose.
 */
export const SKILL_GUIDE_POSE: Readonly<Record<string, MascotPose>> = {
  'skill.science.astronomy': 'telescope',
  'skill.science.human_body': 'doctor',
  'skill.science.chemistry': 'goggles',
  'skill.science.animals': 'binoculars',
  'skill.history.ancient_rome': 'toga',
  'skill.history.ancient_egypt': 'archaeologist',
  'skill.history.ancient_greece': 'laurel',
  'skill.history.middle_ages': 'knight',
  'skill.geography.world_geography': 'map',
  'skill.geography.oceans': 'diving',
  'skill.money.how_money_works': 'piggy-bank',
  'skill.arts.art_history': 'easel',
  'skill.arts.music': 'conducting',
  'skill.arts.architecture': 'hard-hat',
  'skill.world_systems.everyday_technology': 'laptop',
  'skill.world_systems.government': 'ballot',
};

/** Calm poses allowed inside a lesson. Learning mode stays quiet; the big poses belong to progress screens. */
export const QUIET_MASCOT_POSES = ['pointing', 'thinking', 'idea', 'explaining', 'magnifier', 'whisper', 'thumbs-up', 'oops', 'checkpoint'] as const satisfies readonly MascotPose[];
export type QuietMascotPose = (typeof QUIET_MASCOT_POSES)[number];

/** Most a level should use (owner call, 2026-09-26): he speaks rarely, as a teacher. More is a validator warning. */
export const MAX_MASCOT_ASIDES_PER_LEVEL = 1;

/** Longest line he says in one bubble. He's a sidekick, not a lecturer. */
export const MASCOT_LINE_MAX = 140;

/** His lines at fixed moments. Short, warm, never scolding. */
export const DR_SCROLL_LINES = {
  introHello: `Hi, I'm ${MASCOT_NAME}. Come in, sit down. We've got a lot to talk about.`,
  introLessons: 'Every level is a short lesson. Clear it, and that skill levels up for good.',
  introReply: 'Nice to meet you',
  levelPerfect: "Every question, first try. Beautiful. I'm telling everybody.",
  levelStrong: "Look at that. That one's yours now, and nobody takes it back.",
  levelReinforced: "You went back and fixed every miss. That's how it sticks. That's the whole secret.",
  levelHeavilyReinforced: "Cleared! The tricky ones come back in Review, and trust me, they'll feel easier.",
  levelMastery: 'A mastery star! Hold on, I need to find a frame for this.',
  levelReplay: 'A second visit. Good. Knowledge is like family: it likes it when you come back.',
  reviewEmpty: "Nothing to refresh. Your memory's in great shape, so I'm taking a nap.",
  reviewReady: 'A few old friends came back to visit. Say hello before they wander off again.',
} as const;

/**
 * One-time tips: each shows once per account, the first time its moment comes
 * up, and can be dismissed. Inside lessons they use calm poses only.
 */
export const DR_SCROLL_TIPS = {
  'first-question': { pose: 'pointing', line: 'Pick one, then tap Check. Only your first try earns XP. No rush.' },
  'first-miss': { pose: 'explaining', line: "Missing one costs you nothing. The cards that explain it are right under the choices. Take another look, I'll wait." },
  'first-checkpoint': { pose: 'idea', line: "A checkpoint mixes the whole chapter. It's a look back, not a test you can fail." },
  'first-review': { pose: 'thinking', line: "These come back right before you'd forget them. Review never uses your daily levels." },
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
