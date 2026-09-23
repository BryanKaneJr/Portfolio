import { PRICING, VOICE } from '@brainscroll/core';
import { router } from 'expo-router';
import { Body, BigNumber, Button, Card, Label, Screen, Title } from '@/components/ui';
import { useProgressView } from '@/progress/ProgressProvider';

/**
 * Daily Quest Complete: the free cap feels like finishing the day, not an energy wall.
 * Review is the primary free action. Unlimited is optional and never interrupts a lesson.
 */
export default function DailyCompleteScreen() {
  const { today, xpToday } = useProgressView();

  return (
    <Screen>
      <Label tone="success">Daily quest complete</Label>
      <BigNumber>
        {today.used} / {today.cap ?? today.used}
      </BigNumber>
      <Body muted>new levels · +{xpToday} XP today</Body>
      <Title>Brain successfully fed.</Title>
      <Body>{VOICE.dailyComplete} 🌱</Body>

      <Button label="Review what I learned" onPress={() => router.replace('/review')} />
      <Button variant="secondary" label="Come back tomorrow" onPress={() => router.dismissTo('/')} />

      <Card>
        <Label tone="brand">Unlimited</Label>
        <Body>Keep leveling · ${PRICING.monthlyUsd}/mo</Body>
        <Body muted>{VOICE.fairness}</Body>
      </Card>
    </Screen>
  );
}
