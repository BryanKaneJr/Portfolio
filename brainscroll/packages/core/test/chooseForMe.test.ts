import { describe, expect, it } from 'vitest';
import { chooseForMe, type ChoiceCandidate } from '../src';

const skill = (id: string, subjectId: string, level = 0, hasNext = true): ChoiceCandidate => ({ id, subjectId, level, hasNext });
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('chooseForMe', () => {
  const skills = [
    skill('rome', 'history', 12),
    skill('egypt', 'history'),
    skill('astronomy', 'science', 30),
    skill('animals', 'science'),
    skill('music', 'arts'),
  ];

  it('never offers the current skill, and changes subject', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const c = chooseForMe(skills, { currentSkillId: 'rome', random: () => r })!;
      expect(c.skillId).not.toBe('rome');
      expect(c.skillId).not.toBe('egypt');
    }
  });

  it('usually picks a new skill, sometimes one in progress', () => {
    expect(chooseForMe(skills, { currentSkillId: 'rome', random: seq(0.1, 0) })).toEqual({ skillId: 'animals', kind: 'new' });
    expect(chooseForMe(skills, { currentSkillId: 'rome', random: seq(0.9, 0) })).toEqual({ skillId: 'astronomy', kind: 'resume' });
  });

  it('"Pick again" moves on to a skill and subject not just offered', () => {
    const c = chooseForMe(skills, { currentSkillId: 'rome', offered: ['animals'], random: () => 0 })!;
    expect(['music']).toContain(c.skillId);
  });

  it('skips finished skills, and relaxes rules rather than coming back empty', () => {
    const few = [skill('rome', 'history', 12), skill('egypt', 'history', 100, false)];
    expect(chooseForMe(few, { currentSkillId: 'rome' })).toEqual({ skillId: 'rome', kind: 'resume' });
    expect(chooseForMe([skill('egypt', 'history', 100, false)])).toBeUndefined();
    const again = chooseForMe(skills.slice(0, 2), { currentSkillId: 'rome', offered: ['egypt'], random: () => 0 });
    expect(again?.skillId).toBe('egypt');
  });
});
