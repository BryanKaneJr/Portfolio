/**
 * Reminders (owner, 2026-10-01). Opt-in, asked once after the first level.
 * When on: a note at 8 am, noon and 7 pm on days the learner hasn't learned
 * yet, and one at 11 pm when today would break a streak. Scheduled on the
 * device, a week ahead at most and re-planned whenever the app opens or a
 * level is cleared, so someone who stops opening the app gets a week of notes,
 * then silence. Nothing leaves the device.
 */
export const REMINDER_HOURS = [8, 12, 19] as const;
export const STREAK_REMINDER_HOUR = 23;
export const REMINDER_DAYS_AHEAD = 7;

export type PlannedReminder = { at: Date; body: string };

const DAILY_LINES: Record<(typeof REMINDER_HOURS)[number], readonly string[]> = {
  8: ['Good morning. Five new levels are ready when you are.', 'A fresh day, a few new things to learn.', 'Coffee and a level? Your call.'],
  12: ['Lunch break? A level takes about five minutes.', 'Something new to learn, whenever suits you.', 'A quick level before the afternoon?'],
  19: ['Five short levels, then go do something else.', 'Evening! Something new to learn is waiting.', 'Wind down with a level or two.'],
};

/** The 11 pm note: warm, never alarming (no "lose", no "only"). */
export function streakReminderLine(streak: number): string {
  return streak <= 1
    ? 'You learned something yesterday. One level tonight makes it two days in a row.'
    : `You're on a ${streak}-day streak, and there's still time for one level today.`;
}

/**
 * The reminders to schedule from `now` (device-local time). `streak` is the
 * current run (core Streak.current: ending today, or yesterday when today
 * isn't counted yet).
 */
export function planReminders({ now, learnedToday, streak }: { now: Date; learnedToday: boolean; streak: number }): PlannedReminder[] {
  const plan: PlannedReminder[] = [];
  const at = (days: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  for (let day = 0; day < REMINDER_DAYS_AHEAD; day++) {
    if (!(day === 0 && learnedToday))
      for (const hour of REMINDER_HOURS) {
        const when = at(day, hour);
        const lines = DAILY_LINES[hour];
        if (when > now) plan.push({ at: when, body: lines[when.getDate() % lines.length]! });
      }
  }
  // Tonight, if today isn't counted yet and there's a run to keep. Tomorrow night, if today is counted
  // (any later night only matters once tomorrow is learned, which re-plans).
  if (!learnedToday && streak >= 1 && at(0, STREAK_REMINDER_HOUR) > now) plan.push({ at: at(0, STREAK_REMINDER_HOUR), body: streakReminderLine(streak) });
  if (learnedToday && streak >= 1) plan.push({ at: at(1, STREAK_REMINDER_HOUR), body: streakReminderLine(streak) });
  return plan.sort((a, b) => a.at.getTime() - b.at.getTime());
}
