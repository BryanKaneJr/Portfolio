import { LEAGUE, ordinal, type FeedReaction } from '@brainscroll/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, LeagueBanner, MomentCard } from '@/components/social';
import { Body, Button, Caption, Card, DrScrollSays, IconButton, LoadError, OfflineState, Row, Screen, ScreenHeader, SkeletonCard, Title } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { useSocial } from '@/progress/useSocial';
import { color, space } from '@/theme/tokens';

/**
 * Social (owner, 2026-10-01): your league as a banner on top (tap for the
 * standings), this week's XP against your friends, then the feed of moments
 * from friends and league mates, with Dr. Scroll reactions.
 */
export default function SocialScreen() {
  const p = useProgress();
  const { view, league, feed, failed, reload, setFeed } = useSocial();
  if (p.offline) return <OfflineState onRetry={() => void p.reconnect()} retrying={p.reconnecting} />;

  const openPerson = (id: string) => router.push({ pathname: '/person/[id]', params: { id } });
  const react = (ownerId: string, key: string, reaction: FeedReaction | null) => {
    // Show it at once; the server agrees or the next load corrects it.
    setFeed((items) =>
      items?.map((i) => {
        if (i.owner.id !== ownerId || i.key !== key) return i;
        const reactions = { ...i.reactions };
        if (i.mine) reactions[i.mine] = Math.max(0, (reactions[i.mine] ?? 1) - 1);
        if (reaction) reactions[reaction] = (reactions[reaction] ?? 0) + 1;
        const { mine: _old, ...rest } = i;
        return { ...rest, reactions, ...(reaction ? { mine: reaction } : {}) };
      }) ?? null,
    );
    p.social.react(ownerId, key, reaction).catch(() => void reload());
  };

  // You and your friends, by this week's XP.
  const me = league?.members.find((m) => m.you);
  const circle = view && me ? [...view.friends, { ...me, username: view.me.username }].sort((a, b) => b.weeklyXp - a.weeklyXp) : [];
  const last = league?.lastWeek;

  return (
    <Screen>
      <ScreenHeader eyebrow="Friends and league" title="Social" right={<IconButton label="Add friends" icon="addFriend" onPress={() => router.push('/add-friends')} />} />
      {failed && !league ? (
        <LoadError onRetry={() => void reload()} />
      ) : !league || !view || !feed ? (
        <>
          <SkeletonCard art={56} lines={2} />
          <SkeletonCard lines={3} />
        </>
      ) : (
        <>
          {last?.place && last.place <= LEAGUE.PRIZES.length && last.xp ? (
            <Card variant="mastery" accessibilityLabel={`Last week you finished ${ordinal(last.place)} in your league: plus ${last.xp} XP`}>
              <Title>{`Last week: ${ordinal(last.place)} in your league!`}</Title>
              <Caption>{`+${last.xp.toLocaleString('en-US')} XP, added to your total.`}</Caption>
            </Card>
          ) : null}
          <LeagueBanner league={league} onPress={() => router.push('/league')} />

          {view.incoming.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Title>Friend requests</Title>
              {view.incoming.map((r) => (
                <Card key={r.id} variant="raised">
                  <Row gap={space.md}>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Open @${r.username}'s profile`} onPress={() => openPerson(r.id)} style={{ flex: 1 }}>
                      <Row gap={space.md}>
                        <Avatar username={r.username} />
                        <View style={{ flex: 1 }}>
                          <Body numberOfLines={1}>{`@${r.username}`}</Body>
                          <Caption>{`Brain Lv. ${r.knowledgeLevel}`}</Caption>
                        </View>
                      </Row>
                    </Pressable>
                    <Button compact label="Accept" onPress={() => void p.social.respondFriendRequest(r.id, true).then(reload)} />
                    <Button compact variant="secondary" label="Not now" onPress={() => void p.social.respondFriendRequest(r.id, false).then(reload)} />
                  </Row>
                </Card>
              ))}
            </View>
          )}

          {view.friends.length === 0 ? (
            <Card variant="plain" style={{ gap: space.md }}>
              <DrScrollSays spot="social.empty" lines={['Learning is better with company. Bring a friend and see who learns more this week.']} />
              <Button label="Add friends" onPress={() => router.push('/add-friends')} />
            </Card>
          ) : (
            <View style={{ gap: space.sm }}>
              <Title>This week with friends</Title>
              <Card variant="plain" style={{ paddingVertical: space.xs, paddingHorizontal: 0, gap: 0 }}>
                {circle.map((f, i) => {
                  const you = f.id === me?.id;
                  return (
                    <Pressable
                      key={f.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${ordinal(i + 1)}: ${you ? 'you' : `@${f.username}`}, ${f.weeklyXp} XP this week`}
                      onPress={() => openPerson(f.id)}
                      style={({ pressed }) => [styles.row, i > 0 && styles.divided, you && { backgroundColor: color.brandSoft }, pressed && { opacity: 0.8 }]}>
                      <Caption style={{ width: 28 }}>{ordinal(i + 1)}</Caption>
                      <Avatar username={f.username} size={32} />
                      <Body style={{ flex: 1 }} numberOfLines={1}>
                        {you ? 'You' : `@${f.username}`}
                      </Body>
                      <Body>{`${f.weeklyXp.toLocaleString('en-US')} XP`}</Body>
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          )}

          <View style={{ gap: space.sm }}>
            <Title>Feed</Title>
            {feed.length === 0 ? (
              <Caption>Nothing yet. Trophies, finished chapters and streaks from you, your friends and your league show up here.</Caption>
            ) : (
              feed.map((item) => <MomentCard key={`${item.owner.id}|${item.key}`} item={item} onOpen={() => openPerson(item.owner.id)} onReact={(r) => react(item.owner.id, item.key, r)} />)
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.lg },
  divided: { borderTopWidth: 1, borderTopColor: color.border },
});
