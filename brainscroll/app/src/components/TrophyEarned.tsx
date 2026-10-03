import { isGoldArt, trophyInfo, type Trophy } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { TrophyBadge } from '@/components/TrophyBadge';
import { Caption, Card, Eyebrow, Icon, Row, Shimmer, spring, Title } from '@/components/ui';
import { feedback, useReduceMotion } from '@/theme/feedback';
import { trophyCatalog } from '@/content';
import { color, iconSize, radius, space } from '@/theme/tokens';

/**
 * "Trophy earned": the newest trophy a completion unlocked (gold for a
 * mastery), with a count of any others. The whole card opens its share
 * card, marked by a small share icon in the corner.
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
    // The whole card shares; the small share mark in its corner says so without a big button.
    <Card
      variant={gold ? 'mastery' : 'reward'}
      style={{ width: '100%', minWidth: 300 }}
      onPress={() => router.push({ pathname: '/share/[id]', params: { id: first.trophyId } })}
      accessibilityLabel={`${eyebrow}: ${first.name}. Share`}>
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
        </View>
        <View style={[styles.share, gold && styles.shareGold]} aria-hidden accessible={false}>
          <Icon name="share" tint={gold ? color.mastery : color.brandText} size={iconSize.sm} />
        </View>
      </Row>
    </Card>
  );
}

/** The badge lands just after its card, so the two don't arrive as one blur. */
const BADGE_DELAY = 250;

const styles = StyleSheet.create({
  // A small round share mark, top right: clearly tappable, never a second headline.
  share: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: color.brandSoft, borderWidth: 1, borderColor: color.brandLine },
  shareGold: { backgroundColor: 'transparent', borderColor: color.mastery },
});
