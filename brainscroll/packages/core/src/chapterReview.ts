import { XP } from './constants';
import type { AnswerResult, ProgressState, XpEvent } from './completion';
import type { Question } from './content-schema';
import { levelId as makeLevelId } from './ids';

/**
 * Chapter reviews: go back over any chapter you've cleared, whenever you like
 * (owner, 2026-09-29). Mirrors start_chapter_review / answer_chapter_review /
 * complete_chapter_review in
 * backend/supabase/migrations/20261013000000_chapter_reviews.sql; keep
 * chapterReview.test.ts in step with backend/tests/chapter-reviews.test.sql.
 *
 * - One question per level of the chapter, rotating with each review of it.
 * - Graded like a level: the first attempt is recorded once, a miss is
 *   corrected with the source cards, and the review finishes when every
 *   question is resolved.
 * - XP: XP.CHAPTER_REVIEW_MAX scaled by the share right on the first try,
 *   rounded. Repeatable: farming is allowed, the return is just small.
 * - A first try counts as right only if that question wasn't checked outside
 *   the review (a replay of its level) since the review started.
 * - Nothing else moves: no concept strength, no review schedule, no daily
 *   allowance, no streak. Each answer is noted as a check, so the next
 *   scheduled review of that question pays no XP (as with a replay).
 * - Quests: when the skill has no new levels left for the learner, the review
 *   is recorded with quest credit and counts as its chapter's last level
 *   toward a Weekly Quest (quests.ts countedLevels).
 */

export const CHAPTER_SIZE = 10;

export interface ChapterReviewRun {
  skillId: string;
  chapter: number;
  questionIds: string[];
  startedAt: string;
  /** questionId → the first attempt, attempts so far, and when it was answered right. */
  answers: Record<string, { firstAttemptCorrect: boolean; attemptCount: number; resolvedAt?: string }>;
  completedAt?: string;
  xpAwarded?: number;
}

/** What a started (or resumed) review hands the app. */
export interface ChapterReviewStart {
  reviewId: string;
  skillId: string;
  chapter: number;
  questionIds: string[];
  /** Already answered right (resuming). */
  resolved: string[];
}

export interface ChapterReviewResult {
  reviewId: string;
  skillId: string;
  chapter: number;
  xpAwarded: number;
  firstAttemptCorrect: number;
  total: number;
  /** Counted toward Weekly Quests: the skill had no new levels left for the learner. */
  questCredit: boolean;
  alreadyCompleted: boolean;
}

export class ChapterReviewError extends Error {
  constructor(readonly code: 'CHAPTER_NOT_CLEARED' | 'CHAPTER_NOT_AVAILABLE' | 'REVIEW_NOT_FOUND' | 'QUESTION_NOT_IN_REVIEW' | 'REVIEW_UNRESOLVED') {
    super(code);
    this.name = 'ChapterReviewError';
  }
}

/** Chapters cleared in a skill: its highest cleared level, in whole chapters. */
export function clearedChapters(highestCleared: number): number {
  return Math.floor(highestCleared / CHAPTER_SIZE);
}

/** The level numbers of a chapter: 1 → 1..10. */
export function chapterLevels(chapter: number): number[] {
  return Array.from({ length: CHAPTER_SIZE }, (_, i) => (chapter - 1) * CHAPTER_SIZE + i + 1);
}

/** XP for a finished chapter review. */
export function chapterReviewXp(firstAttemptCorrect: number, total: number): number {
  return total > 0 ? Math.round((XP.CHAPTER_REVIEW_MAX * firstAttemptCorrect) / total) : 0;
}

const runsOf = (state: ProgressState) => state.chapterReviews ?? {};

function startView(reviewId: string, run: ChapterReviewRun): ChapterReviewStart {
  return {
    reviewId,
    skillId: run.skillId,
    chapter: run.chapter,
    questionIds: run.questionIds,
    resolved: run.questionIds.filter((q) => run.answers[q]?.resolvedAt),
  };
}

/**
 * Start a review of a cleared chapter, or resume the unfinished one for it.
 * `questionsFor` gives a level's questions (by level id). Each level gives
 * one question: sorted by id, the next one along for every review of this
 * chapter already finished.
 */
export function startChapterReview(
  state: ProgressState,
  input: { skillId: string; chapter: number; reviewId: string; now: Date; questionsFor: (levelId: string) => readonly Pick<Question, 'id'>[] | undefined },
): { state: ProgressState; start: ChapterReviewStart } {
  const { skillId, chapter } = input;
  const cleared = state.skills[skillId]?.highestCleared ?? 0;
  if (!Number.isInteger(chapter) || chapter < 1 || cleared < chapter * CHAPTER_SIZE) throw new ChapterReviewError('CHAPTER_NOT_CLEARED');
  const runs = runsOf(state);
  const open = Object.entries(runs)
    .filter(([, r]) => r.skillId === skillId && r.chapter === chapter && !r.completedAt)
    .sort(([, a], [, b]) => a.startedAt.localeCompare(b.startedAt))[0];
  if (open) return { state, start: startView(open[0], open[1]) };

  const done = Object.values(runs).filter((r) => r.skillId === skillId && r.chapter === chapter && r.completedAt).length;
  const questionIds = chapterLevels(chapter).flatMap((n) => {
    const qs = [...(input.questionsFor(makeLevelId(skillId, n)) ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1));
    return qs.length ? [qs[done % qs.length]!.id] : [];
  });
  // A chapter whose levels have all been retired has nothing to review.
  if (questionIds.length === 0) throw new ChapterReviewError('CHAPTER_NOT_AVAILABLE');
  const run: ChapterReviewRun = { skillId, chapter, questionIds, startedAt: input.now.toISOString(), answers: {} };
  return { state: { ...state, chapterReviews: { ...runs, [input.reviewId]: run } }, start: startView(input.reviewId, run) };
}

