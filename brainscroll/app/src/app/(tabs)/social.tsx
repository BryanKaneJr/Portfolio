import { DR_SCROLL_FRIEND, drScrollPosts, LEAGUE, ordinal, type FeedReaction } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, DrScrollPostCard, LeagueBanner, MomentCard } from '@/components/social';
import { Body, Button, Caption, Card, DrScrollSays, Icon, IconButton, LoadError, OfflineState, Row, Screen, ScreenHeader, SkeletonCard, Title } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { load, save } from '@/progress/storage';
import { useSocial } from '@/progress/useSocial';
import { color, iconSize, space } from '@/theme/tokens';

/**
 * Social (owner, 2026-10-01): your league as a banner on top (tap for the
 * standings), this week's XP against your friends, then the feed of moments
 * from friends and league mates, with Dr. Scroll reactions.
 */
export default function SocialScreen() {
  const p = useProgress();
  const { view, league, feed, failed, reload, setFeed } = useSocial();
  const userId = p.account?.status === 'signed_in' ? p.account.userId : undefined;
  const [met, meet] = useMetDrScroll(userId);
  // His daily moments, slotted into the feed by time.
  const moments = useMemo(() => {
    const posts = drScrollPosts(new Date()).map((post) => ({ at: post.at, post }));
    const items = (feed ?? []).map((item) => ({ at: item.at, item }));
    return [...items, ...posts].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [feed]);
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
  const circle = view && me ? [...view.friends, { ...me, username: view.me.username, avatar: view.me.avatar }].sort((a, b) => b.weeklyXp - a.weeklyXp) : [];
  const last = league?.lastWeek;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Friends and league"
        title="Social"
        right={
          <Row gap={space.sm}>
            {view && (
              <Pressable accessibilityRole="button" accessibilityLabel="Edit your profile" onPress={() => router.push('/edit-profile')} hitSlop={6}>
                <Avatar username={view.me.username} avatar={view.me.avatar} size={40} />
              </Pressable>
            )}
            <IconButton label="Add friends" icon="addFriend" onPress={() => router.push('/add-friends')} />
          </Row>
        }
      />
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
                <Card key={r.id} variant="raised" style={{ gap: space.md }}>
                  {/* Name on its own line, buttons below, so a long username never squeezes. */}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open @${r.username}'s profile`} onPress={() => openPerson(r.id)}>
                    <Row gap={space.md}>
                      <Avatar username={r.username} avatar={r.avatar} size={48} />
                      <View style={{ flex: 1 }}>
                        <Body numberOfLines={1}>{`@${r.username}`}</Body>
                        <Caption>{`Brain Lv. ${r.knowledgeLevel}`}</Caption>
                      </View>
                    </Row>
                  </Pressable>
                  <Row gap={space.sm}>
                    <View style={{ flex: 1 }}>
                      <Button compact label="Accept" onPress={() => void p.social.respondFriendRequest(r.id, true).then(reload)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button compact variant="secondary" label="Not now" onPress={() => void p.social.respondFriendRequest(r.id, false).then(reload)} />
                    </View>
                  </Row>
                </Card>
              ))}
            </View>
          )}

          {/* Everyone's first friend (owner, 2026-10-03): pinned until it's been
              tapped once; after that he turns up in the feed instead. */}
          {met === false && (
            <Card
              variant="mastery"
              onPress={() => {
                meet();
                openPerson(DR_SCROLL_FRIEND.id);
              }}
              accessibilityLabel="Dr. Scroll, your first friend. Open his profile">
              <Row gap={space.md}>
                <Avatar username="dr-scroll" avatar={DR_SCROLL_FRIEND.avatar} size={48} />
                <View style={{ flex: 1 }}>
                  <Body>{DR_SCROLL_FRIEND.name}</Body>
                  <Caption style={{ color: color.mastery }}>Your first friend · Official</Caption>
                </View>
                <Icon name="forward" tint={color.mastery} size={iconSize.sm} />
              </Row>
            </Card>
          )}

          {view.friends.length === 0 ? (
            <Card variant="plain" style={{ gap: space.md }}>
              <DrScrollSays spot="social.empty" animation="wave-point" size="md" lines={['Learning is better with company. Bring a friend and see who learns more this week.']} />
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
                      <Avatar username={f.username} avatar={f.avatar} size={32} />
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
            {feed.length === 0 && <Caption>Trophies, finished chapters and streaks from you, your friends and your league show up here.</Caption>}
            {moments.map((m) =>
              'post' in m ? (
                <DrScrollPostCard key={m.post.key} post={m.post} onOpen={() => openPerson(DR_SCROLL_FRIEND.id)} />
              ) : (
                <MomentCard key={`${m.item.owner.id}|${m.item.key}`} item={m.item} onOpen={() => openPerson(m.item.owner.id)} onReact={(r) => react(m.item.owner.id, m.item.key, r)} />
              ),
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

/**
 * Whether this account has opened Dr. Scroll's pinned card yet (kept on the
 * device, per account). Undefined while it loads, so the card never flashes.
 */
function useMetDrScroll(userId: string | undefined): [boolean | undefined, () => void] {
  const [met, setMet] = useState<boolean | undefined>(undefined);
  const key = userId ? `${MET_KEY}:${userId}` : undefined;
  useEffect(() => {
    if (!key) return;
    let live = true;
    load<boolean>(key).then(
      (v) => live && setMet(!!v),
      () => live && setMet(false),
    );
    return () => {
      live = false;
    };
  }, [key]);
  const meet = () => {
    setMet(true);
    if (key) void save(key, true);
  };
  return [met, meet];
}
const MET_KEY = 'bs.drscroll.met';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.lg },
  divided: { borderTopWidth: 1, borderTopColor: color.border },
});
