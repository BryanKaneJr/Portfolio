import type { BlockedLearner, UserReportReason, FeedItem, FeedReaction, LeagueView, SocialCard, SocialProfile, SocialView, AccountState, AnalyticsEvent, ChapterReviewResult, Equipped, OtpTarget, SignInMethod, AnswerResult, Card, ContentReportInput, CompletionSummary, DailyAllowance, FinalRoundAnswer, Level, Question, QuestCompletion, QuestsView, QuestView, ReviewItem, ReviewResult, StartReason, Streak, ChestReward, LockerView, Look } from '@brainscroll/core';

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
  /** Learning streak, derived by the server from first clears and review answers. */
  streak: Streak;
  /** Chests opened, boosts and cosmetics won, and what the learner wears (rewards.ts). */
  locker: LockerView;
}

/** A chest just opened: what it paid, the Locker after it, and the day's Brainpower. */
export interface ChestOpening {
  reward: ChestReward;
  locker: LockerView;
  daily: DailyAllowance;
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

/** A Final Round question and the level it comes from (its source cards live there). */
export interface FinalRoundItem {
  question: Question;
  levelId: string;
  /** Final Round only: the question's source cards, in order (the first is shown before the questions, all of them after a miss). */
  cards?: Card[];
}

/** A started (or resumed) chapter review: its questions, and those already answered right. */
export interface ChapterReviewSession {
  reviewId: string;
  skillId: string;
  chapter: number;
  items: FinalRoundItem[];
  resolved: string[];
}

export interface ProgressBackend {
  readonly kind: 'local' | 'remote';
  init(): Promise<void>;
  snapshot(): Promise<ProgressSnapshot>;
  startLevel(levelId: string): Promise<StartResult>;
  /**
   * Cards by id, from any level (a missed question's evidence can come from
   * an earlier one). Server builds fetch their levels' bundles and keep them;
   * the app doesn't ship lessons in those builds.
   */
  cards(ids: readonly string[]): Promise<Card[]>;
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
  // ── Weekly Quests (docs/social-expansion.md) ──
  /** Every quest that has started (newest first) with this learner's progress, and their trophies. */
  quests(): Promise<QuestsView>;
  /** Make an ended quest the one active Archive quest (switching resets the one left). */
  startQuest(questId: string): Promise<QuestView>;
  /** Opens the Final Round once every requirement is met; its questions are picked once and then fixed. */
  openFinalRound(questId: string): Promise<{ view: QuestView; items: FinalRoundItem[] }>;
  /** Grades one Final Round answer; a miss is corrected with the question's source cards. */
  answerFinalRound(questId: string, questionId: string, optionId: string): Promise<FinalRoundAnswer>;
  /** Finishes the quest: its XP bonus once, and the trophy only inside the live week. */
  completeQuest(questId: string): Promise<QuestCompletion>;
  /** Shows a quest title and emblem on Profile (each from a quest trophy the learner holds; null for none). */
  setEquipped(next: Equipped): Promise<Equipped>;
  // ── Chapter reviews (packages/core/src/chapterReview.ts) ──
  /** Starts a review of a cleared chapter (one question per level), or resumes the unfinished one. */
  startChapterReview(skillId: string, chapter: number): Promise<ChapterReviewSession>;
  /** Grades one attempt: the first is recorded once, a miss is corrected with the source cards. */
  answerChapterReview(reviewId: string, question: Question, optionId: string): Promise<AnswerResult>;
  /** Finishes once every question is resolved: up to XP.CHAPTER_REVIEW_MAX, from first attempts. */
  completeChapterReview(reviewId: string): Promise<ChapterReviewResult>;
  // ── Map chests and the Locker (core rewards.ts; SQL 20261106000000_rewards.sql) ──
  /** Opens a chapter's chest (after its 5th level), once: one roll, made by the server. */
  openChest(skillId: string, chapter: number): Promise<ChestOpening>;
  /** Starts a saved XP boost (one at a time). */
  startBoost(boostId: string): Promise<LockerView>;
  /** Wears a ring, name style and title (null takes one off); each must be owned. */
  setLook(look: Look): Promise<LockerView>;
  /** Dev only: erase the signed-in learner's progress and keep the account. */
  reset(): Promise<void>;
  /** The app preview only (local mode, docs/app-preview.md): every glow, name style and title, to try on. */
  ownEveryLook?(): Promise<LockerView>;

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

  // ── Social (core social.ts; SQL 20261022000000_social.sql) ──
  /** Your username and invite code, friends and requests. Gives you a username the first time. */
  social(): Promise<SocialView>;
  /** This week's league (joined on first look), ranked; pays last week's podium first. */
  league(): Promise<LeagueView>;
  /** The last 14 days of moments from you, your friends and your league mates. */
  feed(): Promise<FeedItem[]>;
  /** Anyone's profile (`limited` when it's private and you're not a friend or league mate). Throws SocialError USER_NOT_FOUND when blocked or unknown. */
  socialProfile(userId: string): Promise<SocialProfile>;
  setUsername(name: string): Promise<string>;
  /** Wear an avatar (core avatarUnlocked). Everyone has one; there's no going back to a letter. */
  setAvatar(avatar: string): Promise<string>;
  /** Exact username only; null when there's no one by that name. */
  findUser(username: string): Promise<SocialCard | null>;
  /** Asks, or accepts theirs if they already asked. */
  sendFriendRequest(userId: string): Promise<'requested' | 'friends'>;
  respondFriendRequest(fromId: string, accept: boolean): Promise<void>;
  /** Unfriends, or cancels a request you sent. */
  removeFriend(userId: string): Promise<void>;
  /** Opening someone's invite link: friends at once. */
  acceptInvite(code: string): Promise<SocialCard>;
  blockUser(userId: string): Promise<void>;
  /** The learners you've blocked (Settings), newest first. */
  blockedUsers(): Promise<BlockedLearner[]>;
  /** Stops hiding them; it doesn't make you friends again. */
  unblockUser(userId: string): Promise<void>;
  /** A reason and an optional note for the team (docs/moderation.md). You can't report yourself. */
  reportUser(userId: string, reason: UserReportReason, note?: string): Promise<void>;
  /** A heart on someone's moment (one of theirs from the last 14 days); null takes it back. */
  react(ownerId: string, itemKey: string, reaction: FeedReaction | null): Promise<void>;
  /** Friend and league push notifications on or off (docs/notifications.md). */
  setSocialNotifications(on: boolean): Promise<boolean>;
  /** Private profile on or off: when on, only friends and league mates see your levels, XP and trophies. */
  setPrivateProfile(on: boolean): Promise<boolean>;
  /** This device's Expo push token, for this account; it moves with whoever signs in. */
  registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void>;
  /** Signing out: this device stops getting this account's notifications. */
  unregisterPushToken(token: string): Promise<void>;
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
