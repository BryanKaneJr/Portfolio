import { isGoldArt, trophyInfo, type DailyAllowance, type Trophy } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useBrainpowerFlight } from '@/components/BrainpowerFlight';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { TrophyBadge } from '@/components/TrophyBadge';
import { Body, Caption, Card, Eyebrow, Gleams, Icon, Row, Shimmer, spring, Title } from '@/components/ui';
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
/** The trophy +1s an action paid (granted, not lost at the cap), for the card's own "+1" (owner, 2026-10-04). */
export function trophyBrainpower(daily: DailyAllowance | undefined): number {
  return (daily?.brainpowerEarned ?? []).filter((e) => e.kind === 'trophy' && e.granted === 1).length;
}

export function TrophyEarned({ trophies, at = 0, brainpower = 0 }: { trophies: Trophy[]; at?: number; brainpower?: number }) {
  const first = trophies[0];
  const flight = useBrainpowerFlight();
  const plus = useRef<View>(null);
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
  // Its +1s fly from the card's own "+1" to the Brainpower chip, like the Brainpower card's lines.
  useEffect(() => {
    if (!flight || !key || brainpower <= 0) return;
    const timers = Array.from({ length: brainpower }, (_, i) =>
      setTimeout(() => {
        const v = plus.current;
        if (!v) return flight.launch({ x: 0, y: 0 }, 1);
        v.measureInWindow((x, y, w, h) => flight.launch({ x: x + w / 2, y: y + h / 2 }, 1));
      }, at + BADGE_DELAY + 450 + i * 520),
    );
    return () => timers.forEach(clearTimeout);
  }, [flight, key, brainpower, at]);
  if (!first) return null;
  const info = trophyInfo(first.trophyId, trophyCatalog);
  const gold = first.kind === 'mastery' || first.kind === 'subject' || first.trophyId === 'trophy.master_of_all' || isGoldArt(info?.art);
  const more = trophies.length - 1;
  const eyebrow = trophies.length > 1 ? `${trophies.length} trophies earned` : 'Trophy earned';
  return (
    // The whole card shares; the small share mark in its corner says so without a big button.
    <Card
      variant={gold ? 'mastery' : 'reward'}
      style={{ width: '100%' }}
      onPress={() => router.push({ pathname: '/share/[id]', params: { id: first.trophyId } })}
      accessibilityLabel={`${eyebrow}: ${first.name}${brainpower > 0 ? `, plus ${brainpower} Brainpower` : ''}. Share`}>
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
          {more > 0 && <Caption>{`and ${more} more`}</Caption>}
          {brainpower > 0 && (
            <View ref={plus} collapsable={false} style={{ alignSelf: 'flex-start' }}>
              <Row gap={space.xxs}>
                <Body style={{ color: color.brandText }}>{`+${brainpower}`}</Body>
                <BrainpowerIcon size={iconSize.md} />
              </Row>
            </View>
          )}
        </View>
        <View style={[styles.share, gold && styles.shareGold]} aria-hidden accessible={false}>
          <Icon name="share" tint={gold ? color.mastery : color.brandText} size={iconSize.sm} />
        </View>
      </Row>
      <Gleams count={4} tint={gold ? color.mastery : color.text} />
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
