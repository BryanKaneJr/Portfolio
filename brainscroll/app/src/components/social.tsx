import { DR_SCROLL_FRIEND, ordinal, theTier, trophyInfo, WORLD_BOARD, type FeedItem, type DrScrollPost, type FeedReaction, type LeagueView, type WorldBoardView } from '@brainscroll/core';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AvatarGlow } from '@/components/cosmetics';
import { TrophyBadge } from '@/components/TrophyBadge';
import { AVATAR_ART, Caption, Card, DrScroll, Icon, Row } from '@/components/ui';
import { getSkill, trophyCatalog } from '@/content';
import { usePop } from '@/components/ui/motion';
import { color, iconSize, space, type } from '@/theme/tokens';

/**
 * Social building blocks (owner, 2026-10-01): avatars, the world leaderboard card and
 * the feed's moments with their hearts. There are no photos:
 * a learner wears an avatar from the set (a starter at random from sign-up).
 */

/**
 * The link that opens BrainScroll on someone's invite (app/src/app/invite/[code].tsx).
 * With an invite domain it's a web link: it opens the app when it's installed,
 * and otherwise a page with the store links and the code (docs/invite-links.md).
 */
const INVITE_DOMAIN = process.env.EXPO_PUBLIC_INVITE_DOMAIN || undefined;
export const inviteLink = (code: string) => (INVITE_DOMAIN ? `https://${INVITE_DOMAIN}/invite/${code}` : `brainscroll://invite/${code}`);

const hash = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

/** The starter set: every tree's avatar (not gold, not legendary). */
const STARTERS = Object.keys(AVATAR_ART).filter((id) => /^avatar\.[a-z_]+$/.test(id));

/**
 * A learner's avatar (AVATAR_ART). Everyone wears one from sign-up (owner,
 * 2026-10-01: no letter avatars); if one is ever missing, a starter is picked
 * from the username. The art is its own circle and is never wrapped: what a
 * map chest adds is a glow behind it (owner, 2026-10-05), spilling past its edge.
 */
export function Avatar({ username, avatar, size = 40, ring }: { username: string; avatar?: string; size?: number; ring?: string | null }) {
  const art = (avatar ? AVATAR_ART[avatar] : undefined) ?? AVATAR_ART[STARTERS[hash(username) % STARTERS.length]!];
  const face = (s: number) => art && <Image source={art} style={{ width: s, height: s }} resizeMode="contain" accessibilityIgnoresInvertColors />;
  return (
    <View accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      {ring ? <AvatarGlow ring={ring} size={size}>{face(size)}</AvatarGlow> : face(size)}
    </View>
  );
}

/** "3 days left", "Ends today": the same calm count as the quest tile. */
export function leagueDaysLeft(endsAt: string, now = Date.now()): string {
  const days = Math.ceil((Date.parse(endsAt) - now) / 86_400_000);
  return days <= 1 ? 'Ends today' : `${days} days left`;
}

/** What a league of one says, here and on the standings (no place, no prize). */
export const LEAGUE_OF_ONE = 'Your league fills up as learners join this week.';

/** How a league row is named: you, a hidden learner (blocked either way), or their username. */
export const leagueMemberName = (m: LeagueView['members'][number]) => (m.you ? 'You' : m.blocked ? 'Hidden learner' : `@${m.username}`);

/**
 * The world leaderboard on Social, kept small (owner, 2026-10-09: "a clean
 * display and small"): the top 3's avatars, your place by total XP of all
 * time, and a tap opens the top 50 (app/src/app/leaderboard.tsx).
 */
