import { describe, expect, it } from 'vitest';
import { emptyProgress, milestoneTrophies, questsView, trophyInfo, type ProgressState, type TrophyCatalog } from '../src';

// Mirrors backend/tests/trophies.test.sql.
const CATALOG: TrophyCatalog = {
  skills: [
    { id: 'skill.science.testing', subjectId: 'subject.science', name: 'Testing' },
    { id: 'skill.history.rome', subjectId: 'subject.history', name: 'Rome' },
  ],
  subjects: [
    { id: 'subject.science', name: 'Science' },
    { id: 'subject.history', name: 'History' },
  ],
};
const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 0, 0, m)).toISOString();
function clear(s: ProgressState, skillId: string, n: number, second: number, perfect = false): ProgressState {
  const levelId = `level.${skillId.slice('skill.'.length)}.${String(n).padStart(3, '0')}`;
  return {
    ...s,
    levels: { ...s.levels, [levelId]: { completedAt: at(second), revision: 1, firstAttemptCorrect: perfect ? 3 : 2, total: 3, idempotencyKey: levelId } },
    xpEvents: [...s.xpEvents, { type: 'LEVEL_COMPLETE', amount: 100, skillId, levelId, idempotencyKey: `level_complete:${levelId}`, at: at(second) }],
  };
}
const fresh = () => emptyProgress(new Date('2026-09-01T00:00:00Z'), 'UTC');
const ids = (s: ProgressState) => milestoneTrophies(s, CATALOG).map((t) => t.trophyId);
const when = (s: ProgressState, id: string) => milestoneTrophies(s, CATALOG).find((t) => t.trophyId === id)?.earnedAt;

describe('milestone trophies', () => {
  it('are derived from progress, each with when it was reached', () => {
    let s = fresh();
    expect(ids(s)).toEqual([]);
    s = clear(s, 'skill.science.testing', 1, 1);
    expect(milestoneTrophies(s, CATALOG)).toEqual([{ trophyId: 'trophy.first_level', earnedAt: at(1) }]);
    s = clear(s, 'skill.history.rome', 1, 2);
    expect(ids(s)).toEqual(['trophy.first_level', 'trophy.explorer', 'trophy.polymath']);
    for (let n = 2; n <= 10; n++) s = clear(s, 'skill.science.testing', n, 10 + n);
    expect(when(s, 'trophy.chapter_one')).toBe(at(20));
    expect(ids(s)).not.toContain('trophy.warming_up');
  });

  it('counts perfect lessons (every question right on the first clear)', () => {
    let s = fresh();
    for (let n = 1; n <= 9; n++) s = clear(s, 'skill.science.testing', n, n, true);
    s = clear(s, 'skill.science.testing', 10, 10, false);
    expect(ids(s)).not.toContain('trophy.sharp');
    s = clear(s, 'skill.science.testing', 11, 11, true);
    expect(when(s, 'trophy.sharp')).toBe(at(11));
  });

  it('awards a mastery per skill, and a subject once all its skills are mastered', () => {
    let s = clear(fresh(), 'skill.science.testing', 100, 5);
    expect(ids(s)).toEqual(expect.arrayContaining(['trophy.mastered', 'trophy.mastery_testing', 'trophy.subject_science']));
    expect(ids(s)).not.toContain('trophy.subject_history');
    expect(trophyInfo('trophy.mastery_testing', CATALOG)).toMatchObject({ name: 'Mastered: Testing', kind: 'mastery' });
    expect(trophyInfo('trophy.subject_science', CATALOG)).toMatchObject({ name: 'Master of Science', kind: 'subject' });
    s = clear(s, 'skill.history.rome', 100, 9);
    expect(when(s, 'trophy.subject_history')).toBe(at(9));
  });

  it('counts first-try reviews and quests finished in their week', () => {
    let s = fresh();
    for (let i = 0; i < 100; i++)
      s = { ...s, xpEvents: [...s.xpEvents, { type: 'DELAYED_RECALL', amount: 10, skillId: 'skill.science.testing', levelId: 'level.science.testing.001', idempotencyKey: `r${i}`, at: at(i) }] };
    s = { ...s, trophies: [1, 2, 3].map((n) => ({ trophyId: `trophy.q${n}`, name: `Q${n}`, kind: 'quest' as const, questId: `quest.q${n}`, earnedAt: at(200 + n) })) };
    expect(ids(s)).toEqual(['trophy.long_memory', 'trophy.quest_regular']);
    expect(when(s, 'trophy.quest_regular')).toBe(at(203));
  });

  it('join quest trophies on the shelf, newest first', () => {
    let s = clear(fresh(), 'skill.science.testing', 1, 1);
    s = { ...s, trophies: [{ trophyId: 'trophy.roman_world', name: 'The Roman World', kind: 'quest', questId: 'quest.roman_world', earnedAt: at(30) }] };
    expect(questsView(s, [], new Date(at(40)), CATALOG).trophies.map((t) => [t.trophyId, t.kind, t.name])).toEqual([
      ['trophy.roman_world', 'quest', 'The Roman World'],
      ['trophy.first_level', 'milestone', 'First Level'],
    ]);
  });
});
