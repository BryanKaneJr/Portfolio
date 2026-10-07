import { chestKey, cosmeticItem, RewardError, type ChestReward, type SocialView } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { ChestArt, ChestOpening, StyledName } from '@/components/cosmetics';
import { RARITY, SoftGlow, TitlePlate } from '@/components/rewardsUi';
import { Avatar } from '@/components/social';
import { Button, Gleams, IconButton, Notice, OutlinedNumber, Row, useLoop } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { feedback, useReduceMotion } from '@/theme/feedback';
import { color, layout, space, type } from '@/theme/tokens';

/**
 * A map chest (owner, 2026-10-05; docs/specs/REWARDS.md), opened from the
 * road after a chapter's 5th level. Tap Open: the chest rattles harder and
 * harder while the server rolls once, bursts open glowing, then fades away
 * as the prize comes in. A boost can start now or wait in
 * Edit profile; a cosmetic can be worn straight away.
 */
const noop = () => () => {};

export default function ChestScreen() {
  const { skillId = '', chapter: chapterParam = '1' } = useLocalSearchParams<{ skillId: string; chapter: string }>();
  const chapter = Number(chapterParam);
  const p = useProgress();
  // The web build is pre-rendered without the link's query: draw nothing until mounted, so a reload of this page hydrates cleanly.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const reduce = useReduceMotion();
  // Opened before this visit (opening it here marks it opened at once, mid-shake: that doesn't count).
  const [opened] = useState(() => p.snapshot.locker.chests.includes(chestKey(skillId, chapter)));
  const [reward, setReward] = useState<ChestReward | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [me, setMe] = useState<SocialView['me'] | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const wobble = useLoop(700, { active: !reward && !opened && !busy });
  // The opening: shake (while the server rolls), then the owner's opening animation, then the prize.
  const [shaking, setShaking] = useState(false);
  const [prizeShown, setPrizeShown] = useState(false);
  const [shake] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));
  // The open chest fades away as the prize comes in.
  const [reveal] = useState(() => new Animated.Value(0));
  useEffect(() => {
    p.social.view().then((s) => setMe(s.me), () => {});
  }, [p.social]);

  /** A rattle that builds: eight quick swings, each a little wider, about 0.8 s. */
  const rattle = () =>
    new Promise<void>((resolve) => {
      if (reduce) return resolve();
      shake.setValue(0);
      const swings = [0.35, -0.45, 0.55, -0.65, 0.75, -0.85, 1, -1, 0];
      Animated.sequence(swings.map((to, i) => Animated.timing(shake, { toValue: to, duration: i === swings.length - 1 ? 60 : 85, easing: Easing.inOut(Easing.quad), useNativeDriver: true }))).start(() => resolve());
    });
  const open = async () => {
    setBusy(true);
    setError(null);
    setShaking(true);
    feedback('select');
    try {
      const [r] = await Promise.all([p.rewards.openChest(skillId, chapter), rattle()]);
      feedback('unlock');
      reveal.setValue(0);
      burst.setValue(0);
      setReward(r.reward);
    } catch (e) {
      setError(e instanceof RewardError && e.code === 'CHEST_LOCKED' ? `Clear Level ${(chapter - 1) * 10 + 5} to open it.` : 'It didn’t open. Try again.');
    } finally {
      setShaking(false);
      setBusy(false);
    }
  };
  /** The lid stands open (the opening animation calls this): the chest fades away as the prize comes in, then the words and buttons. */
  const land = () => {
    Animated.sequence([
      Animated.delay(reduce ? 0 : 450),
      Animated.timing(reveal, { toValue: 1, duration: reduce ? 1 : 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: reduce ? 1 : 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start(() => setPrizeShown(true));
  };
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      feedback('select');
      setDone(true);
    } catch {
      setError('That didn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const boostId = reward?.kind === 'boost' ? p.snapshot.locker.boosts.findLast((b) => b.source === chestKey(skillId, chapter) && !b.startedAt)?.id : undefined;
  const item = reward?.kind === 'cosmetic' ? cosmeticItem(reward.itemId) : undefined;
  const rarity = item ? item.tier : 'quest';
  const tilt = wobble.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-4deg', '4deg', '-4deg'] });
  const rattleStyle = {
    transform: [
      { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) },
      { rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] }) },
      { scale: shake.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.06, 1, 1.06] }) },
    ],
  };

  const fadeIn = { opacity: burst, transform: [{ translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] };
  const prizeStyle = {
    opacity: reveal.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] }),
    transform: [{ scale: reveal.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.6, 0.6, 1] }) }],
  };
  const chestStyle = {
    opacity: reveal.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0, 0] }),
    transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
  };
  const minutes = reward?.kind === 'boost' ? reward.minutes : 0;
  const headline = !reward
    ? ''
    : reward.kind === 'boost'
      ? `${minutes >= 60 ? '1 hour' : `${minutes} minute`} XP boost`
      : reward.kind === 'brainpower'
        ? `+${reward.amount} Brainpower`
        : item?.kind === 'ring'
          ? `${item.name} glow`
          : item?.kind === 'name_style'
            ? `${item.name} name style`
            : 'New title';
  const prizeArt = !reward ? null : reward.kind === 'boost' ? (
    <OutlinedNumber value="2x" fontSize={112} tone="brand" />
  ) : reward.kind === 'brainpower' ? (
    <BrainpowerIcon size={150} state="lit" />
  ) : item?.kind === 'ring' ? (
    <Avatar username={me?.username ?? 'you'} avatar={me?.avatar} ring={item.id} size={150} />
  ) : item?.kind === 'name_style' ? (
    <StyledName nameStyle={item.id} style={[type.h1, { color: color.text }]}>{me ? `@${me.username}` : 'Your name'}</StyledName>
  ) : item ? (
    <TitlePlate name={item.name} rarity={item.tier} size="lg" />
  ) : null;

  if (!mounted) return <View style={{ flex: 1, backgroundColor: color.bgDeep }} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep }}>
      <Row style={{ paddingHorizontal: layout.gutter, paddingTop: space.sm }}>
        <IconButton label="Close" icon="close" onPress={close} />
      </Row>
      {/* One layout before and after opening, so the chest never moves; the buttons sit over the space kept for them. */}
      <View style={{ flex: 1 }}>
        <View style={styles.main}>
          <Animated.View style={reward ? { opacity: reveal.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0], extrapolate: 'clamp' }) } : null}>
            <Text style={[type.h1, { color: color.text, textAlign: 'center' }]}>{opened ? 'Chest opened' : `Chapter ${chapter} chest`}</Text>
          </Animated.View>
          {!reward ? (
            <Pressable testID="open-chest" accessibilityRole="button" accessibilityLabel="Open the chest" disabled={opened || busy} onPress={open} style={styles.stage}>
              <SoftGlow rarity="quest" size={300} />
              <Animated.View style={shaking ? rattleStyle : { transform: [{ rotate: opened ? '0deg' : tilt }] }}>
                {opened ? <ChestArt state="opened" size={200} /> : <ChestOpening size={250} play={false} />}
              </Animated.View>
              {!opened && <Gleams count={4} tint={color.text} size={16} />}
            </Pressable>
          ) : (
            // The chest glows open, then fades away as the prize comes in.
            <View style={styles.stage}>
              <SoftGlow rarity={rarity} size={300} />
              <Animated.View style={chestStyle}>
                <ChestOpening size={250} onOpen={land} />
              </Animated.View>
              <Animated.View style={[styles.prize, prizeStyle]}>{prizeArt}</Animated.View>
            </View>
          )}
          <View style={styles.caption}>
            {!reward ? (
              !opened && <Text style={[type.title, { color: color.textMuted }]}>{busy ? ' ' : 'Tap to open'}</Text>
            ) : (
              <Animated.View style={[{ alignItems: 'center', gap: space.xs }, fadeIn]} testID="chest-reward">
                <Text style={[type.h1, { color: color.text, textAlign: 'center' }]}>{headline}</Text>
                {item && <Text style={[type.label, { color: RARITY[item.tier].accent, letterSpacing: 2.4 }]}>{RARITY[item.tier].label}</Text>}
              </Animated.View>
            )}
            {error && <Notice tone="danger">{error}</Notice>}
          </View>
        </View>
        {/* After opening, the choices come in with the prize. */}
        <Animated.View
          pointerEvents={reward && !prizeShown ? 'none' : 'auto'}
          style={[styles.footer, reward ? { opacity: burst, transform: [{ translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] } : null]}>
          {reward?.kind === 'boost' && boostId && !done && (
            <>
              <Button testID="start-boost-now" label="Start now" loading={busy} onPress={() => act(() => p.rewards.startBoost(boostId))} />
              <Button variant="secondary" label="Save for later" onPress={close} />
            </>
          )}
          {reward?.kind === 'cosmetic' && item && !done && (
            <>
              <Button
                testID="wear-now"
                label="Wear it"
                loading={busy}
                onPress={() =>
                  act(() => {
                    const look = p.snapshot.locker.look;
                    return p.rewards.setLook(item.kind === 'ring' ? { ...look, ring: item.id } : item.kind === 'name_style' ? { ...look, nameStyle: item.id } : { ...look, title: item.id });
                  })
                }
              />
              <Button variant="secondary" label="Later" onPress={close} />
            </>
          )}
          {reward && (reward.kind === 'brainpower' || done) && <Button label="Done" onPress={close} />}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  main: { flex: 1, padding: layout.gutter, paddingBottom: layout.gutter * 2 + layout.buttonHeight * 2 + space.sm, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  caption: { minHeight: 72, alignItems: 'center', gap: space.sm },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: layout.gutter, gap: space.sm },
  stage: { width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
  prize: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
