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
  // Everyday moments (owner, 2026-10-02): Dr. Scroll off duty, for light moments outside lessons.
  'bee-chase',
  'bee-hello',
  'book-tower',
  'coffee-jitter',
  'cupcake-sneak',
  'giant-sandwich',
  'hiccups',
  'paddling-pool',
  'pigeon-head',
  'sandwich',
  'sneeze',
  'spaghetti',
  'storm-umbrella',
  'stuck-jar',
  'sun-reflector',
  'tea-pinky',
  'tiny-hat',
  'trick-candle',
  'yoga-wobble',
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
export const QUIET_MASCOT_POSES = ['pointing', 'thinking', 'idea', 'explaining', 'magnifier', 'reading', 'whisper', 'thumbs-up', 'oops', 'checkpoint'] as const satisfies readonly MascotPose[];
export type QuietMascotPose = (typeof QUIET_MASCOT_POSES)[number];

/**
 * Dr. Scroll doing something that belongs to each skill, for card pictures
 * (owner, 2026-10-01: "doing an action relevant to the subject or skill").
 * Each list includes the skill's map costume (SKILL_GUIDE_POSE).
 */
export const SKILL_ACTION_POSES: Readonly<Record<string, readonly MascotPose[]>> = {
  'skill.science.astronomy': ['telescope', 'space-helmet', 'juggling-planets'],
  'skill.science.human_body': ['doctor', 'exercise'],
  'skill.science.chemistry': ['goggles'],
  'skill.science.animals': ['binoculars', 'hiking'],
  'skill.history.ancient_rome': ['toga', 'laurel'],
  'skill.history.ancient_egypt': ['archaeologist', 'torch'],
  'skill.history.ancient_greece': ['laurel', 'toga', 'torch'],
  'skill.history.middle_ages': ['knight', 'crown'],
  'skill.history.us_history': ['torch', 'podium'],
  'skill.geography.world_geography': ['map', 'hiking', 'binoculars'],
  'skill.geography.oceans': ['diving', 'sailboat', 'fishing'],
  'skill.geography.earth_climate': ['umbrella', 'hiking', 'gardening'],
  'skill.money.how_money_works': ['piggy-bank', 'market-stall', 'shopping'],
  'skill.arts.art_history': ['easel', 'sculpting'],
  'skill.arts.music': ['conducting', 'piano', 'violin', 'guitar', 'drums'],
  'skill.arts.architecture': ['hard-hat'],
  'skill.arts.film_tv': ['camera'],
  'skill.world_systems.everyday_technology': ['laptop', 'bicycle'],
  'skill.world_systems.computers': ['laptop'],
  'skill.world_systems.government': ['ballot', 'podium', 'crown'],
};

/** Calm poses Dr. Scroll takes as a card's picture. Not `thinking`: beside a card, his frown reads as sad. */
export const CARD_PICTURE_POSES = ['reading', 'magnifier', 'idea', 'explaining'] as const satisfies readonly QuietMascotPose[];

/**
 * Dr. Scroll's pose when he is a card's picture (`mascotPictureCard` picks
 * the card: at most one a level). He takes turns between his actions for the skill (piano and
 * violin for Music), his subject's prop (a flask for Science) and his calm
 * poses, so cards in a row don't repeat him. Silent, never a reaction: a
 * picture, not an aside. The actions and prop are the only non-calm poses a
 * lesson shows, and only here.
 */
export function cardPicturePose(skillId: string, levelNumber: number, cardIndex: number): MascotPose {
  const subject = skillId.split('.')[1]?.replace(/_/g, '-');
  const prop = (MASCOT_POSES as readonly string[]).includes(subject ?? '') ? (subject as MascotPose) : undefined;
  const turns: MascotPose[] = [...new Set([...(SKILL_ACTION_POSES[skillId] ?? []), prop, ...CARD_PICTURE_POSES].filter((p): p is MascotPose => !!p))];
  return turns[(levelNumber + cardIndex) % turns.length]!;
}

