import { Platform } from 'react-native';

/**
 * Web only: lets one screen catch the browser's Back (or Forward) button
 * before the router acts on it. The router resets its state on `popstate`
 * without a `beforeRemove`, so a screen that must ask before it's left (a
 * started level) can't stop it the usual way.
 *
 * Listeners on window run in the order they were added, so this module adds
 * its one listener when it's first imported (by the root layout, before the
 * router mounts), and the screen sets the guard while it needs it. A guard
 * that returns true has handled the event: the router never sees it.
 */
type Guard = (e: PopStateEvent) => boolean;
let guard: Guard | null = null;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('popstate', (e) => {
    if (guard?.(e)) e.stopImmediatePropagation();
  });
}

/** Sets the guard; returns the function that clears it (if it's still this one). */
export function setPopGuard(next: Guard): () => void {
  guard = next;
  return () => {
    if (guard === next) guard = null;
  };
}
