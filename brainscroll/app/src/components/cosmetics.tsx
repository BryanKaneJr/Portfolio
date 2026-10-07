import { cosmeticItem, masteryTitleName, masteryTitleSkill, RewardError, type CosmeticTier } from '@brainscroll/core';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { getSkill } from '@/content';
import { feedback, useReduceMotion } from '@/theme/feedback';
import { Material } from '@/components/rewardsUi';
import { Button, Icon, Notice } from '@/components/ui';
import { UI_ART } from '@/components/ui/uiArt';
import { useProgress } from '@/progress/ProgressProvider';
import { color, iconSize, radius, space, type } from '@/theme/tokens';

/**
 * Cosmetics from map chests (owner, 2026-10-05; docs/specs/REWARDS.md), all
 * drawn in code: avatar glows, name styles and the chest itself. Ids match
 * core COSMETICS. Legendary ones move; with Reduce Motion they hold still.
 */

/**
 * Each glow is a small animated scene behind the avatar (owner, 2026-10-07:
 * "what we have is boring", Matrix code rain as one of them). Ids stay
 * `ring.*` from when these were rings. `glow` is the soft light under the
 * scene; Common and Rare scenes are quiet, Epic and Legendary busy.
 */
type Scene = 'fireflies' | 'ripple' | 'bubbles' | 'sunburst' | 'embers' | 'aurora' | 'galaxy' | 'code';
export const RING_LOOKS: Record<string, { scene: Scene; glow: string; ink: string }> = {
  'ring.plum': { scene: 'fireflies', glow: color.plum, ink: '#FFE9A8' },
  'ring.silver': { scene: 'ripple', glow: '#B8C4D0', ink: '#F2F5F9' },
  'ring.ocean': { scene: 'bubbles', glow: '#2F6BFF', ink: '#9BEBFF' },
  'ring.gold': { scene: 'sunburst', glow: '#E0A42C', ink: '#FFE39A' },
  'ring.flame': { scene: 'embers', glow: '#FF5A1F', ink: '#FFD166' },
  'ring.aurora': { scene: 'aurora', glow: '#2BD9A0', ink: '#7CF5C4' },
  'ring.galaxy': { scene: 'galaxy', glow: '#7856FF', ink: '#FFFFFF' },
  'ring.prism': { scene: 'code', glow: '#0FA958', ink: '#39FF8A' },
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

/** Below this size (league rows, the feed) a glow is just its light: no scene. */
const SCENE_MIN = 48;
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789';

/** 0 → 1 over and over, from `delay`, on the native driver; still with Reduce Motion. */
function useCycle(ms: number, delay: number, active: boolean) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    if (!active || reduce) return v.setValue(0.5);
    v.setValue(0);
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: true }));
    const t = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [v, ms, delay, active, reduce]);
  return v;
}

/** A small deterministic scatter, so a scene looks the same every time. */
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** One drifting thing: moves from `from` to `to` over `ms`, fading in and out (embers, bubbles, fireflies). */
function Mote({ x, y, from, to, ms, delay, dot, colorIn, ring, active }: { x: number; y: number; from: [number, number]; to: [number, number]; ms: number; delay: number; dot: number; colorIn: string; ring?: boolean; active: boolean }) {
  const t = useCycle(ms, delay, active);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x - dot / 2,
        top: y - dot / 2,
        width: dot,
        height: dot,
        borderRadius: dot / 2,
        ...(ring ? { borderWidth: Math.max(1, dot / 7), borderColor: colorIn, backgroundColor: 'rgba(255,255,255,0.08)' } : { backgroundColor: colorIn, shadowColor: colorIn, shadowOpacity: 0.9, shadowRadius: dot }),
        opacity: t.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 0.8, 0] }),
        transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from[0], to[0]] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [from[1], to[1]] }) }],
      }}
    />
  );
}

/** A falling column of code (Code Rain). */
function CodeColumn({ x, spread, glyph, ms, delay, ink, i, active }: { x: number; spread: number; glyph: number; ms: number; delay: number; ink: string; i: number; active: boolean }) {
  const t = useCycle(ms, delay, active);
  const n = Math.ceil(spread / glyph) + 2;
  const chars = Array.from({ length: n }, (_, k) => GLYPHS[Math.floor(rand(i, k) * GLYPHS.length)]!);
  const tall = n * glyph;
  return (
    <Animated.View style={{ position: 'absolute', left: x, top: 0, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-tall, spread] }) }] }}>
      {chars.map((c, k) => (
        <Text key={k} style={{ fontFamily: MONO, fontSize: glyph * 0.9, lineHeight: glyph, color: k === n - 1 ? '#E9FFF1' : ink, opacity: k === n - 1 ? 1 : 0.25 + (0.65 * k) / n, textShadowColor: ink, textShadowRadius: k === n - 1 ? 6 : 0 }}>
          {c}
        </Text>
      ))}
    </Animated.View>
  );
}

