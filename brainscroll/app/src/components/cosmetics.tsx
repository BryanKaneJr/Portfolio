import { cosmeticItem, masteryTitleName, masteryTitleSkill, RewardError, type CosmeticTier } from '@brainscroll/core';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { router } from 'expo-router';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
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
 * scene (none under Code Rain); Common and Rare scenes are quiet, Epic and
 * Legendary busy.
 */
type Scene = 'fireflies' | 'ripple' | 'bubbles' | 'sunburst' | 'embers' | 'aurora' | 'galaxy' | 'code' | 'equations' | 'constellation' | 'neural' | 'music';
export const RING_LOOKS: Record<string, { scene: Scene; glow: string | null; ink: string }> = {
  'ring.plum': { scene: 'fireflies', glow: color.plum, ink: '#FFE9A8' },
  'ring.silver': { scene: 'ripple', glow: '#B8C4D0', ink: '#F2F5F9' },
  'ring.ocean': { scene: 'bubbles', glow: '#2F6BFF', ink: '#9BEBFF' },
  'ring.gold': { scene: 'sunburst', glow: '#E0A42C', ink: '#FFE39A' },
  'ring.flame': { scene: 'embers', glow: '#FF5A1F', ink: '#FFD166' },
  'ring.aurora': { scene: 'aurora', glow: '#2BD9A0', ink: '#7CF5C4' },
  'ring.galaxy': { scene: 'galaxy', glow: '#7856FF', ink: '#FFFFFF' },
  'ring.prism': { scene: 'code', glow: null, ink: '#39FF8A' },
  'ring.equations': { scene: 'equations', glow: '#5B3FD6', ink: '#E8E1FF' },
  'ring.constellation': { scene: 'constellation', glow: '#1E3A8A', ink: '#FFFFFF' },
  'ring.neural': { scene: 'neural', glow: '#2B3FBF', ink: '#7CE8FF' },
  'ring.music': { scene: 'music', glow: '#8A2D7A', ink: '#FFF1D6' },
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
const NOTES = ['♩', '♪', '♫', '♬'];
/** Sheet Music's notes, by half-steps up from the bottom line: neighbours far apart in height. */
const STAFF_STEPS = [1, 6, 3, 8, 2, 5];
const NOTE_MS = 7200;
const MATHS = ['π', '√', '∑', '∞', 'x²', 'Δ', 'θ', '∫', 'λ', '≈', 'e', '÷', '∂', 'φ'];

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

/**
 * A falling column of code (Code Rain). No backdrop or clipping: each
 * character fades in as it enters the circle and out as it leaves, so the
 * rain dissolves at the edge (owner, 2026-10-07: "just the code and a fade").
 */
function CodeColumn({ x, half, c, spread, glyph, ms, delay, ink, i, active }: { x: number; half: number; c: number; spread: number; glyph: number; ms: number; delay: number; ink: string; i: number; active: boolean }) {
  const t = useCycle(ms, delay, active);
  const n = Math.ceil(spread / glyph) + 2;
  const tall = n * glyph;
  const travel = spread + tall;
  const ramp = Math.min(half * 0.5, glyph * 2.5);
  return (
    <Animated.View style={{ position: 'absolute', left: x, top: 0, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-tall, spread] }) }] }}>
      {Array.from({ length: n }, (_, k) => {
        const head = k === n - 1;
        // When this character's middle crosses the circle's top and bottom in this column.
        const at = (y: number) => (y - k * glyph - glyph / 2 + tall) / travel;
        const fade = t.interpolate({ inputRange: [at(c - half), at(c - half + ramp), at(c + half - ramp), at(c + half)], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
        const base = head ? 1 : 0.25 + (0.65 * k) / n;
        return (
          <Animated.Text
            key={k}
            style={{ fontFamily: MONO, fontSize: glyph * 0.9, lineHeight: glyph, color: head ? '#E9FFF1' : ink, opacity: Animated.multiply(fade, base), textShadowColor: ink, textShadowRadius: head ? 6 : 0 }}>
            {GLYPHS[Math.floor(rand(i, k) * GLYPHS.length)]}
          </Animated.Text>
        );
      })}
    </Animated.View>
  );
}

