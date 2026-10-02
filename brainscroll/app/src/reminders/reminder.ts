import { planReminders, type ReminderContext } from '@brainscroll/core';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Reminders (core reminders.ts, owner 2026-10-01): when on, notes at 8 am,
 * noon and 7 pm about where the learner is ("Finish Chapter 7!"), and 11 pm
 * when today would break a streak. All local, planned two weeks ahead and
 * re-planned whenever the app opens or a level is cleared. Nothing leaves the
 * device.
 */
export const REMINDER_SUPPORTED = true;
const CHANNEL = 'daily-reminder';

Notifications.setNotificationHandler({
  // Inside the app it's pointless: never show it in the foreground.
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Ask the OS, when the learner says yes to reminders. */
export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Cancel every pending reminder and, if they're on, schedule the plan from now. */
export async function rearmReminder({ enabled, ...ctx }: { enabled: boolean } & ReminderContext): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  for (const r of planReminders(ctx)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'BrainScroll', body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
    });
  }
}
