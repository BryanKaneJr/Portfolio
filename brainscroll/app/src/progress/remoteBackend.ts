import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AccountError,
  accountErrorFromAuth,
  accountFromUser,
  isValidEmail,
  isValidOtp,
  normalizeEmail,
  type AccountState,
  checkClientConfig,
  CompletionError, type CompletionErrorCode, type CompletionOutcome, type CompletionSummary, type Level, type ReviewItem, type StartReason } from '@brainscroll/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLevel } from '@/content';
import type { ProgressBackend, ProgressSnapshot } from './backend';
import { deviceTimeZone } from './backend';

/**
 * Supabase-backed progress. The server owns every award; this module only
 * maps RPC payloads (snake_case) to the app's types. Players start with an
 * anonymous session and can link a real account later without losing progress.
 */
export function createRemoteBackend(url: string, anonKey: string): ProgressBackend {
  const supabase: SupabaseClient = createClient(url, anonKey, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      if (COMPLETION_ERRORS.has(error.message)) throw new CompletionError(error.message as CompletionErrorCode);
      throw new Error(`${fn}: ${error.message}`);
    }
    return data as T;
  }

  async function ensureSession() {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(`sign-in failed: ${error.message}`);
  }

  async function bundles(levelIds: string[]): Promise<Record<string, Level>> {
    if (levelIds.length === 0) return {};
    const raw = await rpc<Record<string, LearnerBundle>>('get_level_bundles', { p_level_ids: levelIds });
    return Object.fromEntries(Object.entries(raw).map(([id, b]) => [id, fromLearnerBundle(b)]));
  }

  return {
    kind: 'remote',
    async init() {
      // Refuse to run with a secret key or a malformed URL (never ship a service key).
      const bad = checkClientConfig(url, anonKey).filter((p) => p.severity === 'error');
      if (bad.length) throw new Error(`Supabase config: ${bad.map((p) => p.message).join('; ')}`);
      await ensureSession();
      await rpc('update_profile', { p_timezone: deviceTimeZone() });
    },
    async snapshot(): Promise<ProgressSnapshot> {
      const s = await rpc<RawProgress>('get_progress');
      return {
        skills: Object.fromEntries(
          Object.entries(s.skills).map(([id, v]) => [id, { highestCleared: v.highest_cleared, stars: v.stars, totalXp: v.total_xp }]),
        ),
        completedLevels: s.completed_levels,
        daily: { ...mapDaily(s.daily), localDate: s.daily.local_date },
        knowledgeLevel: s.knowledge_level,
        totalXp: Number(s.total_xp),
        xpToday: Number(s.xp_today),
        reviewsDue: s.reviews_due,
      };
    },
    async startLevel(levelId) {
      const r = await rpc<{ allowed: boolean; reason: StartReason; revision?: number; bundle?: LearnerBundle }>('start_level', {
        p_level_id: levelId,
      });
      const level = r.bundle ? fromLearnerBundle(r.bundle) : getLevel(levelId);
      return { reason: r.reason, level, revision: r.revision };
    },
    async answerQuestion(level, questionId, optionId) {
      const r = await rpc<{ correct: boolean; resolved: boolean; first_attempt_correct: boolean; attempt_count: number; rationale: string | null; explanation: string | null }>(
        'answer_question',
        { p_level_id: level.id, p_question_id: questionId, p_option_id: optionId },
      );
      return {
        correct: r.correct,
        resolved: r.resolved,
        firstAttemptCorrect: r.first_attempt_correct,
        attemptCount: r.attempt_count,
        rationale: r.rationale ?? undefined,
        explanation: r.explanation ?? undefined,
      };
    },
    async completeLevel({ level, revision, idempotencyKey }) {
      const r = await rpc<RawSummary>('complete_level', {
        p_level_id: level.id,
        p_revision: revision,
        p_idempotency_key: idempotencyKey,
      });
      return mapSummary(r);
    },
    async reviewQueue(limit) {
      const raw = await rpc<{ concept_id: string; question_id: string; level_id: string; skill_id: string }[]>('get_review_queue', { p_limit: limit });
      const levels = await bundles([...new Set(raw.map((i) => i.level_id))]);
      return raw.flatMap((i): ReviewItem[] => {
        const question = levels[i.level_id]?.questions.find((q) => q.id === i.question_id);
        return question ? [{ conceptId: i.concept_id, question, levelId: i.level_id, skillId: i.skill_id }] : [];
      });
    },
    async submitReview(item, optionId) {
      const r = await rpc<{
        correct: boolean;
        resolved: boolean;
        first_attempt_correct: boolean;
        attempt_count: number;
        xp_awarded: number;
        scheduled: boolean;
        rationale: string | null;
        explanation: string | null;
      }>('submit_review', {
        p_concept_id: item.conceptId,
        p_question_id: item.question.id,
        p_option_id: optionId,
      });
      return {
        correct: r.correct,
        resolved: r.resolved,
        firstAttemptCorrect: r.first_attempt_correct,
        attemptCount: r.attempt_count,
        xpAwarded: r.xp_awarded,
        scheduled: r.scheduled,
        rationale: r.rationale ?? undefined,
        explanation: r.explanation ?? undefined,
      };
    },
    async reset() {
      await supabase.auth.signOut();
      await ensureSession();
      await rpc('update_profile', { p_timezone: deviceTimeZone() });
    },

    // ── Account persistence: email one-time codes, no deep links needed ──
    account: currentAccount,
    async startEmailLink(email) {
      const e = checkedEmail(email);
      const now = await currentAccount();
      if (now.status === 'saved') throw new AccountError('NOT_ALLOWED', 'This account already has an email.');
      // For an anonymous user this attaches the email to the SAME user id and
      // sends a confirmation code (Supabase "Change email address" template).
      const { error } = await supabase.auth.updateUser({ email: e });
      if (error) throw accountErrorFromAuth(error);
    },
    async confirmEmailLink(email, code) {
      const { error } = await supabase.auth.verifyOtp({ email: checkedEmail(email), token: checkedCode(code), type: 'email_change' });
      if (error) throw accountErrorFromAuth(error);
      return currentAccount();
    },
    async startSignIn(email) {
      const { error } = await supabase.auth.signInWithOtp({ email: checkedEmail(email), options: { shouldCreateUser: false } });
      if (error) throw accountErrorFromAuth(error);
    },
    async confirmSignIn(email, code) {
      const { error } = await supabase.auth.verifyOtp({ email: checkedEmail(email), token: checkedCode(code), type: 'email' });
      if (error) throw accountErrorFromAuth(error);
      await rpc('update_profile', { p_timezone: deviceTimeZone() });
      return currentAccount();
    },
    async signOut() {
      const now = await currentAccount();
      if (now.status !== 'saved') throw new AccountError('NOT_ALLOWED', 'Add an email first, or your progress would be lost.');
      await supabase.auth.signOut();
      await ensureSession();
      await rpc('update_profile', { p_timezone: deviceTimeZone() });
      return currentAccount();
    },
  };

  async function currentAccount(): Promise<AccountState> {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw accountErrorFromAuth(error);
    const state = accountFromUser(data.user);
    if (!state) throw new AccountError('UNKNOWN', 'Not signed in.');
    return state;
  }
}

