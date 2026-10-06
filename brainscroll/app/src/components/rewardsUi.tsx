import { COSMETICS, cosmeticItem, masteryTitleSkill, type CosmeticTier } from '@brainscroll/core';
import { useId, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Icon } from '@/components/ui';
import { color, radius, space, type } from '@/theme/tokens';

/**
 * How rewards look (owner, 2026-10-05: "doesn't look premium at all"). Every
 * rarity has its own material, used the same way everywhere: Common is brushed
 * silver, Rare sapphire, Epic amethyst, Legendary sunset orange. Gold stays for
 * mastery (CLAUDE.md): a Mastery title wears gold, a Weekly Quest title violet.
 */
export type Rarity = CosmeticTier | 'mastery' | 'quest';

export const RARITY: Record<Rarity, { label: string; stops: [string, string]; ink: string; accent: string; glow: string; edge: string }> = {
  common: { label: 'Common', stops: ['#E4EAF0', '#8593A0'], ink: '#18212A', accent: '#DCE3EA', glow: 'rgba(201,211,220,0.35)', edge: 'rgba(255,255,255,0.8)' },
  rare: { label: 'Rare', stops: ['#2F7BE0', '#123A80'], ink: '#EAF4FF', accent: '#7CC4FF', glow: 'rgba(77,163,255,0.45)', edge: 'rgba(170,215,255,0.55)' },
  epic: { label: 'Epic', stops: ['#8B4FE8', '#3E1A87'], ink: '#F4ECFF', accent: '#D2B2FF', glow: 'rgba(170,110,255,0.5)', edge: 'rgba(222,200,255,0.6)' },
  legendary: { label: 'Legendary', stops: ['#FFB547', '#D9531E'], ink: '#2A1002', accent: '#FFC98A', glow: 'rgba(255,140,60,0.6)', edge: 'rgba(255,226,190,0.9)' },
  mastery: { label: 'Mastery', stops: ['#FFE08A', '#C8861C'], ink: '#2A1A02', accent: '#FFE9A8', glow: 'rgba(255,200,87,0.6)', edge: 'rgba(255,246,214,0.9)' },
  quest: { label: 'Quest', stops: ['#7856FF', '#3A2299'], ink: '#F1EDFF', accent: '#C4B5FF', glow: 'rgba(120,86,255,0.5)', edge: 'rgba(200,188,255,0.6)' },
};

/** A title's rarity, from its id (a chest title, a Mastery title) or, for a quest title, 'quest'. */
export function titleRarity(id: string | null | undefined): Rarity {
  if (!id) return 'quest';
  if (masteryTitleSkill(id)) return 'mastery';
  return cosmeticItem(id)?.tier ?? 'quest';
}

/** Someone else's title arrives as its name: find its rarity the same way. */
export function rarityOfTitleName(name: string): Rarity {
  const item = COSMETICS.find((c) => c.kind === 'title' && c.name === name);
  if (item) return item.tier;
  return / Master$/.test(name) ? 'mastery' : 'quest';
}

/** A gradient panel filling its parent, top-left to bottom-right, with a lit top edge. */
export function Material({ rarity, rx = radius.md, soft }: { rarity: Rarity; rx?: number; soft?: boolean }) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const r = RARITY[rarity];
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
      }}>
      {size && (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={r.stops[0]} stopOpacity={soft ? 0.32 : 1} />
              <Stop offset="1" stopColor={r.stops[1]} stopOpacity={soft ? 0.12 : 1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} rx={rx} ry={rx} fill={`url(#${id})`} />
          <Rect x="0.75" y="0.75" width={size.w - 1.5} height={size.h - 1.5} rx={rx} ry={rx} fill="none" stroke={r.edge} strokeOpacity={soft ? 0.7 : 1} strokeWidth={1.5} />
        </Svg>
      )}
    </View>
  );
}

/** A small cut gem in a rarity's colours: the mark on cards and the prize label. */
export function RarityGem({ rarity, size = 12 }: { rarity: Rarity; size?: number }) {
  const r = RARITY[rarity];
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Path d="M6 0.5 L11.5 6 L6 11.5 L0.5 6 Z" fill={r.stops[0]} stroke={r.edge} strokeWidth={0.8} />
      <Path d="M6 0.5 L11.5 6 L6 6 Z" fill="#FFFFFF" opacity={0.35} />
    </Svg>
  );
}

/** "LEGENDARY" with its gem: the rarity, said once, in its own colour. */
export function RarityLabel({ rarity }: { rarity: Rarity }) {
  return (
    <View style={styles.rarityLabel}>
      <RarityGem rarity={rarity} />
      <Text style={[type.label, { color: RARITY[rarity].accent, letterSpacing: 2.4 }]}>{RARITY[rarity].label}</Text>
      <RarityGem rarity={rarity} />
    </View>
  );
}

