import { describe, expect, it } from 'vitest';
import { streakFrom } from '../src';

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
