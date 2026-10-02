/** The web build has no push notifications (push.ts is native only). */
export const PUSH_SUPPORTED = false;
export const currentPushToken = (): string | null => null;
export async function pushToken(): Promise<string | null> {
  return null;
}
export const pushPlatform = (): 'ios' | 'android' | null => null;
export function onTokenRotated(_: () => void): () => void {
  return () => {};
}
export function routeFromNotification(data: unknown): string | null {
  const url = (data as { url?: unknown } | undefined)?.url;
  return typeof url === 'string' && /^\/(social|league|person\/[A-Za-z0-9_-]{1,64})$/.test(url) ? url : null;
}
export const useLastTappedNotification = (): null => null;
