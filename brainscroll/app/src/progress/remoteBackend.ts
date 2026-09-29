import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AccountError,
  accountErrorFromAuth,
  accountFromUser,
  checkedOtpTarget,
  isValidOtp,
  SIGN_IN_METHODS,
  SIGNED_OUT,
  type AccountState,
  type AnalyticsEvent,
  type ContentReportInput,
  type SignInMethod,
  MILESTONE_TROPHIES,
  checkClientConfig,
  CompletionError, type CompletionErrorCode, type CompletionOutcome, type CompletionSummary, type Level, type QuestView, type ReviewItem, type StartReason, NO_STREAK, type Streak } from '@brainscroll/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { OFFERED_METHODS } from '@/auth/config';
import { canUseNativeSheet, forgetNativeSession, getIdToken } from '@/auth/idToken';
import { signInWithBrowser } from '@/auth/oauthBrowser';
import { getLevel, levelIdOfQuestion } from '@/content';
import type { EntitlementView, ProgressBackend, ProgressSnapshot } from './backend';
import { deviceTimeZone } from './backend';

/**
 * Supabase-backed progress. The server owns every award; this module only
 * maps RPC payloads (snake_case) to the app's types. An account is required:
 * learners sign in with Apple, Google, a phone number or email before any
 * progress exists. There is no anonymous session. See docs/accounts.md.
 */
