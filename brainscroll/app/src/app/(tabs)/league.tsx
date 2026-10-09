import { LEAGUE, leagueMove, leaguePrize, movedTier, ordinal, theTier, tierGem, tierName, type LeagueView, type QuestView, type WorldBoardView } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { StyledName } from '@/components/cosmetics';
import { TierEmblem } from '@/components/LeagueTier';
import { Avatar, LEAGUE_OF_ONE, leagueDaysLeft, leagueMemberName, WorldBoardCard } from '@/components/social';
import { Body, Button, Caption, Card, Icon, LevelArt, LoadError, OfflineState, ProgressBar, Row, Screen, ScreenHeader, SkeletonCard, Title } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { load as loadSaved, save } from '@/progress/storage';
import { featuredQuest, isPast, questDef, questStatusLine, questTotals, useQuests } from '@/progress/useQuests';
import { color, iconSize, space, type } from '@/theme/tokens';

/**
 * Leagues (owner, 2026-10-09: "moving leagues and quests to their own tab"):
 * your week in one place. Last week's note, then the standings: up to 20
 * learners in your tier (owner, 2026-10-08), ranked by XP earned since Monday.
 * The top 3 win 1,000 / 500 / 250 XP when the week ends, by the server's rule
 * (core leaguePrize): only with XP that week, and only with someone behind
 * them. Each row says if the week would move them up or down a tier if it
 * ended now (core leagueMove; never past the first or last tier). Someone
 * blocked either way is a "Hidden learner": a place and XP, no name. Prize
 * places are violet, not gold (gold means mastery); moving down is a quiet
 * grey. Under them, this week's quest and the world leaderboard.
 */
export default function LeaguesScreen() {
  const p = useProgress();
  const { social } = p;
  const [league, setLeague] = useState<LeagueView | null>(null);
  const [board, setBoard] = useState<WorldBoardView | null>(null);
  const [failed, setFailed] = useState(false);
  const quests = useQuests().data;
  const quest = featuredQuest(quests);
  const userId = p.account?.status === 'signed_in' ? p.account.userId : undefined;
  const signedIn = !!userId && !p.offline;
  const load = useCallback(async () => {
    try {
      // The league first: joining gives you a username, and it pays last week's prize.
      const l = await social.league();
      setLeague(l);
      setFailed(false);
      social.worldBoard().then(setBoard, () => {});
    } catch {
      setFailed(true);
    }
  }, [social]);
  // Again after progress changes: a cleared level moves your league XP.
  useFocusEffect(
    useCallback(() => {
      if (signedIn) void load();
    }, [signedIn, load, p.snapshot]), // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Last week's note (moved up, a podium, or a new league) shows until it's tapped once (owner, 2026-10-08).
  const [lastSeen, seeLast] = useSeen(userId, LAST_WEEK_KEY, league?.lastWeek?.weekStart);

  if (p.offline) return <OfflineState onRetry={() => void p.reconnect()} retrying={p.reconnecting} />;
  const last = lastSeen === false ? league?.lastWeek : undefined;
  return (
    <Screen>
      <ScreenHeader
        eyebrow={league ? leagueDaysLeft(league.endsAt) : 'This week'}
        title={league ? tierName(league.tier) : 'Leagues'}
        right={league ? <TierEmblem tier={league.tier} size={44} /> : undefined}
      />
      {failed && !league ? (
        <LoadError onRetry={() => void load()} />
      ) : !league ? (
        <SkeletonCard lines={6} />
      ) : (
        <>
          {last?.moved === 1 && last.tier ? (
            // Moving up a tier is the week's headline (owner, 2026-10-08), with any prize under it.
            <Card variant="reward" onPress={seeLast} accessibilityLabel={`You moved up to ${theTier(last.tier)}${last.xp ? `, and won ${last.xp} XP` : ''}. Tap to close`}>
              <Row gap={space.md}>
                <TierEmblem tier={last.tier} size={44} />
                <View style={{ flex: 1, gap: space.xxs }}>
                  <Title>{`Welcome to ${theTier(last.tier)}!`}</Title>
                  <Caption>{last.place && last.xp ? `${ordinal(last.place)} last week: +${last.xp.toLocaleString('en-US')} XP, added to your total.` : 'You moved up a league last week.'}</Caption>
                </View>
              </Row>
            </Card>
          ) : last?.place && last.place <= LEAGUE.PRIZES.length && last.xp ? (
            <Card variant="reward" onPress={seeLast} accessibilityLabel={`Last week you finished ${ordinal(last.place)} in your league: plus ${last.xp} XP. Tap to close`}>
              <Title>{`Last week: ${ordinal(last.place)} in your league!`}</Title>
              <Caption>{`+${last.xp.toLocaleString('en-US')} XP, added to your total.`}</Caption>
            </Card>
          ) : last?.moved === -1 && last.tier ? (
            // Moving down is said plainly, never as a loss.
            <Card variant="plain" onPress={seeLast} accessibilityLabel={`A new week: this week you're in ${theTier(last.tier)}. Tap to close`}>
              <Caption>{`A new week: this week you’re in ${theTier(last.tier)}.`}</Caption>
            </Card>
          ) : null}

          {league.members.length <= 1 && <Body>{LEAGUE_OF_ONE}</Body>}
          {/* No rules paragraph (owner, 2026-10-04): the standings explain themselves. */}
          <Card variant="plain" style={{ paddingVertical: space.xs, paddingHorizontal: 0, gap: 0 }}>
            {league.members.map((m, i) => {
              const place = i + 1;
              // What this place would win if the week ended now: the server's rule, with their real XP.
              const prize = leaguePrize(place, league.members.length, m.weeklyXp);
              // Where the week would move them if it ended now, from their own tier (a safety-net joiner may differ).
              const tier = m.leagueTier ?? league.tier;
              const move = movedTier(tier, leagueMove(place, league.members.length, m.weeklyXp)) - tier;
              const name = leagueMemberName(m);
              const detail = [m.blocked ? null : `Brain Lv. ${m.knowledgeLevel}`, prize ? `${prize.toLocaleString('en-US')} XP prize` : null].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={m.id}
                  disabled={m.blocked}
                  accessibilityRole="button"
                  accessibilityLabel={`${ordinal(place)}: ${name}${m.blocked ? '' : `, brain level ${m.knowledgeLevel}`}, ${m.weeklyXp} XP this week${prize ? `, in line for ${prize} XP` : ''}${move > 0 ? ', moving up' : move < 0 ? ', moving down' : ''}`}
                  onPress={() => router.push({ pathname: '/person/[id]', params: { id: m.id } })}
                  style={({ pressed }) => [styles.row, i > 0 && styles.divided, m.you && { backgroundColor: color.brandSoft }, pressed && { opacity: 0.8 }]}>
                  <Body style={{ width: 36, ...(prize ? { color: color.brandText, fontWeight: '800' } : null) }}>{ordinal(place)}</Body>
                  <Avatar username={m.blocked ? '?' : m.username} avatar={m.blocked ? undefined : m.avatar} ring={m.blocked ? null : m.ring} size={36} />
                  <View style={{ flex: 1, gap: space.xxs }}>
                    <StyledName nameStyle={m.blocked ? null : m.nameStyle} style={[type.body, { color: color.text }]}>{name}</StyledName>
                    {detail ? <Caption>{detail}</Caption> : null}
                    {move > 0 ? <Caption style={{ color: color.success, fontWeight: '800' }}>{`▲ Up to ${tierGem(tier + 1)}`}</Caption> : null}
                    {move < 0 ? <Caption style={{ color: color.textMuted }}>{`▼ Down to ${tierGem(tier - 1)}`}</Caption> : null}
                  </View>
                  <Body>{`${m.weeklyXp.toLocaleString('en-US')} XP`}</Body>
                </Pressable>
              );
            })}
          </Card>

          {quest && (
            <View style={{ gap: space.sm }}>
              <Title>{isPast(quest) ? 'Your Archive quest' : 'This week’s quest'}</Title>
              <QuestCard quest={quest} />
            </View>
          )}
          {board && <WorldBoardCard board={board} onPress={() => router.push('/leaderboard')} />}
          {quests?.quests.some(isPast) && <Button variant="secondary" label="See the Archive" onPress={() => router.push('/quests')} />}
        </>
      )}
    </Screen>
  );
}

