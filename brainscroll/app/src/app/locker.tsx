import { COSMETICS, cosmeticItem, masteryTitleId, RewardError, type CosmeticKind, type Look, type SocialView } from '@brainscroll/core';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { boostLength, ChestArt, clock, lookTitleName, NameSwatch, StyledName, TIER_INK, TIER_LABEL, useBoostLeft } from '@/components/cosmetics';
import { Avatar } from '@/components/social';
import { Body, Button, Caption, Card, Chip, Eyebrow, Icon, IconButton, Notice, Row, Screen, Title } from '@/components/ui';
import { skills } from '@/content';
import { useProgress } from '@/progress/ProgressProvider';
import { feedback } from '@/theme/feedback';
import { color, depth, iconSize, radius, space, type } from '@/theme/tokens';

/**
 * The Locker (owner, 2026-10-05; docs/specs/REWARDS.md): XP boosts waiting to
 * be started, and the rings, name styles and titles won from map chests. One
 * of each is worn; others see them on the learner's card. Items not won yet
 * show as locked tiles with their tier, so there's something to look for.
 */
export default function LockerScreen() {
  const p = useProgress();
  const { locker, skills: progress } = p.snapshot;
  const [me, setMe] = useState<SocialView['me'] | null>(null);
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
  const worn = (kind: CosmeticKind) => (kind === 'ring' ? look.ring : kind === 'name_style' ? look.nameStyle : look.title);

  const grid = (kind: CosmeticKind) => (
    <View style={styles.grid}>
      <Tile label="None" selected={worn(kind) === null} onPress={() => wear(kind, null)} testID={`wear-${kind}-none`}>
        <Icon name="close" tint={color.textMuted} size={iconSize.md} />
      </Tile>
      {COSMETICS.filter((c) => c.kind === kind).map((c) => {
        const has = owned.has(c.id);
        return (
          <Tile
            key={c.id}
            testID={`wear-${c.id}`}
            label={has ? c.name : TIER_LABEL[c.tier]}
            tierInk={has ? undefined : TIER_INK[c.tier]}
            locked={!has}
            selected={worn(kind) === c.id}
            onPress={has ? () => wear(kind, c.id) : undefined}>
            {kind === 'ring' ? (
              <Avatar username={me?.username ?? 'you'} avatar={me?.avatar} ring={c.id} size={48} />
            ) : (
              <NameSwatch nameStyle={c.id} />
            )}
          </Tile>
        );
      })}
    </View>
  );

  const titles = [...mastery, ...COSMETICS.filter((c) => c.kind === 'title').map((c) => c.id)];
  return (
    <Screen header={<IconButton label="Back" icon="back" onPress={close} />}>
      <Eyebrow tone="brand">Locker</Eyebrow>
      {/* You, as others see you. */}
      <Card variant="raised" style={{ alignItems: 'center', gap: space.sm }}>
        <Avatar username={me?.username ?? 'you'} avatar={me?.avatar} ring={look.ring} size={96} />
        <StyledName nameStyle={look.nameStyle} style={[type.h2, { color: color.text }]}>{me ? `@${me.username}` : 'You'}</StyledName>
        {lookTitleName(look.title) ? <Chip tone="brand">{lookTitleName(look.title)}</Chip> : null}
      </Card>
      {notice && <Notice tone="danger">{notice}</Notice>}

      <View style={{ gap: space.sm }}>
        <Title>XP boosts</Title>
        {left !== null && (
          <Card variant="raised" style={styles.boostRow}>
            <View style={styles.boostBadge}>
              <Text style={[type.title, { color: color.onMastery }]}>2x</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Body>Boost running</Body>
              <Caption style={{ color: color.mastery, fontVariant: ['tabular-nums'] }}>{`${clock(left)} left`}</Caption>
            </View>
          </Card>
        )}
        {saved.map((b) => (
          <Card key={b.id} variant="raised" style={styles.boostRow}>
            <View style={[styles.boostBadge, { backgroundColor: color.masterySoft }]}>
              <Text style={[type.title, { color: color.mastery }]}>2x</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Body>{`${boostLength(b.minutes)} XP boost`}</Body>
            </View>
            <Button
              compact
              label="Start"
              testID={`start-boost-${b.minutes}`}
              disabled={left !== null}
              loading={busy === b.id}
              onPress={() => run(b.id, () => p.rewards.startBoost(b.id))}
            />
          </Card>
        ))}
        {left === null && saved.length === 0 && <Caption>None saved.</Caption>}
      </View>

      <View style={{ gap: space.sm }}>
        <Title>Rings</Title>
        {grid('ring')}
      </View>
      <View style={{ gap: space.sm }}>
        <Title>Name styles</Title>
        {grid('name_style')}
      </View>
      <View style={{ gap: space.sm }}>
        <Title>Titles</Title>
        <View style={styles.titles}>
          <TitleChip label="None" selected={look.title === null} onPress={() => wear('title', null)} />
          {titles.map((id) => {
            const item = cosmeticItem(id);
            const has = item ? owned.has(id) : true;
            return (
              <TitleChip
                key={id}
                label={has ? (lookTitleName(id) ?? id) : `${TIER_LABEL[item!.tier]} title`}
                tierInk={has ? undefined : TIER_INK[item!.tier]}
                locked={!has}
                selected={look.title === id}
                onPress={has ? () => wear('title', id) : undefined}
              />
            );
          })}
        </View>
      </View>
      <Row gap={space.md} style={{ justifyContent: 'center', opacity: 0.7, paddingVertical: space.lg }}>
        <ChestArt state="locked" size={36} />
        <Caption>{`${locker.cosmetics.length} of ${COSMETICS.length} found`}</Caption>
      </Row>
    </Screen>
  );
}

function Tile({ children, label, selected, locked, tierInk, onPress, testID }: { children: React.ReactNode; label: string; selected?: boolean; locked?: boolean; tierInk?: string; onPress?: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected, disabled: !onPress }}
      accessibilityLabel={locked ? `${label}, not found yet` : label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && { opacity: 0.8 }]}>
      <View style={[styles.tileArt, locked && { opacity: 0.35 }]}>{children}</View>
      {locked && (
        <View style={styles.lock}>
          <Icon name="lock" tint={color.textMuted} size={iconSize.sm} />
        </View>
      )}
      <Text numberOfLines={1} style={[type.meta, { color: tierInk ?? (selected ? color.brandText : color.textMuted), fontWeight: '700' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function TitleChip({ label, selected, locked, tierInk, onPress }: { label: string; selected?: boolean; locked?: boolean; tierInk?: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected, disabled: !onPress }}
      accessibilityLabel={locked ? `${label}, not found yet` : label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.titleChip, selected && styles.tileSelected, pressed && { opacity: 0.8 }]}>
      {locked && <Icon name="lock" tint={color.textFaint} size={iconSize.sm} />}
      <Text style={[type.caption, { color: tierInk ?? (selected ? color.brandText : color.text), fontWeight: '700' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Three to a row: each kind has a None tile and eight items.
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: depth.border,
    borderBottomWidth: depth.edge,
    borderColor: color.border,
    paddingHorizontal: space.xs,
  },
  tileSelected: { borderColor: color.brand, backgroundColor: color.brandSoft },
  tileArt: { height: 50, alignItems: 'center', justifyContent: 'center' },
  lock: { position: 'absolute', top: 30, alignSelf: 'center' },
  titles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  titleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: depth.border,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  boostRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  boostBadge: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: color.mastery, alignItems: 'center', justifyContent: 'center' },
});
