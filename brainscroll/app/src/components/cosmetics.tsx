import { cosmeticItem, masteryTitleName, masteryTitleSkill, type CosmeticTier } from '@brainscroll/core';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { getSkill } from '@/content';
import { useReduceMotion } from '@/theme/feedback';
import { Icon } from '@/components/ui';
import { UI_ART } from '@/components/ui/uiArt';
import { useProgress } from '@/progress/ProgressProvider';
import { color, depth, iconSize, radius, space, type } from '@/theme/tokens';

/**
 * Cosmetics from map chests (owner, 2026-10-05; docs/specs/REWARDS.md), all
 * drawn in code: avatar rings, name styles and the chest itself. Ids match
 * core COSMETICS. Legendary ones move; with Reduce Motion they hold still.
 */

/** Each ring: its gradient stops (top to bottom), and whether it turns. */
export const RING_LOOKS: Record<string, { stops: string[]; turns?: boolean; width?: number }> = {
  'ring.plum': { stops: [color.plum, color.plumDeep] },
  'ring.silver': { stops: ['#F2F5F9', '#8D99A6'] },
  'ring.ocean': { stops: ['#5FE1F0', '#2F6BFF'] },
  'ring.gold': { stops: ['#FFE39A', '#E0A42C'] },
  'ring.flame': { stops: ['#FFE066', '#FF8A2B', '#E5383B'], width: 1.3 },
  'ring.aurora': { stops: ['#7CF5C4', '#4DA3FF', '#B57BFF'], width: 1.3 },
  'ring.galaxy': { stops: ['#2B1B6E', '#7856FF', '#FF7AD9', '#2B1B6E'], turns: true, width: 1.4 },
  'ring.prism': { stops: ['#FF6B6B', '#FFC857', '#39D98A', '#4DA3FF', '#B57BFF'], turns: true, width: 1.4 },
};

/** Each name style: its colour, an optional glow, and for legendary ones a second colour it breathes into. */
export const NAME_LOOKS: Record<string, { ink: string; glow?: string; pulse?: string }> = {
  'name.plum': { ink: color.plum },
  'name.silver': { ink: '#D9E0E8' },
  'name.ocean': { ink: '#5FC8F5' },
  'name.gold': { ink: '#FFD36B' },
  'name.ember': { ink: '#FF9A4D', glow: 'rgba(255,90,40,0.75)' },
  'name.aurora': { ink: '#7CF5C4', glow: 'rgba(77,163,255,0.8)' },
  'name.shimmer': { ink: '#FFD36B', glow: 'rgba(255,200,87,0.7)', pulse: '#FFF6D8' },
  'name.holo': { ink: '#6FF0FF', glow: 'rgba(181,123,255,0.8)', pulse: '#FF8BE8' },
};

export const TIER_LABEL: Record<CosmeticTier, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
export const TIER_INK: Record<CosmeticTier, string> = { common: color.textMuted, rare: '#5FC8F5', epic: '#C79BFF', legendary: color.mastery };

/** A slow full turn, on the native driver (legendary rings). */
function useTurn(active: boolean) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active || reduce) return v.setValue(0);
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v, active, reduce]);
  return v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
}

