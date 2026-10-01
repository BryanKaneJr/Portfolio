/** The web build has no reminders (reminder.ts is native only). */
export const REMINDER_SUPPORTED = false;
export async function requestReminderPermission(): Promise<boolean> {
  return false;
}
export async function rearmReminder(_: { enabled: boolean; learnedToday: boolean; streak: number; now?: Date }): Promise<void> {}
