/**
 * Reminders (owner, 2026-10-01: "We want people to use the app, we want to
 * notify them. We don't have to spam, but we can throw out a notification
 * saying finish chapter 7!"). Opt-in, asked once after the first level.
 *
 * When on: a note at 8 am, noon and 7 pm every day, and one at 11 pm when
 * today would break a streak. The notes speak to where the learner is
 * ("Finish Chapter 7 of Astronomy! 3 levels to go."), their reviews and
 * their streak. Having learned today doesn't silence the day: it just changes
 * the note (finish the chapter, use the levels left). A day with nothing left
 * to do (today's levels used, no reviews due) gets no more notes.
 *
 * Scheduled on the device, two weeks ahead, and re-planned whenever the app
 * opens or a level is cleared. The one line we don't cross is being a jerk:
 * no guilt, no insults, no fake deadlines (a test checks the copy).
 */
export const REMINDER_HOURS = [8, 12, 19] as const;
export const STREAK_REMINDER_HOUR = 23;
export const REMINDER_DAYS_AHEAD = 14;

/** Where the learner is, to write notes about it. */
export interface ReminderContext {
  now: Date;
  learnedToday: boolean;
  /** Core Streak.current: the run ending today, or yesterday while today isn't counted. */
  streak: number;
  /** New levels left today; null with Unlimited. */
  dailyRemaining: number | null;
  reviewsDue: number;
  /** The level they'd play next, in the skill they're on. */
  next?: { skillName: string; levelNumber: number; chapter: number; chapterTitle?: string; levelsLeftInChapter: number };
}

export type PlannedReminder = { at: Date; body: string };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** Notes about the next level and its chapter. */
function progressLines(next: NonNullable<ReminderContext['next']>): string[] {
  const left = next.levelsLeftInChapter;
  return [
    left <= 1 ? `One level left in Chapter ${next.chapter} of ${next.skillName}. Finish it!` : `Finish Chapter ${next.chapter} of ${next.skillName}! ${plural(left, 'level')} to go.`,
    `${next.skillName} Level ${next.levelNumber} is ready for you.`,
    next.chapterTitle ? `Chapter ${next.chapter}: ${next.chapterTitle}. Pick up where you left off.` : `Pick up ${next.skillName} where you left off.`,
    `Five minutes, one level, and ${next.skillName} levels up. Ready?`,
  ];
}

const GENERAL_LINES = [
  'Something new to learn is waiting for you.',
  'A level takes about five minutes. Got five minutes?',
  'Your brain called. It wants something new.',
  'Swap a few minutes of scrolling for a level.',
];

/** The 11 pm note: keep the run going. Warm, not a threat. */
export function streakReminderLine(streak: number): string {
  return streak <= 1 ? 'You learned something yesterday. One level tonight makes it two days in a row!' : `Keep your ${streak}-day streak going! One level does it.`;
}

/** What the note at slot `k` of a day says, or nothing when there's nothing left to do that day. */
function noteFor(ctx: ReminderContext, today: boolean, k: number, firstToday: boolean): string | undefined {
  const levelsLeft = !today || ctx.dailyRemaining === null || ctx.dailyRemaining > 0;
  const lines: string[] = [];
  if (levelsLeft) lines.push(...(ctx.next ? progressLines(ctx.next) : GENERAL_LINES));
  if (ctx.reviewsDue > 0) lines.push(`${plural(ctx.reviewsDue, 'card')} ready for review. A quick refresher keeps them yours.`);
  // The first note after learning today says well done, and what's left.
  if (firstToday && ctx.learnedToday && levelsLeft && ctx.dailyRemaining) return `Nice work today! You still have ${plural(ctx.dailyRemaining, 'new level')} to use.`;
  return lines.length ? lines[k % lines.length] : undefined;
}

/** The reminders to schedule from `now` (device-local time). */
export function planReminders(ctx: ReminderContext): PlannedReminder[] {
  const { now, learnedToday, streak } = ctx;
  const plan: PlannedReminder[] = [];
  const at = (days: number, hour: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  for (let day = 0; day < REMINDER_DAYS_AHEAD; day++)
    REMINDER_HOURS.forEach((hour, i) => {
      const when = at(day, hour);
      if (when <= now) return;
      const body = noteFor(ctx, day === 0, day * REMINDER_HOURS.length + i, day === 0 && !plan.length);
      if (body) plan.push({ at: when, body });
    });
  // Tonight, if today isn't counted yet and there's a run to keep. Tomorrow night, if today is counted
  // (later nights only matter once tomorrow is learned, which re-plans).
  if (!learnedToday && streak >= 1 && at(0, STREAK_REMINDER_HOUR) > now) plan.push({ at: at(0, STREAK_REMINDER_HOUR), body: streakReminderLine(streak) });
  if (learnedToday && streak >= 1) plan.push({ at: at(1, STREAK_REMINDER_HOUR), body: streakReminderLine(streak) });
  return plan.sort((a, b) => a.at.getTime() - b.at.getTime());
}