/** A ring drawn around whatever it holds, at the same outer size (Avatar passes the art inside). */
export function AvatarRing({ ring, size, children }: { ring: string; size: number; children: (inner: number) => ReactNode }) {
  const look = RING_LOOKS[ring];
  const id = `r${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const spin = useTurn(!!look?.turns);
  if (!look) return <>{children(size)}</>;
  const stroke = Math.max(2, Math.round(size * 0.06 * (look.width ?? 1)));
  const gap = Math.max(1, Math.round(size * 0.03));
  const inner = size - 2 * (stroke + gap);
  const r = (size - stroke) / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, look.turns ? { transform: [{ rotate: spin }] } : null]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              {look.stops.map((c, i) => (
                <Stop key={i} offset={look.stops.length === 1 ? 0 : i / (look.stops.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={stroke} fill="none" />
        </Svg>
      </Animated.View>
      <View style={{ position: 'absolute', left: stroke + gap, top: stroke + gap }}>{children(inner)}</View>
    </View>
  );
}

/** A slow breath between 0 and 1, on the native driver (legendary name styles). */
function useBreath(active: boolean) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active || reduce) return v.setValue(0);
    const half = { duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true };
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, ...half }), Animated.timing(v, { toValue: 0, ...half })]));
    loop.start();
    return () => loop.stop();
  }, [v, active, reduce]);
  return v;
}

/**
 * A username in its name style (or plain). Legendary styles breathe into a
 * second colour: the same text drawn twice, the top copy fading in and out.
 */
export function StyledName({ children, nameStyle, style, numberOfLines = 1, header }: { children: string; nameStyle?: string | null; style?: StyleProp<TextStyle>; numberOfLines?: number; header?: boolean }) {
  const look = nameStyle ? NAME_LOOKS[nameStyle] : undefined;
  const breath = useBreath(!!look?.pulse);
  const role = header ? ('header' as const) : undefined;
  if (!look) return <Text accessibilityRole={role} style={style} numberOfLines={numberOfLines}>{children}</Text>;
  const glow = look.glow ? { textShadowColor: look.glow, textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } } : null;
  if (!look.pulse) return <Text accessibilityRole={role} style={[style, { color: look.ink }, glow]} numberOfLines={numberOfLines}>{children}</Text>;
  return (
    <View style={{ flexShrink: 1 }}>
      <Text accessibilityRole={role} style={[style, { color: look.ink }, glow]} numberOfLines={numberOfLines}>{children}</Text>
      <Animated.Text
        aria-hidden
        accessible={false}
        importantForAccessibility="no"
        style={[style, { color: look.pulse, position: 'absolute', left: 0, top: 0, right: 0, opacity: breath }]}
        numberOfLines={numberOfLines}>
        {children}
      </Animated.Text>
    </View>
  );
}

/** A name style's swatch for the Locker: "Aa" in that style. */
/** A name style, shown as its own name written in it ("Gold" in gold). */
export function NameSwatch({ nameStyle, size = 18 }: { nameStyle: string; size?: number }) {
  return <StyledName nameStyle={nameStyle} style={{ fontSize: size, fontWeight: '800' }}>{cosmeticName(nameStyle)}</StyledName>;
}

export const cosmeticName = (id: string) => cosmeticItem(id)?.name ?? id;

/** A worn title's name: a chest title, or "<Skill> Master". */
export function lookTitleName(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  const skill = masteryTitleSkill(id);
  if (skill) {
    const name = getSkill(skill)?.name;
    return name ? masteryTitleName(name) : undefined;
  }
  return cosmeticItem(id)?.name;
}

/**
 * The map chest, from the owner's art (ui/chest, ui/chest-open): shut and dim
 * before it can open, shut when ready, open after.
 */
export function ChestArt({ state, size = 56 }: { state: 'locked' | 'ready' | 'opened'; size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Image
        source={state === 'opened' ? UI_ART['chest-open'] : UI_ART.chest}
        style={{ width: size, height: size, opacity: state === 'locked' ? 0.45 : 1 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/** The time now, ticking each second while `active` (a running boost's countdown). */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** "12:05" left. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** How long a boost runs, said: "15 min", "1 hour". */
export const boostLength = (minutes: number) => (minutes >= 60 ? `${minutes / 60} hour` : `${minutes} min`);

/** The running boost's time left, or null. Ticks while one runs. */
export function useBoostLeft(): number | null {
  const ends = useProgress().snapshot.locker.activeBoost?.endsAt;
  const now = useNow(!!ends);
  const left = ends ? Date.parse(ends) - now : 0;
  return left > 0 ? left : null;
}

/** The header chip while a boost runs: "2x XP 12:05". Opens the Locker. */
export function BoostChip() {
  const left = useBoostLeft();
  if (left === null) return null;
  return (
    <Pressable
      testID="boost-chip"
      accessibilityRole="button"
      accessibilityLabel={`2x XP boost, ${Math.ceil(left / 60000)} minutes left. Open the Locker`}
      onPress={() => router.push('/locker')}
      style={({ pressed }) => [styles.boostChip, pressed && { opacity: 0.8 }]}>
      <Icon name="xp" tint={color.onMastery} size={iconSize.sm} />
      <Text style={[type.label, { color: color.onMastery, fontWeight: '800', fontVariant: ['tabular-nums'] }]}>{`2x ${clock(left)}`}</Text>
    </Pressable>
  );
}

/** Profile's way into the Locker: the chest, and what's waiting in it. */
export function LockerTile() {
  const { locker } = useProgress().snapshot;
  const left = useBoostLeft();
  const saved = locker.boosts.filter((b) => !b.startedAt).length;
  const line = left !== null ? `2x XP · ${clock(left)} left` : saved ? `${saved} XP ${saved === 1 ? 'boost' : 'boosts'}` : null;
  return (
    <Pressable
      testID="open-locker"
      accessibilityRole="button"
      accessibilityLabel={line ? `Locker: ${line}. Open` : 'Locker. Open'}
      onPress={() => router.push('/locker')}
      style={({ pressed }) => [styles.lockerTile, pressed && { opacity: 0.8 }]}>
      <ChestArt state="ready" size={48} />
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text style={[type.title, { color: color.text }]}>Locker</Text>
        {line && <Text style={[type.caption, { color: left !== null ? color.mastery : color.textMuted }]}>{line}</Text>}
      </View>
      <Icon name="forward" tint={color.textMuted} size={iconSize.md} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boostChip: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, backgroundColor: color.mastery, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.xxs, minHeight: 32 },
  lockerTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: depth.border,
    borderBottomWidth: depth.edge,
    borderColor: color.border,
    padding: space.md,
  },
});
