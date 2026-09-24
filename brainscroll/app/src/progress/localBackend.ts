import {
  AccountError,
  answerQuestion,
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
import { load, save } from './storage';

const PROGRESS_KEY = 'brainscroll.progress.v1';

/** Offline play: bundled content + the shared rules from @brainscroll/core, persisted on-device. */
export function createLocalBackend(): ProgressBackend {
  let state: ProgressState = emptyProgress(new Date(), deviceTimeZone());

  const commit = (next: ProgressState) => {
    if (next === state) return;
    state = next;
    void save(PROGRESS_KEY, next);
  };

  return {
    kind: 'local',
    async init() {
      const saved = await load<ProgressState>(PROGRESS_KEY);
      // Older saves predate attempt tracking.
      if (saved?.version === 1) state = { ...saved, questionAttempts: saved.questionAttempts ?? {} };
    },
    async snapshot(): Promise<ProgressSnapshot> {
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
      return { reason: checkStart(state, level, new Date()), level, revision: level.revision };
    },
    async answerQuestion(level, questionId, optionId) {
      const r = answerQuestion(state, { level, questionId, optionId });
      commit(r.state);
      return r.result;
    },
    async completeLevel({ level, idempotencyKey }) {
      const r = completeLevel(state, { level, idempotencyKey, now: new Date() });
      commit(r.state);
      return r.summary;
    },
    async reviewQueue(limit) {
      return buildReviewQueue(state, allLevels, new Date(), limit);
    },
    async submitReview(item, optionId) {
      const r = submitReview(state, { item, optionId, now: new Date() });
      commit(r.state);
      return r.result;
    },
    async reset() {
      commit(emptyProgress(new Date(), deviceTimeZone()));
    },
    // Offline play has no server account: progress is saved on this device only.
    account: async () => ({ status: 'device_only' }),
    startEmailLink: unavailable,
    confirmEmailLink: unavailable,
    startSignIn: unavailable,
    confirmSignIn: unavailable,
    signOut: unavailable,
    // Offline builds send nothing anywhere.
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

async function unavailable(): Promise<never> {
  throw new AccountError('ACCOUNTS_UNAVAILABLE');
}