/** The scene for one glow, `spread` points square, centred on the avatar. */
function GlowScene({ scene, spread, size, ink, active }: { scene: Scene; spread: number; size: number; ink: string; active: boolean }) {
  const c = spread / 2;
  const turn = useCycle(scene === 'galaxy' ? 24000 : 16000, 0, active && (scene === 'sunburst' || scene === 'galaxy'));
  const sway = useCycle(7000, 0, active && scene === 'aurora');
  const spin = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const dot = Math.max(3, size * 0.05);
  if (scene === 'code') {
    const glyph = Math.max(8, Math.round(size * 0.11));
    const cols = Math.floor(spread / glyph);
    return (
      <View style={{ position: 'absolute', width: spread, height: spread, borderRadius: c, overflow: 'hidden', backgroundColor: 'rgba(3,20,10,0.75)' }}>
        {Array.from({ length: cols }, (_, i) => (
          <CodeColumn key={i} i={i} x={i * glyph + glyph * 0.1} spread={spread} glyph={glyph} ms={2200 + rand(i, 1) * 2600} delay={rand(i, 2) * 2500} ink={ink} active={active} />
        ))}
      </View>
    );
  }
  if (scene === 'ripple')
    return (
      <>
        {[0, 1, 2].map((i) => (
          <Ripple key={i} c={c} size={size} delay={i * 1100} ink={ink} active={active} />
        ))}
      </>
    );
  if (scene === 'sunburst')
    return (
      <Animated.View style={{ position: 'absolute', width: spread, height: spread, transform: [{ rotate: spin }] }}>
        <Svg width={spread} height={spread}>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const w = 0.09;
            const p = (r: number, d: number) => `${c + Math.cos(a + d) * r} ${c + Math.sin(a + d) * r}`;
            return <Path key={i} d={`M ${p(size * 0.3, -w)} L ${p(c, 0)} L ${p(size * 0.3, w)} Z`} fill={ink} opacity={i % 2 ? 0.35 : 0.6} />;
          })}
        </Svg>
      </Animated.View>
    );
  if (scene === 'galaxy')
    return (
      <Animated.View style={{ position: 'absolute', width: spread, height: spread, transform: [{ rotate: spin }] }}>
        <Svg width={spread} height={spread}>
          {Array.from({ length: 36 }, (_, i) => {
            const arm = i % 2;
            const r = size * 0.38 + (i / 36) * (c - size * 0.38);
            const a = arm * Math.PI + (i / 36) * Math.PI * 1.6 + rand(i, 3) * 0.3;
            return <Circle key={i} cx={c + Math.cos(a) * r} cy={c + Math.sin(a) * r} r={Math.max(0.8, dot * (0.25 + rand(i, 4) * 0.5))} fill={i % 5 === 0 ? '#FF9BE8' : ink} opacity={0.5 + rand(i, 5) * 0.5} />;
          })}
        </Svg>
      </Animated.View>
    );
  if (scene === 'aurora') {
    const bands = [
      { col: '#39F5B0', y: 0.3, w: 0.95 },
      { col: '#4DA3FF', y: 0.5, w: 0.8 },
      { col: '#B57BFF', y: 0.68, w: 0.9 },
    ];
    return (
      <View style={{ position: 'absolute', width: spread, height: spread, borderRadius: c, overflow: 'hidden' }}>
        {bands.map((b, i) => (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: spread * b.y - spread * 0.12,
              width: spread,
              height: spread * 0.24,
              transform: [
                { translateX: sway.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-spread * 0.12 * (i % 2 ? -1 : 1), spread * 0.12 * (i % 2 ? -1 : 1), -spread * 0.12 * (i % 2 ? -1 : 1)] }) },
                { scaleY: sway.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 1.2, 0.7] }) },
              ],
            }}>
            <Svg width={spread} height={spread * 0.24}>
              <Defs>
                <RadialGradient id={`au${i}`} cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0" stopColor={b.col} stopOpacity={0.75} />
                  <Stop offset="1" stopColor={b.col} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx={spread / 2} cy={spread * 0.12} rx={(spread * b.w) / 2} ry={spread * 0.12} fill={`url(#au${i})`} />
            </Svg>
          </Animated.View>
        ))}
      </View>
    );
  }
  // Motes: fireflies wander, bubbles and embers rise.
  const count = scene === 'fireflies' ? 8 : scene === 'bubbles' ? 12 : 18;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        if (scene === 'fireflies') {
          const a = rand(i, 1) * Math.PI * 2;
          const r = size * 0.55 + rand(i, 2) * (c - size * 0.6);
          const x = c + Math.cos(a) * r;
          const y = c + Math.sin(a) * r;
          return <Mote key={i} x={x} y={y} from={[0, 4]} to={[(rand(i, 3) - 0.5) * size * 0.25, -size * 0.12]} ms={2600 + rand(i, 4) * 1800} delay={rand(i, 5) * 2400} dot={dot} colorIn={ink} active={active} />;
        }
        // Either side of the avatar, so they rise around it rather than behind it.
        const side = i % 2 ? 1 : -1;
        const x = c + side * (size * 0.42 + rand(i, 1) * (c - size * 0.42) * 0.9);
        const rise = scene === 'bubbles' ? spread * 0.7 : spread * 0.6;
        return (
          <Mote
            key={i}
            x={x}
            y={c + spread * 0.32}
            from={[0, 0]}
            to={[(rand(i, 3) - 0.5) * size * 0.3, -rise]}
            ms={scene === 'bubbles' ? 3200 + rand(i, 4) * 1800 : 1800 + rand(i, 4) * 1400}
            delay={rand(i, 5) * 2000}
            dot={scene === 'bubbles' ? dot * (1.3 + rand(i, 6) * 1.6) : dot * (0.8 + rand(i, 6) * 0.9)}
            colorIn={scene === 'embers' && i % 3 === 0 ? '#FF7A2B' : ink}
            ring={scene === 'bubbles'}
            active={active}
          />
        );
      })}
    </>
  );
}

