import { DAILY_FREE_NEW_LEVELS, PRICING, VOICE } from '@brainscroll/core';
import { router } from 'expo-router';
import { Body, BigNumber, Button, Card, Label, Screen, Title } from '@/components/ui';

/**
 * Daily Quest Complete — the free cap experienced as a finish, not an energy wall.
 * Review is the primary free action; Unlimited is optional and never interrupts a lesson.
 */
export default function DailyCompleteScreen() {
  return (
    <Screen>
      <Label tone="success">Daily quest complete</Label>
      <BigNumber>
        {DAILY_FREE_NEW_LEVELS} / {DAILY_FREE_NEW_LEVELS}
      </BigNumber>
      <Body muted>new levels</Body>
      <Title>Brain successfully fed.</Title>
      <Body>{VOICE.dailyComplete} 🌱</Body>

      <Button label="Review what I learned" onPress={() => router.replace('/review')} />
      <Button variant="secondary" label="Come back tomorrow" onPress={() => router.back()} />

      <Card>
        <Label tone="brand">Unlimited</Label>
        <Body>Keep leveling · ${PRICING.monthlyUsd}/mo</Body>
        <Body muted>{VOICE.fairness}</Body>
      </Card>
    </Screen>
  );
}
