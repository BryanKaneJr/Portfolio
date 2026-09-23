import { MASTERY_BAND_SIZE, XP, type CompletionOutcome } from './constants';
import type { Level, Question } from './content-schema';
import { dailyAllowance, localDate, type DailyAllowance } from './daily';
import { parseLevelId } from './ids';
import { knowledgeLevel, levelCompletionXp } from './progression';
import { isDelayedRecall, nextDue, nextStrength } from './review';

/**
 * The level start/complete rules as a pure state transition.
 *
 * This mirrors `start_level` / `complete_level` in
 * backend/supabase/migrations exactly (same order of checks, same error codes,
 * same XP and mastery updates). The app uses it for offline/local play; with
 * Supabase configured the server is authoritative and the app only renders the
 * returned results.
 *
 * Lesson completion: learn → first attempt at each question (recorded once,
 * immutable) → a wrong answer shows the question's source cards and must be
 * corrected → when every question is resolved the level completes. XP comes
 * from first-attempt accuracy only; corrections earn progression, not XP.
 */

export interface ProgressState {
  version: 1;
  createdAt: string;
  timeZone: string;
  hasUnlimited: boolean;
  skills: Record<string, { highestCleared: number; stars: number; totalXp: number }>;
  levels: Record<string, { completedAt: string; revision: number; firstAttemptCorrect: number; total: number; idempotencyKey: string }>;
  concepts: Record<string, ConceptMastery>;
  /** questionId → attempt record. The first attempt is immutable once recorded. */
  questionAttempts: Record<string, QuestionAttempt>;
  /** local date (YYYY-MM-DD) → new levels completed that day */
  daily: Record<string, number>;
  xpEvents: XpEvent[];
}

export interface ConceptMastery {
  strength: number;
  seenCount: number;
  correctCount: number;
  incorrectCount: number;
  lastSeenAt: string;
  dueAt: string;
  /** 0 normal · 1 missed once · 2 missed repeatedly. Higher priority reviews first. */
  priority: number;
}

export interface QuestionAttempt {
  levelId: string;
  firstOptionId: string;
  firstAttemptCorrect: boolean;
  attemptCount: number;
  resolvedCorrect: boolean;
}

/** Review priority a question's attempts earn its concepts: 0 got it first time, 1 missed once, 2 missed repeatedly. */
export function reviewPriority(a: Pick<QuestionAttempt, 'firstAttemptCorrect' | 'attemptCount'>): number {
  if (a.firstAttemptCorrect) return 0;
  return a.attemptCount <= 2 ? 1 : 2;
}

export interface XpEvent {
  type: 'LEVEL_COMPLETE' | 'MASTERY_CLEAR' | 'DELAYED_RECALL';
  amount: number;
  skillId: string;
  levelId: string;
  idempotencyKey: string;
  at: string;
}

export interface CompletionSummary {
  levelId: string;
  skillId: string;
  alreadyCompleted: boolean;
  skillLevelBefore: number;
  skillLevel: number;
  stars: number;
  skillXp: number;
  xpAwarded: number;
  /** Questions answered correctly on the first attempt. Sets the XP. */
  firstAttemptCorrect: number;
  total: number;
  outcome: CompletionOutcome;
  /** Concepts missed on the first attempt, queued for earlier review. */
  reinforcedConceptIds: string[];
  masteryCleared: boolean;
  knowledgeLevel: number;
  daily: DailyAllowance;
}

export type StartReason = 'NEW' | 'REPLAY' | 'LEVEL_LOCKED' | 'DAILY_COMPLETE' | 'LEVEL_NOT_AVAILABLE';
export type CompletionErrorCode = 'LEVEL_LOCKED' | 'DAILY_LIMIT_REACHED' | 'UNRESOLVED_QUESTIONS' | 'QUESTION_NOT_IN_LEVEL' | 'IDEMPOTENCY_KEY_REQUIRED';

export class CompletionError extends Error {
  constructor(public readonly code: CompletionErrorCode) {
    super(code);
    this.name = 'CompletionError';
  }
}

export function emptyProgress(now: Date, timeZone: string): ProgressState {
  return { version: 1, createdAt: now.toISOString(), timeZone, hasUnlimited: false, skills: {}, levels: {}, concepts: {}, questionAttempts: {}, daily: {}, xpEvents: [] };
}

export function highestCleared(state: ProgressState, skillId: string): number {
  return state.skills[skillId]?.highestCleared ?? 0;
}

