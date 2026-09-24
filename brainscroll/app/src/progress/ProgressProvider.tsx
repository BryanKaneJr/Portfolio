import { skillProgressView, type AccountState, type AnswerResult, type ContentReportInput, type CompletionSummary, type Level, type ReviewItem, type ReviewResult } from '@brainscroll/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clearAnalytics, configureAnalytics, track } from '@/analytics/track';
import { levelByNumber, skills } from '@/content';
import type { ProgressBackend, ProgressSnapshot, StartResult } from './backend';
import { createLocalBackend } from './localBackend';
import { createRemoteBackend } from './remoteBackend';
import { load, newIdempotencyKey, save } from './storage';

/**
 * App-wide progress. Screens render from `snapshot` and call actions; the
 * backend decides the rules: Supabase when EXPO_PUBLIC_SUPABASE_URL/ANON_KEY
 * are set, otherwise offline play on-device.
 */

const SESSIONS_KEY = 'brainscroll.sessions.v1';
const ONBOARDED_KEY = 'brainscroll.onboarded.v1';

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
  resetAll(): Promise<void>;
  /** Where progress is kept (device, guest, or a saved email account). Null until known. */
  account: AccountState | null;
  refreshAccount(): Promise<void>;
  startEmailLink(email: string): Promise<void>;
  confirmEmailLink(email: string, code: string): Promise<void>;
  startSignIn(email: string): Promise<void>;
  /** Switches this device to another account; in-progress level sessions belong to the old one and are dropped. */
  confirmSignIn(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  /** Permanently deletes the learner and all their data; the app restarts at onboarding. */
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

function createBackend(): ProgressBackend {
  return SUPABASE_URL && SUPABASE_ANON_KEY ? createRemoteBackend(SUPABASE_URL, SUPABASE_ANON_KEY) : createLocalBackend();
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
  const [account, setAccount] = useState<AccountState | null>(null);
  // Synchronous mirrors for handlers.
  const sessionsRef = useRef(sessions);
  const snapshotRef = useRef(snapshot);

  const backendOrThrow = useCallback((): ProgressBackend => {
    if (!backendRef.current) throw new Error('Progress backend not ready');
    return backendRef.current;
  }, []);

  const refresh = useCallback(async () => {
    const s = await backendOrThrow().snapshot();
    snapshotRef.current = s;
    setSnapshot(s);
  }, [backendOrThrow]);

  useEffect(() => {
    backendRef.current ??= createBackend();
    const backend = backendRef.current;
    (async () => {
      const [s, o] = await Promise.all([load<Record<string, LevelSession>>(SESSIONS_KEY), load<boolean>(ONBOARDED_KEY)]);
      if (s) {
        sessionsRef.current = s;
        setSessions(s);
      }
      try {
        await backend.init();
        void configureAnalytics((events) => backend.logEvents(events));
        track('app_open', { backend: backend.kind });
        await refresh();
        setAccount(await backend.account());
        // Anyone who has already cleared a level has effectively onboarded.
        setOnboarded(o === true || snapshotRef.current.completedLevels.length > 0);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setOnboarded(o === true);
      }
      setReady(true);
    })();
  }, [refresh]);

  const commitSessions = useCallback((next: Record<string, LevelSession>) => {
    sessionsRef.current = next;
    setSessions(next);
    void save(SESSIONS_KEY, next);
  }, []);

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
        void save(ONBOARDED_KEY, true);
      },
      async resetAll() {
        await backendOrThrow().reset();
        commitSessions({});
        setLastSummary(undefined);
        setOnboarded(false);
        void save(ONBOARDED_KEY, false);
        await refresh();
        setAccount(await backendOrThrow().account());
      },
      account,
      async refreshAccount() {
        setAccount(await backendOrThrow().account());
      },
      async startEmailLink(email) {
        await backendOrThrow().startEmailLink(email);
        setAccount(await backendOrThrow().account());
      },
      async confirmEmailLink(email, code) {
        setAccount(await backendOrThrow().confirmEmailLink(email, code));
      },
      startSignIn: (email) => backendOrThrow().startSignIn(email),
      async confirmSignIn(email, code) {
        const next = await backendOrThrow().confirmSignIn(email, code);
        commitSessions({});
        setLastSummary(undefined);
        setAccount(next);
        await refresh();
      },
      reportContent: (input) => backendOrThrow().reportContent(input),
      async deleteAccount() {
        const next = await backendOrThrow().deleteAccount();
        clearAnalytics();
        commitSessions({});
        setLastSummary(undefined);
        setOnboarded(false);
        void save(ONBOARDED_KEY, false);
        setAccount(next);
        await refresh();
      },
      async signOut() {
        const next = await backendOrThrow().signOut();
        commitSessions({});
        setLastSummary(undefined);
        setAccount(next);
        await refresh();
      },
    }),
    [ready, error, snapshot, sessions, lastSummary, onboarded, account, refresh, commitSessions, backendOrThrow],
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
