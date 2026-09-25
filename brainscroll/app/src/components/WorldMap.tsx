import { subjectAttribute } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { SUBJECT_ICON } from '@/components/CharacterSheet';
import { DrScroll, Icon, LevelArt, usePop } from '@/components/ui';
import { haptic, useReduceMotion } from '@/theme/feedback';
import { color, depth, fw, radius, space, subjectColor, type } from '@/theme/tokens';

/** One subject on the World Map. */
export type Region = {
  subjectId: string;
  name: string;
  /** Levels cleared across the subject's skills (CURRENT_PRODUCT_DECISIONS.md §15). */
  levelsCleared: number;
  /** Names of its playable skills, shown under the plate. */
  skills: string[];
};

/** Each subject's landmark, floating on its island, and the smaller scenery drifting beside it. */
const LANDMARK: Record<string, { art: string; scenery: string }> = {
  'subject.history': { art: 'rome.colosseum', scenery: 'rome.aqueduct' },
  'subject.science': { art: 'astronomy.saturn', scenery: 'body.neuron' },
  'subject.geography': { art: 'object.globe', scenery: 'geo.mountains' },
  'subject.money': { art: 'money.piggy-bank', scenery: 'money.coin-plant' },
  'subject.arts': { art: 'object.palette', scenery: 'arts.easel' },
  'subject.world_systems': { art: 'technology.gears', scenery: 'technology.lightbulb' },
};

const ROW = 236; // vertical room per region
const ISLAND_RX = 0.34; // island half-width, as a share of the map width
const ISLAND_RY = 100;
const LABEL = 230; // the island's label column
const DISC = 112;
const CLIFF = 10; // the island's darker underside, for depth

/**
 * The World Map (visual-direction.md "Home"): every subject is an island on an
 * overworld, joined by a dotted road. Each island floats its landmark inside a
 * ring that fills toward Lv. 100 in the subject's colour, over a plate with its
 * name and level. The subject you're playing flies a flag, with Dr. Scroll
 * standing guard in the open space beside it. Mastered subjects turn gold (★).
 */
