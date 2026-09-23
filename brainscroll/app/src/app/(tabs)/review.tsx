import { Body, Card, Label, Screen, Title } from '@/components/ui';
import { getConcept } from '@/content';
import { useProgressView } from '@/progress/ProgressProvider';

/** Review never consumes the daily new-level allowance and stays open after 5/5. */
export default function ReviewScreen() {
  const { reviewsDue } = useProgressView();
  return (
    <Screen>
      <Title>Review</Title>
      <Card>
        <Label tone="success">Unlimited, always</Label>
        <Body>
          {reviewsDue.length > 0
            ? `${reviewsDue.length} ${reviewsDue.length === 1 ? 'thing' : 'things'} worth refreshing.`
            : 'Nothing due yet. Clear a level and the concepts you learned will come back here to be refreshed.'}
        </Body>
      </Card>
      {reviewsDue.map((id) => {
        const c = getConcept(id);
        return (
          <Card key={id}>
            <Title>{c?.title ?? id}</Title>
            {c && <Body muted>{c.description}</Body>}
          </Card>
        );
      })}
      {reviewsDue.length > 0 && <Body muted>Recall practice for these is coming soon.</Body>}
    </Screen>
  );
}
