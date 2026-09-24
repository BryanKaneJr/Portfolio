/**
 * Stage 0: frozen product constants.
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

/** The single premium entitlement. Its only gameplay/progression effect is removing the daily new-level cap (cosmetic perks never touch progression). */
export const ENTITLEMENT_UNLIMITED = 'unlimited_learning' as const;

/** Launch pricing hypotheses (USD). Display only; the store is authoritative. */
export const PRICING = {
  monthlyUsd: 4.99,
  annualUsd: 39.99,
} as const;

/**
 * XP award rules. XP is an immutable ledger; these values are what each event awards.
 * Level-completion XP is not here: it comes from first-attempt accuracy via
 * LEARNING_STRUCTURE[type].firstAttemptXp (see below).
 */
export const XP = {
  /**
   * A scheduled review item answered correctly on the first attempt. Awarded
   * once per scheduled occurrence (event type DELAYED_RECALL); a wrong first
   * answer earns 0, and the required correction never earns XP.
   */
  REVIEW_FIRST_ATTEMPT: 10,
} as const;

/**
 * QUESTION_CORRECT is retired (first-attempt accuracy now sets LEVEL_COMPLETE XP).
 * MASTERY_CLEAR is retired (the Mastery Challenge's own XP pool replaces the old
 * +250 bonus). Both stay in the type for historical rows.
 */
export type XpEventType = 'LEVEL_COMPLETE' | 'QUESTION_CORRECT' | 'DELAYED_RECALL' | 'MASTERY_CLEAR' | 'QUEST_COMPLETE' | 'CORRECTION';

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
 * `questions.standard` is THE canonical question count for the type, the one
 * number every doc, screen and tool refers to: regular 3, checkpoint 5,
 * milestone 7, Mastery Challenge 10. The validator warns on a draft that
 * differs and rejects a published level that differs. `questions.min`/`max`
 * is only the drafting tolerance (error outside it). `learningCards` and
 * `learningWords` cover the reading/visual cards between the hook and the
 * questions, and produce warnings only.
 */
export type LevelType = 'regular' | 'checkpoint' | 'milestone' | 'mastery';
export type SessionType = LevelType | 'review';

/**
 * How a level's first-attempt accuracy maps to completion XP. Every question
 * must still be correctly resolved before the level completes, but only the
 * first attempt at each question counts toward the reward.
 */
export type CompletionOutcome = 'perfect' | 'strong' | 'reinforced' | 'heavily_reinforced';

export interface XpBand {
  /** Minimum share of questions right on the first attempt (0–1). */
  minShare: number;
  xp: number;
  outcome: CompletionOutcome;
}

/*
 * Encounter XP pools. Initial balancing numbers: tune them here and in the SQL
 * table level_xp_curve together; never hard-code them in the UI. Bands are by
 * share of questions right on the first attempt, so a level with a slightly
 * different question count still lands in the intended band. Never negative.
 */

/** Regular level (3 questions): 3/3 → 100 · 2/3 → 70 · 1/3 → 35 · 0/3 → 15. */
export const STANDARD_FIRST_ATTEMPT_XP: readonly XpBand[] = [
  { minShare: 1, xp: 100, outcome: 'perfect' },
  { minShare: 2 / 3, xp: 70, outcome: 'strong' },
  { minShare: 1 / 3, xp: 35, outcome: 'reinforced' },
  { minShare: 0, xp: 15, outcome: 'heavily_reinforced' },
];

/** Checkpoint (5 questions): 5/5 → 150 · 4/5 → 105 · 3/5 → 60 · 0–2/5 → 25. */
export const CHECKPOINT_FIRST_ATTEMPT_XP: readonly XpBand[] = [
  { minShare: 1, xp: 150, outcome: 'perfect' },
  { minShare: 4 / 5, xp: 105, outcome: 'strong' },
  { minShare: 3 / 5, xp: 60, outcome: 'reinforced' },
  { minShare: 0, xp: 25, outcome: 'heavily_reinforced' },
];

/** Level 50 milestone (7 questions): 7/7 → 250 · 6/7 → 175 · 4–5/7 → 90 · 0–3/7 → 40. */
export const MILESTONE_FIRST_ATTEMPT_XP: readonly XpBand[] = [
  { minShare: 1, xp: 250, outcome: 'perfect' },
  { minShare: 6 / 7, xp: 175, outcome: 'strong' },
  { minShare: 4 / 7, xp: 90, outcome: 'reinforced' },
  { minShare: 0, xp: 40, outcome: 'heavily_reinforced' },
];

