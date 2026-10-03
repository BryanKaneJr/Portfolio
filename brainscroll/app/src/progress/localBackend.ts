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
  learningStreak,
  localDate,
  submitReview,
  totalCleared,
  type ContentReportInput,
  type ProgressState,
  answerFinalRound,
  completeQuest,
  openFinalRound,
  questsView,
  questView,
  questWindow,
  QuestError,
  setEquipped,
  startQuest,
  answerChapterReview,
  completeChapterReview,
  startChapterReview,
  SocialError,
  milestoneTrophies,
  trophyBrainpower,
  questBrainpower,
  type DailyAllowance,
  gradeAnswer,
} from '@brainscroll/core';
import { allLevels, getLevel, levelCount, levelIdOfQuestion, quests as questDefs, trophyCatalog } from '@/content';
import type { EntitlementView, ProgressBackend, ProgressSnapshot } from './backend';
import { deviceTimeZone } from './backend';
import { OFFERED_METHODS } from '@/auth/config';
import { load, newIdempotencyKey, remove, save } from './storage';
import { befriend, blockedView, checkAvatar, checkUsername, emptyLocalSocial, ensureIdentity, feedView, findSim, inviteSim, leagueView, payLastWeek, profileView, socialView, type LocalSocialState } from './localSocial';

/** Per-account progress: `${PROGRESS_KEY}:${userId}`. */
export const PROGRESS_KEY = 'brainscroll.progress.v2';
/** Pre-accounts saves held progress for no one in particular. There is no guest progress: they're dropped. */
const LEGACY_DEVICE_PROGRESS_KEY = 'brainscroll.progress.v1';
const DEV_ACCOUNTS_KEY = 'brainscroll.dev.accounts.v1';
const DEV_SESSION_KEY = 'brainscroll.dev.session.v1';
/**
 * The development sandbox's store record, per account (`${key}:${userId}`):
 * what a real store and RevenueCat would hold. Written by the sandbox
 * purchases module, read by syncEntitlement(), like the real round trip.
 */
export const DEV_UNLIMITED_KEY = 'brainscroll.dev.unlimited.v1';
export interface DevUnlimitedGrant {
  productId: string;
  store: 'SANDBOX';
  purchasedAt: string;
}

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
function questDef(questId: string) {
  const def = questDefs.find((q) => q.id === questId);
  if (!def) throw new QuestError('QUEST_NOT_FOUND');
  return def;
}

/** Final Round questions from the bundled lessons, with the level each comes from. */
function finalRoundItems(questionIds: string[]) {
  return questionIds.flatMap((id) => {
    const levelId = levelIdOfQuestion(id);
    const question = levelId ? getLevel(levelId)?.questions.find((q) => q.id === id) : undefined;
    return question && levelId ? [{ question, levelId }] : [];
  });
}

