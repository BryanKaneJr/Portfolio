import { chestKey, cosmeticItem, RewardError, type ChestReward, type SocialView } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { boostLength, ChestArt, NameSwatch } from '@/components/cosmetics';
import { Burst, RarityLabel, TitlePlate } from '@/components/rewardsUi';
import { Avatar } from '@/components/social';
import { Button, Eyebrow, IconButton, Notice, OutlinedNumber, Row, useLoop } from '@/components/ui';
import { getSkill } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { feedback, useReduceMotion } from '@/theme/feedback';
import { color, layout, space, type } from '@/theme/tokens';

/**
 * A map chest (owner, 2026-10-05; docs/specs/REWARDS.md), opened from the
 * road after a chapter's 5th level. Tap Open: the chest rattles harder and
 * harder while the server rolls once, bursts open with a glow in the prize's
 * rarity colour behind it, and the prize rises. A boost can start now or wait in
 * the Locker; a cosmetic can be worn straight away.
 */
export default function ChestScreen() {
  const { skillId = '', chapter: chapterParam = '1' } = useLocalSearchParams<{ skillId: string; chapter: string }>();
  const chapter = Number(chapterParam);
  const p = useProgress();
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
  // The opening: shake (while the server rolls), pop open with a glow, then the prize rises.
  const [shaking, setShaking] = useState(false);
  const [shake] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));
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
      pop.setValue(0);
      burst.setValue(0);
      setReward(r.reward);
      Animated.sequence([
        Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
        Animated.timing(burst, { toValue: 1, duration: reduce ? 1 : 480, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      ]).start();
    } catch (e) {
      setError(e instanceof RewardError && e.code === 'CHEST_LOCKED' ? `Clear Level ${(chapter - 1) * 10 + 5} to open it.` : 'It didn’t open. Try again.');
    } finally {
      setShaking(false);
      setBusy(false);
    }
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

  const skillName = getSkill(skillId)?.name ?? '';
  const boostId = reward?.kind === 'boost' ? p.snapshot.locker.boosts.findLast((b) => b.source === chestKey(skillId, chapter) && !b.startedAt)?.id : undefined;
  const item = reward?.kind === 'cosmetic' ? cosmeticItem(reward.itemId) : undefined;
  const rarity = item ? item.tier : 'quest';
  const rise = { opacity: burst, transform: [{ translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] };
  const tilt = wobble.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-4deg', '4deg', '-4deg'] });
  const rattleStyle = {
    transform: [
      { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) },
      { rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] }) },
      { scale: shake.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.06, 1, 1.06] }) },
    ],
  };
  const popStyle = { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep }}>
      <Row style={{ paddingHorizontal: layout.gutter, paddingTop: space.sm }}>
        <IconButton label="Close" icon="close" onPress={close} />
      </Row>
      <View style={{ flex: 1, padding: layout.gutter, gap: space.xl, alignItems: 'center', justifyContent: 'center' }}>
        <Eyebrow tone="brand">{`${skillName} · Chapter ${chapter}`}</Eyebrow>
        {!reward ? (
          <>
            <Animated.View style={shaking ? rattleStyle : { transform: [{ rotate: opened ? '0deg' : tilt }] }}>
              <ChestArt state={opened ? 'opened' : 'ready'} size={176} />
            </Animated.View>
            {error && <Notice tone="danger">{error}</Notice>}
          </>
        ) : (
          <>
            {/* The chest bursts open, its glow in the prize's rarity colour. */}
            <Animated.View style={[{ alignItems: 'center', justifyContent: 'center', width: 300, height: 210 }, popStyle]}>
              <Burst rarity={rarity} size={300} />
              <ChestArt state="opened" size={168} />
            </Animated.View>
            <Animated.View style={[{ alignItems: 'center', gap: space.md }, rise]} testID="chest-reward">
              {item && <RarityLabel rarity={item.tier} />}
              {reward.kind === 'boost' && (
                <>
                  <OutlinedNumber value="2x" fontSize={72} tone="brand" />
                  <TitlePlate name={`${boostLength(reward.minutes)} XP boost`} rarity="quest" size="lg" />
                </>
              )}
              {reward.kind === 'brainpower' && (
                <>
                  <BrainpowerIcon size={96} state="lit" />
                  <TitlePlate name={`+${reward.amount} Brainpower`} rarity="quest" size="lg" />
                </>
              )}
              {item?.kind === 'ring' && (
                <>
                  <Avatar username={me?.username ?? 'you'} avatar={me?.avatar} ring={item.id} size={112} />
                  <Text style={[type.h2, { color: color.text }]}>{`${item.name} glow`}</Text>
                </>
              )}
              {item?.kind === 'name_style' && <NameSwatch nameStyle={item.id} size={48} />}
              {item?.kind === 'title' && <TitlePlate name={item.name} rarity={item.tier} size="lg" />}
            </Animated.View>
            {error && <Notice tone="danger">{error}</Notice>}
          </>
        )}
      </View>
      <View style={{ padding: layout.gutter, gap: space.sm }}>
        {!reward && !opened && <Button testID="open-chest" label="Open" loading={busy} onPress={open} />}
        {!reward && opened && <Button variant="secondary" label="See your Locker" onPress={() => router.replace('/locker')} />}
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
      </View>
    </SafeAreaView>
  );
}
