import { Redirect, router } from 'expo-router';
import { Body, BigNumber, Button, Card, Label, ProgressBar, Row, Screen, Title } from '@/components/ui';
import { getLevel } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { useStartLevel } from '@/progress/useStartLevel';

/** Home / Continue: "loading a save file". One dominant Continue card owns the screen. */
export default function HomeScreen() {
  const p = useProgress();
  const v = useProgressView();
  const startLevel = useStartLevel();
  if (!p.ready) return <Screen>{null}</Screen>;
  if (!p.onboarded) return <Redirect href="/welcome" />;

  const skill = v.skills[0]!;
  const nextId = p.nextLevelId(skill.id);
  const next = nextId ? getLevel(nextId) : undefined;
  const resuming = nextId ? v.sessions[nextId] : undefined;
  const { today } = v;

  return (
    <Screen>
      <Label tone="brand">BrainScroll</Label>
      <Row>
        <Title>Knowledge Lv.</Title>
        <BigNumber>{v.knowledgeLevel}</BigNumber>
      </Row>

      <Card accent>
        <Label>Continue</Label>
        <Title>
          {skill.name} · Lv. {skill.view.level}
        </Title>
        {next ? (
          <Body muted>
            Level {next.number}: {next.title}
          </Body>
        ) : (
          <Body muted>You've cleared every published level. More are on the way.</Body>
        )}
        <ProgressBar value={skill.view.bandProgress} />
        {next && today.dailyComplete ? (
          <Button label="Daily quest complete" onPress={() => router.push('/daily-complete')} />
        ) : next ? (
          <Button label={resuming ? `Resume Level ${next.number}` : `Start Level ${next.number}`} onPress={() => startLevel(next.id)} />
        ) : null}
      </Card>

      <Card>
        <Label>Today</Label>
        <Body>
          {today.used} / {today.cap ?? '∞'} new levels completed
        </Body>
        {today.cap !== null && <ProgressBar value={today.used / today.cap} tone="info" />}
      </Card>

      {v.reviewsDue > 0 && (
        <Card>
          <Label tone="success">Review</Label>
          <Body>
            {v.reviewsDue} {v.reviewsDue === 1 ? 'thing' : 'things'} worth refreshing
          </Body>
          <Button variant="secondary" label="Start review" onPress={() => router.push('/review-session')} />
        </Card>
      )}
    </Screen>
  );
}
