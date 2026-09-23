import type { AnswerResult, CompletionSummary, DailyAllowance, Level, ReviewItem, ReviewResult, StartReason } from '@brainscroll/core';

/**
 * Where progress lives. `local` runs the shared rules on-device (offline play);
 * `remote` calls the Supabase RPCs, which are authoritative. Screens only see
 * this interface, so switching is configuration, not code.
 */
export interface ProgressSnapshot {
  skills: Record<string, { highestCleared: number; stars: number; totalXp: number }>;
  completedLevels: string[];
  daily: DailyAllowance & { localDate: string };
  knowledgeLevel: number;
  totalXp: number;
  xpToday: number;
  reviewsDue: number;
}

export interface StartResult {
  reason: StartReason;
  /** The content to render: the server's current published revision when remote. */
  level?: Level;
  revision?: number;
}

export interface ProgressBackend {
  readonly kind: 'local' | 'remote';
  init(): Promise<void>;
  snapshot(): Promise<ProgressSnapshot>;
  startLevel(levelId: string): Promise<StartResult>;
  /** Grade one attempt. The first attempt at each question is recorded once and never replaced. */
  answerQuestion(level: Level, questionId: string, optionId: string): Promise<AnswerResult>;
  /** Completes a level whose questions are all resolved. XP comes from first attempts only. */
  completeLevel(input: { level: Level; revision: number; idempotencyKey: string }): Promise<CompletionSummary>;
  reviewQueue(limit: number): Promise<ReviewItem[]>;
  submitReview(item: ReviewItem, optionId: string): Promise<ReviewResult>;
  /** Dev only: start over as a brand-new player. */
  reset(): Promise<void>;
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
