import { describe, expect, it } from 'vitest';
import { chooseForMe, type ChoiceCandidate } from '../src';

const skill = (id: string, subjectId: string, level = 0, hasNext = true): ChoiceCandidate => ({ id, subjectId, level, hasNext });

describe('chooseForMe', () => {
  const skills = [
    skill('rome', 'history', 12),
    skill('egypt', 'history'),
    skill('astronomy', 'science', 30),
    skill('animals', 'science'),
    skill('music', 'arts'),
  ];

  it('picks any skill with a level left, each equally likely', () => {
    const picks = [0, 0.2, 0.4, 0.6, 0.8].map((r) => chooseForMe(skills, { random: () => r })!.skillId);
    expect(picks).toEqual(['rome', 'egypt', 'astronomy', 'animals', 'music']);
    expect(chooseForMe(skills, { random: () => 0 })).toEqual({ skillId: 'rome', kind: 'resume' });
    expect(chooseForMe(skills, { random: () => 0.2 })).toEqual({ skillId: 'egypt', kind: 'new' });
  });

  it('"Pick again" never shows the same skill twice in a row', () => {
    for (let r = 0; r < 1; r += 0.05) expect(chooseForMe(skills, { offered: ['egypt', 'rome'], random: () => r })!.skillId).not.toBe('rome');
  });

  it('skips finished skills, and repeats only when one skill is left', () => {
    const few = [skill('rome', 'history', 12), skill('egypt', 'history', 100, false)];
    expect(chooseForMe(few, { offered: ['rome'] })).toEqual({ skillId: 'rome', kind: 'resume' });
    expect(chooseForMe([skill('egypt', 'history', 100, false)])).toBeUndefined();
  });
});