/** A maths symbol drifting up and fading (Equations). */
function MathSymbol({ x, y, rise, ms, delay, glyph, ink, sym, active }: { x: number; y: number; rise: number; ms: number; delay: number; glyph: number; ink: string; sym: string; active: boolean }) {
  const t = useCycle(ms, delay, active);
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: x - glyph,
        top: y - glyph / 2,
        width: glyph * 2,
        textAlign: 'center',
        fontSize: glyph,
        lineHeight: glyph * 1.2,
        fontWeight: '700',
        color: ink,
        textShadowColor: '#B57BFF',
        textShadowRadius: 8,
        opacity: t.interpolate({ inputRange: [0, 0.2, 0.7, 1], outputRange: [0, 0.95, 0.7, 0] }),
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) }, { scale: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.7, 1, 1.1] }) }],
      }}>
      {sym}
    </Animated.Text>
  );
}

/** A soft twinkle: opacity and size breathe on their own clock. */
function Twinkle({ x, y, r, ink, ms, delay, active }: { x: number; y: number; r: number; ink: string; ms: number; delay: number; active: boolean }) {
  const t = useCycle(ms, delay, active);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        backgroundColor: ink,
        shadowColor: ink,
        shadowOpacity: 1,
        shadowRadius: r * 2,
        opacity: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 1, 0.45] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.25, 0.8] }) }],
      }}
    />
  );
}

/** A straight line between two points, as a thin rotated bar (fades with `opacity`). */
function Link({ a, b, ink, thick, opacity }: { a: { x: number; y: number }; b: { x: number; y: number }; ink: string; thick: number; opacity: Animated.AnimatedInterpolation<number> | number }) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: (a.x + b.x) / 2 - len / 2,
        top: (a.y + b.y) / 2 - thick / 2,
        width: len,
        height: thick,
        borderRadius: thick,
        backgroundColor: ink,
        opacity,
        transform: [{ rotate: `${angle}rad` }],
      }}
    />
  );
}

/** A signal running along one link (Neural Net). */
function Pulse({ a, b, ms, delay, dot, ink, active }: { a: { x: number; y: number }; b: { x: number; y: number }; ms: number; delay: number; dot: number; ink: string; active: boolean }) {
  const t = useCycle(ms, delay, active);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: a.x - dot / 2,
        top: a.y - dot / 2,
        width: dot,
        height: dot,
        borderRadius: dot / 2,
        backgroundColor: '#FFFFFF',
        shadowColor: ink,
        shadowOpacity: 1,
        shadowRadius: dot * 1.5,
        opacity: t.interpolate({ inputRange: [0, 0.05, 0.5, 0.55, 1], outputRange: [0, 1, 1, 0, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, b.x - a.x, b.x - a.x] }) },
          { translateY: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, b.y - a.y, b.y - a.y] }) },
        ],
      }}
    />
  );
}

/** Points around the avatar, between its edge and the scene's: the same for a given seed every time. */
function ringPoints(n: number, c: number, size: number, seed: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (rand(i, seed) - 0.5) * 0.5;
    const r = size * 0.62 + rand(i, seed + 1) * (c * 0.92 - size * 0.62);
    return { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
  });
}

/**
 * Real constellations (owner, 2026-10-07: "a known constellation, like
 * Orion's belt"), as fractions of the scene's radius from its middle, kept off
 * the avatar. Orion lies on its side across the bottom, as it rises, so its
 * belt shows under the avatar; the Big Dipper and Cassiopeia arc over the top.
 */