/**
 * Which learning card, if any, shows Dr. Scroll as its picture (owner,
 * 2026-10-02: "include Dr. Scroll in some of them, like 10%... I'd like to not
 * spam Dr. Scroll"). He's a guest, not the stand-in for every missing picture:
 * - at most one card per level, chosen among the cards with no picture of
 *   their own (`candidates`, card indices);
 * - never in a level where he already has an aside;
 * - and only in about two levels out of five.
 * With about four learning cards a level, that's roughly one card in ten.
 * The rest of the cards without a picture show none. Stable per level, so a
 * replay looks the same.
 */
export function mascotPictureCard(skillId: string, levelNumber: number, candidates: readonly number[], hasAside: boolean): number | null {
  if (hasAside || candidates.length === 0) return null;
  let h = 2166136261;
  for (const ch of `${skillId}:${levelNumber}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  if (h % 5 >= 2) return null;
  return candidates[Math.floor(h / 5) % candidates.length]!;
}

/** Most a level should use (owner call, 2026-09-26): he speaks rarely, as a teacher. More is a validator warning. */
export const MAX_MASCOT_ASIDES_PER_LEVEL = 1;

/** Longest line he says in one bubble. He's a sidekick, not a lecturer. */
export const MASCOT_LINE_MAX = 140;

/** His lines at fixed one-off moments (each shows once or rarely). Short, warm, never scolding. */
export const DR_SCROLL_LINES = {
  introHello: `Hi, I'm ${MASCOT_NAME}. Come in, sit down. We've got a lot to talk about.`,
  introLessons: 'Every level is a short lesson. Clear it, and that skill levels up for good.',
  introReply: 'Nice to meet you',
  reviewEmpty: "Nothing to refresh. Your memory's in great shape, so I'm taking a nap.",
  homeStart: "Not sure where to begin? Tap any subject, or let me pick one for you with Choose for me.",
  leaveLevel: "Heading out? If you leave now, this level starts over from the beginning next time. Your first answers still count.",
} as const;

/**
 * What he says at moments that come round again and again (owner,
 * 2026-10-01: at least 10 lines each, so he doesn't repeat himself). Pick
 * with `drScrollSaying`. Short, warm, never scolding, no new facts.
 */
export const DR_SCROLL_SAYINGS = {
  /** Level Complete, every question right on the first try. */
  levelPerfect: [
    "Every question, first try. Beautiful. I'm telling everybody.",
    'Not one miss. I would frame this, but my wall is already full of your work.',
    "Perfect. You made that look easy, and I happen to know it wasn't.",
    'Clean sweep! Somewhere a textbook just felt very proud of itself.',
    'First try, every time. Your brain is showing off, and I approve.',
    "Flawless. I had a hint ready and you didn't even need it.",
    "That's a perfect run. I'm adding a gold star to my imaginary chart.",
    "All right on the first go. You were paying attention, weren't you?",
    "Perfect! I'd give you a standing ovation, but my knees vote no.",
    'Not a single slip. That knowledge walked right in and sat down.',
    "Spotless. I'm trying not to look impressed. I'm very impressed.",
    "Every one, first try. You're making my job look easy.",
  ],
  /** Level Complete, nearly all right on the first try. */
  levelStrong: [
    "Look at that. That one's yours now, and nobody takes it back.",
    "Nearly flawless. Anything that slipped comes back in Review, gently.",
    "Strong work. One more look at the tricky bit and it's locked in.",
    "That's a solid clear. Your future self says thank you.",
    'So close to perfect I had to squint. Well done.',
    'Good stuff. Almost all first try, and you fixed the rest yourself.',
    'Strong round! A tiny wobble, and wobbles are how it sticks.',
    "That level's in the bag. I'll hold the bag, you keep going.",
    "Very nice. A miss isn't a mark against you, it's a bookmark.",
    "Solid. You know more than you did ten minutes ago, and that's the game.",
    "Great clear. I'll bring the slippery one back when you're ready.",
  ],
  /** Level Complete, several misses, all corrected. */
  levelReinforced: [
    "You went back and fixed every miss. That's how it sticks. That's the whole secret.",
    "Misses, then fixes. Honestly, that's the best way to learn anything.",
    "You didn't skip the hard parts. You worked through them. That counts.",
    'Every wrong turn got corrected. Your brain just did some real exercise.',
    "Cleared! The tricky ones will visit again in Review, and they'll be friendlier.",
    'Tough level, and you finished it. I like your stubbornness.',
    "You looked again, and again, and got there. That's what learners do.",
    'Mistakes are just your brain taking notes. You took plenty. Good.',
    'That one fought back. You won anyway.',
    'Fixing a miss teaches more than a lucky guess. You learned a lot here.',
    "Done, and every answer set straight. That's a real clear.",
  ],
  /** Level Complete, most first tries missed, all corrected. */
  levelHeavilyReinforced: [
    "Cleared! The tricky ones come back in Review, and trust me, they'll feel easier.",
    "That was a tough one, and you stuck with it. I'm proud of you.",
    "Hard level, done. The next time you see these, they'll look familiar.",
    "You didn't give up on a single question. That's the part that matters.",
    'Brand new ideas are slippery. You caught every one eventually.',
    "Every question resolved. The first tries were rough; the learning wasn't.",
    'Some levels are a climb. You made it to the top.',
    "Lots of fixing today, and that's fine. That's exactly how memory gets built.",
    'Never mind the first tries. Review will bring these back until they stick.',
    'That one was new territory. You mapped all of it.',
    'Finished! These will feel easier next time. I promise.',
  ],
  /** Level Complete on a mastery star (Level 100, 200, ...). */
  levelMastery: [
    'A mastery star! Hold on, I need to find a frame for this.',
    "One hundred levels. I'm speechless, and I'm never speechless.",
    "Mastery! I'd throw confetti, but I used it all on the last star.",
    'That star took a hundred levels, and every one of them is still in there.',
    "You mastered it. I'm writing your name in my good book. In ink.",
    "A whole band, done and resolved. That's real expertise.",
    "Mastery star earned. Go on, take a moment. You've earned that too.",
    'From Level 1 to here. Remember when all of this was new?',
    "That's a star nobody can take away. Shine on.",
    "Mastered! I'm going to need a bigger trophy shelf for you.",
  ],
  /** Level Complete on a replay. */
  levelReplay: [
    'A second visit. Good. Knowledge is like family: it likes it when you come back.',
    "Back for another look? That's how good memories get even better.",
    'Replays are how the pros practice. Nice one.',
    'Old friends, fresh look. You remembered more than you think.',
    'Revisiting is just studying with style.',
    'Same level, sharper you.',
    'Going over it again? Smart. Even I reread my notes.',
    "That one was yours already. Now it's extra yours.",
    'Practice round done. Every pass makes it stick a little better.',
    'Coming back to a level is never a step back.',
  ],
  /** Daily Knowledge Complete (the screen adds a 🌱). */
  dailyComplete: [
    'No more doomscrolling. Go touch grass.',
    "We're done here. Go outside.",
    "That's today's learning. Go tell someone something you learned.",
    'Brain fed. Now go feed the rest of you.',
    'All done for today. The world outside is very educational too.',
    "That's a full day of learning. Go stretch those legs.",
    'Done! Close the app, open a window.',
    'Your brain did its workout. Time for the rest of you.',
    "That's enough scrolling for one day, even the smart kind.",
    "Today's levels are done. See you tomorrow, genius.",
  ],
  /** Review tab, when concepts are due. */
  reviewReady: [
    'A few old friends came back to visit. Say hello before they wander off again.',
    "Some ideas are knocking. Let's make sure you still know their names.",
    'Review time. A quick look now saves a lot of relearning later.',
    "A few things are due for a refresh. It won't take long.",
    'Your memory sent a few things back for a check-up.',
    'These are right on the edge of fading. Perfect time to catch them.',
    'A little review keeps it all yours. Ready when you are.',
    "Some cards are back. Let's see what stuck.",
    'Quick refresher? Your future self will thank you.',
    'A few ideas want a second look. They missed you.',
  ],
} as const satisfies Record<string, readonly string[]>;
export type DrScrollMoment = keyof typeof DR_SCROLL_SAYINGS;

/** Each moment has at least this many lines (owner, 2026-10-01). */
export const MIN_SAYINGS_PER_MOMENT = 10;

/**
 * One of his lines for a moment. `key` picks the starting point (a skill id,
 * so skills don't all start on the same line) and `n` steps through the pool
 * (the level number, or the day), so the next level or the next day always
 * gets a different line.
 */
export function drScrollSaying(moment: DrScrollMoment, key: string, n: number): string {
  const lines = DR_SCROLL_SAYINGS[moment];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return lines[(h + n) % lines.length]!;
}

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
  'lesson.card-picture': { pose: 'reading', where: 'Lesson: above at most one learning card a level that has no illustration of its own, in about two levels out of five, when there is room (card from mascotPictureCard, pose from cardPicturePose)', lesson: true },
  'lesson.leave': { pose: 'explaining', where: 'Lesson: the check before leaving a level partway, since it starts over next time', lesson: true },
  'checkpoint.intro': { pose: 'checkpoint', where: 'Lesson: beside the title of every checkpoint level', lesson: true },
  'feedback.correct': { pose: 'thumbs-up', where: 'Lesson and review: beside "Correct"', lesson: true },
  'feedback.wrong': { pose: 'oops', where: 'Lesson and review: beside "Not quite"', lesson: true },
  'level-complete.cleared': { pose: 'clapping', where: 'Level Complete, no level-up (replays)' },
  'level-complete.level-up': { pose: 'celebrate', where: 'Level Complete with a level-up' },
  'level-complete.mastery': { pose: 'mastery', where: 'Level Complete on a mastery star' },
  'level-complete.lucky-drop': { pose: 'cupcake-sneak', where: 'Level Complete when a perfect level dropped a lucky +1 Brainpower (not on a mastery star)' },
  'review-complete': { pose: 'clapping', where: 'Review Complete screen' },
  'quest.final-round': { pose: 'thinking', where: 'Opening a Weekly Quest\'s Final Round' },
  'quest.complete': { pose: 'celebrate', where: 'Weekly Quest complete (trophy or Archive XP)' },
  'daily-complete': { pose: 'go-outside', where: 'Out of Brainpower: "Go touch grass." (a different off-duty pose each day, SPOT_POSE_VARIANTS)' },
  'review.empty': { pose: 'sleeping', where: 'Review tab when nothing is due' },
  'loading': { pose: 'waiting', where: 'Loading a level or the review queue (after a short delay)' },
  'error.load': { pose: 'tangled', where: 'A level or screen that could not load (never about account or payment data)' },
  'level.locked': { pose: 'thinking', where: 'Opening a level that is not unlocked yet' },
  'home.start': { pose: 'pointing', where: 'Home, before any level is started: points to a first subject or Choose for me' },
  'home.path': { pose: 'reading', where: 'Home: beside the level path in the chapter you are in, in the skill\'s costume (a different action of the skill each day, mapGuidePose)' },
  'map.rest': { pose: 'tea-pinky', where: 'Skill map: in each chapter you have finished, Dr. Scroll stayed behind goofing off, a different everyday pose per chapter (mapRestPose)' },
  'review.ready': { pose: 'review', where: 'Review tab when concepts are due' },
  'not-found': { pose: 'tangled', where: 'A link to something that does not exist' },
  'social.empty': { pose: 'wave', where: 'Social: no friends yet, inviting the learner to add some' },
  'profile.dr-scroll': { pose: 'celebrate', where: 'Dr. Scroll\'s own profile (everyone\'s first friend): a fun line that changes on each tap' },
  'social.dr-scroll-post': { pose: 'tea-pinky', where: 'Social feed: Dr. Scroll\'s own daily post, each in its moment\'s everyday pose (core DR_SCROLL_POSTS)' },
} as const satisfies Record<string, { pose: MascotPose; where: string; lesson?: boolean }>;
export type MascotSpot = keyof typeof MASCOT_SPOTS;

/**
 * Spots where Dr. Scroll takes turns between poses, one a day (owner,
 * 2026-10-03: the everyday poses, placed "where they fit best"). The first is
 * the spot's own pose. Light, off-duty moments outside lessons only: a lesson
 * spot never varies, so learning mode stays quiet.
 */
export const SPOT_POSE_VARIANTS: Partial<Record<MascotSpot, readonly MascotPose[]>> = {
  // Out of Brainpower: him enjoying time away from the app.
  'daily-complete': ['go-outside', 'paddling-pool', 'sun-reflector', 'tea-pinky', 'yoga-wobble', 'bee-hello', 'giant-sandwich'],
  // Busy, waiting.
  loading: ['waiting', 'coffee-jitter', 'book-tower', 'spaghetti'],
  // Something didn't work: a small struggle, never alarming.
  'error.load': ['tangled', 'stuck-jar', 'storm-umbrella'],
  // A link to nowhere: a bit silly, low stakes.
  'not-found': ['tangled', 'pigeon-head', 'tiny-hat'],
  // Nothing due: a break.
  'review.empty': ['sleeping', 'tea-pinky', 'sandwich'],
};

/** The pose a spot shows on a given day (`dayNumber`): its turn among SPOT_POSE_VARIANTS, else its own pose. */
export function spotPose(spot: MascotSpot, day: number): MascotPose {
  const turns = SPOT_POSE_VARIANTS[spot];
  if (!turns?.length) return MASCOT_SPOTS[spot].pose;
  // Offset by the spot so two spots seen the same day don't move in lockstep.
  let h = 0;
  for (const ch of spot) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return turns[(((day + h) % turns.length) + turns.length) % turns.length]!;
}

/** Dr. Scroll off duty (owner, 2026-10-02): the everyday poses, for light moments outside lessons. */
export const EVERYDAY_POSES = [
  'tea-pinky', 'bee-hello', 'book-tower', 'coffee-jitter', 'cupcake-sneak', 'giant-sandwich', 'hiccups', 'paddling-pool', 'pigeon-head', 'sandwich',
  'sneeze', 'spaghetti', 'storm-umbrella', 'stuck-jar', 'sun-reflector', 'tiny-hat', 'trick-candle', 'yoga-wobble', 'bee-chase',
] as const satisfies readonly MascotPose[];

const hashOf = (text: string) => {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};

/**
 * On a skill map, each chapter you've finished has Dr. Scroll goofing off by
 * the road (owner, 2026-10-03: "fit as many as we can on the map"). Stable
 * per chapter, and stepping 7 through the 19 poses means no pose repeats
 * within 19 chapters of one skill.
 */
export function mapRestPose(skillId: string, chapterIndex: number): MascotPose {
  return EVERYDAY_POSES[(hashOf(skillId) + chapterIndex * 7) % EVERYDAY_POSES.length]!;
}

/** In the chapter you're in, he's in the skill's costume, taking turns among its actions one a day (the costume itself first). */
export function mapGuidePose(skillId: string, day: number): MascotPose {
  const costume = SKILL_GUIDE_POSE[skillId];
  const turns = [...new Set([costume, ...(SKILL_ACTION_POSES[skillId] ?? [])].filter((p): p is MascotPose => !!p))];
  if (!turns.length) return MASCOT_SPOTS['home.path'].pose;
  return turns[((day % turns.length) + turns.length) % turns.length]!;
}
