import { describe, expect, it } from 'vitest';
import { blankCount, blankParts, isFillBlank, type Question } from '../src';

describe('fill in the blank', () => {
  it('splits a prompt around its one gap', () => {
    expect(blankParts('The third planet from the Sun is _____.')).toEqual({ before: 'The third planet from the Sun is ', after: '.' });
    expect(blankParts('___ crossed the Rubicon')).toEqual({ before: '', after: ' crossed the Rubicon' });
  });

  it('is not a fill-in-the-blank without exactly one gap', () => {
    expect(blankParts('Which planet is third from the Sun?')).toBeNull();
    expect(blankParts('A __ short line is not a gap')).toBeNull();
    expect(blankParts('Two ____ gaps ____ here')).toBeNull();
    expect(blankCount('Two ____ gaps ____ here')).toBe(2);
  });

  it('applies to multiple choice only', () => {
    const base = { id: 'question.astronomy.001.q1', purpose: 'recall' as const, conceptIds: ['concept.astronomy.c1'], sourceCardIds: ['card.astronomy.001.c1'], explanation: 'E', difficulty: 0.2 };
    const mcq: Question = { ...base, kind: 'mcq', prompt: 'The third planet is _____.', options: [{ id: 'a', label: 'Earth', correct: true }, { id: 'b', label: 'Mars', correct: false }] };
    expect(isFillBlank(mcq)).toBe(true);
    expect(isFillBlank({ ...mcq, prompt: 'Which planet is third?' })).toBe(false);
  });
});