export function WorldBoardCard({ board, onPress }: { board: WorldBoardView; onPress: () => void }) {
  const place = board.you.place;
  const of = board.ranked.toLocaleString('en-US');
  return (
    <Card
      variant="raised"
      onPress={onPress}
      accessibilityLabel={`World leaderboard: ${place ? `you're ${ordinal(place)} of ${of} by total XP` : 'no place yet. Earn XP to get one'}. Open the top ${WORLD_BOARD.TOP}`}>
      <Row gap={space.md}>
        <View style={{ flexDirection: 'row' }}>
          {board.rows.slice(0, WORLD_BOARD.PREVIEW).map((r, i) => (
            <View key={r.id} style={{ marginLeft: i > 0 ? -space.sm : 0, zIndex: WORLD_BOARD.PREVIEW - i }}>
              <Avatar username={r.username} avatar={r.avatar} size={32} />
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text style={[type.bodyStrong, { color: color.text }]}>World leaderboard</Text>
          <Caption>{place ? `All time · ${of} learners` : 'Earn XP to get a place'}</Caption>
        </View>
        {place ? <Text style={[type.h2, { color: color.text }]}>{`#${place.toLocaleString('en-US')}`}</Text> : null}
        <Icon name="forward" tint={color.textMuted} size={iconSize.sm} />
      </Row>
    </Card>
  );
}

/** A trophy moment's name, shown in bold gold so it reads as a trophy (owner, 2026-10-03). */
function trophyName(item: FeedItem): string | undefined {
  return item.kind === 'trophy' ? (trophyInfo(item.data.trophyId ?? '', trophyCatalog)?.name ?? item.data.name) : undefined;
}

/** One line for a moment ("finished Chapter 3 of Astronomy", "earned the First Level trophy"). */
export function momentLine(item: FeedItem): string {
  switch (item.kind) {
    case 'trophy': {
      const name = trophyName(item);
      return name ? `earned the ${name} trophy` : 'earned a trophy';
    }
    case 'chapter':
      return `finished Chapter ${item.data.chapter} of ${getSkill(item.data.skillId ?? '')?.name ?? 'a skill'}`;
    case 'streak':
      return `hit a ${item.data.days}-day streak`;
    case 'league':
      return `finished ${ordinal(item.data.place ?? 1)} in ${item.owner.you ? 'your' : 'their'} league${item.data.xp ? ` (+${item.data.xp.toLocaleString('en-US')} XP)` : ''}`;
    case 'tier':
      return `moved up to ${theTier(item.data.tier ?? 1)}`;
  }
}

function timeAgo(at: string, now = Date.now()): string {
  const m = Math.max(1, Math.round((now - Date.parse(at)) / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
}

/**
 * Dr. Scroll's own moment in the feed (core DR_SCROLL_POSTS): his gold
 * avatar, what he's up to, and the pose to match. No reactions (he isn't an
 * account); tapping it opens his profile, which is how learners find him
 * once his pinned card has gone.
 */
export function DrScrollPostCard({ post, onOpen }: { post: DrScrollPost; onOpen: () => void }) {
  return (
    <Card variant="plain" onPress={onOpen} accessibilityLabel={`${DR_SCROLL_FRIEND.name} ${post.line} ${timeAgo(post.at)} ago. Open his profile`}>
      <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
        <Avatar username="dr-scroll" avatar={DR_SCROLL_FRIEND.avatar} />
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text style={[type.body, { color: color.text }]}>
            <Text style={{ fontWeight: '800' }}>{DR_SCROLL_FRIEND.name}</Text> {post.line}
          </Text>
          <Caption>
            {`${timeAgo(post.at)} ago · `}
            <Caption style={{ color: color.mastery }}>Official</Caption>
          </Caption>
        </View>
        <DrScroll spot="social.dr-scroll-post" pose={post.pose} size={64} />
      </Row>
    </Card>
  );
}

/**
 * A moment in the feed: who, what, when, and a heart: on other people's
 * moments you can like it; on yours it shows how many have.
 */
export function MomentCard({ item, onOpen, onReact }: { item: FeedItem; onOpen: () => void; onReact: (reaction: FeedReaction | null) => void }) {
  const who = item.owner.you ? 'You' : `@${item.owner.username}`;
  const line = momentLine(item);
  // Every reaction counts as a heart (older Dr. Scroll reactions included).
  const hearts = Object.values(item.reactions).reduce<number>((n, c) => n + (c ?? 0), 0);
  const liked = item.mine !== undefined && item.mine !== null;
  return (
    <Card variant="plain" style={{ gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${who} ${line}, ${timeAgo(item.at)} ago. Open their profile`} onPress={onOpen}>
        <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
          <Avatar username={item.owner.username} avatar={item.owner.avatar} ring={item.owner.ring} />
          <View style={{ flex: 1, gap: space.xxs }}>
            <Text style={[type.body, { color: color.text }]}>
              <Text style={{ fontWeight: '800' }}>{who}</Text>{' '}
              {trophyName(item) ? (
                <>
                  earned the <Text style={styles.trophyName}>{trophyName(item)}</Text> trophy
                </>
              ) : (
                line
              )}
            </Text>
            <Caption>{`${timeAgo(item.at)} ago${item.owner.you ? '' : item.owner.friend ? ' · Friend' : ' · League'}`}</Caption>
          </View>
          {item.kind === 'trophy' && item.data.trophyId ? (
            <View style={{ width: 44 }}>
              <TrophyBadge trophyId={item.data.trophyId} name="" size={40} />
            </View>
          ) : null}
        </Row>
      </Pressable>
      {(hearts > 0 || !item.owner.you) && (
        <HeartButton liked={liked} count={hearts} onPress={item.owner.you ? undefined : () => onReact(liked ? null : 'heart')} />
      )}
    </Card>
  );
}

/**
 * A heart: an outline, filled when you've liked it (tap again to take it
 * back), with the count beside it. On your own moments it only shows the count.
 */
function HeartButton({ liked, count, onPress }: { liked: boolean; count: number; onPress?: () => void }) {
  const pop = usePop(liked ? 'liked' : null, { from: 0.6 });
  const label = onPress ? `${liked ? 'Liked' : 'Like'}${count ? `, ${count} ${count === 1 ? 'like' : 'likes'}` : ''}` : `${count} ${count === 1 ? 'like' : 'likes'}`;
  const heart = (
    <Row gap={space.xxs} style={styles.heart}>
      <Animated.View style={pop}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path d={HEART} fill={liked ? color.heart : 'none'} stroke={liked ? color.heart : color.textMuted} strokeWidth={2} strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      {count > 0 && <Caption style={liked ? { color: color.heart, fontWeight: '800' } : undefined}>{String(count)}</Caption>}
    </Row>
  );
  if (!onPress)
    return (
      <View accessible accessibilityLabel={label} style={{ alignSelf: 'flex-start' }}>
        {heart}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: liked }}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [{ alignSelf: 'flex-start' }, pressed && { transform: [{ scale: 0.92 }] }]}>
      {heart}
    </Pressable>
  );
}

/** Material's heart, drawn so it can be an outline or filled on every platform. */
const HEART = 'M12 20.6l-1.3-1.2C6 15.2 3 12.4 3 9a4.5 4.5 0 0 1 4.5-4.5c1.7 0 3.4.8 4.5 2.1a6 6 0 0 1 4.5-2.1A4.5 4.5 0 0 1 21 9c0 3.4-3 6.2-7.7 10.4L12 20.6z';

const styles = StyleSheet.create({
  trophyName: { color: color.mastery, fontWeight: '800' },
  heart: { alignItems: 'center', paddingVertical: space.xxs },
});
