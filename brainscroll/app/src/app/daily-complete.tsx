import { dayNumber, drScrollSaying, PRICING } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { Body, Button, Caption, Card, Display, DrScrollSays, Eyebrow, Icon, Numeral, Pop, ProgressBar, Reveal, Row } from '@/components/ui';
import { featuredQuest, questDef, questTotals, useQuests } from '@/progress/useQuests';
import { useProgressView } from '@/progress/ProgressProvider';
import { color, iconSize, layout, space } from '@/theme/tokens';

/**
 * Out of Brainpower: feels like finishing the day, not a wall. It says how
 * to earn more (streak, trophies, chapter reviews, a lucky perfect level)
 * and when it refills. Review is the primary free action. Unlimited is an
 * optional, quiet card and never interrupts a lesson.
 */
export default function DailyCompleteScreen() {
  const { today, xpToday } = useProgressView();
  const insets = useSafeAreaInsets();
  const quest = featuredQuest(useQuests().data);
  // Product health: how often learners run out (not how long they stay).
  useEffect(() => track('daily_complete_seen', { used: today.used, cap: today.cap ?? today.used }), [today.used, today.cap]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep }} edges={['top']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: layout.gutter, gap: space.xl }}>
        <View style={{ width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', gap: space.xl, alignItems: 'center' }}>
          <Eyebrow tone="success">Brainpower used up</Eyebrow>
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Pop>
              <Numeral size="hero">🧠 {today.brainpower ?? 0} / {today.brainpowerMax}</Numeral>
            </Pop>
            <Caption center>
              {today.used} new {today.used === 1 ? 'level' : 'levels'} · +{xpToday} XP today
            </Caption>
          </View>
          <Reveal delay={300}>
            <View style={{ gap: space.lg, alignItems: 'center' }}>
              <Display center>Brain successfully fed.</Display>
              <DrScrollSays spot="daily-complete" lines={[`${drScrollSaying('dailyComplete', 'daily', dayNumber(new Date(), deviceTimeZone()))} 🌱`]} style={{ width: '100%', minWidth: 280 }} />
            </View>
          </Reveal>
          <Reveal delay={400}>
            <Card variant="quiet" style={{ width: '100%', minWidth: 280, gap: space.sm }}>
              <Eyebrow tone="brand">Earn more Brainpower</Eyebrow>
              <Body>🔥 Keep your streak going: +1 each day</Body>
              <Body>🏆 Win a trophy: +1</Body>
              <Body>📚 Finish a chapter review: +1</Body>
              <Body>✨ A perfect level might drop +1</Body>
              <Caption>You refill to {today.brainpowerRefill} tomorrow.</Caption>
            </Card>
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
            {/* Quiet and optional: running out is the end of a good day, not a wall. */}
            <Card variant="quiet" style={{ width: '100%', minWidth: 280, gap: space.sm }} onPress={() => router.push({ pathname: '/unlimited', params: { from: 'daily_complete' } })} accessibilityLabel="Want more today? See Unlimited">
              <Eyebrow tone="brand">Unlimited</Eyebrow>
              <Body>∞ Brainpower: keep leveling today · ${PRICING.monthlyUsd}/mo</Body>
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
