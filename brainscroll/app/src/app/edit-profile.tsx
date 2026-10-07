import { COSMETICS, masteryTitleId, SOCIAL_ERROR_TEXT, SocialError, usernameProblem, type CosmeticKind, type Look, type SocialView } from '@brainscroll/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { lookTitleName, NameSwatch, StyledName } from '@/components/cosmetics';
import { ItemCard, TitlePlate, titleRarity } from '@/components/rewardsUi';
import { Avatar } from '@/components/social';
import { Button, Caption, Card, Field, GradientFill, Icon, IconButton, LoadError, Notice, Row, Screen, SkeletonCard, Title } from '@/components/ui';
import { skills } from '@/content';
import { questDef, useQuests } from '@/progress/useQuests';
import { useProgress } from '@/progress/ProgressProvider';
import { feedback } from '@/theme/feedback';
import { color, iconSize, layout, radius, space, type } from '@/theme/tokens';

type Tab = 'ring' | 'name_style' | 'title';
const TABS: { id: Tab; label: string }[] = [
  { id: 'ring', label: 'Glows' },
  { id: 'name_style', label: 'Name styles' },
  { id: 'title', label: 'Titles' },
];

/**
 * Edit profile (owner, 2026-10-01; the Locker moved in 2026-10-07): you as
 * others see you (tap the avatar to change it), your username, and a
 * wardrobe of glows, name styles and titles (from map chests, Mastery stars
 * and weekly quests), one of each worn. Each item sits on its rarity's
 * material (components/rewardsUi.tsx); ones not found yet wait in shadow.
 */
