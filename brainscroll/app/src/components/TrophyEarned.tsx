import { isGoldArt, trophyInfo, type Trophy } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { TrophyBadge } from '@/components/TrophyBadge';
import { Button, Caption, Card, Eyebrow, Row, Shimmer, spring, Title } from '@/components/ui';
import { feedback, useReduceMotion } from '@/theme/feedback';
import { trophyCatalog } from '@/content';
import { space } from '@/theme/tokens';

/**
 * "Trophy earned": the newest trophy a completion unlocked (gold for a
 * mastery), with a count of any others, and a button to share it.
 *
 * Its moment: `at` ms after the screen opens (when the card arrives), the
 * badge springs in with a small wobble and the unlock haptic lands with it;
 * a gold trophy then catches the light. With reduce motion it simply
 * appears, and the haptic still marks it.
 */
export function TrophyEarned({ trophies, at = 0 }: { trophies: Trophy[]; at?: number }) {
  const first = trophies[0];
  const reduce = useReduceMotion();
  const [pop] = useState(() => new Animated.Value(reduce ? 1 : 0));
  const key = first?.trophyId;
  const felt = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!key) return;
    if (reduce) pop.setValue(1);
    const t = setTimeout(() => {
      // Once per trophy, even if reduce motion changes mid-way.
      if (felt.current !== key) feedback('unlock');
      felt.current = key;
      if (!reduce) Animated.spring(pop, { toValue: 1, ...spring.pop, useNativeDriver: true }).start();
    }, at + BADGE_DELAY);
    return () => clearTimeout(t);
  }, [key, at, reduce, pop]);
  if (!first) return null;
  const info = trophyInfo(first.trophyId, trophyCatalog);
  const gold = first.kind === 'mastery' || first.kind === 'subject' || first.trophyId === 'trophy.master_of_all' || isGoldArt(info?.art);
  const more = trophies.length - 1;
  const eyebrow = trophies.length > 1 ? `${trophies.length} trophies earned` : 'Trophy earned';
  return (
    <Card variant={gold ? 'mastery' : 'reward'} style={{ width: '100%', minWidth: 300 }}>
      <Row gap={space.lg} style={{ alignItems: 'flex-start' }}>
        <Animated.View
          style={{
            width: 72,
            opacity: pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 0.6, 1], outputRange: ['-14deg', '6deg', '0deg'] }) }],
          }}>
          {gold ? (
            <Shimmer size={72} delay={at + BADGE_DELAY + 350}>
              <TrophyBadge trophy={first} name="" size={56} />
            </Shimmer>
          ) : (
            <TrophyBadge trophy={first} name="" size={56} />
          )}
        </Animated.View>
        <View style={{ flex: 1, gap: space.xxs }}>
          <Eyebrow tone={gold ? 'mastery' : 'brand'}>{eyebrow}</Eyebrow>
          <Title>{first.name}</Title>
          {info?.description ? <Caption>{info.description}</Caption> : null}
          {more > 0 && <Caption>{`and ${more} more`}</Caption>}
          {/* Under the text, so the eyebrow and title keep the full width on small phones. */}
          <View style={{ alignSelf: 'flex-start', marginTop: space.xs }}>
            <Button
              compact
              variant="secondary"
              label="Share"
              onPress={() => router.push({ pathname: '/share/[id]', params: { id: first.trophyId } })}
            />
          </View>
        </View>
      </Row>
    </Card>
  );
}

/** The badge lands just after its card, so the two don't arrive as one blur. */
const BADGE_DELAY = 250;