const SKY: { stars: [number, number][]; links: [number, number][]; bright?: number[] }[] = [
  {
    // Orion: Meissa, Betelgeuse, Bellatrix, Alnitak, Alnilam, Mintaka, Saiph, Rigel.
    stars: [[-0.95, 0.66], [-0.72, 0.5], [-0.68, 0.88], [-0.06, 0.66], [0.04, 0.74], [0.14, 0.82], [0.7, 0.52], [0.72, 0.9]],
    links: [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5], [3, 6], [5, 7]],
    // The belt.
    bright: [3, 4, 5],
  },
  {
    // The Big Dipper: Alkaid, Mizar, Alioth, Megrez, Phecda, Merak, Dubhe.
    stars: [[-0.95, -0.42], [-0.72, -0.66], [-0.44, -0.78], [-0.12, -0.82], [-0.04, -0.64], [0.38, -0.66], [0.3, -0.94]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    // Cassiopeia's W: Caph, Schedar, Navi, Ruchbah, Segin.
    stars: [[-0.82, -0.5], [-0.42, -0.86], [0, -0.66], [0.4, -0.92], [0.82, -0.56]],
    links: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
];
const SKY_MS = 9000;

/** Constellation: one real constellation at a time, its stars appearing and lines drawing in, then on to the next. */
function Constellation({ c, size, ink, active }: { c: number; size: number; ink: string; active: boolean }) {
  const t = useCycle(SKY_MS * SKY.length, 0, active);
  const r = Math.max(1.5, size * 0.024);
  return (
    <>
      {SKY.map((sky, k) => {
        const from = k / SKY.length;
        const span = 1 / SKY.length;
        const at = (u: number) => from + u * span;
        const pts = sky.stars.map(([x, y]) => ({ x: c + x * c, y: c + y * c }));
        const step = 0.55 / sky.links.length;
        return (
          <Animated.View key={k} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: t.interpolate({ inputRange: [0, at(0), at(0.08), at(0.88), at(1), 1].map((v, i, a) => Math.min(1, Math.max(v, i ? a[i - 1]! + 1e-6 : 0))), outputRange: [0, 0, 1, 1, 0, 0] }) }}>
            {sky.links.map(([a, b], i) => (
              <Link key={`l${i}`} a={pts[a]!} b={pts[b]!} ink={ink} thick={Math.max(1, size * 0.009)} opacity={t.interpolate({ inputRange: [0, at(0.1 + i * step), at(0.1 + (i + 1) * step), 1].map((v, j, arr) => Math.min(1, Math.max(v, j ? arr[j - 1]! + 1e-6 : 0))), outputRange: [0, 0, 0.6, 0.6] })} />
            ))}
            {pts.map((p, i) => (
              <Twinkle key={`s${i}`} x={p.x} y={p.y} r={r * (sky.bright?.includes(i) ? 1.5 : 0.85 + rand(i + k * 9, 13) * 0.6)} ink={ink} ms={1600 + rand(i + k * 9, 14) * 1600} delay={rand(i + k * 9, 15) * 1500} active={active} />
            ))}
          </Animated.View>
        );
      })}
    </>
  );
}

/** Neural Net: nodes around the avatar, joined to their neighbours, with signals running along the links. */
function NeuralNet({ c, size, ink, active }: { c: number; size: number; ink: string; active: boolean }) {
  const nodes = ringPoints(10, c, size, 21);
  const links = nodes.flatMap((p, i) => [
    [p, nodes[(i + 1) % nodes.length]!],
    [p, nodes[(i + 2) % nodes.length]!],
  ]);
  const dot = Math.max(2.5, size * 0.035);
  return (
    <>
      {links.map(([a, b], i) => (
        <Link key={`l${i}`} a={a!} b={b!} ink={ink} thick={Math.max(1, size * 0.008)} opacity={i % 2 ? 0.22 : 0.35} />
      ))}
      {links.map(([a, b], i) =>
        i % 3 === 2 ? null : <Pulse key={`p${i}`} a={i % 2 ? b! : a!} b={i % 2 ? a! : b!} ms={1400 + rand(i, 22) * 1400} delay={rand(i, 23) * 2400} dot={dot * 0.8} ink={ink} active={active} />,
      )}
      {nodes.map((p, i) => (
        <Twinkle key={`n${i}`} x={p.x} y={p.y} r={dot * (0.7 + rand(i, 24) * 0.5)} ink={ink} ms={1800 + rand(i, 25) * 1400} delay={rand(i, 26) * 1500} active={active} />
      ))}
    </>
  );
}

/** Sheet Music's staff waves this many times across the circle, rising and falling this many gaps. */
const WAVES = 1.25;
const SWELL = 1.1;
/** Where along its run (0 → 1) the staff's wave is sampled for a note to ride it. */
const RIDE = Array.from({ length: 25 }, (_, i) => i / 24);

/** One note riding the wavy staff left to right, fading in and out at the circle's edge (Sheet Music). */
function Note({ y, half, c, glyph, ms, delay, ink, sym, rise, active }: { y: number; half: number; c: number; glyph: number; ms: number; delay: number; ink: string; sym: string; rise: number[]; active: boolean }) {
  const t = useCycle(ms, delay, active);
  const ramp = 0.2;
  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: c - half - glyph / 2,
        // The glyph's head sits low in its box: lift it so the head lands on its line or space.
        top: y - glyph * 0.62,
        width: glyph,
        textAlign: 'center',
        fontSize: glyph,
        lineHeight: glyph * 1.1,
        color: ink,
        textShadowColor: '#FF8BD8',
        textShadowRadius: 6,
        opacity: t.interpolate({ inputRange: [0, ramp, 1 - ramp, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, half * 2] }) }, { translateY: t.interpolate({ inputRange: RIDE, outputRange: rise }) }],
      }}>
      {sym}
    </Animated.Text>
  );
}

