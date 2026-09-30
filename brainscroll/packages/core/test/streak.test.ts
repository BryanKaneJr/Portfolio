import { describe, expect, it } from 'vitest';
import { streakFrom, emptyProgress, learningStreak, noteLearningDay, withLearningDays, type ProgressState } from '../src';

describe('streakFrom', () => {
  it('is empty without learning days', () => {
    expect(streakFrom([], '2026-09-26')).toEqual({ current: 0, longest: 0, today: false });
  });
  it('counts the run ending today, one day per date however many levels', () => {
    expect(streakFrom(['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-26'], '2026-09-26')).toEqual({ current: 3, longest: 3, today: true });
  });
  it("stays alive through today until today is over (yesterday's run still counts)", () => {
    expect(streakFrom(['2026-09-24', '2026-09-25'], '2026-09-26')).toEqual({ current: 2, longest: 2, today: false });
  });
  it('resets current after a missed day and keeps the longest', () => {
    expect(streakFrom(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-20'], '2026-09-26')).toEqual({ current: 0, longest: 3, today: false });
    expect(streakFrom(['2026-09-01', '2026-09-02', '2026-09-26'], '2026-09-26')).toEqual({ current: 1, longest: 2, today: true });
  });
  it('crosses month and year ends', () => {
    expect(streakFrom(['2025-12-31', '2026-01-01'], '2026-01-01').current).toBe(2);
    expect(streakFrom(['2024-02-28', '2024-02-29', '2024-03-01'], '2024-03-01').current).toBe(3);
  });
});

describe('learning days', () => {
  const base = () => emptyProgress(new Date('2026-10-01T00:00:00Z'), 'UTC');
  it('are dated when the learning happens, in the time zone the learner is in then', () => {
    const ny = { ...base(), timeZone: 'America/New_York' };
    // 02:00 UTC is still the evening before in New York.
    expect(Object.keys(noteLearningDay(ny, new Date('2026-10-06T02:00:00Z')).learningDays ?? {})).toEqual(['2026-10-05']);
  });

  it('never merge after a time zone change', () => {
    // 23:30 and 00:30 UTC: two days. An hour east both would be the same local day.
    let s = noteLearningDay(base(), new Date('2026-10-05T23:30:00Z'));
    s = noteLearningDay(s, new Date('2026-10-06T00:30:00Z'));
    s = { ...s, timeZone: 'Europe/Paris' };
    expect(learningStreak(s, new Date('2026-10-06T12:00:00Z'))).toMatchObject({ current: 2, longest: 2 });
  });

  it('are built once from older saves', () => {
    const old: ProgressState = {
      ...base(),
      levels: { 'level.science.testing.001': { completedAt: '2026-10-05T12:00:00.000Z', revision: 1, firstAttemptCorrect: 3, total: 3, idempotencyKey: 'k' } },
      reviewDays: { '2026-10-06': true },
    };
    expect(withLearningDays(old).learningDays).toEqual({ '2026-10-05': '2026-10-05T12:00:00.000Z', '2026-10-06': '2026-10-06T00:00:00.000Z' });
  });
});
