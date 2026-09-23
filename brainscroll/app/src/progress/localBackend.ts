import {
  buildReviewQueue,
  checkStart,
  completeLevel,
  dailyStatus,
  emptyProgress,
  knowledgeLevel,
  localDate,
  submitReview,
  totalCleared,
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
      if (saved?.version === 1) state = saved;
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
    async completeLevel({ level, answers, idempotencyKey }) {
      const r = completeLevel(state, { level, answers, idempotencyKey, now: new Date() });
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
  };
}
