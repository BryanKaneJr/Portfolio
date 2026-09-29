import { describe, expect, it } from 'vitest';
import {
  answerChapterReview,
  ChapterReviewError,
  chapterReviewXp,
  clearedChapters,
  completeChapterReview,
  emptyProgress,
  questView,
  startChapterReview,
  submitReview,
  type ProgressState,
  type Question,
  type QuestDefinition,
} from '../src';

// Mirrors backend/tests/chapter-reviews.test.sql.
const SKILL = 'skill.science.chapters';
const question = (level: number, k: number): Question =>
  ({
    id: `question.chapters.${String(level).padStart(3, '0')}.q${k}`,
    purpose: 'recall',
    prompt: 'Q?',
    options: [
      { id: 'a', label: 'Option a', correct: true },
      { id: 'b', label: 'Option b', correct: false, rationale: 'Not b.' },
    ],
    explanation: 'Because.',
    conceptIds: [`concept.chapters.c${level}`],
    sourceCardIds: [],
  }) as unknown as Question;
const questionsFor = (levelId: string) => {
  const n = Number(levelId.split('.').at(-1));
  return n >= 1 && n <= 10 ? [question(n, 2), question(n, 1)] : undefined;
};
const byId = (id: string) => {
  const [, , level, k] = id.split('.');
  return question(Number(level), Number(k!.slice(1)));
};
const T0 = new Date('2026-10-05T09:00:00Z');
const at = (min: number) => new Date(T0.getTime() + min * 60_000);

function cleared(n: number): ProgressState {
  return { ...emptyProgress(new Date('2026-09-01T00:00:00Z'), 'UTC'), skills: { [SKILL]: { highestCleared: n, stars: 0, totalXp: 0 } } };
}
function start(s: ProgressState, reviewId: string, now = T0) {
  return startChapterReview(s, { skillId: SKILL, chapter: 1, reviewId, now, questionsFor });
}
function answerAll(s: ProgressState, reviewId: string, ids: string[], now = T0): ProgressState {
  for (const id of ids) s = answerChapterReview(s, { reviewId, question: byId(id), optionId: 'a', now }).state;
  return s;
}

describe('chapter reviews', () => {
  it('only for chapters you have cleared', () => {
    expect(clearedChapters(19)).toBe(1);
    expect(() => start(cleared(9), 'r1')).toThrow(ChapterReviewError);
    expect(() => startChapterReview(cleared(10), { skillId: SKILL, chapter: 2, reviewId: 'r1', now: T0, questionsFor })).toThrow('CHAPTER_NOT_CLEARED');
    expect(() => startChapterReview(cleared(10), { skillId: SKILL, chapter: 0, reviewId: 'r1', now: T0, questionsFor })).toThrow('CHAPTER_NOT_CLEARED');
  });

  it('asks one question per level, graded like a level, and pays at most 15 XP', () => {
    let { state: s, start: v } = start(cleared(10), 'r1');
    expect(v.questionIds).toHaveLength(10);
    expect(v.questionIds[0]).toBe('question.chapters.001.q1');
    expect(v.questionIds[9]).toBe('question.chapters.010.q1');
    expect(start(s, 'other').start.reviewId).toBe('r1');
    expect(() => completeChapterReview(s, { reviewId: 'r1', now: T0, maxPublishedLevel: 10 })).toThrow('REVIEW_UNRESOLVED');
    expect(() => answerChapterReview(s, { reviewId: 'r1', question: question(1, 2), optionId: 'a', now: T0 })).toThrow('QUESTION_NOT_IN_REVIEW');

    let r = answerChapterReview(s, { reviewId: 'r1', question: question(1, 1), optionId: 'b', now: T0 });
    expect(r.result).toMatchObject({ correct: false, resolved: false, rationale: 'Not b.' });
    expect(r.result.explanation).toBeUndefined();
    r = answerChapterReview(r.state, { reviewId: 'r1', question: question(1, 1), optionId: 'a', now: T0 });
    expect(r.result).toMatchObject({ resolved: true, firstAttemptCorrect: false, attemptCount: 2 });
    s = r.state;
    expect(s.checks?.['question.chapters.001.q1']).toBe(T0.toISOString());
    expect(start(s, 'other').start.resolved).toEqual(['question.chapters.001.q1']);
    s = answerAll(s, 'r1', v.questionIds);

    const done = completeChapterReview(s, { reviewId: 'r1', now: T0, maxPublishedLevel: 10 });
    expect(done.result).toMatchObject({ xpAwarded: 14, firstAttemptCorrect: 9, total: 10, questCredit: true, alreadyCompleted: false });
    expect(done.state.skills[SKILL]!.totalXp).toBe(14);
    expect(done.state.xpEvents.at(-1)).toMatchObject({ type: 'CHAPTER_REVIEW', amount: 14, levelId: 'level.science.chapters.010', questCredit: true });
    const again = completeChapterReview(done.state, { reviewId: 'r1', now: T0, maxPublishedLevel: 10 });
    expect(again.result).toMatchObject({ xpAwarded: 0, alreadyCompleted: true, questCredit: true });
    expect(() => answerChapterReview(done.state, { reviewId: 'r1', question: question(2, 1), optionId: 'a', now: T0 })).toThrow('QUESTION_NOT_IN_REVIEW');
    ({ start: v } = start(done.state, 'r2'));
    expect(v.questionIds[0]).toBe('question.chapters.001.q2');
  });

  it('scales XP by first tries, rounded, never above 15', () => {
    expect([0, 1, 5, 9, 10].map((n) => chapterReviewXp(n, 10))).toEqual([0, 2, 8, 14, 15]);
    expect(chapterReviewXp(3, 3)).toBe(15);
  });

  it('counts toward a quest only once nothing new is left, and each chapter once', () => {
    const quest: QuestDefinition = { id: 'quest.live', startsOn: '2026-10-05', requirements: [{ skillId: SKILL, newLevels: 2 }], xpReward: 50, trophy: { id: 'trophy.live', name: 'Live' } };
    const done = () => questView(s, quest, at(60)).requirements[0]!.done;
    let s = cleared(10);
    for (const [id, max] of [['r1', 10], ['r2', 10], ['r3', 11]] as const) {
      const started = start(s, id, at(1));
      s = answerAll(started.state, id, started.start.questionIds, at(1));
      const r = completeChapterReview(s, { reviewId: id, now: at(2), maxPublishedLevel: max });
      s = r.state;
      expect(r.result.xpAwarded).toBe(15);
      expect(r.result.questCredit).toBe(max === 10);
      expect(done()).toBe(1);
    }
  });

  it('leaves scheduled review alone, except that a checked answer pays no review XP', () => {
    let s = cleared(10);
    s = {
      ...s,
      levels: { 'level.science.chapters.001': { completedAt: T0.toISOString(), revision: 1, firstAttemptCorrect: 2, total: 2, idempotencyKey: 'k' } },
      concepts: { 'concept.chapters.c1': { strength: 1, seenCount: 1, correctCount: 1, incorrectCount: 0, lastSeenAt: T0.toISOString(), dueAt: at(5).toISOString(), priority: 0 } },
    };
    const started = start(s, 'r1', at(10));
    s = answerAll(started.state, 'r1', started.start.questionIds, at(10));
    expect(s.concepts['concept.chapters.c1']!.dueAt).toBe(at(5).toISOString());
    const item = { conceptId: 'concept.chapters.c1', question: question(1, 1), skillId: SKILL, levelId: 'level.science.chapters.001' };
    expect(submitReview(s, { item, optionId: 'a', now: at(11) }).result.xpAwarded).toBe(0);
  });
});
