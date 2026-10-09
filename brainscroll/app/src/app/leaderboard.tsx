import { ordinal, WORLD_BOARD, type WorldBoardView } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { StyledName } from '@/components/cosmetics';
import { Avatar } from '@/components/social';
import { Body, Caption, Card, Eyebrow, IconButton, LoadError, Row, Screen, SkeletonCard, Title } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { color, space, type } from '@/theme/tokens';

/**
 * The world leaderboard, opened from Social (owner, 2026-10-09: "when you
 * click on it, it shows the top 50"): everyone by total XP, all time; it never
 * resets. Your row is highlighted, or pinned under the top 50 when you're
 * further down. A row opens that learner's profile.
 */
export default function LeaderboardScreen() {
  const { social } = useProgress();
  const [board, setBoard] = useState<WorldBoardView | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    social.worldBoard().then(
      (b) => {
        setBoard(b);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [social]);
  useFocusEffect(load);

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/league'));
  const header = (
    <Row gap={space.sm}>
      <IconButton label="Back" icon="back" onPress={back} />
      <View style={{ flex: 1, gap: space.xxs }}>
        <Eyebrow>{`Top ${WORLD_BOARD.TOP} · all time`}</Eyebrow>
        <Title>World leaderboard</Title>
      </View>
    </Row>
  );
  if (failed && !board) return <LoadError layout="screen" onRetry={load} onBack={back} />;
  // You, under the list, when you're further down than it goes.
  const pinned = board && board.you.place && !board.rows.some((r) => r.you) ? { ...board.you, place: board.you.place } : null;
  return (
    <Screen header={header}>
      {!board ? (
        <SkeletonCard lines={8} />
      ) : (
        <>
          {board.rows.length > 0 && (
            <Card variant="plain" style={{ paddingVertical: space.xs, paddingHorizontal: 0, gap: 0 }}>
              {board.rows.map((r, i) => (
                <BoardRow key={r.id} row={r} divided={i > 0} />
              ))}
              {pinned && (
                <>
                  <View style={styles.skipped} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Caption center>···</Caption>
                  </View>
                  <BoardRow row={pinned} divided={false} />
                </>
              )}
            </Card>
          )}
          {!board.you.place && <Caption center>Earn XP in a level to get your place.</Caption>}
        </>
      )}
    </Screen>
  );
}

/** "1st", "13th", "89,405th". */
const placeName = (n: number) => ordinal(n).replace(/^\d+/, (d) => Number(d).toLocaleString('en-US'));

function BoardRow({ row: r, divided }: { row: WorldBoardView['rows'][number]; divided: boolean }) {
  const name = r.you ? 'You' : `@${r.username}`;
  const top = r.place <= WORLD_BOARD.PREVIEW;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${placeName(r.place)}: ${r.you ? 'you' : name}${r.friend ? ', your friend' : ''}, ${r.totalXp} XP. Open the profile`}
      onPress={() => router.push({ pathname: '/person/[id]', params: { id: r.id } })}
      style={({ pressed }) => [styles.row, divided && styles.divided, r.you && { backgroundColor: color.brandSoft }, pressed && { opacity: 0.8 }]}>
      <Body style={{ minWidth: 40, ...(top ? { color: color.brandText, fontWeight: '800' } : null) }}>{placeName(r.place)}</Body>
      <Avatar username={r.username} avatar={r.avatar} ring={r.ring} size={36} />
      <View style={{ flex: 1 }}>
        <StyledName nameStyle={r.nameStyle} style={[type.body, { color: color.text }]}>
          {name}
        </StyledName>
        {r.friend && <Caption>Friend</Caption>}
      </View>
      <Body>{`${r.totalXp.toLocaleString('en-US')} XP`}</Body>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.lg },
  divided: { borderTopWidth: 1, borderTopColor: color.border },
  // Places between the top 50 and yours.
  skipped: { paddingVertical: space.xxs, borderTopWidth: 1, borderTopColor: color.border },
});
