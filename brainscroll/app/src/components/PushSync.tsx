import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { onTokenRotated, PUSH_SUPPORTED, pushPlatform, pushToken, routeFromNotification, useLastTappedNotification } from '@/notifications/push';
import { useProgress } from '@/progress/ProgressProvider';

/**
 * Keeps this device registered for the signed-in account's social notifications
 * (on sign-in, when the app comes back, and when the OS rotates the token), and
 * opens the right screen when one is tapped, even from a cold start.
 */
export function PushSync() {
  const { ready, account, social } = useProgress();
  const signedIn = ready && account?.status === 'signed_in';
  const userId = signedIn ? account.userId : null;

  useEffect(() => {
    if (!PUSH_SUPPORTED || !userId) return;
    const register = async () => {
      const platform = pushPlatform();
      const token = await pushToken();
      if (token && platform) await social.registerPushToken(token, platform).catch(() => {});
    };
    void register();
    const app = AppState.addEventListener('change', (s) => s === 'active' && void register());
    const rotated = onTokenRotated(() => void register());
    return () => {
      app.remove();
      rotated();
    };
  }, [userId, social]);

  const tapped = useLastTappedNotification();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!tapped || !userId) return;
    const id = tapped.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const route = routeFromNotification(tapped.notification.request.content.data);
    if (route) router.push(route as never);
  }, [tapped, userId]);

  return null;
}
