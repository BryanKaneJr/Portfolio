import type { QuestView } from '@brainscroll/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LevelArt } from '@/components/ui';
import { questDef } from '@/progress/useQuests';
import { color, depth, fw, radius, space } from '@/theme/tokens';

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
  const live = Date.parse(quest.startsAt) <= now && now < Date.parse(quest.endsAt);
  if (!def || !live) return null;
  const done = quest.state === 'completed' && quest.liveClear;
  const days = questDaysLeft(quest.endsAt, now);
  const band = done ? 'Done' : `${days} ${days === 1 ? 'day' : 'days'}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`This week's quest: ${def.title}. ${done ? 'Finished.' : `${band} left in its week.`} Open the quest.`}
      onPress={() => router.push({ pathname: '/quest/[id]', params: { id: quest.id } })}
      style={({ pressed }) => [styles.tile, done && styles.doneTile, pressed && { transform: [{ translateY: depth.edge }], borderBottomWidth: 0, marginBottom: depth.edge }]}>
      <View style={styles.art}>
        <LevelArt art={def.art} size={60} />
      </View>
      <View style={[styles.band, done && styles.doneBand]}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.label, done && { color: color.onSuccess }]}>
          {band}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 84,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
    borderWidth: depth.border,
    borderColor: color.brandLine,
    borderBottomWidth: depth.edge + depth.border,
    borderBottomColor: color.brandEdge,
    overflow: 'hidden',
  },
  doneTile: { borderColor: color.successLine, borderBottomColor: color.successEdge },
  art: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.xs },
  band: { backgroundColor: color.brand, paddingVertical: space.xxs, alignItems: 'center' },
  doneBand: { backgroundColor: color.success },
  label: { ...fw('800'), fontSize: 14, color: color.onBrand },
});
