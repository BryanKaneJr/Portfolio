import type { AccountState, AnalyticsEvent, OtpTarget, SignInMethod, AnswerResult, ContentReportInput, CompletionSummary, DailyAllowance, Level, ReviewItem, ReviewResult, StartReason } from '@brainscroll/core';

/**
 * Where progress lives. `remote` calls the Supabase RPCs, which are
 * authoritative. `local` is the development harness: the shared rules run
 * on-device and accounts are simulated, so the whole flow (sign in → onboard →
 * learn) works without a Supabase project. Release builds use `remote`. Screens only see
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

/** The learner's Unlimited plan, as the server records it. Display only: the cap itself is enforced server-side. */
export interface EntitlementView {
  active: boolean;
  /** ISO time the current period (or grace period) ends; null for none or a grant that never expires. */
  expiresAt: string | null;
  /** false once cancelled (it still runs to expiresAt). */
  willRenew: boolean | null;
  /** APP_STORE, PLAY_STORE, … which decides where it's managed. */
  store: string | null;
}

export const NO_ENTITLEMENT: EntitlementView = { active: false, expiresAt: null, willRenew: null, store: null };

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
  /** Dev only: erase the signed-in learner's progress and keep the account. */
  reset(): Promise<void>;

  // ── Accounts (docs/accounts.md) ──
  // An account is required before any progress exists. There is no guest or
  // anonymous mode, nothing to migrate and nothing to merge. Every progress
  // call above needs a signed-in account.
  /** The current account, restored from the saved session on launch. */
  account(): Promise<AccountState>;
  /** The methods this build can offer right now, in display order (configured and supported here). */
  signInMethods(): Promise<SignInMethod[]>;
  /**
   * Apple or Google. Native: the OS sheet returns an ID token for Supabase.
   * Web: redirects to the provider and back (the promise may never settle,
   * because the page navigates away; the session is restored on return).
   */
  signInWithProvider(provider: 'apple' | 'google'): Promise<AccountState>;
  /** Sends a one-time code by SMS or email. The account is created on first use. */
  sendCode(target: OtpTarget): Promise<void>;
  /** Confirms the code and signs in (or up). */
  verifyCode(target: OtpTarget, code: string): Promise<AccountState>;
  /** Signs out. Progress stays with the account and comes back on the next sign-in, here or anywhere. */
  signOut(): Promise<AccountState>;
  /**
   * Permanently deletes this learner and every piece of their data, then
   * returns to signed out. Store subscriptions are not cancelled by this;
   * they're managed by Apple/Google.
   */
  deleteAccount(): Promise<AccountState>;

  // ── Unlimited (docs/subscriptions.md) ──
  /** The learner's Unlimited plan as recorded server-side. */
  entitlement(): Promise<EntitlementView>;
  /**
   * After a purchase or restore: asks the server to re-read the store's
   * record now, rather than waiting for the store's webhook. Remote calls the
   * sync-entitlement function; local reads the sandbox store.
   */
  syncEntitlement(): Promise<EntitlementView>;

  // ── Analytics & content reports (docs/analytics.md) ──
  /** Sends already-sanitized events. Remote: log_events (allowlisted server-side). Local: dropped. */
  logEvents(events: AnalyticsEvent[]): Promise<void>;
  /** Files a report about a level, card or question. A repeat for the same object updates the open report. */
  reportContent(input: ContentReportInput): Promise<{ duplicate: boolean }>;
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
