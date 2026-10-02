import { describe, expect, it } from 'vitest';
import { LEARNING_STRUCTURE, dailyAllowance, knowledgeLevel, subjectAttribute, levelCompletionXp, localDate, nextDue, nextStrength, skillProgressView } from '../src';

describe('skill progression', () => {
  it('starts at level 0 with level 1 next', () => {
    expect(skillProgressView(0)).toEqual({ level: 0, stars: 0, band: 1, chapter: 1, bandProgress: 0, nextLevel: 1 });
  });

  it('puts level 63 in chapter 7 (61–70)', () => {
    const v = skillProgressView(62);
    expect(v.nextLevel).toBe(63);
    expect(v.chapter).toBe(7);
  });

  it('awards a star at 100 and opens band 2 without resetting the level', () => {
    const v = skillProgressView(100);
    expect(v).toMatchObject({ level: 100, stars: 1, band: 2, chapter: 1, nextLevel: 101, bandProgress: 0 });
    expect(skillProgressView(212)).toMatchObject({ level: 212, stars: 2, band: 3 });
  });

  it('keeps knowledge level monotonic and sublinear', () => {
    expect(knowledgeLevel(0)).toBe(1);
    let prev = 0;
    for (let n = 0; n <= 1000; n++) {
      const k = knowledgeLevel(n);
      expect(k).toBeGreaterThanOrEqual(prev);
      prev = k;
    }
    expect(knowledgeLevel(1000)).toBeLessThan(100);
  });
});

describe('subject attribute', () => {
  it('counts levels cleared, 1 to 100', () => {
    expect(subjectAttribute(0)).toEqual({ level: 0, stars: 0, share: 0 });
    expect(subjectAttribute(6)).toEqual({ level: 6, stars: 0, share: 0.06 });
    expect(subjectAttribute(99)).toEqual({ level: 99, stars: 0, share: 0.99 });
  });
  it('masters at 100 (★, a full bar), then starts again from 1', () => {
    expect(subjectAttribute(100)).toEqual({ level: 100, stars: 1, share: 1 });
    expect(subjectAttribute(101)).toEqual({ level: 1, stars: 1, share: 0.01 });
    expect(subjectAttribute(200)).toEqual({ level: 100, stars: 2, share: 1 });
    expect(subjectAttribute(250)).toEqual({ level: 50, stars: 2, share: 0.5 });
  });
});

describe('xp', () => {
  const regular = { number: 18, type: 'regular' as const };
  it('follows the first-attempt curve: 100 / 70 / 35 / 15', () => {
    expect([3, 2, 1, 0].map((n) => levelCompletionXp(regular, n, 3).total)).toEqual([100, 70, 35, 15]);
    expect(levelCompletionXp(regular, 3, 3).outcome).toBe('perfect');
  });

  it('gives each encounter type its own pool: checkpoint 150 / 105 / 60 / 25', () => {
    const cp = { number: 10, type: 'checkpoint' as const };
    expect([5, 4, 3, 2, 1, 0].map((n) => levelCompletionXp(cp, n, 5).total)).toEqual([150, 105, 60, 25, 25, 25]);
  });

  it('milestone (7 questions): 250 / 175 / 90 / 40', () => {
    const ms = { number: 50, type: 'milestone' as const };
    expect([7, 6, 5, 4, 3, 0].map((n) => levelCompletionXp(ms, n, 7).total)).toEqual([250, 175, 90, 90, 40, 40]);
  });

  it('Mastery Challenge (10 questions): 500 / 350 / 175 / 75, and no separate bonus', () => {
    const m = { number: 100, type: 'mastery' as const };
    expect([10, 9, 8, 7, 5, 4, 0].map((n) => levelCompletionXp(m, n, 10).total)).toEqual([500, 350, 350, 175, 175, 75, 75]);
    // The star needs no minimum first-attempt score.
    expect(levelCompletionXp(m, 0, 10)).toEqual({ total: 75, outcome: 'heavily_reinforced', earnsStar: true });
    expect(levelCompletionXp({ number: 99, type: 'regular' }, 3, 3).earnsStar).toBe(false);
  });

  it('reads the bands from LEARNING_STRUCTURE, never from hard-coded values', () => {
    for (const type of ['regular', 'checkpoint', 'milestone', 'mastery'] as const) {
      const top = LEARNING_STRUCTURE[type].firstAttemptXp[0]!;
      expect(levelCompletionXp({ number: 1, type }, 1, 1).total).toBe(top.xp);
    }
  });
});

describe('daily allowance', () => {
  it('ends the free day at 5/5 as a completion, not an error', () => {
    expect(dailyAllowance({ newLevelsUsedToday: 4, hasUnlimited: false, isFirstDay: false })).toMatchObject({ remaining: 1, dailyComplete: false });
    expect(dailyAllowance({ newLevelsUsedToday: 5, hasUnlimited: false, isFirstDay: false })).toMatchObject({ cap: 5, remaining: 0, dailyComplete: true });
  });

  it('gives the first-day bonus', () => {
    expect(dailyAllowance({ newLevelsUsedToday: 5, hasUnlimited: false, isFirstDay: true }).dailyComplete).toBe(false);
  });

  it('removes the cap for Unlimited', () => {
    expect(dailyAllowance({ newLevelsUsedToday: 40, hasUnlimited: true, isFirstDay: false })).toMatchObject({ cap: null, dailyComplete: false });
  });

  it('computes the local calendar day from a time zone, not UTC', () => {
    const at = new Date('2026-01-01T03:00:00Z');
    expect(localDate(at, 'UTC')).toBe('2026-01-01');
    expect(localDate(at, 'America/New_York')).toBe('2025-12-31');
  });
});

describe('review', () => {
  it('climbs on correct answers and resets on misses', () => {
    expect(nextStrength(0, true)).toBe(1);
    expect(nextStrength(5, true)).toBe(5);
    expect(nextStrength(4, false)).toBe(0);
  });

  it('schedules a missed concept soon and a strong one later', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(nextDue(now, 0).getTime() - now.getTime()).toBe(10 * 60_000);
    expect(nextDue(now, 1).toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });
});
