/**
 * Stage 0 — frozen product constants.
 *
 * These are contracts, not tuning knobs. Every screen, migration, test and
 * content tool depends on them. Changing one requires updating
 * docs/product-rules.md and backend/supabase/migrations (app_settings) together.
 */

/** New canonical levels a free account may complete per local calendar day. Review never counts. */
export const DAILY_FREE_NEW_LEVELS = 5;

/**
 * Launch experiment (roadmap: "test 10-15 new levels on day one").
 * Applies only on the user's first local calendar day.
 */
export const FIRST_DAY_NEW_LEVELS = 10;

/** One mastery band. Level 100 is Mastery I; 200 is Mastery II; prestige never resets. */
export const MASTERY_BAND_SIZE = 100;

/** The single premium entitlement. It removes the daily new-level cap and nothing else. */
export const ENTITLEMENT_UNLIMITED = 'unlimited_learning' as const;

/** Launch pricing hypotheses (USD). Display only — the store is authoritative. */
export const PRICING = {
  monthlyUsd: 4.99,
  annualUsd: 39.99,
} as const;

/** XP award rules. XP is an immutable ledger; these values are what each event awards. */
export const XP = {
  /** Base XP for first-time completion of a canonical level. Once per level, ever. */
  LEVEL_COMPLETE: 20,
  /** Small bonus per correctly answered question inside a level. */
  QUESTION_CORRECT: 2,
  /** Cap on QUESTION_CORRECT XP per level so guessing/grinding never pays. */
  QUESTION_CORRECT_CAP_PER_LEVEL: 6,
  /** Correct answer on a concept that was due for review after a real delay. */
  DELAYED_RECALL: 5,
  /** Clearing a mastery checkpoint (level 100, 200, ...). */
  MASTERY_CLEAR: 250,
} as const;

export type XpEventType = 'LEVEL_COMPLETE' | 'QUESTION_CORRECT' | 'DELAYED_RECALL' | 'MASTERY_CLEAR' | 'CORRECTION';

/** Mobile text budgets enforced by the content validator. */
export const TEXT_BUDGET = {
  headline: 80,
  body: 360,
  questionPrompt: 200,
  answerLabel: 80,
  explanation: 300,
  factFact: 140,
} as const;

/**
 * BrainScroll is a learning app, not a quiz app. A level is read → understand →
 * a few light questions → XP. Testing is proportional to the moment: regular
 * levels are mostly learning; checkpoints, milestones and mastery test more.
 * Review sessions size themselves to whatever is due.
 *
 * `questions` is the hard range (validator error outside it). `target` is the
 * editorial norm (warning outside it). `learningCards` and `learningWords`
 * cover the reading/visual cards between the hook and the questions, and
 * produce warnings only.
 */
export type LevelType = 'regular' | 'checkpoint' | 'milestone' | 'mastery';
export type SessionType = LevelType | 'review';

export interface LearningStructure {
  label: string;
  questions: { min: number; max: number; target: { min: number; max: number } };
  learningCards: { min: number; max: number };
  learningWords: { min: number; max: number };
  /** Expect one recall, one understanding and one connection question. */
  coverPurposes: boolean;
}

export const LEVEL_TYPES = ['regular', 'checkpoint', 'milestone', 'mastery'] as const satisfies readonly LevelType[];

export const LEARNING_STRUCTURE: Record<SessionType, LearningStructure> = {
  /** The standard loop: hook, 2–4 short learning cards (~100–250 words), 3 light questions. */
  regular: {
    label: 'Level',
    questions: { min: 2, max: 4, target: { min: 3, max: 3 } },
    learningCards: { min: 2, max: 4 },
    learningWords: { min: 100, max: 250 },
    coverPurposes: true,
  },
  /** Every 10th level: still teaches, then a slightly longer check (~5) across the chapter. */
  checkpoint: {
    label: 'Checkpoint',
    questions: { min: 4, max: 6, target: { min: 5, max: 5 } },
    learningCards: { min: 2, max: 4 },
    learningWords: { min: 80, max: 250 },
    coverPurposes: true,
  },
  /** Level 50 (and 150, 250 …): a bigger synthesis moment, 5–7 questions. */
  milestone: {
    label: 'Milestone',
    questions: { min: 4, max: 8, target: { min: 5, max: 7 } },
    learningCards: { min: 1, max: 4 },
    learningWords: { min: 50, max: 250 },
    coverPurposes: true,
  },
  /** Level 100 (and 200, 300 …): the Mastery Challenge, ~10 questions. The fullest test in a tree. */
  mastery: {
    label: 'Mastery Challenge',
    questions: { min: 8, max: 12, target: { min: 10, max: 10 } },
    learningCards: { min: 0, max: 3 },
    learningWords: { min: 0, max: 200 },
    coverPurposes: false,
  },
  /** Spaced repetition: one question per concept due, capped per session. No learning cards. */
  review: {
    label: 'Review',
    questions: { min: 1, max: 10, target: { min: 1, max: 10 } },
    learningCards: { min: 0, max: 0 },
    learningWords: { min: 0, max: 0 },
    coverPurposes: false,
  },
};

/** Most questions a single review session serves. */
export const REVIEW_SESSION_MAX_QUESTIONS = LEARNING_STRUCTURE.review.questions.max;

/** What each question is for. Regular levels use one of each. */
export const QUESTION_PURPOSES = ['recall', 'understanding', 'connection'] as const;
export type QuestionPurpose = (typeof QUESTION_PURPOSES)[number];

/** The six launch subjects (roadmap §2). */
export const LAUNCH_SUBJECTS = [
  { id: 'subject.history', name: 'History' },
  { id: 'subject.science', name: 'Science' },
  { id: 'subject.geography', name: 'Geography' },
  { id: 'subject.money', name: 'Money & Economics' },
  { id: 'subject.arts', name: 'Arts & Culture' },
  { id: 'subject.world_systems', name: 'How the World Works' },
] as const;

/** Brand voice lines used at fixed moments. Keep jokes sparse. */
export const VOICE = {
  dailyComplete: 'No more doomscrolling. Go touch grass.',
  dailyCompleteAlt: "We're done here. Go outside.",
  fairness: 'All knowledge can be unlocked free over time.',
  tagline: 'Stop scrolling. Start leveling.',
} as const;
