import { cosmeticItem, masteryTitleName, masteryTitleSkill, type CosmeticTier } from '@brainscroll/core';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { getSkill } from '@/content';
import { useReduceMotion } from '@/theme/feedback';
import { Material } from '@/components/rewardsUi';
import { Icon } from '@/components/ui';
import { UI_ART } from '@/components/ui/uiArt';
import { useProgress } from '@/progress/ProgressProvider';
import { color, iconSize, radius, space, type } from '@/theme/tokens';

/**
 * Cosmetics from map chests (owner, 2026-10-05; docs/specs/REWARDS.md), all
 * drawn in code: avatar rings, name styles and the chest itself. Ids match
 * core COSMETICS. Legendary ones move; with Reduce Motion they hold still.
 */

/**
 * Each glow (ids stay `ring.*` from when these were rings; owner, 2026-10-05:
 * "instead of rings, we did a back glow"): its colours, and whether it turns
 * (Galaxy, Prism) or breathes (Epic and up).
 */
export const RING_LOOKS: Record<string, { stops: string[]; turns?: boolean; breathes?: boolean }> = {
  'ring.plum': { stops: [color.plum, color.plumDeep] },
  'ring.silver': { stops: ['#F2F5F9', '#8D99A6'] },
  'ring.ocean': { stops: ['#5FE1F0', '#2F6BFF'] },
  'ring.gold': { stops: ['#FFE39A', '#E0A42C'] },
  'ring.flame': { stops: ['#FFE066', '#FF8A2B', '#E5383B'], breathes: true },
  'ring.aurora': { stops: ['#7CF5C4', '#4DA3FF', '#B57BFF'], breathes: true },
  'ring.galaxy': { stops: ['#7856FF', '#FF7AD9', '#4DA3FF'], turns: true, breathes: true },
  'ring.prism': { stops: ['#FF6B6B', '#FFC857', '#39D98A', '#4DA3FF', '#B57BFF'], turns: true, breathes: true },
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

/** A slow swell, on the native driver (Epic and Legendary glows). */
function useSwell(active: boolean) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active || reduce) return v.setValue(0);
    const half = { duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true };
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, ...half }), Animated.timing(v, { toValue: 0, ...half })]));
    loop.start();
    return () => loop.stop();
  }, [v, active, reduce]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
}

/**
 * A soft light behind the avatar art, spilling past its edge: one colour
 * fading out, or (three colours and up) several blooms around the middle.
 * The art itself is untouched, drawn on top at full size.
 */
export function AvatarGlow({ ring, size, children }: { ring: string; size: number; children: ReactNode }) {
  const look = RING_LOOKS[ring];
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const spin = useTurn(!!look?.turns);
  const swell = useSwell(!!look?.breathes);
  if (!look) return <>{children}</>;
  const spread = Math.round(size * 1.6);
  const c = spread / 2;
  const many = look.stops.length >= 3;
  const blooms = many
    ? look.stops.map((col, i) => {
        const a = (i / look.stops.length) * Math.PI * 2 - Math.PI / 2;
        return { col, x: c + Math.cos(a) * size * 0.16, y: c + Math.sin(a) * size * 0.16, r: c * 0.82 };
      })
    : [{ col: look.stops[0]!, x: c, y: c, r: c }];
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: (size - spread) / 2, top: (size - spread) / 2, width: spread, height: spread, transform: [...(look.turns ? [{ rotate: spin }] : []), { scale: swell }] }}>
        <Svg width={spread} height={spread}>
          <Defs>
            {blooms.map((b, i) => (
              <RadialGradient key={i} id={`${id}${i}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={b.col} stopOpacity={many ? 0.8 : 1} />
                <Stop offset="0.45" stopColor={many ? b.col : (look.stops[1] ?? b.col)} stopOpacity={many ? 0.45 : 0.7} />
                <Stop offset="1" stopColor={many ? b.col : (look.stops[1] ?? b.col)} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {blooms.map((b, i) => (
            <Circle key={i} cx={b.x} cy={b.y} r={b.r} fill={`url(#${id}${i})`} />
          ))}
        </Svg>
      </Animated.View>
      {children}
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
      <Icon name="xp" tint={color.onBrand} size={iconSize.sm} />
      <Text style={[type.label, { color: color.onBrand, fontWeight: '800', fontVariant: ['tabular-nums'] }]}>{`2x ${clock(left)}`}</Text>
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
      style={({ pressed }) => [styles.lockerTile, pressed && { transform: [{ scale: 0.98 }] }]}>
      <Material rarity="quest" soft />
      <ChestArt state="ready" size={64} />
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text style={[type.h2, { color: color.text }]}>Locker</Text>
        {line && <Text style={[type.caption, { color: color.brandText, fontWeight: '700' }]}>{line}</Text>}
      </View>
      <Icon name="forward" tint={color.textMuted} size={iconSize.md} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boostChip: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, backgroundColor: color.brand, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.xxs, minHeight: 32 },
  lockerTile: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.lg, overflow: 'hidden' },
});

/**
 * The owner's chest-opening animation (ui/chest-open-anim: 72 frames at 24 fps,
 * the lid lifting and light filling the chest), played once from the closed
 * chest and held on its last, glowing frame. `onOpen` fires as the lid stands
 * open, about a second in. With Reduce Motion it shows the open chest at once.
 */
const OPENING = { sheet: require('../../assets/images/ui/chest-open-anim.webp'), frames: 72, cols: 8, frameMs: 42, openAt: 22 };
export function ChestOpening({ size, onOpen, play = true }: { size: number; onOpen?: () => void; /** False holds the closed chest (frame 0) until it's time to open. */ play?: boolean }) {
  const reduce = useReduceMotion();
  const last = OPENING.frames - 1;
  const [t] = useState(() => new Animated.Value(reduce && play ? last : 0));
  useEffect(() => {
    if (!play) return;
    if (reduce) {
      t.setValue(last);
      onOpen?.();
      return;
    }
    const run = Animated.timing(t, { toValue: OPENING.frames, duration: OPENING.frames * OPENING.frameMs, easing: Easing.linear, useNativeDriver: true });
    run.start();
    const opened = setTimeout(() => onOpen?.(), OPENING.openAt * OPENING.frameMs);
    return () => {
      run.stop();
      clearTimeout(opened);
    };
    // Plays once, when `play` turns on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);
  const move = useMemo(() => {
    const input: number[] = [];
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < OPENING.frames; i++) {
      const fx = -(i % OPENING.cols) * size;
      const fy = -Math.floor(i / OPENING.cols) * size;
      input.push(i, i + 0.999);
      x.push(fx, fx);
      y.push(fy, fy);
    }
    return {
      translateX: t.interpolate({ inputRange: input, outputRange: x, extrapolate: 'clamp' }),
      translateY: t.interpolate({ inputRange: input, outputRange: y, extrapolate: 'clamp' }),
    };
  }, [t, size]);
  const rows = Math.ceil(OPENING.frames / OPENING.cols);
  return (
    <View style={{ width: size, height: size, overflow: 'hidden' }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.Image
        source={OPENING.sheet}
        style={{ position: 'absolute', left: 0, top: 0, width: size * OPENING.cols, height: size * rows, transform: [{ translateX: move.translateX }, { translateY: move.translateY }] }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
