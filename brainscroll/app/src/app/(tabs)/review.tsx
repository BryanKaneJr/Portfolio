import { router } from 'expo-router';
import { Body, Button, Card, Label, Screen, Title } from '@/components/ui';
import { getConcept } from '@/content';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';

/** Review never consumes the daily new-level allowance and stays open after 5/5. */
export default function ReviewScreen() {
  const { reviewQueue } = useProgress();
  useProgressView(); // re-render when progress changes
  const queue = reviewQueue(50);

  return (
    <Screen>
      <Title>Review</Title>
      <Card>
        <Label tone="success">Unlimited, always</Label>
        <Body>
          {queue.length > 0
            ? `${queue.length} ${queue.length === 1 ? 'thing' : 'things'} worth refreshing. Reviews never use your daily levels.`
            : 'Nothing due right now. Concepts come back here on a schedule: sooner if you missed them, later as they stick.'}
        </Body>
        {queue.length > 0 && <Button label={`Start review (${Math.min(queue.length, 10)})`} onPress={() => router.push('/review-session')} />}
      </Card>
      {queue.map((item) => {
        const c = getConcept(item.conceptId);
        return (
          <Card key={item.conceptId}>
            <Title>{c?.title ?? item.conceptId}</Title>
            {c && <Body muted>{c.description}</Body>}
          </Card>
        );
      })}
    </Screen>
  );
}
