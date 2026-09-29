import { describe, expect, it } from 'vitest';
import { emptyProgress, milestoneTrophies, questsView, type ProgressState } from '../src';

// Mirrors backend/tests/trophies.test.sql.
const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 0, m)).toISOString();
function clear(s: ProgressState, skillId: string, n: number, minute: number): ProgressState {
  const levelId = `level.${skillId.slice('skill.'.length)}.${String(n).padStart(3, '0')}`;
  return { ...s, xpEvents: [...s.xpEvents, { type: 'LEVEL_COMPLETE', amount: 100, skillId, levelId, idempotencyKey: `level_complete:${levelId}`, at: at(minute) }] };
}
const ids = (s: ProgressState, subjects: number) => milestoneTrophies(s, subjects).map((t) => t.trophyId);

describe('milestone trophies', () => {
  it('are derived from progress, each with when it was reached', () => {
    let s = emptyProgress(new Date('2026-09-01T00:00:00Z'), 'UTC');
    expect(ids(s, 2)).toEqual([]);
    s = clear(s, 'skill.science.testing', 1, 1);
    expect(milestoneTrophies(s, 2)).toEqual([{ trophyId: 'trophy.first_level', earnedAt: at(1) }]);
    s = clear(s, 'skill.history.rome', 1, 2);
    expect(ids(s, 2)).toEqual(['trophy.first_level', 'trophy.polymath']);
    expect(milestoneTrophies(s, 2).find((t) => t.trophyId === 'trophy.polymath')?.earnedAt).toBe(at(2));
    for (let n = 2; n <= 10; n++) s = clear(s, 'skill.science.testing', n, 10 + n);
    expect(milestoneTrophies(s, 2).find((t) => t.trophyId === 'trophy.chapter_one')?.earnedAt).toBe(at(20));
    expect(ids(s, 2)).not.toContain('trophy.well_rounded');
  });

  it('counts first-try reviews and totals', () => {
    let s = emptyProgress(new Date('2026-09-01T00:00:00Z'), 'UTC');
    for (let i = 0; i < 100; i++)
      s = { ...s, xpEvents: [...s.xpEvents, { type: 'DELAYED_RECALL', amount: 10, skillId: 'skill.science.testing', levelId: 'level.science.testing.001', idempotencyKey: `r${i}`, at: at(i) }] };
    expect(ids(s, 1)).toEqual(['trophy.long_memory']);
  });

  it('join quest trophies on the shelf, newest first', () => {
    let s = clear(emptyProgress(new Date('2026-09-01T00:00:00Z'), 'UTC'), 'skill.science.testing', 1, 1);
    s = { ...s, trophies: [{ trophyId: 'trophy.roman_world', name: 'The Roman World', kind: 'quest', questId: 'quest.roman_world', earnedAt: at(30) }] };
    expect(questsView(s, [], new Date(at(40)), 1).trophies.map((t) => [t.trophyId, t.kind, t.name])).toEqual([
      ['trophy.roman_world', 'quest', 'The Roman World'],
      ['trophy.first_level', 'milestone', 'First Level'],
      ['trophy.polymath', 'milestone', 'Polymath'],
    ]);
  });
});
