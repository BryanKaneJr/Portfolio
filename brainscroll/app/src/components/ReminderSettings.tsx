import type { ReminderContext } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { Button, Caption, Card, Eyebrow, Notice, Title } from '@/components/ui';
import { Toggle } from '@/components/FeedbackSettings';
import { chapterFor, levelMeta } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { useCurrentSkill } from '@/progress/useCurrentSkill';
import { useReminderPrefs, setReminderPrefs } from '@/reminders/prefs';
import { rearmReminder, REMINDER_SUPPORTED, requestReminderPermission } from '@/reminders/reminder';
import { space } from '@/theme/tokens';

const WHEN = 'Notes at 8 am, noon and 7 pm about where you are, and one at 11 pm if your streak still needs today.';
const DENIED = 'Notifications are off for BrainScroll. Turn them on in your phone’s Settings to get reminders.';

/** Turns reminders on (asking the OS), and remembers the answer either way. */
async function answer(on: boolean): Promise<boolean> {
  if (on && !(await requestReminderPermission())) {
    setReminderPrefs({ asked: true });
    return false;
  }
  setReminderPrefs({ enabled: on, asked: true });
  return true;
}

/** Settings: reminders on or off. The times are fixed. Hidden where reminders don't exist (web). */
export function ReminderSettings() {
  const prefs = useReminderPrefs();
  const [denied, setDenied] = useState(false);
  if (!REMINDER_SUPPORTED) return null;
  return (
    <Card style={{ gap: space.md }}>
      <Eyebrow>Reminders</Eyebrow>
      <Toggle label="Reminders" detail={WHEN} value={prefs.enabled} onChange={async (on) => setDenied(!(await answer(on)))} />
      {denied && <Notice tone="muted">{DENIED}</Notice>}
    </Card>
  );
}

/**
 * Level Complete, once, after the first level: would they like reminders?
 * Asked here rather than at sign-up, once they know what they'd be reminded of.
 */
export function ReminderPrompt() {
  const prefs = useReminderPrefs();
  const [denied, setDenied] = useState(false);
  if (!REMINDER_SUPPORTED || !prefs.loaded || (prefs.asked && !denied)) return null;
  return (
    <Card style={{ width: '100%', minWidth: 300, gap: space.md }}>
      <Title>Want a reminder to come back?</Title>
      <Caption>{WHEN} You can turn them off in Settings.</Caption>
      {denied ? (
        <Notice tone="muted">{DENIED}</Notice>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button compact label="Yes, remind me" onPress={async () => setDenied(!(await answer(true)))} />
          <Button compact variant="secondary" label="Not now" onPress={() => void answer(false)} />
        </View>
      )}
    </Card>
  );
}

/**
 * Keeps the pending reminders right: re-planned whenever the setting changes,
 * the app comes to the foreground, or a level is cleared, with notes written
 * from where the learner is now.
 */
export function ReminderSync() {
  const prefs = useReminderPrefs();
  const p = useProgress();
  const v = useProgressView();
  const current = useCurrentSkill();
  const nextId = current ? p.nextLevelId(current.id) : undefined;
  const next = nextId ? levelMeta(nextId) : undefined;
  const chapter = next ? chapterFor(next.skillId, next.number) : undefined;
  const ctx: Omit<ReminderContext, 'now'> = {
    learnedToday: !!v.streak.today,
    streak: v.streak.current,
    dailyRemaining: v.today.remaining,
    reviewsDue: v.reviewsDue,
    next:
      next && current
        ? { skillName: current.name, levelNumber: next.number, chapter: chapter?.number ?? Math.ceil(next.number / 10), chapterTitle: chapter?.title, levelsLeftInChapter: (chapter?.levels[1] ?? next.number) - next.number + 1 }
        : undefined,
  };
  // One string for the effect to watch: re-plan only when something in the notes would change.
  const key = JSON.stringify(ctx);
  const [wake, setWake] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setWake((n) => n + 1));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!REMINDER_SUPPORTED) return;
    void rearmReminder({ enabled: prefs.enabled, now: new Date(), ...(JSON.parse(key) as Omit<ReminderContext, 'now'>) }).catch(() => {});
  }, [prefs.enabled, key, wake]);
  return null;
}
