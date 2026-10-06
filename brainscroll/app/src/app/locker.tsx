import { COSMETICS, masteryTitleId, RewardError, type CosmeticKind, type Look, type SocialView } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { boostLength, clock, lookTitleName, NameSwatch, StyledName, useBoostLeft } from '@/components/cosmetics';
import { ItemCard, Material, TitlePlate, titleRarity } from '@/components/rewardsUi';
import { Avatar } from '@/components/social';
import { Button, GradientFill, Icon, IconButton, Notice, Screen } from '@/components/ui';
import { skills } from '@/content';
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
 * The Locker (owner, 2026-10-05; docs/specs/REWARDS.md): you as others see
 * you, XP boosts waiting to start, and a wardrobe of glows, name styles and
 * titles from map chests, one of each worn. Each item sits on its rarity's
 * material (components/rewardsUi.tsx); ones not found yet wait in shadow.
 */
export default function LockerScreen() {
  const p = useProgress();
  const { locker, skills: progress } = p.snapshot;
  const [me, setMe] = useState<SocialView['me'] | null>(null);
  const [tab, setTab] = useState<Tab>('ring');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const left = useBoostLeft();
  useEffect(() => {
    p.social.view().then((s) => setMe(s.me), () => {});
  }, [p.social]);
  const close = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const owned = new Set(locker.cosmetics);
  const look = locker.look;
  const saved = locker.boosts.filter((b) => !b.startedAt);
  const running = locker.activeBoost;
  // Mastery titles: one for each skill with a ★.
  const mastery = skills.filter((s) => (progress[s.id]?.stars ?? 0) >= 1).map((s) => masteryTitleId(s.id));

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setNotice(null);
    try {
      await fn();
      feedback('select');
    } catch (e) {
      setNotice(e instanceof RewardError && e.code === 'BOOST_ACTIVE' ? 'One boost at a time.' : 'That didn’t save. Try again.');
    } finally {
      setBusy(null);
    }
  };
  const wear = (kind: CosmeticKind, id: string | null) => {
    const next: Look = { ...look, ...(kind === 'ring' ? { ring: id } : kind === 'name_style' ? { nameStyle: id } : { title: id }) };
    void run(`${kind}:${id}`, () => p.rewards.setLook(next));
  };
  const titleName = lookTitleName(look.title);
  const name = me ? `@${me.username}` : 'You';

  return (
    <Screen header={<IconButton label="Back" icon="back" onPress={close} />}>
      {/* You, as others see you. */}
      <View style={styles.hero}>
        <GradientFill from={color.profileHeader} to={color.bg} />
        <Text style={[type.label, { color: color.brandText }]}>Locker</Text>
        <Avatar username={me?.username ?? 'you'} avatar={me?.avatar} ring={look.ring} size={120} />
        <StyledName header nameStyle={look.nameStyle} style={[type.h1, { color: color.text }]}>{name}</StyledName>
        {titleName ? <TitlePlate name={titleName} rarity={titleRarity(look.title)} /> : <View style={{ height: 30 }} />}
      </View>
      {notice && <Notice tone="danger">{notice}</Notice>}

      {(running || saved.length > 0) && (
        <View style={{ gap: space.sm }}>
          {running && left !== null && (
            <View style={styles.boost}>
              <Material rarity="quest" />
              <BoostBadge />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.title, { color: color.onBrand }]}>XP boost on</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max(4, (left / (running.minutes * 60000)) * 100)}%` }]} />
                </View>
              </View>
              <Text style={[type.numberSm, { color: color.onBrand }]}>{clock(left)}</Text>
            </View>
          )}
          {saved.map((b) => (
            <View key={b.id} style={styles.boost}>
              <Material rarity="quest" soft />
              <BoostBadge />
              <View style={{ flex: 1 }}>
                <Text style={[type.title, { color: color.text }]}>{`${boostLength(b.minutes)} XP boost`}</Text>
              </View>
              <Button compact label="Start" testID={`start-boost-${b.minutes}`} disabled={left !== null} loading={busy === b.id} onPress={() => run(b.id, () => p.rewards.startBoost(b.id))} />
            </View>
          ))}
        </View>
      )}

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
                <Avatar username={me?.username ?? 'you'} avatar={me?.avatar} ring={c.id} size={56} />
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
          <ItemCard span="full" rarity={null} label="None" selected={look.title === null} onPress={() => wear('title', null)} testID="wear-title-none">
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
        </View>
      )}
    </Screen>
  );
}

/** "2x" on a lit disc: an XP boost. */
function BoostBadge() {
  return (
    <View style={styles.badge}>
      <Text style={[type.title, { color: color.brandEdge, fontWeight: '900' }]}>2x</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, marginHorizontal: -layout.gutter, marginTop: -space.lg, paddingTop: space.lg, paddingBottom: space.xl, overflow: 'hidden' },
  boost: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, overflow: 'hidden' },
  badge: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.onBrand, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', marginTop: space.xs },
  fill: { height: 6, borderRadius: 3, backgroundColor: color.onBrand },
  tabs: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.pill, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: color.surfaceRaised },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
