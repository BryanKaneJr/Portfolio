import { REVIEW_SESSION_MAX_QUESTIONS, type ReviewItem } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Body, Button, Caption, Card, Eyebrow, H2, Numeral, Row, Screen, ScreenHeader } from '@/components/ui';
import { getConcept } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';

/**
 * Review belongs to the learning system, not an inbox to empty. One calm card:
 * what's ready and a way in. It never uses the daily allowance and stays open
 * after 5/5.
 */
export default function ReviewScreen() {
  const { reviewQueue, refresh, ready } = useProgress();
  const [queue, setQueue] = useState<ReviewItem[] | null>(null);

  // Load once per focus. `reviewQueue` changes identity whenever the snapshot
  // does, and `refresh` updates the snapshot, so depending on it would loop.
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, refresh]),
  );

  const n = queue?.length ?? 0;
  const preview = (queue ?? []).slice(0, 4);
  return (
    <Screen>
      <ScreenHeader eyebrow="Memory" title="Review" />
      {queue === null ? (
        <Caption>Checking what’s due…</Caption>
      ) : n > 0 ? (
        <Card variant="accent" style={{ padding: space.xl, gap: space.lg }}>
          <Row gap={space.md} style={{ alignItems: 'flex-end' }}>
            <Numeral size="display" tone="success">
              {n}
            </Numeral>
            <Body style={{ paddingBottom: space.xs }}>{n === 1 ? 'concept is' : 'concepts are'} ready to refresh</Body>
          </Row>
          <View style={{ gap: space.sm }}>
            {preview.map((item) => (
              <Caption key={item.conceptId}>· {getConcept(item.conceptId)?.title ?? item.conceptId}</Caption>
            ))}
            {n > preview.length && <Caption>and {n - preview.length} more</Caption>}
          </View>
          <Button label={`Start review (${Math.min(n, REVIEW_SESSION_MAX_QUESTIONS)})`} onPress={() => router.push('/review-session')} />
        </Card>
      ) : (
        <Card style={{ padding: space.xl, gap: space.md }}>
          <Eyebrow tone="success">All caught up</Eyebrow>
          <H2>Nothing to refresh right now.</H2>
          <Body muted>Concepts come back here on a schedule: sooner if you missed them, later as they stick.</Body>
        </Card>
      )}
      <Caption>Right first time earns +10 XP per item. Reviews never use your daily levels.</Caption>
    </Screen>
  );
}
