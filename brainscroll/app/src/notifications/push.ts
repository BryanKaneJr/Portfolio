import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Social push notifications (docs/notifications.md): the server sends them
 * (friend requests, new friends, league results, someone passing you); the app
 * only hands over this device's Expo push token and opens the right screen on a
 * tap. Needs the OS permission the reminders already ask for, after the first
 * level. Nothing here schedules anything.
 */
export const PUSH_SUPPORTED = true;
const CHANNEL = 'social';
let token: string | null = null;

/** This device's token for the signed-in account, once registered (for signing out). */
export const currentPushToken = () => token;

/** The Expo push token, when notifications are allowed; null otherwise (or in a simulator). */
export async function pushToken(): Promise<string | null> {
  if (!(await Notifications.getPermissionsAsync()).granted) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Friends and leagues', importance: Notifications.AndroidImportance.DEFAULT });
  }
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  try {
    token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    return token;
  } catch {
    return null;
  }
}

export const pushPlatform = (): 'ios' | 'android' | null => (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null);

/**
 * Calls back when the OS rotates this device's token. On iPhone, fetching the
 * token (pushToken) fires the same event with the same token, so only a token
 * that differs from the last one counts: calling back on every event made
 * register, fetch, event, register loop without end (the first TestFlight build
 * sent about 317,000 registrations from one phone in a day; 2026-10-09).
 */
export function onTokenRotated(cb: () => void): () => void {
  let last: string | null = null;
  const sub = Notifications.addPushTokenListener(({ data }) => {
    const next = String(data);
    if (last !== null && next !== last) cb();
    last = next;
  });
  return () => sub.remove();
}

/** Where a tapped notification should open: only the app's own social screens. */
export function routeFromNotification(data: unknown): string | null {
  const url = (data as { url?: unknown } | undefined)?.url;
  return typeof url === 'string' && /^\/(social|league|person\/[A-Za-z0-9_-]{1,64})$/.test(url) ? url : null;
}

export const useLastTappedNotification = () => Notifications.useLastNotificationResponse();
