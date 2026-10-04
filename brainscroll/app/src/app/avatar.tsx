import { AVATAR_GOLD_LEVEL, avatarIdFor, LEGENDARY_AVATARS, SOCIAL_ERROR_TEXT, SocialError, trophyInfo, type LegendaryAvatarId } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/social';
import { AVATAR_ART, Caption, Eyebrow, Icon, IconButton, Notice, Row, Screen, Title } from '@/components/ui';
import { subjects, trophyCatalog } from '@/content';
import { useQuests } from '@/progress/useQuests';
import { useProgress, useProgressView } from '@/progress/ProgressProvider';
import { color, radius, space } from '@/theme/tokens';

/**
 * Choosing your avatar (owner, 2026-10-01): every tree's is yours from the
 * start (a random one is picked at sign-up); its gold one unlocks when you
 * master that tree (Level 100). Shown in your brain on Profile and wherever
 * you appear in Social. Opened from Edit profile.
 */
export default function AvatarScreen() {
  const p = useProgress();
  const { skills } = useProgressView();
  const { social } = p;
  // Earned trophies unlock the legendary avatars.
  const earned = new Set(useQuests().data?.trophies.map((t) => t.trophyId) ?? []);
  const [current, setCurrent] = useState<string | undefined>();
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      social.view().then(
        (v) => {
          setCurrent(v.me.avatar);
          setUsername(v.me.username);
        },
        () => setMessage('Couldn’t load your avatar. Check your connection.'),
      );
    }, [social]),
  );

  const choose = (id: string) => {
    setMessage(null);
    const before = current;
    setCurrent(id);
    social.setAvatar(id).catch((e: unknown) => {
      setCurrent(before);
      setMessage(e instanceof SocialError ? SOCIAL_ERROR_TEXT[e.code] : 'Couldn’t change it. Try again.');
    });
  };

  const tile = (id: string, label: string, locked: boolean, lockedLabel?: string) => {
    const art = AVATAR_ART[id];
    if (!art) return null;
    const chosen = current === id;
    return (
      <Pressable
        key={id}
        disabled={locked}
        accessibilityRole="radio"
        accessibilityState={{ checked: chosen, disabled: locked }}
        accessibilityLabel={locked ? `${label}, locked. ${lockedLabel}` : `${label}${chosen ? ', your avatar' : ''}`}
        onPress={() => choose(id)}
        style={({ pressed }) => [styles.tile, chosen && styles.chosen, pressed && { opacity: 0.8 }]}>
        <Image source={art} style={[styles.art, locked && styles.locked]} resizeMode="contain" accessibilityIgnoresInvertColors />
        {locked && (
          <View style={styles.lock}>
            <Icon name="lock" tint={color.text} size={14} />
          </View>
        )}
        {/* Up to three short lines, so long names ("Earth, Weather & Climate") are never cut. */}
        <Caption center numberOfLines={3} style={{ fontSize: 11, lineHeight: 14 }}>
          {label}
        </Caption>
      </Pressable>
    );
  };

  const mastered = skills.filter((s) => s.view.level >= AVATAR_GOLD_LEVEL).length;
  const legendary = Object.entries(LEGENDARY_AVATARS) as [LegendaryAvatarId, string][];
  const legendaryEarned = legendary.filter(([, t]) => earned.has(t)).length;

  return (
    <Screen
      header={
        <Row gap={space.sm}>
          <IconButton label="Back" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/edit-profile'))} />
          <View style={{ flex: 1, gap: space.xxs }}>
            <Eyebrow>Edit profile</Eyebrow>
            <Title>Your avatar</Title>
          </View>
        </Row>
      }>
      <Row gap={space.lg}>
        <Avatar username={username || '?'} avatar={current} size={88} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Caption>It sits in the middle of your brain on Profile, and friends and league mates see it beside your name.</Caption>
        </View>
      </Row>
      {message && <Notice tone="text">{message}</Notice>}

      {subjects.map((sub) => {
        const inSubject = skills.filter((s) => s.subjectId === sub.id);
        if (!inSubject.length) return null;
        return (
          <View key={sub.id} style={{ gap: space.sm }}>
            <Eyebrow>{sub.name}</Eyebrow>
            <View style={styles.grid}>{inSubject.map((s) => tile(avatarIdFor(s.id), s.name, false))}</View>
          </View>
        );
      })}

      <View style={{ gap: space.sm }}>
        <Title>Gold</Title>
        <Caption>{`Master a tree (Level ${AVATAR_GOLD_LEVEL}) to unlock its gold avatar. ${mastered ? `You've unlocked ${mastered}.` : 'The rarest look in BrainScroll.'}`}</Caption>
        <View style={styles.grid}>
          {[...skills]
            .sort((a, b) => b.view.level - a.view.level || a.name.localeCompare(b.name))
            .map((s) => tile(avatarIdFor(s.id, true), s.name, s.view.level < AVATAR_GOLD_LEVEL, `Master ${s.name} to unlock`))}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Title>Legendary</Title>
        <Caption>{`One for each of BrainScroll's greatest trophies. ${legendaryEarned ? `You've unlocked ${legendaryEarned}.` : 'Almost nobody has one.'}`}</Caption>
        <View style={styles.grid}>
          {legendary.map(([id, trophyId]) => {
            const name = trophyInfo(trophyId, trophyCatalog)?.name ?? 'Legendary';
            return tile(id, name, !earned.has(trophyId), `Earn the ${name} trophy to unlock`);
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: '23%', minWidth: 72, alignItems: 'center', gap: space.xxs, padding: space.xs, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' },
  chosen: { borderColor: color.brandLine, backgroundColor: color.brandSoft },
  art: { width: 64, height: 64 },
  locked: { opacity: 0.3 },
  lock: { position: 'absolute', top: space.xs + 22, alignSelf: 'center', backgroundColor: color.surfaceRaised, borderRadius: radius.pill, padding: space.xxs },
});
