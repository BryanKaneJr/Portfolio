import { useSyncExternalStore } from 'react';
import { load, save } from '@/progress/storage';

/**
 * The reminder setting is the device's, like sound and haptics. Off until the
 * learner says yes (asked once, after their first level; core reminders.ts).
 * `loaded` is false until storage has been read, so the question never
 * flashes for someone who already answered it.
 */
export type ReminderPrefs = { enabled: boolean; asked: boolean; loaded: boolean };
const KEY = 'bs.prefs.reminder';
let prefs: ReminderPrefs = { enabled: false, asked: false, loaded: false };
const listeners = new Set<() => void>();
void load<Partial<ReminderPrefs>>(KEY).then((p) => {
  // Older saves turned reminders on with a chosen hour: that counts as asked.
  prefs = { ...prefs, ...(p ? { enabled: !!p.enabled, asked: p.asked ?? !!p.enabled } : {}), loaded: true };
  listeners.forEach((l) => l());
});

export function setReminderPrefs(next: Partial<Omit<ReminderPrefs, 'loaded'>>): void {
  prefs = { ...prefs, ...next };
  void save(KEY, { enabled: prefs.enabled, asked: prefs.asked });
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
