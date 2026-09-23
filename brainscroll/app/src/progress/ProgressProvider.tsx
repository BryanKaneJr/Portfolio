import {
  checkStart,
  completeLevel as applyCompletion,
  dailyStatus,
  dueConcepts,
  emptyProgress,
  highestCleared,
  knowledgeLevel,
  skillProgressView,
  totalCleared,
  type Answers,
  type CompletionSummary,
  type ProgressState,
  type StartReason,
} from '@brainscroll/core';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getLevel, levelByNumber, skills } from '@/content';
import { load, newIdempotencyKey, save } from './storage';

/**
 * Local progress for offline play. It uses the same rules as the server's
 * complete_level (via @brainscroll/core). When Supabase is wired, completeLevel()
 * becomes an RPC and this provider just caches the authoritative result.
 */

const PROGRESS_KEY = 'brainscroll.progress.v1';
const SESSIONS_KEY = 'brainscroll.sessions.v1';

/** In-progress level: where you are and what you've answered, so a restart resumes. */
export interface LevelSession {
  cardIndex: number;
  answers: Answers;
  idempotencyKey: string;
}

interface ProgressContextValue {
  ready: boolean;
  state: ProgressState;
  sessions: Record<string, LevelSession>;
  lastSummary: CompletionSummary | undefined;
  checkStart(levelId: string): StartReason;
  /** The next level to play in a skill, if it exists in the bundle. */
  nextLevelId(skillId: string): string | undefined;
  getSession(levelId: string): LevelSession;
  updateSession(levelId: string, patch: Partial<LevelSession>): void;
  completeLevel(levelId: string): CompletionSummary;
  resetAll(): void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

function freshState(): ProgressState {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return emptyProgress(new Date(), tz);
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<ProgressState>(freshState);
  const [sessions, setSessions] = useState<Record<string, LevelSession>>({});
  const [lastSummary, setLastSummary] = useState<CompletionSummary>();
  // Refs give synchronous reads, so a double tap can't complete a level twice.
  const stateRef = useRef(state);
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([load<ProgressState>(PROGRESS_KEY), load<Record<string, LevelSession>>(SESSIONS_KEY)]);
      if (p?.version === 1) {
        stateRef.current = p;
        setState(p);
      }
      if (s) {
        sessionsRef.current = s;
        setSessions(s);
      }
      setReady(true);
    })();
  }, []);

  const commitState = useCallback((next: ProgressState) => {
    stateRef.current = next;
    setState(next);
    void save(PROGRESS_KEY, next);
  }, []);

  const commitSessions = useCallback((next: Record<string, LevelSession>) => {
    sessionsRef.current = next;
    setSessions(next);
    void save(SESSIONS_KEY, next);
  }, []);

  const getSession = useCallback((levelId: string): LevelSession => {
    const existing = sessionsRef.current[levelId];
    if (existing) return existing;
    const created = { cardIndex: 0, answers: {}, idempotencyKey: newIdempotencyKey() };
    commitSessions({ ...sessionsRef.current, [levelId]: created });
    return created;
  }, [commitSessions]);

  const updateSession = useCallback((levelId: string, patch: Partial<LevelSession>) => {
    const current = sessionsRef.current[levelId] ?? { cardIndex: 0, answers: {}, idempotencyKey: newIdempotencyKey() };
    commitSessions({ ...sessionsRef.current, [levelId]: { ...current, ...patch } });
  }, [commitSessions]);

  const value = useMemo<ProgressContextValue>(() => ({
    ready,
    state,
    sessions,
    lastSummary,
    checkStart(levelId) {
      const level = getLevel(levelId);
      return level ? checkStart(stateRef.current, level, new Date()) : 'LEVEL_NOT_AVAILABLE';
    },
    nextLevelId(skillId) {
      return levelByNumber(skillId, highestCleared(stateRef.current, skillId) + 1)?.id;
    },
    getSession,
    updateSession,
    completeLevel(levelId) {
      const level = getLevel(levelId);
      if (!level) throw new Error(`Unknown level ${levelId}`);
      const session = getSession(levelId);
      const { state: next, summary } = applyCompletion(stateRef.current, {
        level,
        answers: session.answers,
        idempotencyKey: session.idempotencyKey,
        now: new Date(),
      });
      if (next !== stateRef.current) commitState(next);
      const { [levelId]: _done, ...rest } = sessionsRef.current;
      commitSessions(rest);
      setLastSummary(summary);
      return summary;
    },
    resetAll() {
      commitState(freshState());
      commitSessions({});
      setLastSummary(undefined);
    },
  }), [ready, state, sessions, lastSummary, getSession, updateSession, commitState, commitSessions]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
}

/** Derived, display-ready view of progress for Home, Skills and Profile. */
export function useProgressView() {
  const { state, sessions } = useProgress();
  const now = new Date();
  const skillViews = skills.map((s) => ({ ...s, view: skillProgressView(highestCleared(state, s.id)), xp: state.skills[s.id]?.totalXp ?? 0 }));
  return {
    knowledgeLevel: knowledgeLevel(totalCleared(state)),
    totalXp: state.xpEvents.reduce((n, e) => n + e.amount, 0),
    skills: skillViews,
    today: dailyStatus(state, now),
    reviewsDue: dueConcepts(state, now),
    sessions,
  };
}
