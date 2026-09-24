import { DR_SCROLL_LINES, PRICING, VOICE } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { Body, Button, Caption, Card, Display, DrScrollSays, Eyebrow, Halo, Numeral, Pips, Pop, Reveal } from '@/components/ui';
import { useProgressView } from '@/progress/ProgressProvider';
import { color, layout, space } from '@/theme/tokens';

/**
 * Daily Knowledge Complete: the free cap feels like finishing the day, not an
 * energy wall. Review is the primary free action. Unlimited is an optional,
 * quiet card and never interrupts a lesson.
 */
export default function DailyCompleteScreen() {
  const { today, xpToday } = useProgressView();
  const insets = useSafeAreaInsets();
  // Product health: how often learners reach the cap (not how long they stay).
  useEffect(() => track('daily_complete_seen', { used: today.used, cap: today.cap ?? today.used }), [today.used, today.cap]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep }} edges={['top']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: layout.gutter, gap: space.xl }}>
        <View style={{ width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', gap: space.xl, alignItems: 'center' }}>
          <Eyebrow tone="success">Daily knowledge complete</Eyebrow>
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Halo />
            <Pop>
              <Numeral size="hero">
                {today.used} / {today.cap ?? today.used}
              </Numeral>
            </Pop>
            <Caption center>new levels · +{xpToday} XP today</Caption>
          </View>
          <View style={{ width: '60%' }}>
            <Pips filled={today.used} total={today.cap ?? today.used} tone="success" />
          </View>
          <Reveal delay={300}>
            <View style={{ gap: space.lg, alignItems: 'center' }}>
              <Display center>Brain successfully fed.</Display>
              <DrScrollSays pose="go-outside" lines={[`${VOICE.dailyComplete} 🌱`, DR_SCROLL_LINES.dailyComplete]} style={{ width: '100%', minWidth: 280 }} />
            </View>
          </Reveal>
          <Reveal delay={600}>
            <Card variant="quiet" style={{ width: '100%', minWidth: 280 }}>
              <Eyebrow tone="brand">Unlimited</Eyebrow>
              <Body>Keep leveling · ${PRICING.monthlyUsd}/mo</Body>
              <Caption>{VOICE.fairness}</Caption>
            </Card>
          </Reveal>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: layout.gutter, paddingBottom: Math.max(insets.bottom, space.lg), gap: space.sm, width: '100%', maxWidth: layout.readingWidth + 2 * layout.gutter, alignSelf: 'center' }}>
        <Button label="Review what I learned" onPress={() => router.replace('/review')} />
        <Button variant="ghost" label="Come back tomorrow" onPress={() => router.dismissTo('/')} />
      </View>
    </SafeAreaView>
  );
}
