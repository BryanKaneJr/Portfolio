import { trophyInfo, type Trophy } from '@brainscroll/core';
import { forwardRef } from 'react';
import { Image, Text, View } from 'react-native';
import { trophyVisual } from '@/components/TrophyBadge';
import { Icon, LevelArt, OutlinedNumber, UI_ART } from '@/components/ui';
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
export type ShareSubject = { trophy: Pick<Trophy, 'trophyId' | 'name' | 'kind' | 'questId'> } | { streakDays: number };

export const ShareCard = forwardRef<View, { subject: ShareSubject; line: string }>(function ShareCard({ subject, line }, ref) {
  // The current streak shares like a streak trophy: the owner's flame, the day count, "day streak".
  const trophy = 'trophy' in subject ? subject.trophy : { trophyId: 'streak', name: 'Learning streak', kind: 'milestone' };
  const { gold, levelArt, image: trophyImage } = 'trophy' in subject ? trophyVisual(subject.trophy) : { gold: false, levelArt: undefined, image: undefined };
  const image = 'trophy' in subject ? trophyImage : UI_ART['streak-flame'];
  const info = 'trophy' in subject ? trophyInfo(trophy.trophyId, trophyCatalog) : { art: 'streak', count: subject.streakDays };
  const count = info?.count;
  const streak = !('trophy' in subject) || trophy.trophyId.startsWith('trophy.streak_');
  // Gold wins over streak orange: 1,000 Days is the streak's top tier.
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
          <View style={{ position: 'absolute', bottom: -52, left: -80, right: -80, alignItems: 'center' }}>
            <OutlinedNumber value={count.toLocaleString('en-US')} fontSize={count >= 1000 ? 64 : 80} tone={gold ? 'gold' : streak ? 'streak' : 'brand'} />
          </View>
        ) : null}
      </View>
      {count ? (
        <Text style={[type.title, { color: accent }]}>{UNIT[(info?.art ?? '').replace(/-gold$/, '')] ?? trophy.name}</Text>
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
