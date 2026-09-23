import { MASTERY_BAND_SIZE } from './constants';
import type { Level } from './content-schema';
import { dailyAllowance, localDate, type DailyAllowance } from './daily';
import { parseLevelId } from './ids';
import { knowledgeLevel, levelCompletionXp } from './progression';
import { nextDue, nextStrength } from './review';

/**
 * The level start/complete rules as a pure state transition.
 *
 * This mirrors `start_level` / `complete_level` in
 * backend/supabase/migrations exactly (same order of checks, same error codes,
 * same XP and mastery updates). The app uses it for offline/local play until
 * the Supabase client is wired; after that the server is authoritative and the
 * app only renders the returned CompletionSummary.
 */

export interface ProgressState {
  version: 1;
  createdAt: string;
  timeZone: string;
  hasUnlimited: boolean;
  skills: Record<string, { highestCleared: number; stars: number; totalXp: number }>;
  levels: Record<string, { completedAt: string; revision: number; correct: number; total: number; idempotencyKey: string }>;
  concepts: Record<string, ConceptMastery>;
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
}

export interface XpEvent {
  type: 'LEVEL_COMPLETE' | 'QUESTION_CORRECT' | 'MASTERY_CLEAR';
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
  correct: number;
  total: number;
  masteryCleared: boolean;
  knowledgeLevel: number;
  daily: DailyAllowance;
}

export type StartReason = 'NEW' | 'REPLAY' | 'LEVEL_LOCKED' | 'DAILY_COMPLETE' | 'LEVEL_NOT_AVAILABLE';
export type CompletionErrorCode = 'LEVEL_LOCKED' | 'DAILY_LIMIT_REACHED' | 'INCOMPLETE_ANSWERS' | 'IDEMPOTENCY_KEY_REQUIRED';

export class CompletionError extends Error {
  constructor(public readonly code: CompletionErrorCode) {
    super(code);
    this.name = 'CompletionError';
  }
}

/** questionId → chosen option id */
export type Answers = Record<string, string>;

export function emptyProgress(now: Date, timeZone: string): ProgressState {
  return { version: 1, createdAt: now.toISOString(), timeZone, hasUnlimited: false, skills: {}, levels: {}, concepts: {}, daily: {}, xpEvents: [] };
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

/** Concepts due for review at `now`, soonest first. */
export function dueConcepts(state: ProgressState, now: Date): string[] {
  return Object.entries(state.concepts)
    .filter(([, c]) => new Date(c.dueAt) <= now)
    .sort(([, a], [, b]) => a.dueAt.localeCompare(b.dueAt))
    .map(([id]) => id);
}

export function completeLevel(
  state: ProgressState,
  input: { level: Level; answers: Answers; idempotencyKey: string; now: Date },
): { state: ProgressState; summary: CompletionSummary } {
  const { level, answers, idempotencyKey, now } = input;
  if (!idempotencyKey) throw new CompletionError('IDEMPOTENCY_KEY_REQUIRED');
  const skillId = parseLevelId(level.id).skillId;
  const at = now.toISOString();

  const summarize = (s: ProgressState, extra: Omit<CompletionSummary, 'skillId' | 'skillLevel' | 'stars' | 'skillXp' | 'knowledgeLevel' | 'daily'>): CompletionSummary => {
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

  // Exactly once per canonical level.
  const prior = state.levels[level.id];
  if (prior) {
    return {
      state,
      summary: summarize(state, {
        levelId: level.id,
        alreadyCompleted: true,
        skillLevelBefore: highestCleared(state, skillId),
        xpAwarded: 0,
        correct: prior.correct,
        total: prior.total,
        masteryCleared: false,
      }),
    };
  }

  const before = highestCleared(state, skillId);
  if (level.number !== before + 1) throw new CompletionError('LEVEL_LOCKED');
  const daily = dailyStatus(state, now);
  if (daily.dailyComplete) throw new CompletionError('DAILY_LIMIT_REACHED');
  if (level.questions.some((q) => answers[q.id] === undefined)) throw new CompletionError('INCOMPLETE_ANSWERS');

  const concepts = { ...state.concepts };
  const tested = new Set(level.questions.flatMap((q) => q.conceptIds));
  // First sight: tested concepts start at 0, untested ones at 1.
  for (const lc of level.concepts) {
    if (!concepts[lc.conceptId]) {
      concepts[lc.conceptId] = { strength: tested.has(lc.conceptId) ? 0 : 1, seenCount: 0, correctCount: 0, incorrectCount: 0, lastSeenAt: at, dueAt: at };
    }
  }

  let correct = 0;
  // Same order as SQL (`order by qq.id`) so repeated concepts update identically.
  for (const q of [...level.questions].sort((a, b) => a.id.localeCompare(b.id))) {
    const ok = q.options.find((o) => o.id === answers[q.id])?.correct ?? false;
    if (ok) correct++;
    for (const cid of q.conceptIds) {
      const c = concepts[cid];
      if (!c) continue; // validator guarantees question concepts are level concepts
      concepts[cid] = {
        ...c,
        strength: nextStrength(c.strength, ok),
        correctCount: c.correctCount + (ok ? 1 : 0),
        incorrectCount: c.incorrectCount + (ok ? 0 : 1),
      };
    }
  }
  for (const lc of level.concepts) {
    const c = concepts[lc.conceptId]!;
    concepts[lc.conceptId] = { ...c, seenCount: c.seenCount + 1, lastSeenAt: at, dueAt: nextDue(now, c.strength).toISOString() };
  }

  const xp = levelCompletionXp(level.number, correct);
  const events: XpEvent[] = [{ type: 'LEVEL_COMPLETE', amount: xp.levelComplete, skillId, levelId: level.id, idempotencyKey: `level_complete:${level.id}`, at }];
  if (xp.questionBonus > 0) events.push({ type: 'QUESTION_CORRECT', amount: xp.questionBonus, skillId, levelId: level.id, idempotencyKey: `question_bonus:${level.id}`, at });
  if (xp.mastery > 0) events.push({ type: 'MASTERY_CLEAR', amount: xp.mastery, skillId, levelId: level.id, idempotencyKey: `mastery:${level.id}`, at });

  const prevSkill = state.skills[skillId] ?? { highestCleared: 0, stars: 0, totalXp: 0 };
  const next: ProgressState = {
    ...state,
    skills: {
      ...state.skills,
      [skillId]: { highestCleared: level.number, stars: Math.floor(level.number / MASTERY_BAND_SIZE), totalXp: prevSkill.totalXp + xp.total },
    },
    levels: { ...state.levels, [level.id]: { completedAt: at, revision: level.revision, correct, total: level.questions.length, idempotencyKey } },
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
      correct,
      total: level.questions.length,
      masteryCleared: xp.mastery > 0,
    }),
  };
}