export function WorldMap({ regions, hereId, onOpen }: { regions: Region[]; hereId?: string; onOpen: (subjectId: string) => void }) {
  const [width, setWidth] = useState(0);
  const centers = regions.map((_, i) => ({ x: width * (i % 2 === 0 ? 0.36 : 0.64), y: ROW * i + ROW / 2 }));
  const height = ROW * regions.length;

  // The road: a smooth S between island centres.
  let road = '';
  centers.forEach((c, i) => {
    if (i === 0) road = `M ${c.x} ${c.y}`;
    else {
      const p = centers[i - 1]!;
      road += ` C ${p.x} ${p.y + ROW * 0.55} ${c.x} ${c.y - ROW * 0.55} ${c.x} ${c.y}`;
    }
  });

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Path d={road} stroke={color.borderStrong} strokeWidth={4} strokeDasharray="1 12" strokeLinecap="round" fill="none" />
            {regions.map((r, i) => {
              const c = centers[i]!;
              const tint = subjectColor[r.subjectId] ?? color.textMuted;
              const rx = width * ISLAND_RX;
              return (
                <G key={r.subjectId}>
                  <Path d={blob(c.x, c.y + CLIFF, rx, ISLAND_RY, i)} fill={tint} fillOpacity={0.22} />
                  <Path d={blob(c.x, c.y, rx, ISLAND_RY, i)} fill={color.surface} stroke={tint} strokeOpacity={0.55} strokeWidth={2} />
                  <Path d={blob(c.x, c.y, rx, ISLAND_RY, i)} fill={tint} fillOpacity={0.08} />
                </G>
              );
            })}
          </Svg>
          {regions.map((r, i) => {
            const c = centers[i]!;
            const here = r.subjectId === hereId;
            // The open side of the zigzag: Dr. Scroll where you are, scenery elsewhere.
            const side = i % 2 === 0 ? width * 0.86 : width * 0.14;
            return (
              <View key={r.subjectId} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                {here ? (
                  <View pointerEvents="none" style={{ position: 'absolute', left: side - 48, top: c.y - 56, alignItems: 'center' }}>
                    <DrScroll spot="home.path" pose="map" size="md" />
                  </View>
                ) : (
                  <Drift art={LANDMARK[r.subjectId]?.scenery} phase={i} style={{ left: side - 30, top: c.y - 44 }} />
                )}
                <Island region={r} here={here} phase={i} style={{ left: c.x - LABEL / 2, top: c.y - DISC / 2 - 30 }} onOpen={onOpen} />
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

function Island({ region, here, phase, style, onOpen }: { region: Region; here: boolean; phase: number; style: { left: number; top: number }; onOpen: (subjectId: string) => void }) {
  const attr = subjectAttribute(region.levelsCleared);
  const mastered = attr.stars > 0;
  const tint = subjectColor[region.subjectId] ?? color.textMuted;
  const [taps, setTaps] = useState(0);
  const popStyle = usePop(taps);
  const landmark = LANDMARK[region.subjectId];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${region.name}, level ${attr.level}`}
      onPress={() => {
        haptic.select();
        setTaps((n) => n + 1);
        onOpen(region.subjectId);
      }}
      style={[{ position: 'absolute', width: LABEL, alignItems: 'center' }, style]}>
      <Animated.View style={[{ alignItems: 'center' }, popStyle]}>
        <View style={{ width: DISC, height: DISC, alignItems: 'center', justifyContent: 'center' }}>
          <LevelRing share={attr.share} tint={tint} />
          <Bob phase={phase}>
            <LevelArt art={landmark?.art} size={DISC - 28} />
          </Bob>
          {here && (
            <View style={[styles.flag, { backgroundColor: tint }]}>
              <Icon name="flag" tint={color.bgDeep} size={14} />
            </View>
          )}
        </View>
        <View style={[styles.plate, { borderColor: tint, borderBottomColor: tint }]}>
          <View style={[styles.icon, { backgroundColor: tint }]}>
            <Icon name={SUBJECT_ICON[region.subjectId] ?? 'world'} tint={color.bgDeep} size={14} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.name, mastered && { color: color.mastery }]} numberOfLines={1}>
              {region.name}
              {mastered ? ` ${'★'.repeat(Math.min(attr.stars, 3))}` : ''}
            </Text>
            <Text style={[styles.level, { color: mastered ? color.mastery : tint }]}>Lv. {attr.level}</Text>
          </View>
        </View>
        {here && <Text style={[styles.here, { color: tint }]}>You are here</Text>}
      </Animated.View>
    </Pressable>
  );
}

/** A ring around the landmark that fills toward Lv. 100 in the subject's colour. */
function LevelRing({ share, tint }: { share: number; tint: string }) {
  const r = DISC / 2 - 5;
  const circ = 2 * Math.PI * r;
  return (
    <Svg width={DISC} height={DISC} style={StyleSheet.absoluteFill}>
      <Circle cx={DISC / 2} cy={DISC / 2} r={r + 1} fill={color.bgDeep} />
      <Circle cx={DISC / 2} cy={DISC / 2} r={r} stroke={color.border} strokeWidth={6} fill="none" />
      {share > 0 && (
        <Circle
          cx={DISC / 2}
          cy={DISC / 2}
          r={r}
          stroke={tint}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(share, 0.02) * circ} ${circ}`}
          transform={`rotate(-90 ${DISC / 2} ${DISC / 2})`}
        />
      )}
    </Svg>
  );
}

/** A gentle up-and-down float (still with reduce motion). */
function Bob({ phase, children, lift = 5 }: { phase: number; children: React.ReactNode; lift?: number }) {
  const reduce = useReduceMotion();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 2100 + phase * 110, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 2100 + phase * 110, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const timer = setTimeout(() => loop.start(), phase * 240);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [t, reduce, phase]);
  return <Animated.View style={{ transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -lift] }) }] }}>{children}</Animated.View>;
}

function Drift({ art, phase, style }: { art?: string; phase: number; style: { left: number; top: number } }) {
  if (!art) return null;
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', opacity: 0.55 }, style]}>
      <Bob phase={phase + 3} lift={8}>
        <LevelArt art={art} size={60} />
      </Bob>
    </View>
  );
}

/**
 * A soft, irregular island outline around (cx, cy): eight points at slightly
 * different radii (fixed per index, so it never changes between renders),
 * joined by a smooth closed curve.
 */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number): string {
  const n = 8;
  const pts = Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    const wobble = 0.86 + 0.16 * Math.abs(Math.sin(seed * 1.7 + k * 2.3));
    return { x: cx + Math.cos(a) * rx * wobble, y: cy + Math.sin(a) * ry * wobble };
  });
  // Catmull-Rom through the points, as cubic Béziers.
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let k = 0; k < n; k++) {
    const p0 = pts[(k - 1 + n) % n]!;
    const p1 = pts[k]!;
    const p2 = pts[(k + 1) % n]!;
    const p3 = pts[(k + 2) % n]!;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6} ${p2.x} ${p2.y}`;
  }
  return `${d} Z`;
}

const styles = StyleSheet.create({
  plate: {
    marginTop: -10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: 4,
    paddingRight: space.md,
    paddingVertical: 5,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceRaised,
    borderWidth: depth.border,
    borderBottomWidth: depth.edge,
    maxWidth: LABEL,
  },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { ...type.bodyStrong, ...fw('800'), color: color.text, lineHeight: 20 },
  level: { fontSize: 13, ...fw('800'), lineHeight: 16 },
  here: { ...type.label, marginTop: space.xs },
  flag: { position: 'absolute', top: -2, right: 2, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.bgDeep },
});
