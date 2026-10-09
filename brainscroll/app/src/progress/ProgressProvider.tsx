import { AccountError, BRAINPOWER, dayNumber, NO_STREAK, SIGNED_OUT, skillProgressView, type AccountState, type AnswerResult, type Card, type OtpTarget, type SignInMethod, type ContentReportInput, type CompletionSummary, type Level, type ReviewItem, type ReviewResult, type Equipped, type FinalRoundAnswer, type QuestCompletion, type QuestsView, type QuestView, type ChapterReviewResult, type Question, type Look, type LockerView, NO_LOOK, chestKey, chestLevel, encodeArrangement, expectedLabels, isArrangement } from '@brainscroll/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { clearAnalytics, configureAnalytics, flush as flushAnalytics, track } from '@/analytics/track';
import { levelByNumber, levelMeta, skills } from '@/content';
import { currentPushToken } from '@/notifications/push';
import { createPurchases, type PlanId, type PurchaseOutcome, type Purchases } from '@/purchases';
import { deviceTimeZone, NO_ENTITLEMENT, type ChestOpening, type ChapterReviewSession, type EntitlementView, type FinalRoundItem, type ProgressBackend, type ProgressSnapshot, type StartResult } from './backend';
import { createLocalBackend } from './localBackend';
import { createRemoteBackend } from './remoteBackend';
import { isUuid, load, newIdempotencyKey, remove, save, TROPHIES_SEEN_KEY, TROPHIES_VIEWED_KEY } from './storage';

/**
 * App-wide account and progress. An account comes first: nothing is playable
 * or saved until the learner signs in (Apple, Google, phone or email), and
 * everything after that belongs to the account. Screens render from `snapshot`
 * and call actions; the backend decides the rules: Supabase when
 * EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are set, otherwise the development harness
 * with simulated accounts. See docs/accounts.md.
 */

// Device-side state, kept per account (`${KEY}:${userId}`), so a second account
// on the same device never inherits the first one's onboarding.
/** Where in-progress levels used to be saved. Levels no longer resume, so it's cleared on sign-in. */
const OLD_SESSIONS_KEY = 'brainscroll.sessions.v2';
const ONBOARDED_KEY = 'brainscroll.onboarded.v2';
/** The skill Home offers to continue: the one the learner last chose or played. */
const ACTIVE_SKILL_KEY = 'brainscroll.activeSkill.v2';
/** Dr. Scroll's one-time tips this account has already seen. */
const TIPS_KEY = 'brainscroll.tips.v1';
const userKey = (key: string, userId: string) => `${key}:${userId}`;
/** Pre-accounts, device-wide state. There is no guest progress to keep: it's dropped on launch. */
const LEGACY_DEVICE_KEYS = ['brainscroll.sessions.v1', 'brainscroll.onboarded.v1', 'brainscroll.activeSkill.v1'];

/** One graded attempt, as the server (or local engine) judged it. */
export interface AttemptView {
  /** The answer as checked: an option id, or a match/order arrangement (core encodeArrangement). */
  optionId: string;
  correct: boolean;
  rationale?: string;
  /** Match and order: the positions that were wrong. */
  wrong?: number[];
  explanation?: string;
  /**
   * The recorded first attempt, when the server says so (levels). False on a
   * right answer means an earlier visit missed it first: that still counts.
   */
  firstAttemptCorrect?: boolean;
}

/**
 * The level being played: where you are and every attempt so far. It lives
 * only while the level is open (owner, 2026-10-02: "if you close a level, you
 * start back at the beginning of it when you reopen it"). It's never saved to
 * the device. First attempts are recorded server-side when checked, so starting
 * over never changes what a level pays.
 */
export interface LevelSession {
  revision: number;
  cardIndex: number;
  attempts: Record<string, AttemptView[]>;
  idempotencyKey: string;
}

