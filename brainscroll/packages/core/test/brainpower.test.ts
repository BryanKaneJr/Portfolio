import { describe, expect, it } from 'vitest';
import {
  BRAINPOWER,
  brainpowerBalance,
  brainpowerEarnedAt,
  dailyStatus,
  emptyProgress,
  grantBrainpower,
  perfectDropBrainpower,
  spendBrainpower,
  streakBrainpower,
  trophyBrainpower,
  type ProgressState,
} from '../src';

// Mirrors backend/tests/brainpower.test.sql.
const NOW = new Date('2026-10-02T15:00:00Z');
const TOMORROW = new Date('2026-10-03T15:00:00Z');
const fresh = (): ProgressState => emptyProgress(new Date('2026-09-01T00:00:00Z'), 'UTC');
const at = (balance: number, asOf = '2026-10-02'): ProgressState => ({ ...fresh(), brainpower: { balance, asOf } });

describe('Brainpower', () => {
  it('starts a new learner at a day\'s refill, out of 10', () => {
    expect(brainpowerBalance(fresh(), NOW)).toBe(5);
    expect(dailyStatus(fresh(), NOW)).toMatchObject({ brainpower: 5, brainpowerMax: 10, brainpowerRefill: 5, dailyComplete: false });
  });

  it('refills to 5 each day, and keeps more', () => {
    expect(brainpowerBalance(at(2), TOMORROW)).toBe(5);
    expect(brainpowerBalance(at(8), TOMORROW)).toBe(8);
    expect(brainpowerBalance(at(2), NOW)).toBe(2);
  });

  it('spends 1 per new level, never below 0, and never on Unlimited', () => {
    expect(brainpowerBalance(spendBrainpower(at(3), NOW), NOW)).toBe(2);
    expect(brainpowerBalance(spendBrainpower(at(0), NOW), NOW)).toBe(0);
    expect(dailyStatus(at(0), NOW).dailyComplete).toBe(true);
    const unlimited = { ...at(3), hasUnlimited: true };
    expect(spendBrainpower(unlimited, NOW)).toBe(unlimited);
    expect(dailyStatus(unlimited, NOW)).toMatchObject({ brainpower: null, cap: null, dailyComplete: false });
  });

  it('pays each award once, up to 10: at 10 it is lost', () => {
    let s = grantBrainpower(at(4), 'trophy:t1', 'trophy', NOW);
    expect(brainpowerBalance(s, NOW)).toBe(5);
    expect(brainpowerBalance(grantBrainpower(s, 'trophy:t1', 'trophy', NOW), NOW)).toBe(5);
    s = grantBrainpower(at(BRAINPOWER.MAX), 'trophy:t2', 'trophy', NOW);
    expect(brainpowerBalance(s, NOW)).toBe(10);
    expect(s.brainpowerAwards?.['trophy:t2']?.granted).toBe(0);
    expect(brainpowerBalance(grantBrainpower({ ...s, brainpower: { balance: 4, asOf: '2026-10-02' } }, 'trophy:t2', 'trophy', NOW), NOW)).toBe(4);
  });

  it('notes awards at 0 on Unlimited, so a lapsed plan pays no backlog', () => {
    const s = grantBrainpower({ ...at(4), hasUnlimited: true }, 'trophy:t1', 'trophy', NOW);
    expect(s.brainpowerAwards?.['trophy:t1']?.granted).toBe(0);
    expect(s.brainpower).toEqual({ balance: 4, asOf: '2026-10-02' });
  });

  it('lists what one action earned (awards at that moment)', () => {
    const s = trophyBrainpower(at(4), ['trophy.b', 'trophy.a'], NOW);
    expect(brainpowerEarnedAt(s, NOW)).toEqual([
      { kind: 'trophy', key: 'trophy:trophy.a', granted: 1 },
      { kind: 'trophy', key: 'trophy:trophy.b', granted: 1 },
    ]);
    expect(brainpowerEarnedAt(s, TOMORROW)).toEqual([]);
  });

  it('pays the streak only when it grows past one day, once a day', () => {
    expect(streakBrainpower({ ...at(4), learningDays: { '2026-10-02': NOW.toISOString() } }, NOW).brainpowerAwards).toBeUndefined();
    const s = streakBrainpower({ ...at(4), learningDays: { '2026-10-01': '2026-10-01T12:00:00Z', '2026-10-02': NOW.toISOString() } }, NOW);
    expect(s.brainpowerAwards?.['streak:2026-10-02']).toMatchObject({ kind: 'streak', granted: 1 });
    expect(brainpowerBalance(streakBrainpower(s, NOW), NOW)).toBe(5);
  });

  it('drops +1 on a perfect level 10% of the time: a plain roll, no pity', () => {
    expect(brainpowerBalance(perfectDropBrainpower(at(4), 'level.x.001', NOW, () => 0.05), NOW)).toBe(5);
    expect(brainpowerBalance(perfectDropBrainpower(at(4), 'level.x.001', NOW, () => 0.1), NOW)).toBe(4);
    expect(brainpowerBalance(perfectDropBrainpower(at(4), 'level.x.001', NOW, () => 0.99), NOW)).toBe(4);
  });
});