export default function EditProfileScreen() {
  const p = useProgress();
  const { social } = p;
  const { locker, skills: progress } = p.snapshot;
  const quests = useQuests();
  const [me, setMe] = useState<SocialView['me'] | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState('');
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('ring');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    social.view().then(
      (v) => {
        setMe(v.me);
        setName(v.me.username);
      },
      () => setFailed(true),
    );
  }, [social]);
  useFocusEffect(load);

  const back = () => (router.canGoBack() ? router.back() : router.navigate('/profile'));

  const saveName = async () => {
    const problem = usernameProblem(name);
    if (problem) return setNameMessage(problem);
    try {
      const saved = await social.setUsername(name);
      setName(saved);
      setMe((m) => (m ? { ...m, username: saved } : m));
      setNameMessage('Saved.');
    } catch (e) {
      setNameMessage(e instanceof SocialError ? SOCIAL_ERROR_TEXT[e.code] : 'That didn’t work. Try again.');
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    setNotice(null);
    try {
      await fn();
      feedback('select');
    } catch {
      setNotice('That didn’t save. Try again.');
    }
  };
  const look = locker.look;
  const wear = (kind: CosmeticKind, id: string | null) => {
    const next: Look = { ...look, ...(kind === 'ring' ? { ring: id } : kind === 'name_style' ? { nameStyle: id } : { title: id }) };
    // Wearing a chest or Mastery title takes off a quest title (core setLook); reload so the quest one shows unworn.
    void run(() => p.rewards.setLook(next).then(() => quests.reload()));
  };

  // Quest titles come with quest trophies (live-week clears), as on the Trophies screen. Wearing one takes off a look title.
  const data = quests.data;
  const questTitles = (data?.trophies ?? []).flatMap((t) => (t.kind === 'quest' && t.questId && questDef(t.questId)?.titleReward ? [questDef(t.questId)!] : []));
  const questTitleId = look.title ? null : (data?.equipped.titleQuestId ?? null);
  const wearQuestTitle = (questId: string) => {
    if (!data) return;
    void run(() => p.setEquipped({ ...data.equipped, titleQuestId: questId }).then(() => quests.reload()));
  };
  const takeOffTitles = () => {
    void run(async () => {
      if (look.title) await p.rewards.setLook({ ...look, title: null });
      if (data?.equipped.titleQuestId) await p.setEquipped({ ...data.equipped, titleQuestId: null });
      await quests.reload();
    });
  };

  const owned = new Set(locker.cosmetics);
  // Mastery titles: one for each skill with a ★.
  const mastery = skills.filter((s) => (progress[s.id]?.stars ?? 0) >= 1).map((s) => masteryTitleId(s.id));
  const questWorn = questTitleId ? questDef(questTitleId) : undefined;
  const titleName = lookTitleName(look.title) ?? questWorn?.titleReward ?? null;

  const header = (
    <Row gap={space.sm}>
      <IconButton label="Back" icon="back" onPress={back} />
      <Title style={{ flex: 1 }}>Edit profile</Title>
    </Row>
  );
  if (failed) return <LoadError layout="screen" onRetry={load} onBack={back} />;
  if (!me)
    return (
      <Screen header={header}>
        <SkeletonCard lines={3} action />
      </Screen>
    );

  return (
    <Screen header={header}>
      {/* You, as others see you. The avatar opens the picker. */}
      <View style={styles.hero}>
        <GradientFill from={color.profileHeader} to={color.bg} />
        {/* Room for the glow's scene, which spreads past the avatar. */}
        <Pressable accessibilityRole="button" accessibilityLabel="Your avatar. Change it" onPress={() => router.push('/avatar')} style={({ pressed }) => [{ marginVertical: 48 }, pressed && { opacity: 0.8 }]}>
          <Avatar username={me.username} avatar={me.avatar} ring={look.ring} size={120} />
        </Pressable>
        <Button compact variant="secondary" label="Change avatar" onPress={() => router.push('/avatar')} />
        <StyledName header nameStyle={look.nameStyle} style={[type.h1, { color: color.text }]}>{`@${me.username}`}</StyledName>
        {titleName ? <TitlePlate name={titleName} rarity={look.title ? titleRarity(look.title) : 'quest'} /> : <View style={{ height: 30 }} />}
      </View>

      <Card variant="plain" style={{ gap: space.md }}>
        <Field label="Username" value={name} onChangeText={(t) => setName(t.toLowerCase())} maxLength={20} />
        <Caption>Friends and league mates see this.</Caption>
        <Button label="Save username" variant="secondary" disabled={name === me.username} onPress={() => void saveName()} />
        {nameMessage && <Notice tone="text">{nameMessage}</Notice>}
      </Card>
      {notice && <Notice tone="danger">{notice}</Notice>}

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabOn]}>
            <Text style={[type.bodyStrong, { color: tab === t.id ? color.text : color.textMuted }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'ring' && (
        <View style={styles.grid}>
          <ItemCard rarity={null} label="None" selected={look.ring === null} onPress={() => wear('ring', null)} testID="wear-ring-none">
            <Icon name="close" tint={color.textMuted} size={iconSize.lg} />
          </ItemCard>
          {COSMETICS.filter((c) => c.kind === 'ring').map((c) => {
            const has = owned.has(c.id);
            return (
              <ItemCard key={c.id} testID={`wear-${c.id}`} rarity={c.tier} label={c.name} locked={!has} selected={look.ring === c.id} onPress={has ? () => wear('ring', c.id) : undefined}>
                <Avatar username={me.username} avatar={me.avatar} ring={c.id} size={56} />
              </ItemCard>
            );
          })}
        </View>
      )}

      {tab === 'name_style' && (
        <View style={styles.grid}>
          <ItemCard span="half" rarity={null} label="None" selected={look.nameStyle === null} onPress={() => wear('name_style', null)} testID="wear-name-none">
            <Text style={[type.title, { color: color.textMuted }]}>None</Text>
          </ItemCard>
          {COSMETICS.filter((c) => c.kind === 'name_style').map((c) => {
            const has = owned.has(c.id);
            return (
              // Each name style is just its name, written in it.
              <ItemCard key={c.id} span="half" testID={`wear-${c.id}`} rarity={c.tier} label={c.name} locked={!has} selected={look.nameStyle === c.id} onPress={has ? () => wear('name_style', c.id) : undefined}>
                <NameSwatch nameStyle={c.id} size={22} />
              </ItemCard>
            );
          })}
        </View>
      )}

      {tab === 'title' && (
        <View style={styles.grid}>
          <ItemCard span="full" rarity={null} label="None" selected={!look.title && !questTitleId} onPress={takeOffTitles} testID="wear-title-none">
            <Text style={[type.bodyStrong, { color: color.textMuted }]}>None</Text>
          </ItemCard>
          {[...mastery, ...COSMETICS.filter((c) => c.kind === 'title').map((c) => c.id)].map((id) => {
            const label = lookTitleName(id) ?? id;
            const has = mastery.includes(id) || owned.has(id);
            return (
              <ItemCard key={id} span="full" testID={`wear-${id}`} rarity={titleRarity(id)} label={label} locked={!has} selected={look.title === id} onPress={has ? () => wear('title', id) : undefined}>
                <TitlePlate name={label} rarity={titleRarity(id)} />
              </ItemCard>
            );
          })}
          {questTitles.map((q) => (
            <ItemCard key={q.id} span="full" testID={`wear-quest-${q.id}`} rarity="quest" label={q.titleReward!} selected={questTitleId === q.id} onPress={() => wearQuestTitle(q.id)}>
              <TitlePlate name={q.titleReward!} rarity="quest" />
            </ItemCard>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, marginHorizontal: -layout.gutter, marginTop: -space.lg, paddingTop: space.lg, paddingBottom: space.xl, overflow: 'hidden' },
  tabs: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.pill, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: color.surfaceRaised },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
