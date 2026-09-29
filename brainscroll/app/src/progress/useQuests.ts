import type { QuestsView, QuestView } from '@brainscroll/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { quests as questDefs, type QuestDef } from '@/content';
import { useProgress } from './ProgressProvider';

/**
 * Weekly Quests with this learner's progress, reloaded whenever the screen
 * comes into focus and after progress changes (a level cleared counts).
 */
export function useQuests() {
  const p = useProgress();
  const [data, setData] = useState<QuestsView | null>(null);
  const [failed, setFailed] = useState(false);
  const signedIn = p.account?.status === 'signed_in' && !p.offline;
  const { quests, snapshot } = p;
  const reload = useCallback(async () => {
    try {
      setData(await quests());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [quests]);
  useFocusEffect(
    useCallback(() => {
      if (signedIn) void reload();
      // A cleared level (snapshot) can move quest progress.
    }, [signedIn, reload, snapshot]), // eslint-disable-line react-hooks/exhaustive-deps
  );
  return { data, failed, reload };
}

export function questDef(id: string): QuestDef | undefined {
  return questDefs.find((q) => q.id === id);
}

/** The quest Home shows: this week's, else the learner's active Archive quest. */
export function featuredQuest(data: QuestsView | null): QuestView | undefined {
  const now = Date.now();
  const thisWeek = data?.quests.find((q) => Date.parse(q.startsAt) <= now && now < Date.parse(q.endsAt));
  return thisWeek ?? data?.quests.find((q) => q.state === 'archive' && q.active);
}

/** Its week is over: it's in the Archive (finished or not). */
export function isPast(q: QuestView): boolean {
  return Date.parse(q.endsAt) <= Date.now();
}

export const questTotals = (q: QuestView) => ({
  done: q.requirements.reduce((n, r) => n + Math.min(r.done, r.required), 0),
  required: q.requirements.reduce((n, r) => n + r.required, 0),
});

/** "Sunday": the last day of the live week, in the learner's own time zone. */
export function lastDay(endsAt: string): string {
  return new Date(new Date(endsAt).getTime() - 1).toLocaleDateString('en-US', { weekday: 'long' });
}

/** One calm line about where a quest stands. */
export function questStatusLine(q: QuestView): string {
  if (q.state === 'completed') return q.liveClear ? 'Finished in its week. Trophy earned.' : 'Finished from the Archive.';
  if (q.finalRoundUnlocked) return 'The Final Round is open.';
  if (q.state === 'live') return `Finish by ${lastDay(q.endsAt)} for the trophy.`;
  return q.active ? 'From the Archive: worth XP, no trophy.' : 'In the Archive.';
}