export function createRemoteBackend(url: string, anonKey: string): ProgressBackend {
  const supabase: SupabaseClient = createClient(url, anonKey, {
    // PKCE for the web OAuth redirect (Apple/Google); native uses ID tokens and codes, not redirects.
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: Platform.OS === 'web', flowType: 'pkce' },
  });

  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      if (COMPLETION_ERRORS.has(error.message)) throw new CompletionError(error.message as CompletionErrorCode);
      throw new Error(`${fn}: ${error.message}`);
    }
    return data as T;
  }

  let methodsCache: Promise<Set<SignInMethod>> | null = null;

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
      // Restore a saved session, if any. Nothing is created here: signed out stays signed out.
      // The timezone refresh is best-effort: offline at launch must not look like being signed out.
      if ((await currentAccount()).status === 'signed_in') await rpc('update_profile', { p_timezone: deviceTimeZone() }).catch(() => {});
    },
    async entitlement() {
      return mapEntitlement(await rpc<RawEntitlement>('get_entitlement'));
    },
    async syncEntitlement() {
      const { data, error } = await supabase.functions.invoke<RawEntitlement>('sync-entitlement', { method: 'POST' });
      if (error || !data) throw new Error(`sync-entitlement: ${error?.message ?? 'no response'}`);
      return mapEntitlement(data);
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
        streak: s.streak ?? NO_STREAK,
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
    async quests() {
      const r = await rpc<{
        quests: RawQuestView[];
        trophies: { trophy_id: string; name?: string; kind: 'quest' | 'milestone'; quest_id?: string; earned_at: string }[];
        equipped?: { title_quest_id: string | null; emblem_quest_id: string | null };
      }>('get_quests');
      return {
        quests: r.quests.map(mapQuestView),
        trophies: r.trophies.map((t) => ({
          trophyId: t.trophy_id,
          // Milestone names live with their definitions in core; quest trophies carry their own.
          name: t.name ?? MILESTONE_TROPHIES.find((m) => m.id === t.trophy_id)?.name ?? t.trophy_id,
          kind: t.kind,
          ...(t.quest_id ? { questId: t.quest_id } : {}),
          earnedAt: t.earned_at,
        })),
        equipped: { titleQuestId: r.equipped?.title_quest_id ?? null, emblemQuestId: r.equipped?.emblem_quest_id ?? null },
      };
    },
    async startQuest(questId) {
      return mapQuestView(await rpc<RawQuestView>('start_quest', { p_quest_id: questId }));
    },
    async openFinalRound(questId) {
      const view = mapQuestView(await rpc<RawQuestView>('open_final_round', { p_quest_id: questId }));
      const ids = view.finalRound?.questionIds ?? [];
      const levelIds = [...new Set(ids.map((id) => levelIdOfQuestion(id)).filter((l): l is string => !!l))];
      const levels = await bundles(levelIds);
      const items = ids.flatMap((id) => {
        const levelId = levelIdOfQuestion(id);
        const question = levelId ? levels[levelId]?.questions.find((q) => q.id === id) : undefined;
        return question && levelId ? [{ question, levelId }] : [];
      });
      return { view, items };
    },
    async answerFinalRound(questId, questionId, optionId) {
      const r = await rpc<{ correct: boolean; resolved: boolean; rationale: string | null; explanation: string | null }>('answer_final_round', {
        p_quest_id: questId,
        p_question_id: questionId,
        p_option_id: optionId,
      });
      return { correct: r.correct, resolved: r.resolved, ...(r.rationale ? { rationale: r.rationale } : {}), ...(r.explanation ? { explanation: r.explanation } : {}) };
    },
    async setEquipped(next) {
      const r = await rpc<{ title_quest_id: string | null; emblem_quest_id: string | null }>('set_equipped', { p_title_quest: next.titleQuestId, p_emblem_quest: next.emblemQuestId });
      return { titleQuestId: r.title_quest_id, emblemQuestId: r.emblem_quest_id };
    },
    async completeQuest(questId) {
      const r = await rpc<{ quest_id: string; xp_awarded: number; live_clear: boolean; trophy: { trophy_id: string; name: string } | null }>('complete_quest', { p_quest_id: questId });
      return { questId: r.quest_id, xpAwarded: r.xp_awarded, liveClear: r.live_clear, ...(r.trophy ? { trophy: { trophyId: r.trophy.trophy_id, name: r.trophy.name } } : {}) };
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
      // Dev only. Server progress can't be erased without deleting the account (Delete account does that).
      await this.signOut();
    },

    // ── Accounts: required before any progress; codes and ID tokens, no guests ──
    account: currentAccount,
    async signInMethods() {
      const enabled = await projectMethods();
      const offered: SignInMethod[] = [];
      for (const m of SIGN_IN_METHODS) {
        if (!enabled.has(m) || !OFFERED_METHODS.has(m)) continue;
        // Web signs in to Apple and Google by redirect, and Android to Apple in a browser tab;
        // otherwise native needs the OS sheet to be available.
        if ((m === 'apple' || m === 'google') && Platform.OS !== 'web' && !appleInBrowser(m) && !(await canUseNativeSheet(m))) continue;
        offered.push(m);
      }
      return offered;
    },
    async signInWithProvider(provider) {
      if (Platform.OS === 'web') {
        const redirectTo = typeof window === 'undefined' ? undefined : `${window.location.origin}/`;
        const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
        if (error) throw accountErrorFromAuth(error);
        // The page is navigating to the provider; the session is restored when it comes back.
        return new Promise<AccountState>(() => {});
      }
      if (appleInBrowser(provider)) {
        try {
          await signInWithBrowser(supabase, provider);
        } catch (e) {
          throw e instanceof AccountError ? e : accountErrorFromAuth(e as { message?: string });
        }
        return signedIn();
      }
      const id = await getIdToken(provider);
      const { error } = await supabase.auth.signInWithIdToken({ provider, token: id.token, nonce: id.nonce });
      if (error) throw accountErrorFromAuth(error);
      return signedIn();
    },
    async sendCode(target) {
      const t = checkedOtpTarget(target);
      const { error } =
        t.channel === 'email'
          ? await supabase.auth.signInWithOtp({ email: t.email, options: { shouldCreateUser: true } })
          : await supabase.auth.signInWithOtp({ phone: t.phone, options: { shouldCreateUser: true, channel: 'sms' } });
      if (error) throw accountErrorFromAuth(error);
    },
    async verifyCode(target, code) {
      const t = checkedOtpTarget(target);
      if (!isValidOtp(code)) throw new AccountError('INVALID_CODE');
      const token = code.trim();
      const { error } =
        t.channel === 'email'
          ? await supabase.auth.verifyOtp({ email: t.email, token, type: 'email' })
          : await supabase.auth.verifyOtp({ phone: t.phone, token, type: 'sms' });
      if (error) throw accountErrorFromAuth(error);
      return signedIn();
    },
    logEvents,
    reportContent,
    async deleteAccount() {
      await rpc('delete_my_account');
      // The server session died with the user: drop it locally too.
      await supabase.auth.signOut({ scope: 'local' });
      await forgetNativeSession();
      return SIGNED_OUT;
    },
    async signOut() {
      await forgetNativeSession();
      const { error } = await supabase.auth.signOut();
      // Offline, the server call can fail; the local session is gone either way.
      if (error) await supabase.auth.signOut({ scope: 'local' });
      return SIGNED_OUT;
    },
  };

  async function signedIn(): Promise<AccountState> {
    const account = await currentAccount();
    if (account.status !== 'signed_in') throw new AccountError('NOT_SIGNED_IN');
    await rpc('update_profile', { p_timezone: deviceTimeZone() });
    return account;
  }

  /** Android has no Apple sheet: Apple signs in through the browser flow there. */
  function appleInBrowser(m: SignInMethod): boolean {
    return m === 'apple' && Platform.OS === 'android';
  }

  /** Read from the saved session: works offline, and never creates a user. */
  async function currentAccount(): Promise<AccountState> {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    // A leftover anonymous session from the old guest-first design is not an account.
    if (user?.is_anonymous) {
      await supabase.auth.signOut({ scope: 'local' });
      return SIGNED_OUT;
    }
    return accountFromUser(user);
  }

  /** Which methods the project has switched on (Supabase → Auth → Providers). Cached per launch. */
  function projectMethods(): Promise<Set<SignInMethod>> {
    methodsCache ??= (async () => {
      try {
        const r = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/settings`, { headers: { apikey: anonKey } });
        const external = ((await r.json()) as { external?: Record<string, boolean> }).external ?? {};
        return new Set(SIGN_IN_METHODS.filter((m) => external[m] === true));
      } catch {
        // Can't tell (offline): offer the code-based methods; the server has the final say.
        return new Set<SignInMethod>(['phone', 'email']);
      }
    })();
    return methodsCache;
  }

  async function logEvents(events: AnalyticsEvent[]) {
    if (events.length) await rpc('log_events', { p_events: events });
  }

  async function reportContent(input: ContentReportInput) {
    const r = await rpc<{ id: string; duplicate: boolean }>('report_content', {
      p_level_id: input.levelId,
      p_revision: input.revision,
      p_object_type: input.objectType,
      p_object_id: input.objectId,
      p_category: input.category,
      p_message: input.message?.trim() || null,
    });
    return { duplicate: r.duplicate };
  }
}

interface RawQuestView {
  id: string;
  state: QuestView['state'];
  starts_at: string;
  ends_at: string;
  active: boolean;
  requirements: { skill_id: string; required: number; done: number }[];
  final_round_unlocked: boolean;
  final_round: { question_ids: string[]; resolved: string[] } | null;
  completed_at: string | null;
  live_clear: boolean | null;
}

function mapQuestView(r: RawQuestView): QuestView {
  return {
    id: r.id,
    state: r.state,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    active: r.active,
    requirements: r.requirements.map((q) => ({ skillId: q.skill_id, required: q.required, done: q.done })),
    finalRoundUnlocked: r.final_round_unlocked,
    finalRound: r.final_round ? { questionIds: r.final_round.question_ids, resolved: r.final_round.resolved } : null,
    ...(r.completed_at ? { completedAt: r.completed_at, liveClear: !!r.live_clear } : {}),
  };
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
  streak?: Streak;
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

interface RawEntitlement {
  active: boolean;
  expires_at: string | null;
  will_renew: boolean | null;
  store: string | null;
}
const mapEntitlement = (e: RawEntitlement): EntitlementView => ({ active: !!e.active, expiresAt: e.expires_at ?? null, willRenew: e.will_renew ?? null, store: e.store ?? null });
