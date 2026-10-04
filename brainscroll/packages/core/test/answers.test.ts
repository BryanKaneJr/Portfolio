import { describe, expect, it } from 'vitest';
import { encodeArrangement, gradeAnswer, optionLetter, quantityOf, shuffledLabels, shuffledOptions, type Question } from '../src';

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

describe('shuffledOptions', () => {
  const options = ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id.toUpperCase(), correct: id === 'b' }));
  const q = (id: string) => ({ id, options });

  it('is a stable reordering of the same options, per question id', () => {
    const shown = shuffledOptions(q('question.astronomy.001.q1'));
    expect(shuffledOptions(q('question.astronomy.001.q1'))).toEqual(shown);
    expect(shown.map((o) => o.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    // The same option objects: grading by id is untouched, and the question is not changed.
    expect(shown.every((o) => options.includes(o))).toBe(true);
    expect(options.map((o) => o.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('spreads a right answer that content always puts second across every position', () => {
    const at = [0, 0, 0, 0];
    for (let i = 0; i < 2000; i++) at[shuffledOptions(q(`question.x.${String(i).padStart(3, '0')}.q${(i % 3) + 1}`)).findIndex((o) => o.correct)]! += 1;
    for (const n of at) expect(n / 2000).toBeGreaterThan(0.2);
  });

  it('never needs the correct flags (learner bundles have none)', () => {
    const stripped = options.map(({ id, label }) => ({ id, label }));
    expect(shuffledOptions({ id: 'question.x.001.q1', options: stripped }).map((o) => o.id)).toEqual(shuffledOptions(q('question.x.001.q1')).map((o) => o.id));
  });

  it('letters follow the shown order', () => {
    expect([0, 1, 2, 3].map(optionLetter)).toEqual(['A', 'B', 'C', 'D']);
  });
});

describe('shuffledOptions with numbers', () => {
  const q = (labels: string[]) => ({ id: 'question.x.001.q1', options: labels.map((label, i) => ({ id: 'abcdef'[i]!, label })) });
  const shown = (labels: string[]) => shuffledOptions(q(labels)).map((o) => o.label);

  it('shows numbers and quantities smallest first, not shuffled', () => {
    expect(shown(['1,000', '125', '12', '5'])).toEqual(['5', '12', '125', '1,000']);
    expect(shown(['3.3 million years', '300,000 years', '10 years', '1 billion years'])).toEqual(['10 years', '300,000 years', '3.3 million years', '1 billion years']);
    expect(shown(['44 BCE', '82 BCE', '14 CE', '27 BCE'])).toEqual(['82 BCE', '44 BCE', '27 BCE', '14 CE']);
    expect(shown(['About 2 km', 'About 200 m', 'About 20 km', 'Over 50 m'])).toEqual(['Over 50 m', 'About 200 m', 'About 2 km', 'About 20 km']);
    expect(shown(['75%', '10%', 'About 40%', '25%'])).toEqual(['10%', '25%', 'About 40%', '75%']);
    expect(shown(['1999', '1948', '1983', '1964'])).toEqual(['1948', '1964', '1983', '1999']);
    expect(shown(['about 10 years', 'about 45 days', 'about 6 months', 'about 410 days'])).toEqual(['about 45 days', 'about 6 months', 'about 410 days', 'about 10 years']);
  });

  it('shuffles anything that is not all numbers, or mixes kinds of quantity', () => {
    expect(quantityOf('about half')).toBeNull();
    expect(quantityOf('one hour')).toBeNull();
    expect(quantityOf('About 270 to 300')).toBeNull();
    const mixed = ['10 km', '10 kg', '5 km', '1 kg'];
    expect([...shown(mixed)].sort()).toEqual([...mixed].sort());
    // Not sorted: the same order any id-seeded shuffle of these options gives.
    const words = ['about half', '10%', '25%', 'all of them'];
    expect(shown(words).sort()).toEqual([...words].sort());
    const many = Array.from({ length: 40 }, (_, i) => shuffledOptions({ id: `question.x.${i}.q1`, options: q(words).options }).map((o) => o.label).join('|'));
    expect(new Set(many).size).toBeGreaterThan(5);
  });

  it('reads a quantity: qualifiers, commas, scales and eras', () => {
    expect(quantityOf('About 200 m')).toEqual({ value: 200, unit: 'm' });
    expect(quantityOf('1,000')).toEqual({ value: 1000, unit: '' });
    expect(quantityOf('82 BCE')).toEqual({ value: -82, unit: '' });
    expect(quantityOf('7 million')).toEqual({ value: 7e6, unit: '' });
    expect(quantityOf('45%')).toEqual({ value: 45, unit: '%' });
  });
});
