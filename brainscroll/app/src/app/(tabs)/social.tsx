import { DR_SCROLL_FRIEND, drScrollPosts, friendLeaderboard, LEAGUE, ordinal, theTier, type FeedReaction } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { TierEmblem } from '@/components/LeagueTier';
import { StyledName } from '@/components/cosmetics';
import { Avatar, DrScrollPostCard, LeagueBanner, MomentCard } from '@/components/social';
import { Body, Button, Caption, Card, DrScrollSays, Icon, IconButton, LoadError, Notice, OfflineState, Row, Screen, ScreenHeader, SkeletonCard, Title } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { load, save } from '@/progress/storage';
import { useSocial } from '@/progress/useSocial';
import { color, iconSize, space, type } from '@/theme/tokens';

/**
 * Social (owner, 2026-10-01): your league as a banner on top (tap for the
 * standings), this week's XP against your friends, then the feed of moments
 * from friends and league mates, with hearts.
 */
export default function SocialScreen() {
  const p = useProgress();
  const { view, league, feed, failed, reload, setFeed } = useSocial();
  const userId = p.account?.status === 'signed_in' ? p.account.userId : undefined;
  const [met, meet] = useMetDrScroll(userId);
  // Last week's note (moved up, a podium, or a new league) shows until it's tapped once (owner, 2026-10-08).
  const [lastSeen, seeLast] = useSeen(userId, LAST_WEEK_KEY, league?.lastWeek?.weekStart);
  // A friend request being answered, and what went wrong if it didn't go through (the card stays).
  const [answering, setAnswering] = useState<{ id: string; accept: boolean } | null>(null);
  const [requestError, setRequestError] = useState<{ id: string; text: string } | null>(null);
  // His daily moments, slotted into the feed by time.
  const moments = useMemo(() => {
    const posts = drScrollPosts(new Date()).map((post) => ({ at: post.at, post }));
    const items = (feed ?? []).map((item) => ({ at: item.at, item }));
    return [...items, ...posts].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [feed]);
  if (p.offline) return <OfflineState onRetry={() => void p.reconnect()} retrying={p.reconnecting} />;

  const openPerson = (id: string) => router.push({ pathname: '/person/[id]', params: { id } });
  const answer = async (fromId: string, accept: boolean) => {
    setAnswering({ id: fromId, accept });
    setRequestError(null);
    try {
      await p.social.respondFriendRequest(fromId, accept);
      await reload();
    } catch {
      setRequestError({ id: fromId, text: accept ? 'Couldn’t accept that. Check your connection and try again.' : 'Couldn’t answer that. Check your connection and try again.' });
    } finally {
      setAnswering(null);
    }
  };
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
  const last = lastSeen === false ? league?.lastWeek : undefined;

  return (
    <Screen>
      <ScreenHeader
        eyebrow="Friends and league"
        title="Social"
        right={
          <Row gap={space.sm}>
            {view && (
              <Pressable accessibilityRole="button" accessibilityLabel="Edit your profile" onPress={() => router.push('/edit-profile')} hitSlop={6}>
                <Avatar username={view.me.username} avatar={view.me.avatar} ring={p.snapshot.locker.look.ring} size={40} />
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
          <LeagueBanner league={league} onPress={() => router.push('/league')} />

          {view.incoming.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Title>Friend requests</Title>
              {view.incoming.map((r) => (
                <Card key={r.id} variant="raised" style={{ gap: space.md }}>
                  {/* Name on its own line, buttons below, so a long username never squeezes. */}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open @${r.username}'s profile`} onPress={() => openPerson(r.id)}>
                    <Row gap={space.md}>
                      <Avatar username={r.username} avatar={r.avatar} ring={r.ring} size={48} />
                      <View style={{ flex: 1 }}>
                        <StyledName nameStyle={r.nameStyle} style={[type.body, { color: color.text }]}>{`@${r.username}`}</StyledName>
                        <Caption>{`Brain Lv. ${r.knowledgeLevel}`}</Caption>
                      </View>
                    </Row>
                  </Pressable>
                  <Row gap={space.sm}>
                    <View style={{ flex: 1 }}>
                      <Button compact label="Accept" loading={answering?.id === r.id && answering.accept} disabled={!!answering && answering.id !== r.id} onPress={() => void answer(r.id, true)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button compact variant="secondary" label="Not now" loading={answering?.id === r.id && !answering.accept} disabled={!!answering && answering.id !== r.id} onPress={() => void answer(r.id, false)} />
                    </View>
                  </Row>
                  {requestError?.id === r.id && <Notice>{requestError.text}</Notice>}
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
              <Title>Friend leaderboard</Title>
              <Card variant="plain" style={{ paddingVertical: space.xs, paddingHorizontal: 0, gap: 0 }}>
                {/* This week's top 5, or the top 4 and then you at your place (owner, 2026-10-09). */}
                {friendLeaderboard(circle, me?.id).map(({ row: f, place }, i) => {
                  const you = f.id === me?.id;
                  return (
                    <Pressable
                      key={f.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${ordinal(place)}: ${you ? 'you' : `@${f.username}`}, ${f.weeklyXp} XP this week`}
                      onPress={() => openPerson(f.id)}
                      style={({ pressed }) => [styles.row, i > 0 && styles.divided, you && { backgroundColor: color.brandSoft }, pressed && { opacity: 0.8 }]}>
                      <Caption style={{ width: 36 }}>{ordinal(place)}</Caption>
                      <Avatar username={f.username} avatar={f.avatar} ring={f.ring} size={32} />
                      <View style={{ flex: 1 }}>
                        <StyledName nameStyle={f.nameStyle} style={[type.body, { color: color.text }]}>{you ? 'You' : `@${f.username}`}</StyledName>
                      </View>
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
    load<string>(key).then(
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
