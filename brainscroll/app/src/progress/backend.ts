import type { AccountState, AnswerResult, CompletionSummary, DailyAllowance, Level, ReviewItem, ReviewResult, StartReason } from '@brainscroll/core';

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
  /**
   * Grade one review attempt. The first attempt at a scheduled item is recorded
   * once (+10 XP if right); a miss must be corrected, and corrections earn nothing.
   */
  submitReview(item: ReviewItem, optionId: string): Promise<ReviewResult>;
  /** Dev only: start over as a brand-new player. */
  reset(): Promise<void>;

  // ── Account persistence (docs/accounts.md) ──
  /** Where this player's progress is kept. Local play is always `device_only`. */
  account(): Promise<AccountState>;
  /** Guest → permanent: emails a one-time code to attach `email` to the current (same) user. */
  startEmailLink(email: string): Promise<void>;
  /** Confirms the code. The user id is unchanged, so every bit of progress stays put. */
  confirmEmailLink(email: string, code: string): Promise<AccountState>;
  /** Existing account on this device: emails a sign-in code (never creates an account). */
  startSignIn(email: string): Promise<void>;
  /** Switches this device to that account. The previous guest's progress is not merged. */
  confirmSignIn(email: string, code: string): Promise<AccountState>;
  /** Saved accounts only: sign out and continue as a fresh guest. Guests can't sign out (it would orphan their progress). */
  signOut(): Promise<AccountState>;
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