/**
 * Level 100 Mastery Challenge (10 questions): 10/10 → 500 · 8–9/10 → 350 ·
 * 5–7/10 → 175 · 0–4/10 → 75. There is no separate mastery bonus: resolving
 * every question earns the ★ whatever the first-attempt score.
 */
export const MASTERY_FIRST_ATTEMPT_XP: readonly XpBand[] = [
  { minShare: 1, xp: 500, outcome: 'perfect' },
  { minShare: 8 / 10, xp: 350, outcome: 'strong' },
  { minShare: 5 / 10, xp: 175, outcome: 'reinforced' },
  { minShare: 0, xp: 75, outcome: 'heavily_reinforced' },
];

export interface LearningStructure {
  label: string;
  /**
   * Completion XP by first-attempt accuracy (highest band whose minShare is met).
   * Each encounter type has its own pool. Review has none: it awards
   * XP.REVIEW_FIRST_ATTEMPT per item instead.
   */
  firstAttemptXp: readonly XpBand[];
  /** `standard`: the canonical count (null for review, which sizes itself to what's due). */
  questions: { standard: number | null; min: number; max: number };
  learningCards: { min: number; max: number };
  learningWords: { min: number; max: number };
  /** Expect one recall, one understanding and one connection question. */
  coverPurposes: boolean;
}

export const LEVEL_TYPES = ['regular', 'checkpoint', 'milestone', 'mastery'] as const satisfies readonly LevelType[];

export const LEARNING_STRUCTURE: Record<SessionType, LearningStructure> = {
  /** The standard loop: hook, 2–4 short learning cards (100–250 words), 3 light questions. */
  regular: {
    firstAttemptXp: STANDARD_FIRST_ATTEMPT_XP,
    label: 'Level',
    questions: { standard: 3, min: 2, max: 4 },
    learningCards: { min: 2, max: 4 },
    learningWords: { min: 100, max: 250 },
    coverPurposes: true,
  },
  /** Every 10th level: still teaches, then a 5-question check across the chapter. */
  checkpoint: {
    firstAttemptXp: CHECKPOINT_FIRST_ATTEMPT_XP,
    label: 'Checkpoint',
    questions: { standard: 5, min: 4, max: 6 },
    learningCards: { min: 2, max: 4 },
    learningWords: { min: 80, max: 250 },
    coverPurposes: true,
  },
  /** Level 50 (and 150, 250 …): a bigger synthesis moment, 7 questions. */
  milestone: {
    firstAttemptXp: MILESTONE_FIRST_ATTEMPT_XP,
    label: 'Milestone',
    questions: { standard: 7, min: 6, max: 8 },
    learningCards: { min: 1, max: 4 },
    learningWords: { min: 50, max: 250 },
    coverPurposes: true,
  },
  /** Level 100 (and 200, 300 …): the Mastery Challenge, 10 questions. The fullest test in a tree. */
  mastery: {
    firstAttemptXp: MASTERY_FIRST_ATTEMPT_XP,
    label: 'Mastery Challenge',
    questions: { standard: 10, min: 8, max: 12 },
    learningCards: { min: 0, max: 3 },
    learningWords: { min: 0, max: 200 },
    coverPurposes: false,
  },
  /** Spaced repetition: one question per concept due, capped per session. No learning cards. */
  review: {
    firstAttemptXp: [],
    label: 'Review',
    questions: { standard: null, min: 1, max: 10 },
    learningCards: { min: 0, max: 0 },
    learningWords: { min: 0, max: 0 },
    coverPurposes: false,
  },
};

/** Canonical question count per level type: regular 3 · checkpoint 5 · milestone 7 · mastery 10. */
export const STANDARD_QUESTIONS: Record<LevelType, number> = {
  regular: LEARNING_STRUCTURE.regular.questions.standard!,
  checkpoint: LEARNING_STRUCTURE.checkpoint.questions.standard!,
  milestone: LEARNING_STRUCTURE.milestone.questions.standard!,
  mastery: LEARNING_STRUCTURE.mastery.questions.standard!,
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