export function dailyStatus(state: ProgressState, now: Date): DailyAllowance & { localDate: string } {
  const today = localDate(now, state.timeZone);
  const isFirstDay = today === localDate(new Date(state.createdAt), state.timeZone);
  return {
    localDate: today,
    ...dailyAllowance({ newLevelsUsedToday: state.daily[today] ?? 0, hasUnlimited: state.hasUnlimited, isFirstDay }),
  };
}

export function totalCleared(state: ProgressState): number {
  return Object.values(state.skills).reduce((n, s) => n + s.highestCleared, 0);
}

export function checkStart(state: ProgressState, level: Pick<Level, 'id' | 'skillId' | 'number'>, now: Date): StartReason {
  if (state.levels[level.id]) return 'REPLAY';
  if (level.number !== highestCleared(state, level.skillId) + 1) return 'LEVEL_LOCKED';
  if (dailyStatus(state, now).dailyComplete) return 'DAILY_COMPLETE';
  return 'NEW';
}

/** Concepts due for review at `now`: highest priority first, then soonest, then by id. */
export function dueConcepts(state: ProgressState, now: Date): string[] {
  return Object.entries(state.concepts)
    .filter(([, c]) => new Date(c.dueAt) <= now)
    .sort(([idA, a], [idB, b]) => (b.priority ?? 0) - (a.priority ?? 0) || a.dueAt.localeCompare(b.dueAt) || (idA < idB ? -1 : 1))
    .map(([id]) => id);
}

// ─── Answering a question inside a level ─────────────────────────────────────

export interface AnswerResult {
  correct: boolean;
  /** True once the question has been answered correctly (on any attempt). */
  resolved: boolean;
  /** The recorded first attempt: immutable, and the only one that counts for XP. */
  firstAttemptCorrect: boolean;
  attemptCount: number;
  /** Why the chosen option is wrong (wrong answers only). */
  rationale?: string;
  /** Shown once resolved. */
  explanation?: string;
}

/**
 * Records one attempt at a question in the level being played. The first
 * attempt is stored once and never replaced, so restarting the level can't
 * improve the score. Later attempts only count toward resolution. Replays of
 * completed levels are graded but not recorded.
 */
export function answerQuestion(
  state: ProgressState,
  input: { level: Level; questionId: string; optionId: string },
): { state: ProgressState; result: AnswerResult } {
  const { level, questionId, optionId } = input;
  const q = level.questions.find((x) => x.id === questionId);
  if (!q) throw new CompletionError('QUESTION_NOT_IN_LEVEL');
  const option = q.options.find((o) => o.id === optionId);
  const correct = option?.correct ?? false;
  const reveal = correct ? { explanation: q.explanation } : { rationale: option?.rationale };

  if (state.levels[level.id]) {
    return { state, result: { correct, resolved: correct, firstAttemptCorrect: correct, attemptCount: 0, ...reveal } };
  }
  if (level.number !== highestCleared(state, level.skillId) + 1) throw new CompletionError('LEVEL_LOCKED');

  const attempts = state.questionAttempts ?? {};
  const prev = attempts[q.id];
  if (prev?.resolvedCorrect) {
    return { state, result: { correct, resolved: true, firstAttemptCorrect: prev.firstAttemptCorrect, attemptCount: prev.attemptCount, ...reveal } };
  }
  const rec: QuestionAttempt = prev
    ? { ...prev, attemptCount: prev.attemptCount + 1, resolvedCorrect: correct }
    : { levelId: level.id, firstOptionId: optionId, firstAttemptCorrect: correct, attemptCount: 1, resolvedCorrect: correct };
  return {
    state: { ...state, questionAttempts: { ...attempts, [q.id]: rec } },
    result: { correct, resolved: rec.resolvedCorrect, firstAttemptCorrect: rec.firstAttemptCorrect, attemptCount: rec.attemptCount, ...reveal },
  };
}

// ─── Review (Stage 5) ────────────────────────────────────────────────────────
//
// Mirrors SQL get_review_queue / submit_review. Review is unlimited, never
// consumes the daily allowance, and never lowers a skill level.

export interface ReviewItem {
  conceptId: string;
  question: Question;
  levelId: string;
  skillId: string;
}

/**
 * One approved question per due concept, drawn from levels the learner has
 * completed. Questions rotate by how often the concept has been seen, so a
 * concept isn't always tested with the same wording. Concepts with no question
 * available yet are skipped; a question is never used twice in one queue.
 */
