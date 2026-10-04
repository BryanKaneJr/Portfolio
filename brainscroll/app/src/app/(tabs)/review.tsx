import { dayNumber, drScrollSaying, REVIEW_SESSION_MAX_QUESTIONS, type ReviewItem } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Body, Button, Caption, Card, DrScrollSays, Icon, LoadError, Loading, Numeral, OfflineState, Row, Screen, ScreenHeader, SkeletonCard, StateBlock, UiArt } from '@/components/ui';
import { ChapterReviews } from '@/components/ChapterReviews';
import { getConcept } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { color, iconSize, radius, space } from '@/theme/tokens';

/**
 * Review belongs to the learning system, not an inbox to empty. One calm card:
 * what's ready and a way in. Below it, any cleared chapter to go back over.
 * It never uses the daily allowance and stays open after 5/5.
 */
export default function ReviewScreen() {
  const { reviewQueue, refresh, ready, offline, reconnect, reconnecting } = useProgress();
  const [queue, setQueue] = useState<ReviewItem[] | null>(null);
  // A failed load is its own state: never shown as "caught up".
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  // Bumped by "Try again" to load once more without leaving the tab.
  const [attempt, setAttempt] = useState(0);

  // Load once per focus. `reviewQueue` changes identity whenever the snapshot
  // does, and `refresh` updates the snapshot, so depending on it would loop.
  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let cancelled = false;
      void refresh().catch(() => {});
      reviewQueue(50)
        .then((q) => {
          if (cancelled) return;
          setQueue(q);
          setFailed(false);
        })
        .catch(() => !cancelled && setFailed(true))
        .finally(() => !cancelled && setRetrying(false));
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, refresh, attempt]),
  );

  // Like the other tabs: no server, the whole tab says so (and retries by itself).
  if (offline) return <OfflineState onRetry={() => void reconnect()} retrying={reconnecting} />;

  const n = queue?.length ?? 0;
  const preview = (queue ?? []).slice(0, 4);
  return (
    <Screen>
      <ScreenHeader eyebrow="Memory" title="Review" />
      {failed ? (
        <LoadError
          retrying={retrying}
          onRetry={() => {
            setRetrying(true);
            setAttempt((a) => a + 1);
          }}
        />
      ) : queue === null ? (
        <Loading label="Checking what’s due">
          <SkeletonCard lines={3} action />
        </Loading>
      ) : n > 0 ? (
        <Card variant="accent" style={{ padding: space.xl, gap: space.lg }}>
          <DrScrollSays spot="review.ready" size="md" lines={[drScrollSaying('reviewReady', 'review', dayNumber(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone))]} />
          <Row gap={space.md} style={{ alignItems: 'flex-end' }}>
            <UiArt name="review" size={64} />
            <Numeral size="display" tone="success">
              {n}
            </Numeral>
            <Body style={{ paddingBottom: space.xs }}>{n === 1 ? 'concept is' : 'concepts are'} ready to refresh</Body>
          </Row>
          <View style={{ gap: space.sm }}>
            {preview.map((item) => (
              <Row key={item.conceptId} gap={space.md} style={styles.concept}>
                <Icon name="book" tint={color.success} size={iconSize.md} />
                <Body style={{ flexShrink: 1 }}>{getConcept(item.conceptId)?.title ?? item.conceptId}</Body>
              </Row>
            ))}
            {n > preview.length && <Caption>and {n - preview.length} more</Caption>}
          </View>
          <Button label={`Start review (${Math.min(n, REVIEW_SESSION_MAX_QUESTIONS)})`} onPress={() => router.push('/review-session')} />
        </Card>
      ) : (
        <StateBlock
          spot="review.empty"
          art="review-clear"
          eyebrow="All caught up"
          eyebrowTone="success"
          title="You’re caught up."
          body="Nothing needs review right now. Go learn something new."
          secondary={{ label: 'Learn something new', onPress: () => router.navigate('/') }}
        />
      )}
      {queue !== null && !failed && <ChapterReviews />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  concept: { backgroundColor: color.surfaceRaised, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm },
});