/** Sheet Music: a five-line staff waving across the circle, notes riding its waves behind the avatar. */
function SheetMusic({ c, size, ink, active }: { c: number; size: number; ink: string; active: boolean }) {
  const id = `st${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const gap = Math.max(4, size * 0.1);
  const spread = c * 2;
  const half = Math.sqrt(Math.max(0, c * c - gap * gap * 4)) * 0.92;
  // The wave's rise at x: every line (and every note) shares it, so the staff moves as one ribbon.
  const wave = (x: number) => Math.sin(((x - (c - half)) / (half * 2)) * WAVES * Math.PI * 2) * gap * SWELL;
  const path = (y: number) =>
    RIDE.map((u, i) => {
      const x = c - half + u * half * 2;
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${(y + wave(x)).toFixed(1)}`;
    }).join(' ');
  const rise = RIDE.map((u) => wave(c - half + u * half * 2));
  const glyph = gap * 3;
  return (
    <>
      <Svg width={spread} height={spread} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={ink} stopOpacity={0} />
            <Stop offset="0.2" stopColor={ink} stopOpacity={0.55} />
            <Stop offset="0.8" stopColor={ink} stopOpacity={0.55} />
            <Stop offset="1" stopColor={ink} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[-2, -1, 0, 1, 2].map((k) => (
          <Path key={k} d={path(c + k * gap)} fill="none" stroke={`url(#${id})`} strokeWidth={1.5} strokeLinejoin="round" />
        ))}
      </Svg>
      {/* One conveyor: the same speed for every note, evenly spaced in time and alternating high and low, so none ever overlap. */}
      {STAFF_STEPS.map((step, i) => {
        const y = c + gap * 2 - step * (gap / 2);
        return <Note key={i} y={y} half={half} c={c} glyph={glyph} ms={NOTE_MS} delay={(i * NOTE_MS) / STAFF_STEPS.length} ink={ink} sym={NOTES[i % NOTES.length]!} rise={rise} active={active} />;
      })}
    </>
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
      <View style={{ position: 'absolute', width: spread, height: spread }}>
        {Array.from({ length: cols }, (_, i) => {
          const mid = i * glyph + glyph / 2;
          // The circle's half-height in this column; columns at the very edge are left out.
          const half = Math.sqrt(Math.max(0, c * c - (mid - c) * (mid - c)));
          if (half < glyph * 1.5) return null;
          return <CodeColumn key={i} i={i} x={i * glyph + glyph * 0.1} half={half} c={c} spread={spread} glyph={glyph} ms={2200 + rand(i, 1) * 2600} delay={rand(i, 2) * 2500} ink={ink} active={active} />;
        })}
      </View>
    );
  }
  if (scene === 'constellation') return <Constellation c={c} size={size} ink={ink} active={active} />;
  if (scene === 'neural') return <NeuralNet c={c} size={size} ink={ink} active={active} />;
  if (scene === 'music') return <SheetMusic c={c} size={size} ink={ink} active={active} />;
  if (scene === 'equations')
    return (
      <>
        {Array.from({ length: 10 }, (_, i) => {
          const side = i % 2 ? 1 : -1;
          const x = c + side * (size * 0.5 + rand(i, 31) * (c - size * 0.5) * 0.85);
          return (
            <MathSymbol
              key={i}
              x={x}
              y={c + spread * 0.25 - rand(i, 32) * spread * 0.2}
              rise={spread * 0.45}
              ms={2600 + rand(i, 33) * 1800}
              delay={rand(i, 34) * 2600}
              glyph={Math.max(9, size * (0.12 + rand(i, 35) * 0.06))}
              ink={ink}
              sym={MATHS[Math.floor(rand(i, 36) * MATHS.length)]!}
              active={active}
            />
          );
        })}
      </>
    );
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
  // Without its scene (small avatars), Code Rain keeps a faint light in its green.
  const light = look.glow ?? (scene ? null : look.ink);
  return (
    <View style={{ width: size, height: size }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: (size - spread) / 2, top: (size - spread) / 2, width: spread, height: spread }}>
        {light && (
          <Svg width={spread} height={spread} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id={id} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={light} stopOpacity={0.9} />
                <Stop offset="0.5" stopColor={light} stopOpacity={0.45} />
                <Stop offset="1" stopColor={light} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={c} cy={c} r={c} fill={`url(#${id})`} />
          </Svg>
        )}
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
