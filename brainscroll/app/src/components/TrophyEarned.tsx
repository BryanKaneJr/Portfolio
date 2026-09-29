import { isGoldArt, trophyInfo, type Trophy } from '@brainscroll/core';
import { router } from 'expo-router';
import { View } from 'react-native';
import { TrophyBadge } from '@/components/TrophyBadge';
import { Button, Caption, Card, Eyebrow, Row, Title } from '@/components/ui';
import { trophyCatalog } from '@/content';
import { space } from '@/theme/tokens';

/**
 * "Trophy earned": the newest trophy a completion unlocked (gold for a
 * mastery), with a count of any others, and a button to share it.
 */
export function TrophyEarned({ trophies }: { trophies: Trophy[] }) {
  const first = trophies[0];
  if (!first) return null;
  const info = trophyInfo(first.trophyId, trophyCatalog);
  const gold = first.kind === 'mastery' || first.kind === 'subject' || first.trophyId === 'trophy.master_of_all' || isGoldArt(info?.art);
  const more = trophies.length - 1;
  const eyebrow = trophies.length > 1 ? `${trophies.length} trophies earned` : 'Trophy earned';
  return (
    <Card variant={gold ? 'mastery' : 'reward'} style={{ width: '100%', minWidth: 300 }}>
      <Row gap={space.lg}>
        <View style={{ width: 72 }}>
          <TrophyBadge trophy={first} name="" size={56} />
        </View>
        <View style={{ flex: 1, gap: space.xxs }}>
          <Eyebrow tone={gold ? 'mastery' : 'brand'}>{eyebrow}</Eyebrow>
          <Title>{first.name}</Title>
          {info?.description ? <Caption>{info.description}</Caption> : null}
          {more > 0 && <Caption>{`and ${more} more`}</Caption>}
        </View>
        <Button
          compact
          variant="secondary"
          label="Share"
          onPress={() => router.push({ pathname: '/share/[id]', params: { id: first.trophyId } })}
        />
      </Row>
    </Card>
  );
}
