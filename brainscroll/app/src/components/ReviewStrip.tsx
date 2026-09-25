import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { Body, Button, Icon, Row } from '@/components/ui';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { color, radius, space } from '@/theme/tokens';

/**
 * "N things worth refreshing" with a Start review button, shown only when
 * concepts are due. It lives on the World Map, the category page (owner
 * decision), so a skill's map stays just the map. Once the day's levels are
 * done, Start review becomes the primary action.
 */
export function ReviewStrip() {
  const { ready, refresh } = useProgress();
  const { reviewsDue, today } = useProgressView();
  // Reviews come due while the app sits open; re-check whenever this screen is shown.
  useFocusEffect(
    useCallback(() => {
      if (ready) void refresh().catch(() => {});
    }, [ready, refresh]),
  );
  if (reviewsDue === 0) return null;
  return (
    <Row gap={space.md} style={styles.strip}>
      <Icon name="book" tint={color.success} size={20} />
      <Body style={{ flex: 1 }}>
        {reviewsDue} {reviewsDue === 1 ? 'thing' : 'things'} worth refreshing
      </Body>
      <Button compact variant={today.dailyComplete ? 'primary' : 'secondary'} label="Start review" onPress={() => router.push('/review-session')} />
    </Row>
  );
}

const styles = StyleSheet.create({
  strip: { backgroundColor: color.successSoft, borderRadius: radius.md, borderWidth: 2, borderColor: color.successLine, paddingLeft: space.md, paddingRight: space.xs, paddingVertical: space.xs },
});
