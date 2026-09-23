import { Body, Card, Label, Screen, Title } from '@/components/ui';
import { useDemoProgress } from '@/demo/progress';

/** Review never consumes the daily new-level allowance and stays open after 5/5. */
export default function ReviewScreen() {
  const { reviewsDue } = useDemoProgress();
  return (
    <Screen>
      <Title>Review</Title>
      <Card>
        <Label tone="success">Unlimited, always</Label>
        <Body>
          {reviewsDue > 0
            ? `${reviewsDue} things worth refreshing.`
            : 'Nothing due yet. Clear a level and the concepts you learned will come back here to be refreshed.'}
        </Body>
      </Card>
    </Screen>
  );
}
