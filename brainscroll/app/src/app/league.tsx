import { LEAGUE, leagueName, leaguePrize, ordinal, type LeagueView } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, leagueDaysLeft } from '@/components/social';
import { Body, Caption, Card, Eyebrow, IconButton, LoadError, Row, Screen, SkeletonCard, Title } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { color, space } from '@/theme/tokens';

/**
 * The league's standings this week (owner, 2026-10-01): up to 20 learners at
 * about your brain level, ranked by XP earned since Monday. The top 3 win
 * 1,000 / 500 / 250 XP when the week ends.
 */
export default function LeagueScreen() {
  const p = useProgress();
  const [league, setLeague] = useState<LeagueView | null>(null);
  const [failed, setFailed] = useState(false);
  const { social } = p;
  const load = useCallback(() => {
    social.league().then(
      (l) => {
        setLeague(l);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, [social]);
  useFocusEffect(load);

  const header = (
    <Row gap={space.sm}>
      <IconButton label="Back" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/social'))} />
      <View style={{ flex: 1, gap: space.xxs }}>
        <Eyebrow>{league ? leagueDaysLeft(league.endsAt) : 'This week'}</Eyebrow>
        <Title>{league ? leagueName(league.leagueId) : 'Your league'}</Title>
      </View>
    </Row>
  );
  if (failed && !league) return <LoadError layout="screen" onRetry={load} onBack={() => router.back()} />;
  return (
    <Screen header={header}>
      {!league ? (
        <SkeletonCard lines={6} />
      ) : (
        <>
          <Caption>{`Ranked by XP earned this week. When it ends, the top 3 win ${LEAGUE.PRIZES.map((x) => x.toLocaleString('en-US')).join(' / ')} XP, and a new league starts with learners near your brain level.`}</Caption>
          <Card variant="plain" style={{ paddingVertical: space.xs, paddingHorizontal: 0, gap: 0 }}>
            {league.members.map((m, i) => {
              const place = i + 1;
              const prize = leaguePrize(place, league.members.length, 1);
              const name = m.you ? 'You' : m.blocked ? 'Hidden learner' : `@${m.username}`;
              return (
                <Pressable
                  key={m.id}
                  disabled={m.blocked}
                  accessibilityRole="button"
                  accessibilityLabel={`${ordinal(place)}: ${name}, brain level ${m.knowledgeLevel}, ${m.weeklyXp} XP this week${prize ? `, in line for ${prize} XP` : ''}`}
                  onPress={() => router.push({ pathname: '/person/[id]', params: { id: m.id } })}
                  style={({ pressed }) => [styles.row, i > 0 && styles.divided, m.you && { backgroundColor: color.brandSoft }, pressed && { opacity: 0.8 }]}>
                  <Body style={{ width: 36, ...(prize ? { color: color.mastery, fontWeight: '800' } : null) }}>{ordinal(place)}</Body>
                  <Avatar username={m.blocked ? '?' : m.username} size={36} />
                  <View style={{ flex: 1, gap: space.xxs }}>
                    <Body numberOfLines={1}>{name}</Body>
                    <Caption>{`Brain Lv. ${m.knowledgeLevel}${prize ? ` · ${prize.toLocaleString('en-US')} XP prize` : ''}`}</Caption>
                  </View>
                  <Body>{`${m.weeklyXp.toLocaleString('en-US')} XP`}</Body>
                </Pressable>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.lg },
  divided: { borderTopWidth: 1, borderTopColor: color.border },
});
