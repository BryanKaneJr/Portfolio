import { dayNumber, drScrollSaying, PRICING } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { Body, Button, Caption, Card, Display, DrScrollSays, Eyebrow, Icon, Numeral, Pips, Pop, ProgressBar, Reveal, Row } from '@/components/ui';
import { featuredQuest, questDef, questTotals, useQuests } from '@/progress/useQuests';
import { useProgressView } from '@/progress/ProgressProvider';
import { color, iconSize, layout, space } from '@/theme/tokens';

/**
 * Daily Knowledge Complete: the free cap feels like finishing the day, not an
 * energy wall. Review is the primary free action. Unlimited is an optional,
 * quiet card and never interrupts a lesson.
 */
export default function DailyCompleteScreen() {
  const { today, xpToday } = useProgressView();
  const insets = useSafeAreaInsets();
  const quest = featuredQuest(useQuests().data);
  // Product health: how often learners reach the cap (not how long they stay).
  useEffect(() => track('daily_complete_seen', { used: today.used, cap: today.cap ?? today.used }), [today.used, today.cap]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep }} edges={['top']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: layout.gutter, gap: space.xl }}>
        <View style={{ width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', gap: space.xl, alignItems: 'center' }}>
          <Eyebrow tone="success">Daily knowledge complete</Eyebrow>
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Pop>
              <Numeral size="hero">
                {today.used} / {today.cap ?? today.used}
              </Numeral>
            </Pop>
            <Caption center>new levels · +{xpToday} XP today</Caption>
          </View>
          <View style={{ width: '60%' }}>
            <Pips filled={today.used} total={today.cap ?? today.used} tone="success" label={`${today.used} of ${today.cap ?? today.used} new levels today`} />
          </View>
          <Reveal delay={300}>
            <View style={{ gap: space.lg, alignItems: 'center' }}>
              <Display center>Brain successfully fed.</Display>
              <DrScrollSays spot="daily-complete" lines={[`${drScrollSaying('dailyComplete', 'daily', dayNumber(new Date(), deviceTimeZone()))} 🌱`]} style={{ width: '100%', minWidth: 280 }} />
            </View>
          </Reveal>
          {quest && questDef(quest.id) && quest.state !== 'completed' && (
            <Reveal delay={450}>
              <Card variant="quiet" style={{ width: '100%', minWidth: 280, gap: space.sm }}>
                <Eyebrow tone="brand">{quest.state === 'live' ? 'This week’s quest' : 'From the Archive'}</Eyebrow>
                <Body>
                  {questDef(quest.id)!.title} · {questTotals(quest).done} / {questTotals(quest).required} new levels
                </Body>
                <ProgressBar value={questTotals(quest).done / Math.max(questTotals(quest).required, 1)} size="sm" tone="success" label="Quest progress" />
                <Caption>{quest.finalRoundUnlocked ? 'The Final Round is open.' : 'Come back tomorrow and keep building.'}</Caption>
              </Card>
            </Reveal>
          )}
          <Reveal delay={600}>
            {/* Quiet and optional: the cap is the end of a good day, not a wall. */}
            <Card variant="quiet" style={{ width: '100%', minWidth: 280, gap: space.sm }} onPress={() => router.push({ pathname: '/unlimited', params: { from: 'daily_complete' } })} accessibilityLabel="Want more today? See Unlimited">
              <Eyebrow tone="brand">Unlimited</Eyebrow>
              <Body>Want more today? Keep leveling · ${PRICING.monthlyUsd}/mo</Body>
              <Row gap={space.xs} style={{ justifyContent: 'flex-end' }}>
                <Caption tone="brand">See Unlimited</Caption>
                <Icon name="forward" tint={color.brandText} size={iconSize.sm} />
              </Row>
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


const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
