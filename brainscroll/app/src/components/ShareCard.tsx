import { trophyInfo, type Trophy } from '@brainscroll/core';
import { forwardRef } from 'react';
import { Image, Text, View } from 'react-native';
import { trophyVisual } from '@/components/TrophyBadge';
import { Icon, LevelArt, OutlinedNumber } from '@/components/ui';
import { trophyCatalog } from '@/content';
import { color, depth, fw, radius, space, type } from '@/theme/tokens';

const ICON = require('../../assets/images/icon.png');

/** What a counted trophy's number counts, under the number ("100" / "day streak"). */
const UNIT: Record<string, string> = {
  streak: 'day streak',
  'perfect-lessons': 'perfect lessons',
  levels: 'levels cleared',
  chapters: 'chapters',
  reviews: 'first-try reviews',
  'quest-clears': 'quests in their week',
};

/**
 * The image a learner shares for a trophy: its art, the count big when it
 * has one ("100" over "day streak"), its name, the share line, and the
 * BrainScroll mark. Rendered on screen as the preview and captured as the
 * image, so what they see is what they send. Gold edge for mastery.
 */
export const ShareCard = forwardRef<View, { trophy: Pick<Trophy, 'trophyId' | 'name' | 'kind' | 'questId'>; line: string }>(function ShareCard({ trophy, line }, ref) {
  const { gold, levelArt, image } = trophyVisual(trophy);
  const info = trophyInfo(trophy.trophyId, trophyCatalog);
  const count = info?.count;
  const streak = trophy.trophyId.startsWith('trophy.streak_');
  const accent = gold ? color.mastery : streak ? color.streak : color.brandText;
  return (
    <View
      ref={ref}
      collapsable={false}
      accessible
      accessibilityLabel={`Share card: ${line}`}
      style={{
        width: 320,
        paddingVertical: space.xxl,
        paddingHorizontal: space.xl,
        borderRadius: radius.xl,
        backgroundColor: color.bgDeep,
        borderWidth: depth.border * 2,
        borderColor: gold ? color.mastery : streak ? color.streak : color.brandLine,
        alignItems: 'center',
        gap: space.md,
      }}>
      {/* The count overlaps the art's lower edge, like a badge, and its unit sits right under it. */}
      <View style={{ alignItems: 'center', marginBottom: count ? 36 : 0 }}>
        {levelArt ? <LevelArt art={levelArt} size={168} /> : image ? <Image source={image} style={{ width: 184, height: 184 }} resizeMode="contain" /> : <Icon name="trophy" tint={accent} size={120} />}
        {count ? (
          <View style={{ position: 'absolute', bottom: -44, left: -80, right: -80, alignItems: 'center' }}>
            <OutlinedNumber value={count.toLocaleString('en-US')} fontSize={count >= 1000 ? 64 : 80} fill={color.onBrand} edge={gold ? color.masteryEdge : streak ? color.streakEdge : color.brandEdge} stroke={5} />
          </View>
        ) : null}
      </View>
      {count ? (
        <Text style={[type.title, { color: accent }]}>{UNIT[info?.art ?? ''] ?? trophy.name}</Text>
      ) : (
        <Text style={[type.h2, { color: color.text, textAlign: 'center' }]}>{trophy.name}</Text>
      )}
      <Text style={[type.body, { color: color.textMuted, textAlign: 'center' }]}>{line}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm }}>
        <Image source={ICON} style={{ width: 22, height: 22, borderRadius: 6 }} />
        <Text style={[{ fontSize: 16 }, fw('800'), { color: color.textMuted }]}>BrainScroll</Text>
      </View>
    </View>
  );
});
