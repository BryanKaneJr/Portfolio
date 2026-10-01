import { describe, expect, it } from 'vitest';
import { planReminders, REMINDER_DAYS_AHEAD, STREAK_REMINDER_HOUR, streakReminderLine, type ReminderContext } from '../src/reminders';
import { EM_DASH } from '../src/editorial';

const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const hours = (plan: { at: Date }[], day: number) => plan.filter((r) => r.at.getDate() === day).map((r) => r.at.getHours());
const base: ReminderContext = {
  now: local(5, 10),
  learnedToday: false,
  streak: 0,
  dailyRemaining: 5,
  reviewsDue: 0,
  next: { skillName: 'Astronomy', levelNumber: 64, chapter: 7, chapterTitle: 'Stars Live and Die', levelsLeftInChapter: 7 },
};

describe('reminders', () => {
  it('sends notes at 8 am, noon and 7 pm for two weeks, from the next hour on', () => {
    const plan = planReminders(base);
    expect(hours(plan, 5)).toEqual([12, 19]);
    expect(hours(plan, 6)).toEqual([8, 12, 19]);
    expect(new Set(plan.map((r) => r.at.toDateString())).size).toBe(REMINDER_DAYS_AHEAD);
    // Within iOS's 64 pending notifications.
    expect(planReminders({ ...base, learnedToday: true, streak: 3 }).length).toBeLessThanOrEqual(64);
  });

  it('speaks to where the learner is', () => {
    const bodies = planReminders(base).map((r) => r.body);
    expect(bodies).toContain('Finish Chapter 7 of Astronomy! 7 levels to go.');
    expect(bodies).toContain('Astronomy Level 64 is ready for you.');
    expect(planReminders({ ...base, reviewsDue: 4 }).map((r) => r.body)).toContain('4 cards ready for review. A quick refresher keeps them yours.');
  });

  it('keeps nudging after a level today, and stops for the day once nothing is left', () => {
    const learned = planReminders({ ...base, learnedToday: true, dailyRemaining: 3 });
    expect(hours(learned, 5)).toEqual([12, 19]);
    expect(learned.find((r) => r.at.getDate() === 5)?.body).toBe('Nice work today! You still have 3 new levels to use.');
    expect(hours(planReminders({ ...base, learnedToday: true, dailyRemaining: 0 }), 5)).toEqual([]);
    expect(hours(planReminders({ ...base, learnedToday: true, dailyRemaining: 0, reviewsDue: 2 }), 5)).toEqual([12, 19]);
    expect(hours(planReminders({ ...base, learnedToday: true, dailyRemaining: 0 }), 6)).toEqual([8, 12, 19]);
  });

  it('adds 11 pm when today would break a streak', () => {
    expect(hours(planReminders({ ...base, streak: 4 }), 5)).toContain(STREAK_REMINDER_HOUR);
    expect(hours(planReminders(base), 5)).not.toContain(STREAK_REMINDER_HOUR);
    const learned = planReminders({ ...base, learnedToday: true, streak: 5 });
    expect(hours(learned, 5)).not.toContain(STREAK_REMINDER_HOUR);
    expect(hours(learned, 6)).toContain(STREAK_REMINDER_HOUR);
    expect(hours(learned, 7)).not.toContain(STREAK_REMINDER_HOUR);
  });

  it("is never a jerk: no guilt, threats or fake deadlines", () => {
    const all = [
      ...planReminders({ ...base, reviewsDue: 3, learnedToday: true, streak: 9 }),
      ...planReminders({ ...base, next: undefined, streak: 1 }),
      ...planReminders({ ...base, next: { ...base.next!, levelsLeftInChapter: 1, chapterTitle: undefined } }),
    ].map((r) => r.body);
    for (const line of [...all, streakReminderLine(1), streakReminderLine(12)]) {
      expect(line).not.toMatch(/\b(lose|losing|lost|disappoint|sad|ashamed|lazy|last chance|hurry|before it's too late|forgot)\b/i);
      expect(line).not.toContain(EM_DASH);
    }
  });
});
