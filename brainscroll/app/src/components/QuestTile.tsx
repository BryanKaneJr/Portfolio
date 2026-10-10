import type { QuestView } from '@brainscroll/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { MAP_TILE_ART, MapTile } from '@/components/MapTile';
import { LevelArt } from '@/components/ui';
import { isLive, questDef } from '@/progress/useQuests';

const DAY = 86_400_000;

/** Days left in the quest's week, counting today: 7 on its first day, 1 on its last. */
export function questDaysLeft(endsAt: string, now = Date.now()): number {
  return Math.max(1, Math.ceil((Date.parse(endsAt) - now) / DAY));
}

/**
 * This week's quest as a tile beside the skill map (owner, 2026-10-01, after
 * Duolingo's): its art, and a band saying how many days its week has left, or
 * "Done" once it's finished in its week. Tapping opens the quest.
 *
 * Calm on purpose (the owner's call on the old "no countdowns" rule): a plain
 * day count in the same colour every day, no "only", no warning colour, and
 * nothing that grows louder as the week ends. Shown only while the quest is
 * live; ended quests live in the Archive.
 */
export function QuestTile({ quest }: { quest: QuestView }) {
  // The time when the map opened: a day count doesn't need to tick while you look at it.
  const [now] = useState(Date.now);
  const def = questDef(quest.id);
  if (!def || !isLive(quest, now)) return null;
  const done = quest.state === 'completed' && quest.liveClear;
  const days = questDaysLeft(quest.endsAt, now);
  const band = done ? 'Done' : `${days} ${days === 1 ? 'day' : 'days'}`;
  return (
    <MapTile
      art={<LevelArt art={def.art} size={MAP_TILE_ART} />}
      band={band}
      done={done}
      label={`This week's quest: ${def.title}. ${done ? 'Finished.' : `${band} left in its week.`} Open the quest.`}
      onPress={() => router.push({ pathname: '/quest/[id]', params: { id: quest.id } })}
    />
  );
}
