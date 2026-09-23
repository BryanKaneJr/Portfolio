import { describe, expect, it } from 'vitest';
import { XP, answerQuestion, buildReviewQueue, completeLevel, emptyProgress, levelTypeFor, submitReview, type Level, type ProgressState } from '../src';

// Mirrors backend/tests/review.test.sql.

function lvl(n: number, extraQuestionConcept?: string): Level {
  const num = String(n).padStart(3, '0');
  const concept = `concept.testing.c${n}`;
  const q = (i: number, concepts: string[]) => ({
    id: `question.testing.${num}.q${i}`,
    kind: 'mcq' as const,
    purpose: 'recall' as const,
    conceptIds: concepts,
    sourceCardIds: [`card.testing.${num}.c1`],
    prompt: 'Q?',
    options: [
      { id: 'a', label: 'A', correct: true },
      { id: 'b', label: 'B', correct: false },
    ],
    explanation: 'Because.',
    difficulty: 0.1,
  });
  return {
    id: `level.science.testing.${num}`,
    skillId: 'skill.science.testing',
    number: n,
    type: levelTypeFor(n),
    revision: 1,
    status: 'published',
    title: `Level ${n}`,
    objective: 'x',
    summary: 'x',
    concepts: [{ conceptId: concept, role: 'teach', weight: 1 }, ...(extraQuestionConcept ? [{ conceptId: extraQuestionConcept, role: 'recall' as const, weight: 1 }] : [])],
    prerequisites: [],
    cards: [],
    questions: [q(1, [concept]), ...(extraQuestionConcept ? [q(2, [extraQuestionConcept])] : [])],
    sourceIds: ['source.test'],
  };
}

const T0 = new Date('2026-09-20T12:00:00Z');
const at = (h: number) => new Date(T0.getTime() + h * 3_600_000);
const levels = [lvl(1), lvl(2, 'concept.testing.c1')];

function played(): ProgressState {
  let s = emptyProgress(new Date('2026-08-01T00:00:00Z'), 'UTC');
  // Level 1 answered wrong first, then corrected → c1 due in 10 minutes.
  s = answerQuestion(s, { level: levels[0]!, questionId: 'question.testing.001.q1', optionId: 'b' }).state;
  s = answerQuestion(s, { level: levels[0]!, questionId: 'question.testing.001.q1', optionId: 'a' }).state;
  s = completeLevel(s, { level: levels[0]!, idempotencyKey: 'k1', now: T0 }).state;
  return s;
}

describe('review', () => {
  it('queues nothing before anything is due', () => {
    expect(buildReviewQueue(played(), levels, T0)).toEqual([]);
  });

  it('queues a missed concept soon after', () => {
    const q = buildReviewQueue(played(), levels, at(1));
    expect(q.map((i) => [i.conceptId, i.question.id])).toEqual([['concept.testing.c1', 'question.testing.001.q1']]);
  });

  it('only draws questions from completed levels', () => {
    // Level 2 also tests c1 but is not completed.
    const q = buildReviewQueue(played(), levels, at(1));
    expect(q.every((i) => i.levelId === 'level.science.testing.001')).toBe(true);
  });

  it('rotates between questions for the same concept', () => {
    let s = played();
    for (const [q, opt] of [['question.testing.002.q1', 'a'], ['question.testing.002.q2', 'b'], ['question.testing.002.q2', 'a']] as const)
      s = answerQuestion(s, { level: levels[1]!, questionId: q, optionId: opt }).state;
    s = completeLevel(s, { level: levels[1]!, idempotencyKey: 'k2', now: T0 }).state;
    const first = buildReviewQueue(s, levels, at(1)).find((i) => i.conceptId === 'concept.testing.c1')!;
    s = submitReview(s, { item: first, optionId: 'b', now: at(1) }).state;
    const second = buildReviewQueue(s, levels, at(2)).find((i) => i.conceptId === 'concept.testing.c1')!;
    expect(second.question.id).not.toBe(first.question.id);
  });

  it('awards no XP for a quick re-answer, but reschedules', () => {
    const s = played();
    const [item] = buildReviewQueue(s, levels, at(1));
    const r = submitReview(s, { item: item!, optionId: 'a', now: at(1) });
    expect(r.result).toEqual({ correct: true, correctOptionId: 'a', explanation: 'Because.', xpAwarded: 0, refreshed: ['concept.testing.c1'] });
    expect(r.state.concepts['concept.testing.c1']!.strength).toBe(1);
    expect(r.state.concepts['concept.testing.c1']!.dueAt).toBe(at(25).toISOString());
  });

  it('awards DELAYED_RECALL for a correct answer after a real gap, once', () => {
    const s = played();
    const [item] = buildReviewQueue(s, levels, at(30));
    const r1 = submitReview(s, { item: item!, optionId: 'a', now: at(30) });
    expect(r1.result.xpAwarded).toBe(XP.DELAYED_RECALL);
    expect(r1.state.skills['skill.science.testing']!.totalXp).toBe(15 + XP.DELAYED_RECALL); // 0/1 first attempt → 15
    // Double submit: nothing is due any more, so nothing changes.
    const r2 = submitReview(r1.state, { item: item!, optionId: 'a', now: at(30) });
    expect(r2.state).toBe(r1.state);
    expect(r2.result.xpAwarded).toBe(0);
  });

  it('never touches skill level or the daily allowance', () => {
    const s = played();
    const [item] = buildReviewQueue(s, levels, at(30));
    const r = submitReview(s, { item: item!, optionId: 'b', now: at(30) });
    expect(r.state.skills['skill.science.testing']!.highestCleared).toBe(1);
    expect(r.state.daily).toEqual(s.daily);
    expect(r.state.concepts['concept.testing.c1']!.strength).toBe(0);
  });
});
