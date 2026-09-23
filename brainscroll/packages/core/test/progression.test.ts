import { describe, expect, it } from 'vitest';
import { XP, dailyAllowance, isDelayedRecall, knowledgeLevel, levelCompletionXp, localDate, nextDue, nextStrength, skillProgressView } from '../src';

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

describe('xp', () => {
  const regular = { number: 18, type: 'regular' as const };
  it('follows the first-attempt curve: 100 / 70 / 35 / 15', () => {
    expect([3, 2, 1, 0].map((n) => levelCompletionXp(regular, n, 3).total)).toEqual([100, 70, 35, 15]);
    expect(levelCompletionXp(regular, 3, 3).outcome).toBe('perfect');
  });

  it('adds mastery XP only on checkpoints', () => {
    expect(levelCompletionXp({ number: 99, type: 'regular' }, 3, 3).mastery).toBe(0);
    expect(levelCompletionXp({ number: 100, type: 'mastery' }, 10, 10)).toMatchObject({ levelComplete: 100, mastery: XP.MASTERY_CLEAR });
  });

  it('scales by share for other question counts (provisional for milestone types)', () => {
    expect(levelCompletionXp({ number: 10, type: 'checkpoint' }, 4, 5).levelComplete).toBe(70);
    expect(levelCompletionXp({ number: 100, type: 'mastery' }, 3, 10).levelComplete).toBe(15);
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

  it('only counts correct answers after a real gap as delayed recall', () => {
    const seen = new Date('2026-01-01T00:00:00Z');
    expect(isDelayedRecall(seen, new Date('2026-01-01T01:00:00Z'), true)).toBe(false);
    expect(isDelayedRecall(seen, new Date('2026-01-02T00:00:00Z'), true)).toBe(true);
    expect(isDelayedRecall(seen, new Date('2026-01-02T00:00:00Z'), false)).toBe(false);
  });
});
