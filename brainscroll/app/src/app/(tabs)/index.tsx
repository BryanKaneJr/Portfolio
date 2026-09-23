import { router } from 'expo-router';
import { Body, BigNumber, Button, Card, Label, ProgressBar, Row, Screen, Title } from '@/components/ui';
import { useDemoProgress } from '@/demo/progress';

/** Home / Continue — "loading a save file". One dominant Continue card owns the screen. */
export default function HomeScreen() {
  const p = useDemoProgress();
  const { continueSkill: s, today } = p;

  return (
    <Screen>
      <Label tone="brand">BrainScroll</Label>
      <Row>
        <Title>Knowledge Lv.</Title>
        <BigNumber>{p.knowledgeLevel}</BigNumber>
      </Row>

      <Card accent>
        <Label>Continue</Label>
        <Title>
          {s.name} · Lv. {s.view.level}
        </Title>
        <Body muted>
          Next up: Level {s.view.nextLevel} · Chapter {s.view.chapter}
        </Body>
        <ProgressBar value={s.view.bandProgress} />
        <Button
          label={today.dailyComplete ? 'Daily quest complete' : `Start Level ${s.view.nextLevel}`}
          onPress={() => (today.dailyComplete ? router.push('/daily-complete') : undefined)}
        />
      </Card>

      <Card>
        <Label>Today</Label>
        <Body>
          {today.used} / {today.cap ?? '∞'} new levels completed
        </Body>
        {today.cap !== null && <ProgressBar value={today.used / today.cap} tone="info" />}
      </Card>

      {p.reviewsDue > 0 && (
        <Card>
          <Label tone="success">Review</Label>
          <Body>{p.reviewsDue} things worth refreshing</Body>
        </Card>
      )}
    </Screen>
  );
}
