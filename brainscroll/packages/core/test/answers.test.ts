import { describe, expect, it } from 'vitest';
import { encodeArrangement, gradeAnswer, shuffledLabels, type Question } from '../src';

const base = {
  id: 'question.astronomy.001.q2',
  purpose: 'recall' as const,
  conceptIds: ['concept.astronomy.c1'],
  sourceCardIds: ['card.astronomy.001.c2'],
  prompt: 'P',
  explanation: 'E',
  difficulty: 0.2,
};
const order: Question = { ...base, kind: 'order', items: ['Mercury', 'Venus', 'Earth', 'Mars'], first: 'Closest to the Sun', last: 'Farthest' };
const match: Question = {
  ...base,
  kind: 'match',
  pairs: [
    { left: 'Paris', right: 'France' },
    { left: 'Rome', right: 'Italy' },
    { left: 'Lyon', right: 'France' },
  ],
};

describe('gradeAnswer', () => {
  it('grades multiple choice by option, with its rationale when wrong', () => {
    const mcq: Question = {
      ...base,
      kind: 'mcq',
      options: [
        { id: 'a', label: 'The first', correct: false, rationale: "That's Mercury." },
        { id: 'b', label: 'The third', correct: true },
      ],
    };
    expect(gradeAnswer(mcq, 'b')).toEqual({ correct: true });
    expect(gradeAnswer(mcq, 'a')).toEqual({ correct: false, rationale: "That's Mercury." });
    expect(gradeAnswer(mcq, 'z')).toEqual({ correct: false });
  });

  it('grades an order by label, naming the wrong positions only', () => {
    expect(gradeAnswer(order, encodeArrangement(['Mercury', 'Venus', 'Earth', 'Mars']))).toEqual({ correct: true });
    expect(gradeAnswer(order, encodeArrangement(['Venus', 'Mercury', 'Earth', 'Mars']))).toEqual({ correct: false, wrong: [0, 1] });
  });

  it('treats identical items as interchangeable (two Mars, either way round)', () => {
    const twoMars: Question = { ...base, kind: 'order', items: ['Mercury', 'Mars', 'Mars', 'Jupiter'], first: 'First', last: 'Last' };
    // The UI sends labels, so whichever Mars tile went first, the answer is the same.
    expect(gradeAnswer(twoMars, encodeArrangement(['Mercury', 'Mars', 'Mars', 'Jupiter']))).toEqual({ correct: true });
  });

  it('grades a match by label: shared partners are interchangeable', () => {
    expect(gradeAnswer(match, encodeArrangement(['France', 'Italy', 'France']))).toEqual({ correct: true });
    expect(gradeAnswer(match, encodeArrangement(['Italy', 'France', 'France']))).toEqual({ correct: false, wrong: [0, 1] });
  });

  it('refuses anything that is not a rearrangement of the question’s own labels', () => {
    expect(gradeAnswer(order, encodeArrangement(['Mercury', 'Venus', 'Earth']))).toEqual({ correct: false, wrong: [0, 1, 2, 3] });
    expect(gradeAnswer(order, encodeArrangement(['Mercury', 'Venus', 'Earth', 'Pluto'])).correct).toBe(false);
    expect(gradeAnswer(order, encodeArrangement(['Mercury', 'Mercury', 'Earth', 'Mars'])).correct).toBe(false);
    expect(gradeAnswer(order, 'not json').correct).toBe(false);
    expect(gradeAnswer(order, 'b').correct).toBe(false);
  });
});

describe('shuffledLabels', () => {
  it('is stable per question, keeps every label, and is never already solved', () => {
    const a = shuffledLabels('question.x.001.q1', order.kind === 'order' ? order.items : []);
    expect(shuffledLabels('question.x.001.q1', order.kind === 'order' ? order.items : [])).toEqual(a);
    expect([...a].sort()).toEqual(['Earth', 'Mars', 'Mercury', 'Venus']);
    for (let i = 0; i < 200; i++) {
      const items = ['A', 'B', 'C'];
      expect(shuffledLabels(`question.x.${i}.q1`, items)).not.toEqual(items);
    }
  });
});