/** The week's quest in one row: its art, how it stands and how far along it is. Tapping opens it. */
function QuestCard({ quest }: { quest: QuestView }) {
  const def = questDef(quest.id);
  if (!def) return null;
  const { done, required } = questTotals(quest);
  const status = questStatusLine(quest);
  return (
    <Card variant="raised" accessibilityLabel={`${def.title}: ${status} ${done} of ${required} levels. Open the quest`} onPress={() => router.push({ pathname: '/quest/[id]', params: { id: quest.id } })}>
      <Row gap={space.md}>
        <LevelArt art={def.art} size={56} />
        <View style={{ flex: 1, gap: space.xxs }}>
          <Body style={{ fontWeight: '800' }}>{def.title}</Body>
          <Caption>{status}</Caption>
          <ProgressBar value={required ? done / required : 0} size="sm" label={`${done} of ${required} levels`} />
        </View>
        <Icon name="forward" tint={color.textMuted} size={iconSize.sm} />
      </Row>
    </Card>
  );
}

/**
 * Whether this account has tapped away `value` (here, last week's note, by
 * its week) on this device. Undefined while it loads, so nothing flashes.
 */
function useSeen(userId: string | undefined, name: string, value: string | undefined): [boolean | undefined, () => void] {
  const [seen, setSeen] = useState<string | null | undefined>(undefined);
  const key = userId ? `${name}:${userId}` : undefined;
  useEffect(() => {
    if (!key) return;
    let live = true;
    loadSaved<string>(key).then(
      (v) => live && setSeen(v ?? null),
      () => live && setSeen(null),
    );
    return () => {
      live = false;
    };
  }, [key]);
  const see = () => {
    if (!value) return;
    setSeen(value);
    if (key) void save(key, value);
  };
  return [seen === undefined ? undefined : seen === value, see];
}
const LAST_WEEK_KEY = 'bs.league.last-week-seen';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.lg },
  divided: { borderTopWidth: 1, borderTopColor: color.border },
});
