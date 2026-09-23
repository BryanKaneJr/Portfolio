import { REVIEW_SESSION_MAX_QUESTIONS, type ReviewItem } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Body, Button, Card, Label, Screen, Title } from '@/components/ui';
import { getConcept } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';

/** Review never consumes the daily new-level allowance and stays open after 5/5. */
export default function ReviewScreen() {
  const { reviewQueue, refresh, ready } = useProgress();
  const [queue, setQueue] = useState<ReviewItem[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let cancelled = false;
      void refresh();
      reviewQueue(50)
        .then((q) => !cancelled && setQueue(q))
        .catch(() => !cancelled && setQueue([]));
      return () => {
        cancelled = true;
      };
    }, [ready, reviewQueue, refresh]),
  );

  const n = queue?.length ?? 0;
  return (
    <Screen>
      <Title>Review</Title>
      <Card>
        <Label tone="success">Unlimited, always</Label>
        <Body>
          {queue === null
            ? 'Checking what’s due…'
            : n > 0
              ? `${n} ${n === 1 ? 'thing' : 'things'} worth refreshing. Reviews never use your daily levels.`
              : 'Nothing due right now. Concepts come back here on a schedule: sooner if you missed them, later as they stick.'}
        </Body>
        {n > 0 && <Button label={`Start review (${Math.min(n, REVIEW_SESSION_MAX_QUESTIONS)})`} onPress={() => router.push('/review-session')} />}
      </Card>
      {queue?.map((item) => {
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