export function buildReviewQueue(state: ProgressState, levels: Level[], now: Date, limit = 10): ReviewItem[] {
  const completed = levels.filter((l) => state.levels[l.id]);
  const items: ReviewItem[] = [];
  const used = new Set<string>();
  for (const conceptId of dueConcepts(state, now)) {
    if (items.length >= limit) break;
    const candidates = completed
      .flatMap((l) => l.questions.filter((q) => q.conceptIds.includes(conceptId)).map((question) => ({ question, level: l })))
      .filter((c) => !used.has(c.question.id))
      .sort((a, b) => (a.question.id < b.question.id ? -1 : 1));
    if (candidates.length === 0) continue;
    const pick = candidates[state.concepts[conceptId]!.seenCount % candidates.length]!;
    used.add(pick.question.id);
    items.push({ conceptId, question: pick.question, levelId: pick.level.id, skillId: pick.level.skillId });
  }
  return items;
}

export interface ReviewResult {
  correct: boolean;
  correctOptionId: string;
  explanation: string;
  xpAwarded: number;
  /** Concepts whose schedule changed (only those that were due). */
  refreshed: string[];
}

/**
 * Applies one review answer. Only concepts that are currently due are updated,
 * which also makes a double submit harmless: after the first, nothing is due.
 * A correct answer after a real delay awards DELAYED_RECALL once per concept.
 */
export function submitReview(
  state: ProgressState,
  input: { item: Pick<ReviewItem, 'question' | 'skillId' | 'levelId'>; optionId: string; now: Date },
): { state: ProgressState; result: ReviewResult } {
  const { item, optionId, now } = input;
  const at = now.toISOString();
  const correct = item.question.options.find((o) => o.id === optionId)?.correct ?? false;
  const reveal = { correctOptionId: item.question.options.find((o) => o.correct)?.id ?? '', explanation: item.question.explanation };
  const concepts = { ...state.concepts };
  const events: XpEvent[] = [];
  const refreshed: string[] = [];

  for (const cid of [...item.question.conceptIds].sort()) {
    const c = concepts[cid];
    if (!c || new Date(c.dueAt) > now) continue;
    refreshed.push(cid);
    if (isDelayedRecall(new Date(c.lastSeenAt), now, correct)) {
      events.push({ type: 'DELAYED_RECALL', amount: XP.DELAYED_RECALL, skillId: item.skillId, levelId: item.levelId, idempotencyKey: `delayed_recall:${cid}:${c.lastSeenAt}`, at });
    }
    const strength = nextStrength(c.strength, correct);
    concepts[cid] = {
      strength,
      seenCount: c.seenCount + 1,
      correctCount: c.correctCount + (correct ? 1 : 0),
      incorrectCount: c.incorrectCount + (correct ? 0 : 1),
      lastSeenAt: at,
      dueAt: nextDue(now, strength).toISOString(),
      // A correct review clears the extra priority; a miss keeps it at least "missed once".
      priority: correct ? 0 : Math.max(1, c.priority ?? 0),
    };
  }

  if (refreshed.length === 0) return { state, result: { correct, ...reveal, xpAwarded: 0, refreshed } };

  const xpAwarded = events.reduce((n, e) => n + e.amount, 0);
  const skill = state.skills[item.skillId];
  const next: ProgressState = {
    ...state,
    concepts,
    xpEvents: [...state.xpEvents, ...events],
    skills: skill && xpAwarded > 0 ? { ...state.skills, [item.skillId]: { ...skill, totalXp: skill.totalXp + xpAwarded } } : state.skills,
  };
  return { state: next, result: { correct, ...reveal, xpAwarded, refreshed } };
}

