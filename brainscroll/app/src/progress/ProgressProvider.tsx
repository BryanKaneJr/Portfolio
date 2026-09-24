import { AccountError, SIGNED_OUT, skillProgressView, type AccountState, type AnswerResult, type OtpTarget, type SignInMethod, type ContentReportInput, type CompletionSummary, type Level, type ReviewItem, type ReviewResult } from '@brainscroll/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clearAnalytics, configureAnalytics, flush as flushAnalytics, track } from '@/analytics/track';
import { levelByNumber, skills } from '@/content';
import type { ProgressBackend, ProgressSnapshot, StartResult } from './backend';
import { createLocalBackend } from './localBackend';
import { createRemoteBackend } from './remoteBackend';
import { load, newIdempotencyKey, remove, save } from './storage';

/**
 * App-wide account and progress. An account comes first: nothing is playable
 * or saved until the learner signs in (Apple, Google, phone or email), and
 * everything after that belongs to the account. Screens render from `snapshot`
 * and call actions; the backend decides the rules: Supabase when
 * EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are set, otherwise the development harness
 * with simulated accounts. See docs/accounts.md.
 */

// Device-side state, kept per account (`${KEY}:${userId}`), so a second account
// on the same device never inherits the first one's sessions or onboarding.
const SESSIONS_KEY = 'brainscroll.sessions.v2';
const ONBOARDED_KEY = 'brainscroll.onboarded.v2';
/** The skill Home offers to continue: the one the learner last chose or played. */
const ACTIVE_SKILL_KEY = 'brainscroll.activeSkill.v2';
const userKey = (key: string, userId: string) => `${key}:${userId}`;
/** Pre-accounts, device-wide state. There is no guest progress to keep: it's dropped on launch. */
const LEGACY_DEVICE_KEYS = ['brainscroll.sessions.v1', 'brainscroll.onboarded.v1', 'brainscroll.activeSkill.v1'];

/** One graded attempt, as the server (or local engine) judged it. */
export interface AttemptView {
  optionId: string;
  correct: boolean;
  rationale?: string;
  explanation?: string;
}

/** In-progress level: where you are and every attempt so far, so a restart resumes exactly. */
export interface LevelSession {
  revision: number;
  cardIndex: number;
  attempts: Record<string, AttemptView[]>;
  idempotencyKey: string;
}

interface ProgressContextValue {
  ready: boolean;
  /** Set when the backend couldn't be reached at startup. */
  error: string | null;
  backend: 'local' | 'remote';
  snapshot: ProgressSnapshot;
  sessions: Record<string, LevelSession>;
  lastSummary: CompletionSummary | undefined;
  onboarded: boolean;
  isCompleted(levelId: string): boolean;
  /** The next level to play in a skill, if it exists in the bundle. */
  nextLevelId(skillId: string): string | undefined;
  startLevel(levelId: string): Promise<StartResult>;
  /** Returns the saved session, or starts one for this revision. */
  getSession(levelId: string, revision: number): LevelSession;
  updateSession(levelId: string, patch: Partial<LevelSession>): void;
  /** Grade an attempt and add it to the session. The first attempt is recorded once, server-side. */
  answerQuestion(level: Level, questionId: string, optionId: string): Promise<AnswerResult>;
  completeLevel(levelId: string, level: Level): Promise<CompletionSummary>;
  reviewQueue(limit?: number): Promise<ReviewItem[]>;
  submitReview(item: ReviewItem, optionId: string): Promise<ReviewResult>;
  refresh(): Promise<void>;
  finishOnboarding(): void;
  /** The skill Home's Continue card follows. Set by onboarding and whenever a level starts. */
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
}