interface ProgressContextValue {
  ready: boolean;
  /** Set when the app couldn't start at all (bad config). Being offline is `offline`, not this. */
  error: string | null;
  /**
   * Signed in, but the server couldn't be reached to load progress (offline at
   * launch, or a refresh failed). The account and everything on the device are
   * kept; the tabs show an offline state until `reconnect` succeeds, which
   * happens by itself when the app returns to the foreground or comes back online.
   */
  offline: boolean;
  reconnecting: boolean;
  reconnect(): Promise<void>;
  backend: 'local' | 'remote';
  snapshot: ProgressSnapshot;
  /**
   * Whether any level is open partway. Only this flag is shared, not the
   * sessions themselves: they change on every card, and putting them in the
   * context re-rendered every mounted screen (the skill map underneath a
   * lesson) on each step. The level screen keeps its own copy.
   */
  hasOpenLevel: boolean;
  lastSummary: CompletionSummary | undefined;
  /** Set when the last completed level was the day's first learning: the streak it made (for Level Complete). */
  streakMoment: number | undefined;
  onboarded: boolean;
  /** Dr. Scroll tips this account has already seen (each shows once). */
  seenTips: readonly string[];
  markTipSeen(tipId: string): void;
  isCompleted(levelId: string): boolean;
  /** The next level to play in a skill, if it exists in the bundle. */
  nextLevelId(skillId: string): string | undefined;
  startLevel(levelId: string): Promise<StartResult>;
  /** Cards by id from any level (a missed question's evidence), fetched from the server in server builds. */
  cards(ids: readonly string[]): Promise<Card[]>;
  /** Starts the level from its first card (a level never resumes). */
  startSession(levelId: string, revision: number): LevelSession;
  /** Forgets a level left unfinished, so it starts over next time. */
  discardSession(levelId: string): void;
  updateSession(levelId: string, patch: Partial<LevelSession>): void;
  /** Grade an attempt and add it to the session. The first attempt is recorded once, server-side. */
  answerQuestion(level: Level, questionId: string, optionId: string): Promise<AnswerResult>;
  completeLevel(levelId: string, level: Level): Promise<CompletionSummary>;
  reviewQueue(limit?: number): Promise<ReviewItem[]>;
  /** Friends, the league and the feed: see ProgressBackend. A league prize refreshes XP. */
  social: SocialApi;
  /** Weekly Quests: see ProgressBackend. Completing one refreshes XP. */
  quests(): Promise<QuestsView>;
  startQuest(questId: string): Promise<QuestView>;
  openFinalRound(questId: string): Promise<{ view: QuestView; items: FinalRoundItem[] }>;
  answerFinalRound(questId: string, questionId: string, optionId: string): Promise<FinalRoundAnswer>;
  completeQuest(questId: string): Promise<QuestCompletion>;
  setEquipped(next: Equipped): Promise<Equipped>;
  /** Map chests, XP boosts and the look (snapshot.locker updates with each). */
  rewards: RewardsApi;
  /** Shortcuts for reviewing rewards in the app preview (local mode only; null in real builds). */
  preview: PreviewApi | null;
  submitReview(item: ReviewItem, optionId: string): Promise<ReviewResult>;
  /** Chapter reviews: see ProgressBackend. Finishing one refreshes XP. */
  startChapterReview(skillId: string, chapter: number): Promise<ChapterReviewSession>;
  answerChapterReview(reviewId: string, question: Question, optionId: string): Promise<AnswerResult>;
  completeChapterReview(reviewId: string): Promise<ChapterReviewResult>;
  refresh(): Promise<void>;
  finishOnboarding(): void;
  /**
   * The tree Home's "Up next" follows: the last one played (owner, 2026-10-01).
   * Set whenever a level starts, and by onboarding's first pick. Browsing a
   * skill's map doesn't change it.
   */
  activeSkillId: string | undefined;
  setActiveSkill(skillId: string): void;
  resetAll(): Promise<void>;
  /** The signed-in account, or signed out. Null until known at startup. */
  account: AccountState | null;
  /** Sign-in methods this build offers, in display order. */
  signInMethods: SignInMethod[];
  /** Apple or Google. On web this navigates away and comes back signed in. */
  signInWithProvider(provider: 'apple' | 'google'): Promise<void>;
  /** Texts or emails a one-time code; the account is created on first use. */
  sendCode(target: OtpTarget): Promise<void>;
  verifyCode(target: OtpTarget, code: string): Promise<void>;
  /** Progress stays with the account; the app returns to the sign-in screen. */
  signOut(): Promise<void>;
  /** Permanently deletes the learner and all their data; the app returns to the sign-in screen. */
  deleteAccount(): Promise<void>;
  reportContent(input: ContentReportInput): Promise<{ duplicate: boolean }>;

  // ── Unlimited (docs/subscriptions.md) ──
  /** The learner's plan as the server records it. The cap itself lives in snapshot.daily. */
  entitlement: EntitlementView;
  /** How Unlimited can be bought in this build (plans, or why it can't). */
  purchases: Purchases;
  /** Buys a plan, then has the server re-read the store so the cap lifts at once. */
  buyUnlimited(plan: PlanId): Promise<PurchaseOutcome>;
  /** Restores an earlier purchase on this store account. True when Unlimited is now on. */
  restorePurchases(): Promise<boolean>;
  /** Opens the store's subscription management, then re-syncs. */
  manageSubscription(): Promise<void>;
}