/**
 * A title as a nameplate: the rarity's material, a lit edge, and the title in
 * spaced capitals between two small marks. `size` lg is the prize and the
 * Locker's preview; md sits under a name.
 */
export function TitlePlate({ name, rarity, size = 'md' }: { name: string; rarity: Rarity; size?: 'sm' | 'md' | 'lg' }) {
  const r = RARITY[rarity];
  const fs = size === 'lg' ? 17 : size === 'md' ? 13 : 11;
  const fancy = rarity === 'epic' || rarity === 'legendary' || rarity === 'mastery';
  return (
    <View
      accessible
      accessibilityLabel={`Title: ${name}`}
      style={[styles.plate, { paddingHorizontal: size === 'lg' ? space.xl : size === 'md' ? space.lg : space.md, paddingVertical: size === 'lg' ? space.md : size === 'md' ? 7 : 5, shadowColor: r.glow.replace(/[\d.]+\)$/, '1)') }]}>
      <Material rarity={rarity} rx={size === 'sm' ? 8 : 10} />
      {fancy && <Text style={[styles.mark, { color: r.accent, fontSize: fs - 2 }]}>✦</Text>}
      <Text numberOfLines={1} style={{ color: r.ink, fontSize: fs, fontWeight: '800', letterSpacing: fs * 0.14, textTransform: 'uppercase' }}>
        {name}
      </Text>
      {fancy && <Text style={[styles.mark, { color: r.accent, fontSize: fs - 2 }]}>✦</Text>}
    </View>
  );
}

/** A soft pool of light in the rarity's colour, behind the chest and its prize. */
export function SoftGlow({ rarity, size = 300 }: { rarity: Rarity; size?: number }) {
  const id = `s${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = RARITY[rarity];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={r.accent} stopOpacity={0.35} />
            <Stop offset="0.6" stopColor={r.stops[0]} stopOpacity={0.12} />
            <Stop offset="1" stopColor={r.stops[1]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * One thing in the Locker: its art on the rarity's material, the name under it,
 * a check when worn. Locked ones keep their shape in shadow with a lock.
 */
export function ItemCard({ rarity, label, selected, locked, onPress, testID, children, span = 'third' }: {
  rarity: Rarity | null;
  label: string;
  selected?: boolean;
  locked?: boolean;
  onPress?: () => void;
  testID?: string;
  children: ReactNode;
  /** Three to a row (rings), two (name styles) or one (titles). */
  span?: 'third' | 'half' | 'full';
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected, disabled: !onPress }}
      accessibilityLabel={locked ? `${label}, not found yet` : label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, span === 'third' ? styles.cardThird : span === 'half' ? styles.cardHalf : styles.cardFull, pressed && { transform: [{ scale: 0.97 }] }]}>
      {rarity && !locked ? <Material rarity={rarity} soft /> : <View style={[StyleSheet.absoluteFill, styles.cardPlain]} />}
      {selected && <View style={[StyleSheet.absoluteFill, styles.cardSelected]} />}
      {rarity && (
        <View style={styles.cardGem}>
          <RarityGem rarity={rarity} size={10} />
        </View>
      )}
      {selected && (
        <View style={styles.check}>
          <Icon name="check" tint={color.onBrand} size={12} />
        </View>
      )}
      <View style={[styles.cardArt, locked && { opacity: 0.4 }]}>{children}</View>
      {locked && (
        <View style={styles.cardLock}>
          <Icon name="lock" tint={color.textFaint} size={14} />
        </View>
      )}
      {span === 'third' && (
        <Text numberOfLines={1} style={[type.meta, { color: locked ? color.textFaint : color.text, letterSpacing: 0.3 }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rarityLabel: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  plate: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'center', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  mark: { fontWeight: '800' },
  card: { alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingVertical: space.md, paddingHorizontal: space.xs, borderRadius: radius.md, overflow: 'hidden' },
  cardThird: { flexBasis: '30%', flexGrow: 1, minHeight: 104 },
  cardHalf: { flexBasis: '46%', flexGrow: 1, minHeight: 72 },
  cardFull: { flexBasis: '100%', minHeight: 64 },
  cardPlain: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border },
  cardSelected: { borderRadius: radius.md, borderWidth: 2, borderColor: color.brand },
  cardGem: { position: 'absolute', top: space.sm, left: space.sm },
  check: { position: 'absolute', top: space.xs + 2, right: space.xs + 2, width: 20, height: 20, borderRadius: 10, backgroundColor: color.brand, alignItems: 'center', justifyContent: 'center' },
  cardArt: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  cardLock: { position: 'absolute', top: space.xs + 2, right: space.xs + 2 },
});
