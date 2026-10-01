import { describe, expect, it } from 'vitest';
import { planReminders, REMINDER_DAYS_AHEAD, STREAK_REMINDER_HOUR, streakReminderLine } from '../src/reminders';
import { EM_DASH } from '../src/editorial';

const local = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const hours = (plan: { at: Date }[], day: number) => plan.filter((r) => r.at.getDate() === day).map((r) => r.at.getHours());

describe('reminders', () => {
  it('sends notes at 8 am, noon and 7 pm, a week ahead, skipping the hours already past', () => {
    const plan = planReminders({ now: local(5, 10), learnedToday: false, streak: 0 });
    expect(hours(plan, 5)).toEqual([12, 19]);
    expect(hours(plan, 6)).toEqual([8, 12, 19]);
    expect(new Set(plan.map((r) => r.at.getDate())).size).toBe(REMINDER_DAYS_AHEAD);
  });

  it('skips the rest of a day once it has been learned', () => {
    const plan = planReminders({ now: local(5, 10), learnedToday: true, streak: 0 });
    expect(hours(plan, 5)).toEqual([]);
  });

  it('adds 11 pm tonight only when today would break a streak', () => {
    expect(hours(planReminders({ now: local(5, 10), learnedToday: false, streak: 4 }), 5)).toEqual([12, 19, STREAK_REMINDER_HOUR]);
    expect(hours(planReminders({ now: local(5, 10), learnedToday: false, streak: 0 }), 5)).not.toContain(STREAK_REMINDER_HOUR);
    // Learned today: the run carries on, so tomorrow night is the one to plan.
    const learned = planReminders({ now: local(5, 10), learnedToday: true, streak: 5 });
    expect(hours(learned, 5)).toEqual([]);
    expect(hours(learned, 6)).toEqual([8, 12, 19, STREAK_REMINDER_HOUR]);
    expect(hours(learned, 7)).not.toContain(STREAK_REMINDER_HOUR);
  });

  it('keeps the streak note warm', () => {
    for (const line of [streakReminderLine(1), streakReminderLine(12)]) {
      expect(line).not.toMatch(/lose|only|hurry|break/i);
      expect(line).not.toContain(EM_DASH);
    }
  });
});