const EMPTY_SNAPSHOT: ProgressSnapshot = {
  skills: {},
  completedLevels: [],
  daily: { localDate: '', cap: 5, used: 0, remaining: 5, dailyComplete: false },
  knowledgeLevel: 1,
  totalXp: 0,
  xpToday: 0,
  reviewsDue: 0,
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

export function ProgressProvider({ children }: { children: ReactNode }) {
  // Created on the client only: static web rendering runs without window/storage.
  const backendRef = useRef<ProgressBackend | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ProgressSnapshot>(EMPTY_SNAPSHOT);
  const [sessions, setSessions] = useState<Record<string, LevelSession>>({});
  const [lastSummary, setLastSummary] = useState<CompletionSummary>();
  const [onboarded, setOnboarded] = useState(false);
  const [activeSkillId, setActiveSkillId] = useState<string | undefined>();
  const [account, setAccount] = useState<AccountState | null>(null);
  const [signInMethods, setSignInMethods] = useState<SignInMethod[]>([]);
  // Synchronous mirrors for handlers.
  const sessionsRef = useRef(sessions);
  const snapshotRef = useRef(snapshot);
  const accountRef = useRef<AccountState | null>(null);

  const backendOrThrow = useCallback((): ProgressBackend => {
    if (!backendRef.current) throw new Error('Progress backend not ready');
    return backendRef.current;
  }, []);

  const userIdOrThrow = useCallback((): string => {
    const a = accountRef.current;
    if (a?.status !== 'signed_in') throw new AccountError('NOT_SIGNED_IN');
    return a.userId;
  }, []);

  const refresh = useCallback(async () => {
    if (accountRef.current?.status !== 'signed_in') return;
    const s = await backendOrThrow().snapshot();
    snapshotRef.current = s;
    setSnapshot(s);
  }, [backendOrThrow]);

  const commitSessions = useCallback((next: Record<string, LevelSession>) => {
    sessionsRef.current = next;
    setSessions(next);
    const a = accountRef.current;
    if (a?.status === 'signed_in') void save(userKey(SESSIONS_KEY, a.userId), next);
  }, []);

  /** Loads everything that belongs to this account: its server progress and its device-side state. */
  const enter = useCallback(
    async (next: AccountState) => {
      accountRef.current = next;
      if (next.status !== 'signed_in') {
        sessionsRef.current = {};
        setSessions({});
        snapshotRef.current = EMPTY_SNAPSHOT;
        setSnapshot(EMPTY_SNAPSHOT);
        setLastSummary(undefined);
        setOnboarded(false);
        setActiveSkillId(undefined);
        setAccount(next);
        return;
      }
      const [s, o, active] = await Promise.all([
        load<Record<string, LevelSession>>(userKey(SESSIONS_KEY, next.userId)),
        load<boolean>(userKey(ONBOARDED_KEY, next.userId)),
        load<string>(userKey(ACTIVE_SKILL_KEY, next.userId)),
      ]);
      sessionsRef.current = s ?? {};
      setSessions(s ?? {});
      setActiveSkillId(active);
      await refresh();
      // Progress comes with the account: anyone who has cleared a level (on any device) has onboarded.
      setOnboarded(o === true || snapshotRef.current.completedLevels.length > 0);
      setAccount(next);
    },
    [refresh],
  );

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
        const [a, methods] = await Promise.all([backend.account(), backend.signInMethods()]);
        setSignInMethods(methods);
        await enter(a);
        track('app_open', { backend: backend.kind });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setAccount(SIGNED_OUT);
      }
      setReady(true);
    })();
  }, [enter]);

  const signedIn = useCallback(
    async (next: AccountState) => {
      await enter(next);
      if (next.status === 'signed_in') track('sign_in_completed', { method: next.method });
    },
    [enter],
  );

  const value = useMemo<ProgressContextValue>(
    () => ({
      ready,
      error,
      backend: BACKEND_KIND,
      snapshot,
      sessions,
      lastSummary,
      onboarded,
      isCompleted: (levelId) => snapshotRef.current.completedLevels.includes(levelId),
      nextLevelId(skillId) {
        const cleared = snapshotRef.current.skills[skillId]?.highestCleared ?? 0;
        return levelByNumber(skillId, cleared + 1)?.id;
      },
      startLevel: (levelId) => backendOrThrow().startLevel(levelId),
      getSession(levelId, revision) {
        const existing = sessionsRef.current[levelId];
        // Content changed since this session began: start the level fresh.
        if (existing && existing.revision === revision) return existing;
        const created: LevelSession = { revision, cardIndex: 0, attempts: {}, idempotencyKey: newIdempotencyKey() };
        commitSessions({ ...sessionsRef.current, [levelId]: created });
        return created;
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
          const attempt: AttemptView = { optionId, correct: result.correct, rationale: result.rationale, explanation: result.explanation };
          commitSessions({ ...sessionsRef.current, [level.id]: { ...session, attempts: { ...session.attempts, [questionId]: [...prev, attempt] } } });
        }
        return result;
      },
      async completeLevel(levelId, level) {
        const session = sessionsRef.current[levelId];
        if (!session) throw new Error(`No session for ${levelId}`);
        const summary = await backendOrThrow().completeLevel({
          level,
          revision: session.revision,
          idempotencyKey: session.idempotencyKey,
        });
        const { [levelId]: _done, ...rest } = sessionsRef.current;
        commitSessions(rest);
        setLastSummary(summary);
        await refresh();
        return summary;
      },
      reviewQueue: (limit = 10) => backendOrThrow().reviewQueue(limit),
      submitReview: (item, optionId) => backendOrThrow().submitReview(item, optionId),
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
        setOnboarded(false);
        void save(userKey(ONBOARDED_KEY, userId), false);
        setActiveSkillId(undefined);
        void save(userKey(ACTIVE_SKILL_KEY, userId), null);
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
        await enter(await backendOrThrow().signOut());
      },
    }),
    [ready, error, snapshot, sessions, lastSummary, onboarded, account, signInMethods, activeSkillId, refresh, commitSessions, backendOrThrow, userIdOrThrow, enter, signedIn],
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
  const { snapshot, sessions } = useProgress();
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
    sessions,
  };
}
