import { dayNumber, drScrollSaying, PRICING } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { BrainpowerWays } from '@/components/BrainpowerWays';
import { Body, Button, Caption, Card, Display, DrScrollSays, Eyebrow, Icon, Numeral, Pop, ProgressBar, Reveal, Row, Title } from '@/components/ui';
import { featuredQuest, questDef, questTotals, useQuests } from '@/progress/useQuests';
import { useProgressView } from '@/progress/ProgressProvider';
import { color, depth, iconSize, layout, radius, space, type } from '@/theme/tokens';

/**
 * Out of Brainpower: feels like finishing the day, not a wall. Unlimited
 * leads (owner, 2026-10-03: "unlimited needs to appear more"): the gold
 * brain, the price and one clear button, offered here after a day's learning
 * and never mid-lesson. Below it, a compact row of the ways to earn more and
 * when it refills; review stays one tap away.
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
              <Row gap={space.sm}>
                <BrainpowerIcon size={72} state="empty" />
                <Numeral size="hero">
                  {today.brainpower ?? 0} / {today.brainpowerMax}
                </Numeral>
              </Row>
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
            {/* Where Unlimited is offered: after a day's learning, never mid-lesson. One tap away, never a wall. */}
            <Card variant="reward" style={{ width: '100%', minWidth: 280, gap: space.md }} onPress={() => router.push({ pathname: '/unlimited', params: { from: 'daily_complete' } })} accessibilityLabel="Want more today? See Unlimited">
              <Row gap={space.md}>
                <BrainpowerIcon size={56} state="unlimited" />
                <View style={{ flex: 1, gap: space.xxs }}>
                  <Eyebrow tone="brand">Unlimited</Eyebrow>
                  <Title>Keep learning today</Title>
                  <Caption>∞ Brainpower for new levels · ${PRICING.monthlyUsd}/mo or ${PRICING.annualUsd}/yr</Caption>
                </View>
              </Row>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>See Unlimited</Text>
                <Icon name="forward" tint={color.text} size={iconSize.sm} />
              </View>
            </Card>
          </Reveal>
          <Reveal delay={500}>
            <Card variant="quiet" style={{ width: '100%', minWidth: 280, gap: space.sm }}>
              <Eyebrow tone="brand">Earn more Brainpower</Eyebrow>
              <BrainpowerWays compact />
              <Caption center>Or refill to {today.brainpowerRefill} tomorrow.</Caption>
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
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: layout.gutter, paddingBottom: Math.max(insets.bottom, space.lg), gap: space.sm, width: '100%', maxWidth: layout.readingWidth + 2 * layout.gutter, alignSelf: 'center' }}>
        <Button variant="secondary" label="Review what I learned" onPress={() => router.replace('/review')} />
        <Button variant="ghost" label="Come back tomorrow" onPress={() => router.dismissTo('/')} />
      </View>
    </SafeAreaView>
  );
}


const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const styles = StyleSheet.create({
  // Looks like the primary button, inside the card the whole of which is the tap target.
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: 48, borderRadius: radius.lg, backgroundColor: color.brand, borderBottomWidth: depth.edge, borderBottomColor: color.brandEdge },
  ctaText: { ...type.button, color: color.text },
});
