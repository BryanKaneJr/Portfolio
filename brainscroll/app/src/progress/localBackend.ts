import {
  AccountError,
  answerQuestion,
  checkedOtpTarget,
  isValidOtp,
  SIGN_IN_METHODS,
  SIGNED_OUT,
  type AccountState,
  type OtpTarget,
  type SignInMethod,
  buildReviewQueue,
  checkStart,
  completeLevel,
  dailyStatus,
  emptyProgress,
  knowledgeLevel,
  localDate,
  submitReview,
  totalCleared,
  type ContentReportInput,
  type ProgressState,
} from '@brainscroll/core';
import { allLevels, getLevel } from '@/content';
import type { ProgressBackend, ProgressSnapshot } from './backend';
import { deviceTimeZone } from './backend';
import { load, newIdempotencyKey, remove, save } from './storage';

/** Per-account progress: `${PROGRESS_KEY}:${userId}`. */
export const PROGRESS_KEY = 'brainscroll.progress.v2';
/** Pre-accounts saves held progress for no one in particular. There is no guest progress: they're dropped. */
const LEGACY_DEVICE_PROGRESS_KEY = 'brainscroll.progress.v1';
const DEV_ACCOUNTS_KEY = 'brainscroll.dev.accounts.v1';
const DEV_SESSION_KEY = 'brainscroll.dev.session.v1';
/** Development builds accept this code for every phone and email sign-in (like fake-supabase's FAKE_OTP). */
export const DEV_CODE = '123456';

type DevAccount = Extract<AccountState, { status: 'signed_in' }>;

/**
 * The development harness, used when no Supabase project is configured:
 * bundled content, the shared rules from @brainscroll/core, and SIMULATED
 * accounts, so the real flow (sign in → onboard → learn) runs without
 * credentials. Nothing is playable before signing in, and progress belongs to
 * an account, never to the device. Release builds must use Supabase.
 */
export function createLocalBackend(): ProgressBackend {
  let user: DevAccount | null = null;
  let state: ProgressState | null = null;

  const current = (): ProgressState => {
    if (!state) throw new AccountError('NOT_SIGNED_IN');
    return state;
  };
  const commit = (next: ProgressState) => {
    if (next === state || !user) return;
    state = next;
    void save(`${PROGRESS_KEY}:${user.userId}`, next);
  };

  async function open(account: DevAccount) {
    user = account;
    const saved = await load<ProgressState>(`${PROGRESS_KEY}:${account.userId}`);
    // Older saves predate attempt tracking.
    state = saved?.version === 1 ? { ...saved, questionAttempts: saved.questionAttempts ?? {} } : emptyProgress(new Date(), deviceTimeZone());
    await save(DEV_SESSION_KEY, account.userId);
    return account;
  }

  /** Signing in is signing up: the same email or phone always finds the same account. */
  async function signInAs(method: SignInMethod, identity: { email?: string; phone?: string }): Promise<AccountState> {
    const accounts = (await load<Record<string, DevAccount>>(DEV_ACCOUNTS_KEY)) ?? {};
    const key = identity.email ? `email:${identity.email}` : `phone:${identity.phone}`;
    const account = accounts[key] ?? { status: 'signed_in', userId: newIdempotencyKey(), method, ...identity };
    await save(DEV_ACCOUNTS_KEY, { ...accounts, [key]: account });
    return open(account);
  }

  return {
    kind: 'local',
    async init() {
      await remove(LEGACY_DEVICE_PROGRESS_KEY);
      const sessionUserId = await load<string>(DEV_SESSION_KEY);
      const accounts = Object.values((await load<Record<string, DevAccount>>(DEV_ACCOUNTS_KEY)) ?? {});
      const account = accounts.find((a) => a.userId === sessionUserId);
      if (account) await open(account);
    },
    async snapshot(): Promise<ProgressSnapshot> {
      const state = current();
      const now = new Date();
      const daily = dailyStatus(state, now);
      return {
        skills: state.skills,
        completedLevels: Object.keys(state.levels),
        daily,
        knowledgeLevel: knowledgeLevel(totalCleared(state)),
        totalXp: state.xpEvents.reduce((n, e) => n + e.amount, 0),
        xpToday: state.xpEvents.filter((e) => localDate(new Date(e.at), state.timeZone) === daily.localDate).reduce((n, e) => n + e.amount, 0),
        reviewsDue: buildReviewQueue(state, allLevels, now, 50).length,
      };
    },
    async startLevel(levelId) {
      const level = getLevel(levelId);
      if (!level) return { reason: 'LEVEL_NOT_AVAILABLE' };
      return { reason: checkStart(current(), level, new Date()), level, revision: level.revision };
    },
    async answerQuestion(level, questionId, optionId) {
      const r = answerQuestion(current(), { level, questionId, optionId });
      commit(r.state);
      return r.result;
    },
    async completeLevel({ level, idempotencyKey }) {
      const r = completeLevel(current(), { level, idempotencyKey, now: new Date() });
      commit(r.state);
      return r.summary;
    },
    async reviewQueue(limit) {
      return buildReviewQueue(current(), allLevels, new Date(), limit);
    },
    async submitReview(item, optionId) {
      const r = submitReview(current(), { item, optionId, now: new Date() });
      commit(r.state);
      return r.result;
    },
    async reset() {
      current();
      commit(emptyProgress(new Date(), deviceTimeZone()));
    },

    // ── Simulated accounts: the real flow, without credentials ──
    account: async () => user ?? SIGNED_OUT,
    signInMethods: async () => [...SIGN_IN_METHODS],
    signInWithProvider(provider) {
      // Stands in for the Apple/Google sheet. Same identity every time, like a real provider account.
      return signInAs(provider, { email: `${provider}.learner@example.com` });
    },
    async sendCode(target) {
      checkedOtpTarget(target); // nothing is sent: the code is always DEV_CODE
    },
    async verifyCode(target, code) {
      const t: OtpTarget = checkedOtpTarget(target);
      if (!isValidOtp(code) || code.trim() !== DEV_CODE) throw new AccountError('INVALID_CODE');
      return signInAs(t.channel, t.channel === 'email' ? { email: t.email } : { phone: t.phone });
    },
    async signOut() {
      user = null;
      state = null;
      await remove(DEV_SESSION_KEY);
      return SIGNED_OUT;
    },
    async deleteAccount() {
      const gone = user;
      if (!gone) throw new AccountError('NOT_SIGNED_IN');
      const accounts = (await load<Record<string, DevAccount>>(DEV_ACCOUNTS_KEY)) ?? {};
      await save(DEV_ACCOUNTS_KEY, Object.fromEntries(Object.entries(accounts).filter(([, a]) => a.userId !== gone.userId)));
      await remove(`${PROGRESS_KEY}:${gone.userId}`);
      await save(REPORTS_KEY, []);
      return this.signOut();
    },
    // The harness sends nothing anywhere.
    async logEvents() {},
    async reportContent(input) {
      // Kept on-device (there's no server to send them to); newest wins per object.
      const reports = (await load<ContentReportInput[]>(REPORTS_KEY)) ?? [];
      const duplicate = reports.some((r) => r.objectId === input.objectId);
      await save(REPORTS_KEY, [...reports.filter((r) => r.objectId !== input.objectId), input].slice(-100));
      return { duplicate };
    },
  };
}

const REPORTS_KEY = 'brainscroll.reports.v1';
