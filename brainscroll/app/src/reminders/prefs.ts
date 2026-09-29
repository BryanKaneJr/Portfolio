import { useSyncExternalStore } from 'react';
import { load, save } from '@/progress/storage';

/** The reminder setting is the device's, like sound and haptics. Off by default. */
export type ReminderPrefs = { enabled: boolean; hour: number };
const KEY = 'bs.prefs.reminder';
let prefs: ReminderPrefs = { enabled: false, hour: 19 };
const listeners = new Set<() => void>();
void load<ReminderPrefs>(KEY).then((p) => {
  if (p) {
    prefs = { ...prefs, ...p };
    listeners.forEach((l) => l());
  }
});

export function setReminderPrefs(next: Partial<ReminderPrefs>): void {
  prefs = { ...prefs, ...next };
  void save(KEY, prefs);
  listeners.forEach((l) => l());
}

export function useReminderPrefs(): ReminderPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => prefs,
    () => prefs,
  );
}
