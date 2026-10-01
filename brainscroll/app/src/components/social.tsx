import { FEED_REACTIONS, leagueName, LEAGUE, ordinal, trophyInfo, type FeedItem, type FeedReaction, type LeagueView } from '@brainscroll/core';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { TrophyBadge } from '@/components/TrophyBadge';
import { AVATAR_ART, Caption, Card, DrScroll, GradientFill, Icon, OutlinedNumber, Row, UiArt } from '@/components/ui';
import { getSkill, subjects, trophyCatalog } from '@/content';
import { lift, subjectTint } from '@/theme/subjectTheme';
import { color, depth, elevation, iconSize, radius, space, type } from '@/theme/tokens';

/**
 * Social building blocks (owner, 2026-10-01): avatars, the league banner and
 * the feed's moments with their Dr. Scroll reactions. There are no photos:
 * a learner is their username's initial on a colour picked from it.
 */

/** The link that opens BrainScroll on someone's invite (app/src/app/invite/[code].tsx). */
export const inviteLink = (code: string) => `brainscroll://invite/${code}`;

const hash = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

/** A learner's avatar (AVATAR_ART), or their initial on a colour picked from their username. */
export function Avatar({ username, avatar, size = 40 }: { username: string; avatar?: string; size?: number }) {
  const art = avatar ? AVATAR_ART[avatar] : undefined;
  if (art)
    return (
      <View accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
        <Image source={art} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
    );
  const tint = subjectTint(subjects[hash(username) % subjects.length]?.id);
  return (
    <View
      accessible={false}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint.base, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ ...type.title, fontSize: size * 0.45, lineHeight: size * 0.6, color: tint.ink }}>{username.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

/** "3 days left", "Ends today": the same calm count as the quest tile. */
export function leagueDaysLeft(endsAt: string, now = Date.now()): string {
  const days = Math.ceil((Date.parse(endsAt) - now) / 86_400_000);
  return days <= 1 ? 'Ends today' : `${days} days left`;
}

/** Podium ring colours: gold, silver, bronze. Gold here is the league's top prize, earned like mastery. */
const PODIUM = [color.mastery, '#C9D2DC', '#D9925B'] as const;

/**
 * The league as a banner (owner, 2026-10-01: "more fun and premium"): a
 * violet gradient card with your place on a trophy (top 3) or medal, how far
 * the next place is, and the current podium with its prizes. Tap for the
 * standings.
 */
export function LeagueBanner({ league, onPress }: { league: LeagueView; onPress: () => void }) {
  const place = league.members.findIndex((m) => m.you) + 1;
  const me = league.members[place - 1];
  const name = leagueName(league.leagueId);
  const ahead = place > 1 ? league.members[place - 2] : undefined;
  const gap = ahead && me ? ahead.weeklyXp - me.weeklyXp + 1 : 0;
  const podium = league.members.slice(0, 3);
  const chase = place === 1 ? 'You’re leading. Hold on to it!' : ahead ? `${gap.toLocaleString('en-US')} XP to pass ${ahead.you ? 'them' : `@${ahead.username}`}` : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}: you're ${ordinal(place)} of ${league.members.length} with ${me?.weeklyXp ?? 0} XP this week. ${chase}. ${leagueDaysLeft(league.endsAt)}. Open the standings`}
      onPress={onPress}
      style={({ pressed }) => [styles.banner, pressed && { transform: [{ translateY: 2 }], borderBottomWidth: 2 }]}>
      <GradientFill from={lift(color.brand, 0.12)} to={color.brandEdge} rx={radius.lg} />
      <Row gap={space.md}>
        <View style={styles.medalArt}>
          <UiArt name={place <= LEAGUE.PRIZES.length ? 'trophy' : 'medal'} size={76} />
          <View style={styles.placeNumber}>
            <OutlinedNumber value={String(place)} fontSize={place > 9 ? 24 : 28} tone={place <= LEAGUE.PRIZES.length ? 'gold' : 'brand'} />
          </View>
        </View>
        <View style={{ flex: 1, gap: space.xxs }}>
          <Text style={[type.label, { color: lift(color.brandText, 0.4) }]}>{name.toUpperCase()}</Text>
          <Text style={[type.h2, { color: color.onBrand }]}>{`${ordinal(place)} place`}</Text>
          <Text style={[type.caption, { color: lift(color.brandText, 0.55) }]}>{`${(me?.weeklyXp ?? 0).toLocaleString('en-US')} XP this week · ${leagueDaysLeft(league.endsAt)}`}</Text>
          {chase ? <Text style={[type.caption, { color: color.onBrand, fontWeight: '800' }]}>{chase}</Text> : null}
        </View>
        <Icon name="forward" tint={color.onBrand} size={iconSize.md} />
      </Row>
      <View style={styles.podium}>
        {podium.map((m, i) => (
          <View key={m.id} style={styles.podiumSpot}>
            <View style={[styles.podiumRing, { borderColor: PODIUM[i] }]}>
              <Avatar username={m.blocked ? '?' : m.username} avatar={m.blocked ? undefined : m.avatar} size={30} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text numberOfLines={1} style={[type.caption, { color: color.onBrand, fontWeight: '800' }]}>{m.you ? 'You' : `@${m.username}`}</Text>
              <Text style={[type.caption, { color: PODIUM[i], fontSize: 12, lineHeight: 15 }]}>{`+${LEAGUE.PRIZES[i]!.toLocaleString('en-US')} XP`}</Text>
            </View>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

/** One line for a moment ("finished Chapter 3 of Astronomy"). */
export function momentLine(item: FeedItem): string {
  switch (item.kind) {
    case 'trophy':
      return `earned ${trophyInfo(item.data.trophyId ?? '', trophyCatalog)?.name ?? item.data.name ?? 'a trophy'}`;
    case 'chapter':
      return `finished Chapter ${item.data.chapter} of ${getSkill(item.data.skillId ?? '')?.name ?? 'a skill'}`;
    case 'streak':
      return `hit a ${item.data.days}-day streak`;
    case 'league':
      return `finished ${ordinal(item.data.place ?? 1)} in their league${item.data.xp ? ` (+${item.data.xp.toLocaleString('en-US')} XP)` : ''}`;
  }
}

function timeAgo(at: string, now = Date.now()): string {
  const m = Math.max(1, Math.round((now - Date.parse(at)) / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
}

/**
 * A moment in the feed: who, what, when; the reactions it has so far (Dr.
 * Scroll poses with counts); and, on other people's moments, React, which
 * opens the five poses large enough to tell apart, each with its name.
 */
export function MomentCard({ item, onOpen, onReact }: { item: FeedItem; onOpen: () => void; onReact: (reaction: FeedReaction | null) => void }) {
  const [picking, setPicking] = useState(false);
  const who = item.owner.you ? 'You' : `@${item.owner.username}`;
  const line = momentLine(item);
  const given = FEED_REACTIONS.filter((r) => (item.reactions[r.id] ?? 0) > 0);
  const mine = FEED_REACTIONS.find((r) => r.id === item.mine);
  return (
    <Card variant="plain" style={{ gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${who} ${line}, ${timeAgo(item.at)} ago. Open their profile`} onPress={onOpen}>
        <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
          <Avatar username={item.owner.username} avatar={item.owner.avatar} />
          <View style={{ flex: 1, gap: space.xxs }}>
            <Text style={[type.body, { color: color.text }]}>
              <Text style={{ fontWeight: '800' }}>{who}</Text> {line}
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
      {(given.length > 0 || !item.owner.you) && (
        <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
          {given.map((r) => (
            <View
              key={r.id}
              accessible
              accessibilityLabel={`${r.label}: ${item.reactions[r.id]}${item.mine === r.id ? ', including yours' : ''}`}
              style={[styles.reaction, item.mine === r.id && styles.reactionMine]}>
              <DrScroll spot="social.reaction" pose={r.id} size={28} />
              <Caption style={item.mine === r.id ? { color: color.brandText } : undefined}>{String(item.reactions[r.id])}</Caption>
            </View>
          ))}
          {!item.owner.you && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: picking }}
              accessibilityLabel={mine ? `Your reaction: ${mine.label}. Change it` : 'React'}
              onPress={() => setPicking((v) => !v)}
              hitSlop={4}
              style={({ pressed }) => [styles.reaction, styles.react, pressed && { opacity: 0.7 }]}>
              <Caption style={{ color: color.brandText, fontWeight: '800' }}>{mine ? mine.label : 'React'}</Caption>
            </Pressable>
          )}
        </Row>
      )}
      {picking && (
        <Row gap={space.xs} style={{ justifyContent: 'space-between' }}>
          {FEED_REACTIONS.map((r) => {
            const chosen = item.mine === r.id;
            return (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={chosen ? `${r.label}, your reaction. Take it back` : r.label}
                onPress={() => {
                  setPicking(false);
                  onReact(chosen ? null : r.id);
                }}
                style={({ pressed }) => [styles.pick, chosen && styles.reactionMine, pressed && { opacity: 0.7 }]}>
                <DrScroll spot="social.reaction" pose={r.id} size={48} />
                <Caption center numberOfLines={1}>
                  {r.label}
                </Caption>
              </Pressable>
            );
          })}
        </Row>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.lg, padding: space.lg, gap: space.md, borderWidth: depth.border, borderBottomWidth: depth.edge, borderColor: color.brandEdge, overflow: 'hidden', ...elevation.raised },
  medalArt: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  placeNumber: { position: 'absolute', bottom: -6, alignSelf: 'center' },
  podium: { flexDirection: 'row', gap: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' },
  podiumSpot: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  podiumRing: { borderWidth: 2.5, borderRadius: 999, padding: 1 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, paddingHorizontal: space.xs, paddingVertical: space.xxs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.border },
  reactionMine: { borderColor: color.brandLine, backgroundColor: color.brandSoft },
  react: { paddingHorizontal: space.md, minHeight: 36, borderColor: color.brandLine },
  pick: { flex: 1, alignItems: 'center', gap: space.xxs, paddingVertical: space.xs, borderRadius: radius.md, borderWidth: 1.5, borderColor: color.border },
});