export function completeLevel(
  state: ProgressState,
  input: { level: Level; idempotencyKey: string; now: Date },
): { state: ProgressState; summary: CompletionSummary } {
  const { level, idempotencyKey, now } = input;
  if (!idempotencyKey) throw new CompletionError('IDEMPOTENCY_KEY_REQUIRED');
  const skillId = parseLevelId(level.id).skillId;
  const at = now.toISOString();
  const total = level.questions.length;

  type Extra = Omit<CompletionSummary, 'skillId' | 'skillLevel' | 'stars' | 'skillXp' | 'knowledgeLevel' | 'daily'>;
  const summarize = (s: ProgressState, extra: Extra): CompletionSummary => {
    const sp = s.skills[skillId];
    const { localDate: _ignored, ...daily } = dailyStatus(s, now);
    return {
      ...extra,
      skillId,
      skillLevel: sp?.highestCleared ?? 0,
      stars: sp?.stars ?? 0,
      skillXp: sp?.totalXp ?? 0,
      knowledgeLevel: knowledgeLevel(totalCleared(s)),
      daily,
    };
  };

  // Exactly once per canonical level: a replay awards nothing.
  const prior = state.levels[level.id];
  if (prior) {
    const firstAttemptCorrect = prior.firstAttemptCorrect ?? 0;
    return {
      state,
      summary: summarize(state, {
        levelId: level.id,
        alreadyCompleted: true,
        skillLevelBefore: highestCleared(state, skillId),
        xpAwarded: 0,
        firstAttemptCorrect,
        total: prior.total,
        outcome: levelCompletionXp(level, firstAttemptCorrect, prior.total).outcome,
        reinforcedConceptIds: [],
        masteryCleared: false,
      }),
    };
  }

  const before = highestCleared(state, skillId);
  if (level.number !== before + 1) throw new CompletionError('LEVEL_LOCKED');
  const daily = dailyStatus(state, now);
  if (daily.dailyComplete) throw new CompletionError('DAILY_LIMIT_REACHED');
  const attempts = state.questionAttempts ?? {};
  // A level isn't complete until every question has been answered correctly.
  if (level.questions.some((q) => !attempts[q.id]?.resolvedCorrect)) throw new CompletionError('UNRESOLVED_QUESTIONS');

  const concepts = { ...state.concepts };
  const tested = new Set(level.questions.flatMap((q) => q.conceptIds));
  // First sight: tested concepts start at 0, untested ones at 1.
  for (const lc of level.concepts) {
    if (!concepts[lc.conceptId]) {
      concepts[lc.conceptId] = { strength: tested.has(lc.conceptId) ? 0 : 1, seenCount: 0, correctCount: 0, incorrectCount: 0, lastSeenAt: at, dueAt: at, priority: 0 };
    }
  }

  let firstAttemptCorrect = 0;
  const priority = new Map<string, number>();
  // Same order as SQL (`order by id`) so repeated concepts update identically.
  for (const q of [...level.questions].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const a = attempts[q.id]!;
    const ok = a.firstAttemptCorrect;
    if (ok) firstAttemptCorrect++;
    for (const cid of q.conceptIds) {
      const c = concepts[cid];
      if (!c) continue; // validator guarantees question concepts are level concepts
      concepts[cid] = {
        ...c,
        strength: nextStrength(c.strength, ok),
        correctCount: c.correctCount + (ok ? 1 : 0),
        incorrectCount: c.incorrectCount + (ok ? 0 : 1),
      };
      priority.set(cid, Math.max(priority.get(cid) ?? 0, reviewPriority(a)));
    }
  }
  for (const lc of level.concepts) {
    const c = concepts[lc.conceptId]!;
    const p = priority.get(lc.conceptId) ?? 0;
    // Missed repeatedly: due right away. Missed once: strength 0 (soon). Otherwise the normal interval.
    const dueAt = p >= 2 ? at : nextDue(now, c.strength).toISOString();
    concepts[lc.conceptId] = { ...c, seenCount: c.seenCount + 1, lastSeenAt: at, dueAt, priority: Math.max(c.priority ?? 0, p) };
  }

  const xp = levelCompletionXp(level, firstAttemptCorrect, total);
  const events: XpEvent[] = [{ type: 'LEVEL_COMPLETE', amount: xp.levelComplete, skillId, levelId: level.id, idempotencyKey: `level_complete:${level.id}`, at }];
  if (xp.mastery > 0) events.push({ type: 'MASTERY_CLEAR', amount: xp.mastery, skillId, levelId: level.id, idempotencyKey: `mastery:${level.id}`, at });

  const prevSkill = state.skills[skillId] ?? { highestCleared: 0, stars: 0, totalXp: 0 };
  const next: ProgressState = {
    ...state,
    skills: {
      ...state.skills,
      [skillId]: { highestCleared: level.number, stars: Math.floor(level.number / MASTERY_BAND_SIZE), totalXp: prevSkill.totalXp + xp.total },
    },
    levels: { ...state.levels, [level.id]: { completedAt: at, revision: level.revision, firstAttemptCorrect, total, idempotencyKey } },
    concepts,
    daily: { ...state.daily, [daily.localDate]: (state.daily[daily.localDate] ?? 0) + 1 },
    xpEvents: [...state.xpEvents, ...events],
  };

  return {
    state: next,
    summary: summarize(next, {
      levelId: level.id,
      alreadyCompleted: false,
      skillLevelBefore: before,
      xpAwarded: xp.total,
      firstAttemptCorrect,
      total,
      outcome: xp.outcome,
      reinforcedConceptIds: [...priority].filter(([, p]) => p > 0).map(([c]) => c).sort(),
      masteryCleared: xp.mastery > 0,
    }),
  };
}
