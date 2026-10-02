import type { ReminderContext } from '@brainscroll/core';

/** The web build has no reminders (reminder.ts is native only). */
export const REMINDER_SUPPORTED = false;
export async function requestReminderPermission(): Promise<boolean> {
  return false;
}
export async function rearmReminder(_: { enabled: boolean } & ReminderContext): Promise<void> {}
