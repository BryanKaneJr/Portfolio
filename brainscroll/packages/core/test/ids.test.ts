import { describe, expect, it } from 'vitest';
import { isId, levelId, levelScope, parseLevelId, revisionId } from '../src';

describe('stable ids', () => {
  it('accepts the documented examples', () => {
    expect(isId('subject', 'subject.science')).toBe(true);
    expect(isId('skill', 'skill.science.astronomy')).toBe(true);
    expect(isId('level', 'level.science.astronomy.001')).toBe(true);
    expect(isId('level', 'level.history.rome.143')).toBe(true);
    expect(isId('level', 'level.history.rome.1001')).toBe(true);
    expect(isId('revision', 'level.science.astronomy.001@r3')).toBe(true);
    expect(isId('concept', 'concept.astronomy.gravity')).toBe(true);
    expect(isId('question', 'question.rome.001.q2')).toBe(true);
    expect(isId('card', 'card.astronomy.001.c1')).toBe(true);
    expect(isId('source', 'source.nasa_sun_facts')).toBe(true);
  });

  it('rejects display names, bad casing and unpadded numbers', () => {
    expect(isId('subject', 'Science')).toBe(false);
    expect(isId('skill', 'skill.science.Astronomy')).toBe(false);
    expect(isId('level', 'level.science.astronomy.1')).toBe(false);
    expect(isId('revision', 'level.science.astronomy.001@r0')).toBe(false);
    expect(isId('concept', 'concept.astronomy.light-year')).toBe(false);
    expect(isId('question', 'question.rome.001.q0')).toBe(false);
  });

  it('builds and parses level ids', () => {
    const id = levelId('skill.science.astronomy', 7);
    expect(id).toBe('level.science.astronomy.007');
    expect(parseLevelId(id)).toEqual({ subject: 'science', skill: 'astronomy', skillId: 'skill.science.astronomy', number: 7 });
    expect(levelScope(id)).toBe('astronomy.007');
    expect(revisionId(id, 3)).toBe('level.science.astronomy.007@r3');
    expect(() => levelId('astronomy', 1)).toThrow();
  });
});
