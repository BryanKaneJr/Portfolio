import { describe, expect, it } from 'vitest';
import { emptyProgress, milestoneTrophies, MILESTONE_TROPHIES, questsView, trophyInfo, trophyShareText, streakShareText, type ProgressState, type TrophyCatalog } from '../src';

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
    expect(ids(s)).not.toContain('trophy.perfect_10');
    s = clear(s, 'skill.science.testing', 11, 11, true);
    expect(when(s, 'trophy.perfect_10')).toBe(at(11));
    expect(trophyInfo('trophy.perfect_10', CATALOG)).toMatchObject({ name: '10 Perfect Lessons', art: 'perfect-lessons', count: 10 });
    expect(trophyInfo('trophy.perfect_1000', CATALOG)).toMatchObject({ name: '1,000 Perfect Lessons', count: 1000 });
  });

  it('awards a mastery per skill, and a subject once all its skills are mastered', () => {
    let s = clear(fresh(), 'skill.science.testing', 100, 5);
    expect(ids(s)).toEqual(expect.arrayContaining(['trophy.mastered', 'trophy.mastery_testing', 'trophy.subject_science']));
    expect(ids(s)).not.toContain('trophy.subject_history');
    expect(trophyInfo('trophy.mastery_testing', CATALOG)).toMatchObject({ name: 'Mastered: Testing', kind: 'mastery' });
    expect(trophyInfo('trophy.subject_science', CATALOG)).toMatchObject({ name: 'Master of Science', kind: 'subject' });
    expect(ids(s)).not.toContain('trophy.master_of_all');
    s = clear(s, 'skill.history.rome', 100, 9);
    expect(when(s, 'trophy.subject_history')).toBe(at(9));
    expect(when(s, 'trophy.master_of_all')).toBe(at(9));
  });

  it('awards Jack of All Trades for Level 50 in every skill', () => {
    let s = clear(fresh(), 'skill.science.testing', 50, 3);
    expect(ids(s)).not.toContain('trophy.jack_of_all_trades');
    s = clear(s, 'skill.history.rome', 50, 4);
    expect(when(s, 'trophy.jack_of_all_trades')).toBe(at(4));
  });

  it('counts first-try reviews and quests finished in their week', () => {
    let s = fresh();
    for (let i = 0; i < 100; i++)
      s = { ...s, xpEvents: [...s.xpEvents, { type: 'DELAYED_RECALL', amount: 10, skillId: 'skill.science.testing', levelId: 'level.science.testing.001', idempotencyKey: `r${i}`, at: at(i) }] };
    s = { ...s, trophies: [1, 2, 3].map((n) => ({ trophyId: `trophy.q${n}`, name: `Q${n}`, kind: 'quest' as const, questId: `quest.q${n}`, earnedAt: at(200 + n) })) };
    expect(ids(s)).toEqual(['trophy.long_memory', 'trophy.quest_regular']);
    expect(when(s, 'trophy.quest_regular')).toBe(at(203));
  });

  it('awards streak trophies for the longest run ever, dated by the day it was reached', () => {
    // Mirrors trophies.test.sql: a 6-day run, a gap, then 7 days in a row.
    const day = (d: number, h = 12) => new Date(Date.UTC(2026, 9, d, h)).toISOString();
    let s = fresh();
    const days = [1, 2, 3, 4, 5, 6, 20, 21, 22, 23, 24, 25];
    days.forEach((d, i) => {
      const levelId = `level.science.testing.${String(i + 1).padStart(3, '0')}`;
      s = { ...s, levels: { ...s.levels, [levelId]: { completedAt: day(d), revision: 1, firstAttemptCorrect: 0, total: 3, idempotencyKey: levelId } } };
    });
    expect(ids(s)).not.toContain('trophy.streak_7');
    // A scheduled review makes the seventh day (older saves' `true` review days still count as days).
    s = { ...s, reviewDays: { '2026-10-26': day(26, 8), '2026-10-10': true } };
    expect(when(s, 'trophy.streak_7')).toBe(day(26, 8));
    expect(ids(s)).not.toContain('trophy.streak_30');
    expect(trophyInfo('trophy.streak_365', CATALOG)).toMatchObject({ name: 'One Year', art: 'streak', count: 365 });
    expect(trophyInfo('trophy.streak_1000', CATALOG)).toMatchObject({ art: 'streak-gold', count: 1000 });
  });

  it('has a share line for every trophy', () => {
    const line = (trophyId: string, kind = 'milestone', name = '') => trophyShareText({ trophyId, name, kind }, CATALOG);
    expect(line('trophy.streak_100')).toBe('I hit a 100-day learning streak on BrainScroll!');
    expect(streakShareText(1234)).toBe("I'm on a 1,234-day learning streak on BrainScroll!");
    expect(line('trophy.subject_history', 'subject')).toBe('I mastered History on BrainScroll!');
    expect(line('trophy.mastery_testing', 'mastery')).toBe('I mastered Testing on BrainScroll!');
    expect(line('trophy.perfect_1000')).toBe("I've had 1,000 perfect lessons on BrainScroll!");
    expect(line('trophy.roman_world', 'quest', 'The Roman World')).toBe('I finished a Weekly Quest in its week on BrainScroll! The Roman World');
    for (const t of MILESTONE_TROPHIES) expect(line(t.id)).not.toMatch(/trophy on BrainScroll/);
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
