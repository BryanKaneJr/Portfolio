import { DR_SCROLL_FRIEND, DR_SCROLL_QUOTES, drScrollStats, drScrollTrophyIds, nextDrScrollQuote, trophyInfo } from '@brainscroll/core';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Avatar } from '@/components/social';
import { TrophyBadge } from '@/components/TrophyBadge';
import { Caption, Card, Chip, DrScrollSays, Emblem, Eyebrow, H1, IconButton, Numeral, Row, Screen, Title } from '@/components/ui';
import { levelCount, skills, trophyCatalog } from '@/content';
import { feedback } from '@/theme/feedback';
import { color, space } from '@/theme/tokens';

/**
 * Dr. Scroll's profile (everyone's first friend, owner 2026-10-03). It looks
 * like no one else's: the golden Dr. Scroll, an "Official" mark, a fun line
 * that changes each time you tap it, then every level, the longest streak and
 * every trophy. No friend, block or report buttons: he's part of the app.
 */
export function DrScrollProfile({ onBack }: { onBack: () => void }) {
  // A random first line, then the next one on each tap.
  const [quote, setQuote] = useState(() => Math.floor(Math.random() * DR_SCROLL_QUOTES.length));
  const stats = useMemo(() => drScrollStats(skills.reduce((n, s) => n + levelCount(s.id), 0)), []);
  const trophies = useMemo(() => drScrollTrophyIds(trophyCatalog), []);

  return (
    <Screen header={<IconButton label="Back" icon="back" onPress={onBack} />}>
      <Row gap={space.lg}>
        <Avatar username="dr-scroll" avatar={DR_SCROLL_FRIEND.avatar} size={88} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Eyebrow tone="mastery">Your first friend</Eyebrow>
          <H1 numberOfLines={1}>{DR_SCROLL_FRIEND.name}</H1>
          <Chip tone="mastery" icon="star">
            <Caption style={{ color: color.mastery }}>Official · BrainScroll’s professor</Caption>
          </Chip>
        </View>
      </Row>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Dr. Scroll says: ${DR_SCROLL_QUOTES[quote]}. Tap for another.`}
        onPress={() => {
          feedback('select');
          setQuote(nextDrScrollQuote);
        }}
        style={({ pressed }) => pressed && { opacity: 0.85 }}>
        <DrScrollSays key={quote} spot="profile.dr-scroll" lines={[DR_SCROLL_QUOTES[quote]]} />
        <Caption center style={{ marginTop: space.xs }}>
          Tap for another
        </Caption>
      </Pressable>

      <Card variant="mastery" style={{ gap: space.md }}>
        <Eyebrow tone="mastery">Brain overview</Eyebrow>
        <Row gap={space.lg}>
          <Emblem value={stats.knowledgeLevel} caption="Brain" tone="mastery" />
          <View style={{ flex: 1, gap: space.xs }}>
            <Row gap={space.lg}>
              <View>
                <Numeral>{stats.levels.toLocaleString('en-US')}</Numeral>
                <Caption>Levels cleared</Caption>
              </View>
              <View>
                <Numeral>{`${stats.streakDays.toLocaleString('en-US')}+`}</Numeral>
                <Caption>Day streak</Caption>
              </View>
            </Row>
            <Caption>Every subject mastered. He wrote the notes, after all.</Caption>
          </View>
        </Row>
      </Card>

      <View style={{ gap: space.sm }}>
        <Title>{`All ${trophies.length} trophies`}</Title>
        <Row gap={space.md} style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {trophies.map((id) => (
            <View key={id} style={{ width: 64, alignItems: 'center' }} accessible accessibilityLabel={trophyInfo(id, trophyCatalog)?.name ?? 'Trophy'}>
              <TrophyBadge trophyId={id} name="" size={56} />
            </View>
          ))}
        </Row>
      </View>
    </Screen>
  );
}
