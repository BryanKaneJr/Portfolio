import { chestKey, cosmeticItem, RewardError, type ChestReward, type SocialView } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { boostLength, ChestArt, NameSwatch, TIER_INK, TIER_LABEL } from '@/components/cosmetics';
import { Avatar } from '@/components/social';
import { Body, Button, Chip, Eyebrow, Gleams, IconButton, Notice, OutlinedNumber, Row, Title, useLoop } from '@/components/ui';
import { getSkill } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { feedback, useReduceMotion } from '@/theme/feedback';
import { color, layout, space } from '@/theme/tokens';

/**
 * A map chest (owner, 2026-10-05; docs/specs/REWARDS.md), opened from the
 * road after a chapter's 5th level. Tap to open: the server rolls once, the
 * chest bursts open and the prize comes up. A boost can start now or wait in
 * the Locker; a cosmetic can be worn straight away.
 */
export default function ChestScreen() {
  const { skillId = '', chapter: chapterParam = '1' } = useLocalSearchParams<{ skillId: string; chapter: string }>();
  const chapter = Number(chapterParam);
  const p = useProgress();
  const reduce = useReduceMotion();
  const opened = p.snapshot.locker.chests.includes(chestKey(skillId, chapter));
  const [reward, setReward] = useState<ChestReward | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [me, setMe] = useState<SocialView['me'] | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const wobble = useLoop(700, { active: !reward && !opened && !busy });
  const [burst] = useState(() => new Animated.Value(0));
  useEffect(() => {
    p.social.view().then((s) => setMe(s.me), () => {});
  }, [p.social]);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await p.rewards.openChest(skillId, chapter);
      feedback('unlock');
      setReward(r.reward);
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: reduce ? 1 : 520, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
    } catch (e) {
      setError(e instanceof RewardError && e.code === 'CHEST_LOCKED' ? `Clear Level ${(chapter - 1) * 10 + 5} to open it.` : 'It didn’t open. Try again.');
    } finally {
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
  const rise = { opacity: burst, transform: [{ translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] };
  const tilt = wobble.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-4deg', '4deg', '-4deg'] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep }}>
      <Row style={{ paddingHorizontal: layout.gutter, paddingTop: space.sm }}>
        <IconButton label="Close" icon="close" onPress={close} />
      </Row>
      <View style={{ flex: 1, padding: layout.gutter, gap: space.xl, alignItems: 'center', justifyContent: 'center' }}>
        <Eyebrow tone="brand">{`${skillName} · Chapter ${chapter}`}</Eyebrow>
        {!reward ? (
          <>
            <Animated.View style={{ transform: [{ rotate: opened ? '0deg' : tilt }] }}>
              <ChestArt state={opened ? 'opened' : 'ready'} size={176} />
            </Animated.View>
            {error && <Notice tone="danger">{error}</Notice>}
          </>
        ) : (
          <>
            <View style={{ alignItems: 'center' }}>
              <ChestArt state="opened" size={120} />
              <Gleams count={6} tint={color.mastery} size={18} />
            </View>
            <Animated.View style={[{ alignItems: 'center', gap: space.md }, rise]} testID="chest-reward">
              {reward.kind === 'boost' && (
                <>
                  <OutlinedNumber value="2x" fontSize={88} tone="gold" />
                  <Title style={{ color: color.mastery }}>{`${boostLength(reward.minutes)} XP boost`}</Title>
                </>
              )}
              {reward.kind === 'brainpower' && (
                <>
                  <BrainpowerIcon size={120} state="lit" />
                  <Title style={{ color: color.brandText }}>{`+${reward.amount} Brainpower`}</Title>
                </>
              )}
              {reward.kind === 'cosmetic' && item && (
                <>
                  <Chip tone="muted">
                    <Body style={{ color: TIER_INK[item.tier], fontWeight: '800' }}>{TIER_LABEL[item.tier]}</Body>
                  </Chip>
                  {item.kind === 'ring' && <Avatar username={me?.username ?? 'you'} avatar={me?.avatar} ring={item.id} size={128} />}
                  {item.kind === 'name_style' && (
<NameSwatch nameStyle={item.id} size={48} />
                  )}
                  {item.kind === 'title' && <OutlinedNumber value={item.name} fontSize={36} tone="brand" />}
                  {item.kind !== 'name_style' && <Title>{`${item.name} ${item.kind === 'ring' ? 'ring' : 'title'}`}</Title>}
                </>
              )}
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
