import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * The opt-in daily reminder (owner, 2026-09-29). Off by default. At most one
 * notification a day, at the hour the learner picks, and only if they haven't
 * learned yet that day. It's re-armed as a single one-shot every time the app
 * opens or a level is cleared, so someone who stops opening the app gets one
 * reminder and then silence: never a chain of nags. The copy is never about
 * streaks, loss or pressure (product rules). Nothing leaves the device.
 */
export const REMINDER_SUPPORTED = true;
const CHANNEL = 'daily-reminder';
const LINES = [
  'Your five new levels are ready when you are.',
  'Something new to learn today, whenever suits you.',
  'Five short levels, then go do something else.',
];

Notifications.setNotificationHandler({
  // Inside the app it's pointless: never show it in the foreground.
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Ask the OS once, when the learner turns the reminder on. */
export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Daily reminder', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Cancel any pending reminder and, if it's on, schedule the next one: later
 * today if they haven't learned yet and the hour hasn't passed, else tomorrow.
 */
export async function rearmReminder({ enabled, hour, learnedToday, now = new Date() }: { enabled: boolean; hour: number; learnedToday: boolean; now?: Date }): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (learnedToday || next <= now) next.setDate(next.getDate() + 1);
  await Notifications.scheduleNotificationAsync({
    content: { title: 'BrainScroll', body: LINES[next.getDate() % LINES.length]! },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: next, ...(Platform.OS === 'android' ? { channelId: CHANNEL } : {}) },
  });
}
