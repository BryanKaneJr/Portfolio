import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Button, Caption, Card, Eyebrow, Notice } from '@/components/ui';
import { Toggle } from '@/components/FeedbackSettings';
import { useProgressView } from '@/progress/ProgressProvider';
import { useReminderPrefs, setReminderPrefs } from '@/reminders/prefs';
import { rearmReminder, REMINDER_SUPPORTED, requestReminderPermission } from '@/reminders/reminder';
import { space } from '@/theme/tokens';

const HOURS = [
  { hour: 8, label: '8 am' },
  { hour: 12, label: 'Noon' },
  { hour: 19, label: '7 pm' },
  { hour: 21, label: '9 pm' },
];

/** Profile: the opt-in daily reminder, off by default. Hidden where reminders don't exist (web). */
export function ReminderSettings() {
  const prefs = useReminderPrefs();
  const [denied, setDenied] = useState(false);
  if (!REMINDER_SUPPORTED) return null;
  const time = HOURS.find((h) => h.hour === prefs.hour)?.label ?? `${prefs.hour}:00`;
  return (
    <Card style={{ gap: space.md }}>
      <Eyebrow>Reminder</Eyebrow>
      <Toggle
        label="Daily reminder"
        detail={`One quiet note at ${time}, only on days you haven't learned yet. Never about streaks.`}
        value={prefs.enabled}
        onChange={async (on) => {
          if (on && !(await requestReminderPermission())) {
            setDenied(true);
            return;
          }
          setDenied(false);
          setReminderPrefs({ enabled: on });
        }}
      />
      {denied && <Notice tone="muted">Notifications are off for BrainScroll. Turn them on in your phone’s Settings to use the reminder.</Notice>}
      {prefs.enabled && (
        <View style={{ gap: space.xs }}>
          <Caption>When</Caption>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {HOURS.map((h) => (
              <Button key={h.hour} compact variant="secondary" label={h.label} selected={prefs.hour === h.hour} onPress={() => setReminderPrefs({ hour: h.hour })} />
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

/**
 * Keeps the one pending reminder right: re-armed whenever the setting
 * changes, the app comes to the foreground, or today's first level is cleared.
 */
export function ReminderSync() {
  const prefs = useReminderPrefs();
  const { streak } = useProgressView();
  const learnedToday = !!streak.today;
  const [wake, setWake] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setWake((n) => n + 1));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!REMINDER_SUPPORTED) return;
    void rearmReminder({ enabled: prefs.enabled, hour: prefs.hour, learnedToday }).catch(() => {});
  }, [prefs.enabled, prefs.hour, learnedToday, wake]);
  return null;
}