export function createLocalBackend(): ProgressBackend {
  let user: DevAccount | null = null;
  let state: ProgressState | null = null;
  let social: LocalSocialState = emptyLocalSocial();
  const SOCIAL_KEY = 'brainscroll.dev.social.v1';
  const commitSocial = (next: LocalSocialState) => {
    social = next;
    if (user) void save(`${SOCIAL_KEY}:${user.userId}`, next);
  };
  /** Your username and invite code exist from the first social look on. */
  const me = () => {
    if (!user) throw new AccountError('NOT_SIGNED_IN');
    if (!social.seeded || !social.avatar) commitSocial(ensureIdentity(user.userId, social));
    return user.userId;
  };

  const current = (): ProgressState => {
    if (!state) throw new AccountError('NOT_SIGNED_IN');
    return state;
  };
  const commit = (next: ProgressState): ProgressState => {
    if (next === state || !user) return next;
    state = next;
    void save(`${PROGRESS_KEY}:${user.userId}`, next);
    return next;
  };

  async function open(account: DevAccount) {
    user = account;
    const saved = await load<ProgressState>(`${PROGRESS_KEY}:${account.userId}`);
    // Older saves predate attempt tracking.
    state = saved?.version === 1 ? { ...saved, questionAttempts: saved.questionAttempts ?? {} } : emptyProgress(new Date(), deviceTimeZone());
    social = (await load<LocalSocialState>(`${SOCIAL_KEY}:${account.userId}`)) ?? emptyLocalSocial();
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
        reviewsDue: buildReviewQueue(state, allLevels(), now, 50).length,
        streak: learningStreak(state, now),
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
      const now = new Date();
      const r = completeLevel(current(), { level, idempotencyKey, now });
      const state = commit(withTrophyBrainpower(r.state, now));
      return { ...r.summary, daily: dailyOf(state, now) };
    },
    async reviewQueue(limit) {
      return buildReviewQueue(current(), allLevels(), new Date(), limit);
    },
    async quests() {
      return questsView(current(), questDefs, new Date(), trophyCatalog);
    },
    async startQuest(questId) {
      const def = questDef(questId);
      const next = startQuest(current(), def, new Date());
      commit(next);
      return questView(next, def, new Date());
    },
    async openFinalRound(questId) {
      const def = questDef(questId);
      const next = openFinalRound(current(), def, new Date(), (levelId) => getLevel(levelId)?.questions ?? []);
      commit(next);
      const view = questView(next, def, new Date());
      return { view, items: finalRoundItems(view.finalRound?.questionIds ?? []) };
    },
    async answerFinalRound(questId, questionId, optionId) {
      const found = finalRoundItems([questionId])[0];
      const now = new Date();
      const r = answerFinalRound(current(), questDef(questId), {
        questionId,
        now,
        grade: () => {
          if (!found) return { correct: false };
          const g = gradeAnswer(found.question, optionId);
          return { ...g, explanation: found.question.explanation };
        },
      });
      commit(withTrophyBrainpower(r.state, now));
      return r.result;
    },
    async setEquipped(next) {
      commit(setEquipped(current(), next));
      return next;
    },
    async completeQuest(questId) {
      const now = new Date();
      const r = completeQuest(current(), questDef(questId), now);
      commit(withTrophyBrainpower(r.state, now));
      return r.result;
    },
    async startChapterReview(skillId, chapter) {
      const r = startChapterReview(current(), { skillId, chapter, reviewId: newIdempotencyKey(), now: new Date(), questionsFor: (levelId) => getLevel(levelId)?.questions });
      commit(r.state);
      return { reviewId: r.start.reviewId, skillId, chapter, items: finalRoundItems(r.start.questionIds), resolved: r.start.resolved };
    },
    async answerChapterReview(reviewId, question, optionId) {
      const r = answerChapterReview(current(), { reviewId, question, optionId, now: new Date() });
      commit(r.state);
      return r.result;
    },
    async completeChapterReview(reviewId) {
      const run = current().chapterReviews?.[reviewId];
      // The bundle holds the published levels, numbered 1..n.
      const now = new Date();
      const r = completeChapterReview(current(), {
        reviewId,
        now,
        maxPublishedLevel: run ? levelCount(run.skillId) : 0,
        questionExists: (id) => finalRoundItems([id]).length > 0,
      });
      const state = commit(withTrophyBrainpower(r.state, now));
      return { ...r.result, daily: dailyOf(state, now) };
    },
    async submitReview(item, optionId) {
      const now = new Date();
      const r = submitReview(current(), { item, optionId, now });
      commit(withTrophyBrainpower(r.state, now));
      return r.result;
    },
    async entitlement() {
      const grant = user ? await load<DevUnlimitedGrant>(`${DEV_UNLIMITED_KEY}:${user.userId}`) : null;
      return devEntitlement(current().hasUnlimited, grant);
    },
    async syncEntitlement() {
      const state = current();
      const grant = await load<DevUnlimitedGrant>(`${DEV_UNLIMITED_KEY}:${user!.userId}`);
      if (state.hasUnlimited !== !!grant) commit({ ...state, hasUnlimited: !!grant });
      return devEntitlement(!!grant, grant);
    },
    async reset() {
      current();
      commit(emptyProgress(new Date(), deviceTimeZone()));
    },

    // ── Simulated accounts: the real flow, without credentials ──
    account: async () => user ?? SIGNED_OUT,
    signInMethods: async () => SIGN_IN_METHODS.filter((m) => OFFERED_METHODS.has(m)),
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
      await remove(`${SOCIAL_KEY}:${gone.userId}`);
      await save(REPORTS_KEY, []);
      return this.signOut();
    },
    // The harness sends nothing anywhere.
    async logEvents() {},
    async social() {
      return socialView(me(), social, current(), new Date());
    },
    async league() {
      const id = me();
      commit(payLastWeek(current(), new Date()));
      return leagueView(id, social, current(), new Date());
    },
    async feed() {
      return feedView(me(), social, current(), new Date());
    },
    async socialProfile(userId) {
      return profileView(me(), userId, social, current(), new Date());
    },
    async setUsername(name) {
      me();
      const username = checkUsername(name);
      commitSocial({ ...social, username });
      return username;
    },
    async setAvatar(avatar) {
      me();
      const next = checkAvatar(avatar, current());
      commitSocial({ ...social, avatar: next });
      return next;
    },
    async findUser(username) {
      me();
      return findSim(username, social, current(), new Date());
    },
    async sendFriendRequest(userId) {
      me();
      if (!userId.startsWith('sim-') || social.blocked.includes(userId)) throw new SocialError('USER_NOT_FOUND');
      // Simulated learners always say yes.
      commitSocial(befriend(social, userId));
      return 'friends';
    },
    async respondFriendRequest(fromId, accept) {
      me();
      commitSocial(accept ? befriend(social, fromId) : { ...social, incoming: social.incoming.filter((x) => x !== fromId) });
    },
    async removeFriend(userId) {
      me();
      commitSocial({ ...social, friends: social.friends.filter((x) => x !== userId), outgoing: social.outgoing.filter((x) => x !== userId) });
    },
    async acceptInvite(code) {
      me();
      const r = inviteSim(code, social, current(), new Date());
      commitSocial(r.social);
      return r.card;
    },
    async blockUser(userId) {
      me();
      commitSocial({ ...social, blocked: [...new Set([...social.blocked, userId])], friends: social.friends.filter((x) => x !== userId), incoming: social.incoming.filter((x) => x !== userId), outgoing: social.outgoing.filter((x) => x !== userId) });
    },
    async blockedUsers() {
      me();
      return blockedView(social);
    },
    async unblockUser(userId) {
      me();
      commitSocial({ ...social, blocked: social.blocked.filter((x) => x !== userId) });
    },
    async reportUser(userId) {
      // Mirrors SQL report_user: not yourself, and only someone who exists. The harness keeps no reports.
      if (userId === me() || !userId.startsWith('sim-')) throw new SocialError('USER_NOT_FOUND');
    },
    async react(ownerId, itemKey, reaction) {
      const id = me();
      if (ownerId === id || social.blocked.includes(ownerId)) throw new SocialError('USER_NOT_FOUND');
      // Mirrors SQL react: a heart only on a moment that's in the feed (the owner's last 14 days).
      if (reaction && !feedView(id, social, current(), new Date()).some((i) => i.owner.id === ownerId && i.key === itemKey)) throw new SocialError('MOMENT_NOT_FOUND');
      const reactions = { ...social.reactions };
      if (reaction) reactions[`${ownerId}|${itemKey}`] = reaction;
      else delete reactions[`${ownerId}|${itemKey}`];
      commitSocial({ ...social, reactions });
    },
    // The harness has no server to send pushes: the switch is kept, devices are ignored.
    async setSocialNotifications(on) {
      me();
      commitSocial({ ...social, socialNotifications: on });
      return on;
    },
    async registerPushToken() {},
    async unregisterPushToken() {},
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

function devEntitlement(active: boolean, grant: DevUnlimitedGrant | null | undefined): EntitlementView {
  return { active, expiresAt: null, willRenew: active ? true : null, store: active ? (grant?.store ?? 'SANDBOX') : null };
}

/**
 * +1 Brainpower for each trophy now held (quest trophies and milestones), each
 * quest requirement met and each quest completed, as the SQL triggers do.
 */
function withTrophyBrainpower(state: ProgressState, now: Date): ProgressState {
  const ids = [...(state.trophies ?? []).map((t) => t.trophyId), ...milestoneTrophies(state, trophyCatalog).map((t) => t.trophyId)];
  const withTrophies = trophyBrainpower(state, [...new Set(ids)], now);
  return questBrainpower(withTrophies, questDefs.filter((d) => d.startsOn && questWindow(d).startsAt <= now).map((d) => questView(withTrophies, d, now)), now);
}

/** Today's status after an action, with what the action earned. */
function dailyOf(state: ProgressState, now: Date): DailyAllowance {
  const { localDate: _ignored, ...daily } = dailyStatus(state, now);
  return daily;
}