/** One ring of a ripple, widening from the avatar's edge and fading. */
function Ripple({ c, size, delay, ink, active }: { c: number; size: number; delay: number; ink: string; active: boolean }) {
  const t = useCycle(3300, delay, active);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: c - size / 2,
        top: c - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(1.5, size * 0.025),
        borderColor: ink,
        opacity: t.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.8, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
      }}
    />
  );
}

/**
 * The glow behind the avatar: a soft light in its colour and, at 48 points
 * and up, its animated scene. The art itself is untouched, drawn on top.
 */
export function AvatarGlow({ ring, size, children }: { ring: string; size: number; children: ReactNode }) {
  const look = RING_LOOKS[ring];
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (!look) return <>{children}</>;
  const spread = Math.round(size * 1.7);
  const c = spread / 2;
  const scene = size >= SCENE_MIN;
  return (
    <View style={{ width: size, height: size }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: (size - spread) / 2, top: (size - spread) / 2, width: spread, height: spread }}>
        <Svg width={spread} height={spread} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={id} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={look.glow} stopOpacity={0.9} />
              <Stop offset="0.5" stopColor={look.glow} stopOpacity={0.45} />
              <Stop offset="1" stopColor={look.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={c} fill={`url(#${id})`} />
        </Svg>
        {scene && <GlowScene scene={look.scene} spread={spread} size={size} ink={look.ink} active />}
      </View>
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

/** The header chip while a boost runs: "2x XP 12:05". Opens Profile, where boosts live. */
export function BoostChip() {
  const left = useBoostLeft();
  if (left === null) return null;
  return (
    <Pressable
      testID="boost-chip"
      accessibilityRole="button"
      accessibilityLabel={`2x XP boost, ${Math.ceil(left / 60000)} minutes left. Open`}
      onPress={() => router.navigate('/profile')}
      style={({ pressed }) => [styles.boostChip, pressed && { opacity: 0.8 }]}>
      <Icon name="xp" tint={color.onBrand} size={iconSize.sm} />
      <Text style={[type.label, { color: color.onBrand, fontWeight: '800', fontVariant: ['tabular-nums'] }]}>{`2x ${clock(left)}`}</Text>
    </Pressable>
  );
}

/**
 * XP boosts on Profile (owner, 2026-10-07: "just a bar that appears if you
 * have xp boosts available"): the running one with its time left, and each
 * saved one with Start. Nothing shows without boosts.
 */
export function BoostBars() {
  const p = useProgress();
  const { locker } = p.snapshot;
  const left = useBoostLeft();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const saved = locker.boosts.filter((b) => !b.startedAt);
  const running = locker.activeBoost;
  if (!(running && left !== null) && saved.length === 0) return null;
  const start = async (id: string) => {
    setBusy(id);
    setNotice(null);
    try {
      await p.rewards.startBoost(id);
      feedback('select');
    } catch (e) {
      setNotice(e instanceof RewardError && e.code === 'BOOST_ACTIVE' ? 'One boost at a time.' : 'That didn’t start. Try again.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <View style={{ gap: space.sm }}>
      {running && left !== null && (
        <View style={styles.boostBar}>
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
        <View key={b.id} style={styles.boostBar}>
          <Material rarity="quest" soft />
          <BoostBadge />
          <Text style={[type.title, { flex: 1, color: color.text }]}>{`${boostLength(b.minutes)} XP boost`}</Text>
          <Button compact label="Start" testID={`start-boost-${b.minutes}`} disabled={left !== null} loading={busy === b.id} onPress={() => void start(b.id)} />
        </View>
      ))}
      {notice && <Notice tone="danger">{notice}</Notice>}
    </View>
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
  boostChip: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, backgroundColor: color.brand, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.xxs, minHeight: 32 },
  boostBar: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, overflow: 'hidden' },
  badge: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.onBrand, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden', marginTop: space.xs },
  fill: { height: 6, borderRadius: 3, backgroundColor: color.onBrand },
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