/** One attempt at a chapter review question. The first attempt is recorded once; later ones only resolve it. */
export function answerChapterReview(
  state: ProgressState,
  input: { reviewId: string; question: Question; optionId: string; now: Date },
): { state: ProgressState; result: AnswerResult } {
  const { reviewId, question: q, optionId, now } = input;
  const run = runsOf(state)[reviewId];
  if (!run || run.completedAt || !run.questionIds.includes(q.id)) throw new ChapterReviewError('QUESTION_NOT_IN_REVIEW');
  const option = q.options.find((o) => o.id === optionId);
  const correct = option?.correct ?? false;
  const reveal = correct ? { explanation: q.explanation } : { rationale: option?.rationale };
  const prev = run.answers[q.id];
  const at = now.toISOString();
  // Checked outside this review since it started (a replay grades without
  // recording): the answer was just seen, so the first try can't count.
  const prechecked = (state.checks?.[q.id] ?? '') >= run.startedAt;
  const rec = prev
    ? prev.resolvedAt
      ? prev
      : { ...prev, attemptCount: prev.attemptCount + 1, ...(correct ? { resolvedAt: at } : {}) }
    : { firstAttemptCorrect: correct && !prechecked, attemptCount: 1, ...(correct ? { resolvedAt: at } : {}) };
  const next: ProgressState = {
    ...state,
    chapterReviews: { ...runsOf(state), [reviewId]: { ...run, answers: { ...run.answers, [q.id]: rec } } },
    // The answer has just been checked: the next scheduled review of it pays no XP.
    checks: { ...state.checks, [q.id]: at },
  };
  return { state: next, result: { correct, resolved: !!rec.resolvedAt, firstAttemptCorrect: rec.firstAttemptCorrect, attemptCount: rec.attemptCount, ...reveal } };
}

/**
 * Finish a review once every question is resolved: XP from first attempts
 * (at most XP.CHAPTER_REVIEW_MAX), once. `maxPublishedLevel` is the skill's
 * highest published level: when the learner has cleared it, there's nothing
 * new left, and the review counts toward quests.
 */
export function completeChapterReview(
  state: ProgressState,
  input: { reviewId: string; now: Date; maxPublishedLevel: number },
): { state: ProgressState; result: ChapterReviewResult } {
  const run = runsOf(state)[input.reviewId];
  if (!run) throw new ChapterReviewError('REVIEW_NOT_FOUND');
  const total = run.questionIds.length;
  const firstAttemptCorrect = run.questionIds.filter((q) => run.answers[q]?.firstAttemptCorrect).length;
  const key = `chapter_review:${input.reviewId}`;
  const base = { reviewId: input.reviewId, skillId: run.skillId, chapter: run.chapter, firstAttemptCorrect, total };
  if (run.completedAt) {
    const prior = state.xpEvents.find((e) => e.idempotencyKey === key);
    return { state, result: { ...base, xpAwarded: 0, questCredit: prior?.type === 'CHAPTER_REVIEW' && prior.questCredit, alreadyCompleted: true } };
  }
  if (run.questionIds.some((q) => !run.answers[q]?.resolvedAt)) throw new ChapterReviewError('REVIEW_UNRESOLVED');

  const at = input.now.toISOString();
  const xp = chapterReviewXp(firstAttemptCorrect, total);
  const cleared = state.skills[run.skillId]?.highestCleared ?? 0;
  // Nothing answered (every question removed since it started): no quest credit.
  const questCredit = cleared >= input.maxPublishedLevel && total > 0;
  const event: XpEvent = {
    type: 'CHAPTER_REVIEW',
    amount: xp,
    skillId: run.skillId,
    levelId: makeLevelId(run.skillId, run.chapter * CHAPTER_SIZE),
    questCredit,
    idempotencyKey: key,
    at,
  };
  const skill = state.skills[run.skillId];
  const next: ProgressState = {
    ...state,
    chapterReviews: { ...runsOf(state), [input.reviewId]: { ...run, completedAt: at, xpAwarded: xp } },
    xpEvents: [...state.xpEvents, event],
    skills: skill && xp > 0 ? { ...state.skills, [run.skillId]: { ...skill, totalXp: skill.totalXp + xp } } : state.skills,
  };
  return { state: next, result: { ...base, xpAwarded: xp, questCredit, alreadyCompleted: false } };
}
