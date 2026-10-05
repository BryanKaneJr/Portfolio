import { leagueName, leaguePrize, ordinal, type LeagueView } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { StyledName } from '@/components/cosmetics';
import { Avatar, LEAGUE_OF_ONE, leagueDaysLeft, leagueMemberName } from '@/components/social';
import { Body, Caption, Card, Eyebrow, IconButton, LoadError, Row, Screen, SkeletonCard, Title } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { color, space, type } from '@/theme/tokens';

/**
 * The league's standings this week (owner, 2026-10-01): up to 20 learners at
 * about your brain level, ranked by XP earned since Monday. The top 3 win
 * 1,000 / 500 / 250 XP when the week ends, by the server's rule (core
 * leaguePrize): only with XP that week, and only with someone behind them.
 * Someone blocked either way is a "Hidden learner": a place and XP, no name.
 * Prize places are violet, not gold (gold means mastery).
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
  if (failed && !league) return <LoadError layout="screen" onRetry={load} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
  return (
    <Screen header={header}>
      {!league ? (
        <SkeletonCard lines={6} />
      ) : (
        <>
          {league.members.length <= 1 && <Body>{LEAGUE_OF_ONE}</Body>}
          {/* No rules paragraph (owner, 2026-10-04): the standings explain themselves. */}
          <Card variant="plain" style={{ paddingVertical: space.xs, paddingHorizontal: 0, gap: 0 }}>
            {league.members.map((m, i) => {
              const place = i + 1;
              // What this place would win if the week ended now: the server's rule, with their real XP.
              const prize = leaguePrize(place, league.members.length, m.weeklyXp);
              const name = leagueMemberName(m);
              const detail = [m.blocked ? null : `Brain Lv. ${m.knowledgeLevel}`, prize ? `${prize.toLocaleString('en-US')} XP prize` : null].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={m.id}
                  disabled={m.blocked}
                  accessibilityRole="button"
                  accessibilityLabel={`${ordinal(place)}: ${name}${m.blocked ? '' : `, brain level ${m.knowledgeLevel}`}, ${m.weeklyXp} XP this week${prize ? `, in line for ${prize} XP` : ''}`}
                  onPress={() => router.push({ pathname: '/person/[id]', params: { id: m.id } })}
                  style={({ pressed }) => [styles.row, i > 0 && styles.divided, m.you && { backgroundColor: color.brandSoft }, pressed && { opacity: 0.8 }]}>
                  <Body style={{ width: 36, ...(prize ? { color: color.brandText, fontWeight: '800' } : null) }}>{ordinal(place)}</Body>
                  <Avatar username={m.blocked ? '?' : m.username} avatar={m.blocked ? undefined : m.avatar} ring={m.blocked ? null : m.ring} size={36} />
                  <View style={{ flex: 1, gap: space.xxs }}>
                    <StyledName nameStyle={m.blocked ? null : m.nameStyle} style={[type.body, { color: color.text }]}>{name}</StyledName>
                    {detail ? <Caption>{detail}</Caption> : null}
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