function checkedEmail(email: string): string {
  if (!isValidEmail(email)) throw new AccountError('INVALID_EMAIL');
  return normalizeEmail(email);
}

function checkedCode(code: string): string {
  if (!isValidOtp(code)) throw new AccountError('INVALID_CODE');
  return code.trim();
}

const COMPLETION_ERRORS = new Set<string>(['LEVEL_LOCKED', 'DAILY_LIMIT_REACHED', 'UNRESOLVED_QUESTIONS', 'QUESTION_NOT_IN_LEVEL', 'IDEMPOTENCY_KEY_REQUIRED']);

/**
 * The server sends learner bundles: no `correct` flags, rationales or
 * explanations (grading happens in answer_question). Fill neutral placeholders
 * so the shared Level type holds. UI code never reads option.correct in
 * remote mode; it renders the server's verdicts.
 */
type LearnerBundle = Omit<Level, 'status' | 'questions'> & {
  questions: (Omit<Level['questions'][number], 'explanation' | 'options'> & { options: { id: string; label: string }[] })[];
};
function fromLearnerBundle(b: LearnerBundle): Level {
  return {
    ...b,
    status: 'published',
    questions: b.questions.map((q) => ({ ...q, explanation: '', options: q.options.map((o) => ({ ...o, correct: false })) })),
  } as Level;
}

interface RawDaily {
  local_date: string;
  used: number;
  cap: number | null;
  remaining: number | null;
  daily_complete: boolean;
}

interface RawProgress {
  skills: Record<string, { highest_cleared: number; stars: number; total_xp: number }>;
  completed_levels: string[];
  daily: RawDaily;
  knowledge_level: number;
  total_xp: number | string;
  xp_today: number | string;
  reviews_due: number;
}

interface RawSummary {
  level_id: string;
  skill_id: string;
  already_completed: boolean;
  skill_level_before?: number;
  skill_level: number;
  stars: number;
  skill_xp: number;
  xp_awarded: number;
  first_attempt_correct?: number;
  total?: number;
  outcome?: CompletionOutcome;
  reinforced_concept_ids?: string[];
  mastery_cleared?: boolean;
  knowledge_level: number;
  daily: RawDaily;
}

function mapDaily(d: RawDaily) {
  return { cap: d.cap, used: d.used, remaining: d.remaining, dailyComplete: d.daily_complete };
}

function mapSummary(r: RawSummary): CompletionSummary {
  return {
    levelId: r.level_id,
    skillId: r.skill_id,
    alreadyCompleted: r.already_completed,
    skillLevelBefore: r.skill_level_before ?? r.skill_level,
    skillLevel: r.skill_level,
    stars: r.stars,
    skillXp: r.skill_xp,
    xpAwarded: r.xp_awarded,
    firstAttemptCorrect: r.first_attempt_correct ?? 0,
    total: r.total ?? 0,
    outcome: r.outcome ?? 'strong',
    reinforcedConceptIds: r.reinforced_concept_ids ?? [],
    masteryCleared: r.mastery_cleared ?? false,
    knowledgeLevel: r.knowledge_level,
    daily: mapDaily(r.daily),
  };
}
