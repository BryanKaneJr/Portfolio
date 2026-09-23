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

/** A level is a 2–5 minute encounter, usually 4–7 cards. */
export const CARDS_PER_LEVEL = { min: 3, max: 10 } as const;
export const QUESTIONS_PER_LEVEL = { min: 1, max: 4 } as const;

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