const EMPTY_SNAPSHOT: ProgressSnapshot = {
  skills: {},
  completedLevels: [],
  daily: { localDate: '', cap: BRAINPOWER.MAX, used: 0, remaining: BRAINPOWER.DAILY_REFILL, dailyComplete: false, brainpower: BRAINPOWER.DAILY_REFILL, brainpowerMax: BRAINPOWER.MAX, brainpowerRefill: BRAINPOWER.DAILY_REFILL, brainpowerEarned: [] },
  knowledgeLevel: 1,
  totalXp: 0,
  xpToday: 0,
  streak: NO_STREAK,
  reviewsDue: 0,
  locker: { cosmetics: [], boosts: [], activeBoost: null, look: NO_LOOK, chests: [] },
};

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const BACKEND_KIND: ProgressBackend['kind'] = SUPABASE_URL && SUPABASE_ANON_KEY ? 'remote' : 'local';
/** Store builds set EXPO_PUBLIC_RELEASE=1: they must never fall back to the simulated-account harness. */
const RELEASE = process.env.EXPO_PUBLIC_RELEASE === '1';

function createBackend(): ProgressBackend {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return createRemoteBackend(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (RELEASE) throw new Error('This build has no Supabase project configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  return createLocalBackend();
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

/** Asks the server to re-read the store. If that fails (offline, not set up), falls back to what it already knows. */
async function syncedEntitlement(backend: ProgressBackend): Promise<EntitlementView> {
  try {
    return await backend.syncEntitlement();
  } catch {
    return backend.entitlement().catch(() => NO_ENTITLEMENT);
  }
}

/** The right answer to a question, as an answer string (the app preview's shortcut plays with it). */
const rightAnswer = (q: Question) => (isArrangement(q) ? encodeArrangement(expectedLabels(q)) : (q.options.find((o) => o.correct)?.id ?? ''));

export function ProgressProvider({ children }: { children: ReactNode }) {
  // Created on the client only: static web rendering runs without window/storage.
  const backendRef = useRef<ProgressBackend | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOfflineState] = useState(false);
  const offlineRef = useRef(false);
  const setOffline = useCallback((v: boolean) => {
    offlineRef.current = v;
    setOfflineState(v);
  }, []);
  const [reconnecting, setReconnecting] = useState(false);
  const [snapshot, setSnapshot] = useState<ProgressSnapshot>(EMPTY_SNAPSHOT);
  const [hasOpenLevel, setHasOpenLevel] = useState(false);
  const [lastSummary, setLastSummary] = useState<CompletionSummary>();
  const [streakMoment, setStreakMoment] = useState<number>();
  const [onboarded, setOnboarded] = useState(false);
  const [seenTips, setSeenTips] = useState<string[]>([]);
  const seenTipsRef = useRef<string[]>([]);
  const [activeSkillId, setActiveSkillId] = useState<string | undefined>();
  const [account, setAccount] = useState<AccountState | null>(null);
  const [signInMethods, setSignInMethods] = useState<SignInMethod[]>([]);
  const [entitlement, setEntitlement] = useState<EntitlementView>(NO_ENTITLEMENT);
  const purchases = useMemo(() => createPurchases(BACKEND_KIND), []);
  // Synchronous mirrors for handlers.
  const sessionsRef = useRef<Record<string, LevelSession>>({});
  const snapshotRef = useRef(snapshot);
  const accountRef = useRef<AccountState | null>(null);

  const backendOrThrow = useCallback((): ProgressBackend => {
    if (!backendRef.current) throw new Error('Progress backend not ready');
    return backendRef.current;
  }, []);

  // Settles once launch has made the backend and entered the stored account. A
  // screen opened straight from a link mounts (and asks for its data) before then.
  const [launched] = useState(() => {
    let done = () => {};
    const promise = new Promise<void>((resolve) => (done = resolve));
    return { promise, done };
  });
  const backendAfterLaunch = useCallback(async (): Promise<ProgressBackend> => {
    await launched.promise;
    return backendOrThrow();
  }, [launched, backendOrThrow]);

  const userIdOrThrow = useCallback((): string => {
    const a = accountRef.current;
    if (a?.status !== 'signed_in') throw new AccountError('NOT_SIGNED_IN');
    return a.userId;
  }, []);

  // Refreshes can overlap (one runs in the background after each level), so each
  // takes a number: a reply that comes back after a newer refresh started, or
  // after the account changed (signed out meanwhile), is out of date and dropped.
  const refreshGen = useRef(0);
  const refresh = useCallback(async () => {
    const a = accountRef.current;
    if (a?.status !== 'signed_in') return;
    const gen = ++refreshGen.current;
    const s = await backendOrThrow().snapshot();
    if (gen !== refreshGen.current || accountRef.current !== a) return;
    snapshotRef.current = s;
    setSnapshot(s);
  }, [backendOrThrow]);
  /** The latest completion, so a late refresh only sets the streak chip for the level on screen. */
  const completionGen = useRef(0);
  /** The device day this account last cleared a new level, so a level whose refresh hasn't landed yet still counts as learning today. */
  const learnedDay = useRef<number | null>(null);

  /**
   * Quests fetched alongside progress on entering an account, handed to the
   * first screen that asks (Home, straight after) while still fresh.
   */
  const primedQuests = useRef<{ at: number; view: Promise<QuestsView> } | null>(null);

  const commitSessions = useCallback((next: Record<string, LevelSession>) => {
    sessionsRef.current = next;
    setHasOpenLevel(Object.keys(next).length > 0);
  }, []);

  /** Loads everything that belongs to this account: its server progress and its device-side state. */
  const enter = useCallback(
    async (next: AccountState) => {
      accountRef.current = next;
      learnedDay.current = null;
      if (next.status !== 'signed_in') {
        setOffline(false);
        commitSessions({});
        snapshotRef.current = EMPTY_SNAPSHOT;
        setSnapshot(EMPTY_SNAPSHOT);
        setLastSummary(undefined);
        setStreakMoment(undefined);
        setOnboarded(false);
        setActiveSkillId(undefined);
        seenTipsRef.current = [];
        setSeenTips([]);
        setEntitlement(NO_ENTITLEMENT);
        void purchases.identify(null).catch(() => {});
        setAccount(next);
        return;
      }
      // Purchases belong to the account, so the store sees the same id the server does.
      void purchases.identify(next.userId).catch(() => {});
      void remove(userKey(OLD_SESSIONS_KEY, next.userId));
      const [o, active, tips] = await Promise.all([
        load<boolean>(userKey(ONBOARDED_KEY, next.userId)),
        load<string>(userKey(ACTIVE_SKILL_KEY, next.userId)),
        load<string[]>(userKey(TIPS_KEY, next.userId)),
      ]);
      seenTipsRef.current = tips ?? [];
      setSeenTips(tips ?? []);
      commitSessions({});
      setActiveSkillId(active);
      // The plan, progress and this week's quests in one go, not one after another.
      primedQuests.current = { at: Date.now(), view: backendOrThrow().quests() };
      primedQuests.current.view.catch(() => {});
      let reached = true;
      const [e] = await Promise.all([
        backendOrThrow().entitlement().catch(() => NO_ENTITLEMENT),
        refresh().catch(() => {
          reached = false;
        }),
      ]);
      setEntitlement(e);
      setOffline(!reached);
      // Progress comes with the account: anyone who has cleared a level (on any device) has onboarded.
      // Offline, we can't tell yet; the offline state shows instead, and reconnecting decides.
      setOnboarded(o === true || snapshotRef.current.completedLevels.length > 0 || !reached);
      setAccount(next);
    },
    [refresh, backendOrThrow, purchases, setOffline, commitSessions],
  );

  /** After any store change: the server re-reads the store, then the cap and plan refresh. */
  const resync = useCallback(async () => {
    const e = await syncedEntitlement(backendOrThrow());
    setEntitlement(e);
    await refresh();
    return e;
  }, [backendOrThrow, refresh]);

  useEffect(() => {
    (async () => {
      try {
        backendRef.current ??= createBackend();
        const backend = backendRef.current;
        await Promise.all(LEGACY_DEVICE_KEYS.map(remove));
        await backend.init();
        void configureAnalytics((events) =>
          // Events are only ever sent under a signed-in account; while signed out they wait in the queue.
          accountRef.current?.status === 'signed_in' ? backend.logEvents(events) : Promise.reject(new AccountError('NOT_SIGNED_IN')),
        );
        const a = await backend.account();
        // Signed in, the sign-in options aren't needed yet: read them without holding up launch.
        const methods = backend.signInMethods();
        if (a.status === 'signed_in') void methods.then(setSignInMethods, () => {});
        else setSignInMethods(await methods);
        await enter(a);
        track('app_open', { backend: backend.kind });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setAccount(SIGNED_OUT);
      }
      setReady(true);
      launched.done();
    })();
  }, [enter, launched]);

  /** Try the server again after `offline`: reload progress, the plan and whether onboarding is done. */
  const reconnecting$ = useRef(false);
  const reconnect = useCallback(async () => {
    const a = accountRef.current;
    if (a?.status !== 'signed_in' || reconnecting$.current) return;
    reconnecting$.current = true;
    setReconnecting(true);
    try {
      await refresh();
      const o = await load<boolean>(userKey(ONBOARDED_KEY, a.userId));
      setOnboarded(o === true || snapshotRef.current.completedLevels.length > 0);
      setEntitlement(await backendOrThrow().entitlement().catch(() => NO_ENTITLEMENT));
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      reconnecting$.current = false;
      setReconnecting(false);
    }
  }, [refresh, backendOrThrow, setOffline]);

  // Offline recovers by itself: when the app comes back to the foreground, or the browser comes back online.
  useEffect(() => {
    const retry = () => {
      if (offlineRef.current) void reconnect();
    };
    const sub = AppState.addEventListener('change', (s) => s === 'active' && retry());
    const web = Platform.OS === 'web' && typeof window !== 'undefined';
    if (web) window.addEventListener('online', retry);
    return () => {
      sub.remove();
      if (web) window.removeEventListener('online', retry);
    };
  }, [reconnect]);

  const signedIn = useCallback(
    async (next: AccountState) => {
      await enter(next);
      if (next.status === 'signed_in') track('sign_in_completed', { method: next.method });
    },
    [enter],
  );

  // Stable across progress changes, so screens that load with them (useSocial,
  // useQuests) don't refetch on every unrelated update.
  const social = useMemo<SocialApi>(
    () => ({
      view: async () => (await backendAfterLaunch()).social(),
      async league() {
        const r = await (await backendAfterLaunch()).league();
        // Opening the league pays last week's podium: bring the XP up to date.
        if (r.lastWeek?.xp) await refresh().catch(() => {});
        return r;
      },
      feed: async () => (await backendAfterLaunch()).feed(),
      worldBoard: async () => (await backendAfterLaunch()).worldBoard(),
      profile: async (userId) => (await backendAfterLaunch()).socialProfile(userId),
      setUsername: async (name) => (await backendAfterLaunch()).setUsername(name),
      setAvatar: async (avatar) => (await backendAfterLaunch()).setAvatar(avatar),
      findUser: async (username) => (await backendAfterLaunch()).findUser(username),
      sendFriendRequest: async (userId) => (await backendAfterLaunch()).sendFriendRequest(userId),
      respondFriendRequest: async (fromId, accept) => (await backendAfterLaunch()).respondFriendRequest(fromId, accept),
      removeFriend: async (userId) => (await backendAfterLaunch()).removeFriend(userId),
      acceptInvite: async (code) => (await backendAfterLaunch()).acceptInvite(code),
      blockUser: async (userId) => (await backendAfterLaunch()).blockUser(userId),
      blocked: async () => (await backendAfterLaunch()).blockedUsers(),
      unblockUser: async (userId) => (await backendAfterLaunch()).unblockUser(userId),
      reportUser: async (userId, reason, note) => (await backendAfterLaunch()).reportUser(userId, reason, note),
      react: async (ownerId, itemKey, reaction) => (await backendAfterLaunch()).react(ownerId, itemKey, reaction),
      setNotifications: async (on) => (await backendAfterLaunch()).setSocialNotifications(on),
      setPrivateProfile: async (on) => (await backendAfterLaunch()).setPrivateProfile(on),
      registerPushToken: async (token, platform) => (await backendAfterLaunch()).registerPushToken(token, platform),
    }),
    [backendAfterLaunch, refresh],
  );
  // The Locker changes in place, so the map, header and Profile see it at once.
  const withLocker = useCallback((locker: LockerView, daily?: ChestOpening['daily']) => {
    const s = { ...snapshotRef.current, locker, ...(daily ? { daily: { ...snapshotRef.current.daily, ...daily } } : {}) };
    snapshotRef.current = s;
    setSnapshot(s);
  }, []);
  const rewards = useMemo<RewardsApi>(
    () => ({
      async openChest(skillId, chapter) {
        const r = await backendOrThrow().openChest(skillId, chapter);
        withLocker(r.locker, r.daily);
        track('chest_opened', { skill_id: skillId, chapter, reward: r.reward.kind });
        return r;
      },
      async startBoost(boostId) {
        const minutes = snapshotRef.current.locker.boosts.find((b) => b.id === boostId)?.minutes;
        const locker = await backendOrThrow().startBoost(boostId);
        withLocker(locker);
        if (minutes) track('boost_started', { boost: `boost_${minutes}` });
        return locker;
      },
      async setLook(look) {
        const before = snapshotRef.current.locker.look;
        const locker = await backendOrThrow().setLook(look);
        withLocker(locker);
        for (const [kind, id] of [['ring', look.ring], ['name_style', look.nameStyle], ['title', look.title]] as const) {
          const was = kind === 'name_style' ? before.nameStyle : before[kind];
          if (id && id !== was) track('cosmetic_equipped', { kind, item_id: id });
        }
        return locker;
      },
    }),
    [backendOrThrow, withLocker],
  );

  const preview = useMemo<PreviewApi | null>(
    () =>
      BACKEND_KIND !== 'local'
        ? null
        : {
            async clearToChest(skillId) {
              const b = backendOrThrow();
              const s = snapshotRef.current;
              const cleared = s.skills[skillId]?.highestCleared ?? 0;
              // The first chest not opened yet (chests come in chapter order): ready already, or played up to.
              let chapter = 1;
              while (s.locker.chests.includes(chestKey(skillId, chapter))) chapter++;
              try {
                for (let n = cleared + 1; n <= chestLevel(chapter); n++) {
                  const id = levelByNumber(skillId, n)?.id;
                  if (!id) return { stopped: 'NO_MORE_LEVELS' };
                  const r = await b.startLevel(id);
                  if (r.reason !== 'NEW' || !r.level) return { stopped: r.reason };
                  for (const q of r.level.questions) await b.answerQuestion(r.level, q.id, rightAnswer(q));
                  await b.completeLevel({ level: r.level, revision: r.revision ?? r.level.revision, idempotencyKey: newIdempotencyKey() });
                }
                return { chapter };
              } finally {
                await refresh();
              }
            },
            async ownEveryLook() {
              const locker = await backendOrThrow().ownEveryLook?.();
              if (locker) withLocker(locker);
            },
          },
    [backendOrThrow, refresh, withLocker],
  );

  const quests = useCallback(() => {
    const primed = primedQuests.current;
    primedQuests.current = null;
    return primed && Date.now() - primed.at < 10_000 ? primed.view.catch(() => backendOrThrow().quests()) : backendOrThrow().quests();
  }, [backendOrThrow]);

  const value = useMemo<ProgressContextValue>(
    () => ({
      ready,
      error,
      offline,
      reconnecting,
      reconnect,
      backend: BACKEND_KIND,
      snapshot,
      hasOpenLevel,
      lastSummary,
      streakMoment,
      onboarded,
      seenTips,
      markTipSeen(tipId) {
        if (seenTipsRef.current.includes(tipId)) return;
        const next = [...seenTipsRef.current, tipId];
        seenTipsRef.current = next;
        setSeenTips(next);
        void save(userKey(TIPS_KEY, userIdOrThrow()), next);
      },
      isCompleted: (levelId) => snapshotRef.current.completedLevels.includes(levelId),
      nextLevelId(skillId) {
        const cleared = snapshotRef.current.skills[skillId]?.highestCleared ?? 0;
        return levelByNumber(skillId, cleared + 1)?.id;
      },
      startLevel(levelId) {
        const skillId = levelMeta(levelId)?.skillId;
        if (skillId) {
          setActiveSkillId(skillId);
          void save(userKey(ACTIVE_SKILL_KEY, userIdOrThrow()), skillId);
        }
        return backendOrThrow().startLevel(levelId);
      },
      cards: (ids) => backendOrThrow().cards(ids),
      startSession(levelId, revision) {
        const created: LevelSession = { revision, cardIndex: 0, attempts: {}, idempotencyKey: newIdempotencyKey() };
        commitSessions({ ...sessionsRef.current, [levelId]: created });
        return created;
      },
      discardSession(levelId) {
        if (!sessionsRef.current[levelId]) return;
        const { [levelId]: _gone, ...rest } = sessionsRef.current;
        commitSessions(rest);
      },
      updateSession(levelId, patch) {
        const current = sessionsRef.current[levelId];
        if (!current) return;
        commitSessions({ ...sessionsRef.current, [levelId]: { ...current, ...patch } });
      },
      async answerQuestion(level, questionId, optionId) {
        const result = await backendOrThrow().answerQuestion(level, questionId, optionId);
        const session = sessionsRef.current[level.id];
        if (session) {
          const prev = session.attempts[questionId] ?? [];
          const attempt: AttemptView = { optionId, correct: result.correct, rationale: result.rationale, wrong: result.wrong, explanation: result.explanation, firstAttemptCorrect: result.firstAttemptCorrect };
          commitSessions({ ...sessionsRef.current, [level.id]: { ...session, attempts: { ...session.attempts, [questionId]: [...prev, attempt] } } });
        }
        return result;
      },
      async completeLevel(levelId, level) {
        // Anything that completes can earn trophies: the quests fetched at launch are out of date now.
        primedQuests.current = null;
        let session = sessionsRef.current[levelId];
        if (!session) throw new Error(`No session for ${levelId}`);
        // A level started before the key fix holds a key the server refuses. It never saved, so a new one is safe.
        if (!isUuid(session.idempotencyKey)) {
          session = { ...session, idempotencyKey: newIdempotencyKey() };
          commitSessions({ ...sessionsRef.current, [levelId]: session });
        }
        const today = dayNumber(new Date(), deviceTimeZone());
        const countedBefore = snapshotRef.current.streak.today || learnedDay.current === today;
        const summary = await backendOrThrow().completeLevel({
          level,
          revision: session.revision,
          idempotencyKey: session.idempotencyKey,
        });
        const { [levelId]: _done, ...rest } = sessionsRef.current;
        commitSessions(rest);
        setLastSummary(summary);
        if (!summary.alreadyCompleted) learnedDay.current = today;
        const mine = ++completionGen.current;
        const who = accountRef.current;
        // The level is saved, so Level Complete shows now (it reads the summary) and progress
        // refreshes behind it; the streak chip pops in when the refresh lands. If the refresh
        // fails, the completion still stands.
        setStreakMoment(undefined);
        void refresh().then(
          () => {
            // A newer level (or another account) is on screen now: its own refresh decides.
            if (mine !== completionGen.current || accountRef.current !== who) return;
            const after = snapshotRef.current.streak;
            setStreakMoment(!countedBefore && after.today ? after.current : undefined);
          },
          () => setOffline(true),
        );
        return summary;
      },
      reviewQueue: (limit = 10) => backendOrThrow().reviewQueue(limit),
      social,
      quests,
      startQuest: (questId) => backendOrThrow().startQuest(questId),
      openFinalRound: (questId) => backendOrThrow().openFinalRound(questId),
      answerFinalRound: (questId, questionId, optionId) => backendOrThrow().answerFinalRound(questId, questionId, optionId),
      async setEquipped(next) {
        const r = await backendOrThrow().setEquipped(next);
        // A quest title takes off a look title.
        if (next.titleQuestId && snapshotRef.current.locker.look.title) void refresh().catch(() => {});
        return r;
      },
      rewards,
      preview,
      async completeQuest(questId) {
        primedQuests.current = null;
        const result = await backendOrThrow().completeQuest(questId);
        await refresh().catch(() => setOffline(true));
        return result;
      },
      submitReview(item, optionId) {
        primedQuests.current = null;
        return backendOrThrow().submitReview(item, optionId);
      },
      startChapterReview: (skillId, chapter) => backendOrThrow().startChapterReview(skillId, chapter),
      answerChapterReview: (reviewId, question, optionId) => backendOrThrow().answerChapterReview(reviewId, question, optionId),
      async completeChapterReview(reviewId) {
        primedQuests.current = null;
        const result = await backendOrThrow().completeChapterReview(reviewId);
        await refresh().catch(() => setOffline(true));
        return result;
      },
      refresh,
      finishOnboarding() {
        setOnboarded(true);
        void save(userKey(ONBOARDED_KEY, userIdOrThrow()), true);
      },
      activeSkillId,
      setActiveSkill(skillId) {
        setActiveSkillId(skillId);
        void save(userKey(ACTIVE_SKILL_KEY, userIdOrThrow()), skillId);
      },
      async resetAll() {
        const userId = userIdOrThrow();
        await backendOrThrow().reset();
        commitSessions({});
        setLastSummary(undefined);
        setStreakMoment(undefined);
        setOnboarded(false);
        void save(userKey(ONBOARDED_KEY, userId), false);
        setActiveSkillId(undefined);
        void save(userKey(ACTIVE_SKILL_KEY, userId), null);
        seenTipsRef.current = [];
        setSeenTips([]);
        void save(userKey(TIPS_KEY, userId), []);
        // Forget what was shown, so re-earned trophies are new again (and remote, which keeps its trophies, doesn't re-celebrate them all).
        void remove(userKey(TROPHIES_SEEN_KEY, userId));
        void remove(userKey(TROPHIES_VIEWED_KEY, userId));
        await enter(await backendOrThrow().account());
      },
      account,
      signInMethods,
      async signInWithProvider(provider) {
        track('sign_in_started', { method: provider });
        await signedIn(await backendOrThrow().signInWithProvider(provider));
      },
      async sendCode(target) {
        await backendOrThrow().sendCode(target);
        track('sign_in_started', { method: target.channel });
      },
      async verifyCode(target, code) {
        await signedIn(await backendOrThrow().verifyCode(target, code));
      },
      reportContent: (input) => backendOrThrow().reportContent(input),
      async deleteAccount() {
        const next = await backendOrThrow().deleteAccount();
        // Nothing from the deleted account may be sent under the next one.
        clearAnalytics();
        await enter(next);
      },
      async signOut() {
        // Send this account's queued events while it can still be credited.
        await flushAnalytics();
        // This device stops getting this account's notifications.
        const token = currentPushToken();
        if (token) await backendOrThrow().unregisterPushToken(token).catch(() => {});
        await enter(await backendOrThrow().signOut());
      },
      entitlement,
      purchases,
      async buyUnlimited(plan) {
        userIdOrThrow();
        track('purchase_started', { plan });
        const outcome = await purchases.purchase(plan);
        if (outcome !== 'purchased') return outcome;
        const e = await resync();
        if (e.active) track('subscription_started', { plan });
        return outcome;
      },
      async restorePurchases() {
        userIdOrThrow();
        await purchases.restore();
        const e = await resync();
        track('purchase_restored', { found: e.active });
        return e.active;
      },
      async manageSubscription() {
        userIdOrThrow();
        await purchases.manage();
        await resync();
      },
    }),
    [ready, error, offline, reconnecting, reconnect, setOffline, snapshot, hasOpenLevel, lastSummary, streakMoment, onboarded, seenTips, account, signInMethods, activeSkillId, entitlement, purchases, refresh, resync, commitSessions, social, rewards, preview, quests, backendOrThrow, userIdOrThrow, enter, signedIn],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
}

/** Display-ready view of progress for Home, Skills and Profile. */
export function useProgressView() {
  const { snapshot, hasOpenLevel } = useProgress();
  const skillViews = skills.map((s) => {
    const p = snapshot.skills[s.id];
    return { ...s, view: skillProgressView(p?.highestCleared ?? 0), xp: p?.totalXp ?? 0 };
  });
  return {
    knowledgeLevel: snapshot.knowledgeLevel,
    totalXp: snapshot.totalXp,
    xpToday: snapshot.xpToday,
    skills: skillViews,
    today: snapshot.daily,
    reviewsDue: snapshot.reviewsDue,
    streak: snapshot.streak,
    hasOpenLevel,
  };
}

/** The social half of ProgressBackend, as screens use it. */
export interface RewardsApi {
  openChest(skillId: string, chapter: number): Promise<ChestOpening>;
  startBoost(boostId: string): Promise<LockerView>;
  setLook(look: Look): Promise<LockerView>;
}

export interface PreviewApi {
  /**
   * Plays a skill's next levels, every first answer right, through the same
   * rules as a learner, up to its next unopened chest. Returns that chest's
   * chapter, or why play stopped (out of Brainpower, say).
   */
  clearToChest(skillId: string): Promise<{ chapter: number } | { stopped: string }>;
  /** Every glow, name style and title, to try on in Edit profile. */
  ownEveryLook(): Promise<void>;
}

export interface SocialApi {
  view: ProgressBackend['social'];
  league: ProgressBackend['league'];
  feed: ProgressBackend['feed'];
  worldBoard: ProgressBackend['worldBoard'];
  profile: ProgressBackend['socialProfile'];
  setUsername: ProgressBackend['setUsername'];
  setAvatar: ProgressBackend['setAvatar'];
  findUser: ProgressBackend['findUser'];
  sendFriendRequest: ProgressBackend['sendFriendRequest'];
  respondFriendRequest: ProgressBackend['respondFriendRequest'];
  removeFriend: ProgressBackend['removeFriend'];
  acceptInvite: ProgressBackend['acceptInvite'];
  blockUser: ProgressBackend['blockUser'];
  blocked: ProgressBackend['blockedUsers'];
  unblockUser: ProgressBackend['unblockUser'];
  reportUser: ProgressBackend['reportUser'];
  react: ProgressBackend['react'];
  setNotifications: ProgressBackend['setSocialNotifications'];
  setPrivateProfile: ProgressBackend['setPrivateProfile'];
  registerPushToken: ProgressBackend['registerPushToken'];
}

