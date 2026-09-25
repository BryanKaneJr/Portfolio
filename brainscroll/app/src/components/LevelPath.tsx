import { MASTERY_BAND_SIZE } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { DrScroll, Eyebrow, H2, Icon, LevelArt, usePop } from '@/components/ui';
import { chapterFor, levelByNumber, type Chapter } from '@/content';
import { haptic, useReduceMotion } from '@/theme/feedback';
import { color, depth, fw, space, type } from '@/theme/tokens';

type NodeState = 'done' | 'current' | 'locked';

/** How far each waypoint sits from the center line, so the road winds. */
const SWAY = [0, 56, 84, 56, 0, -56, -84, -56, 0, 0];
const ROW = 108; // vertical distance between waypoints
const TOP = 84; // room above the first waypoint when the "Start" callout is there
const TOP_PLAIN = space.md;
const SIZE = { done: 72, locked: 72, current: 84, boss: 96 } as const;
const EDGE = 7; // the darker underside that makes a waypoint stand up
const CALLOUT = 72; // extra room above the next level (past the first) for its callout
/**
 * Scenery: the open pockets across from the road's two bulges (it swings right
 * around the 3rd waypoint and left around the 7th). Each pocket floats the
 * illustration of the level beside it; `x` is the pocket's center as a share
 * of the map's width.
 */
const POCKETS = [
  { index: 2, x: 0.22 },
  { index: 6, x: 0.74 },
] as const;
const SCENERY = 92;

/**
 * The chapter as an adventure map: hexagonal waypoints joined by a dotted road,
 * walked in violet up to where you are and faint beyond, fading into fog the
 * further ahead they lie. Each waypoint shows its level number. The next level
 * is ringed with a bouncing "Start" callout; the chapter's 10th level is the
 * boss: a bigger shield-marked checkpoint (gold on a mastery level). Dr. Scroll
 * reads by the roadside.
 */
export function LevelPath({
  skillId,
  level,
  nextNumber,
  resuming,
  dailyComplete,
  justCleared,
  chapter: forced,
  mascot = true,
  teaser = true,
  onCurrent,
  onOpen,
}: {
  skillId: string;
  /** Highest level cleared. */
  level: number;
  /** The next level to play, if any is published. */
  nextNumber?: number;
  resuming: boolean;
  dailyComplete: boolean;
  /** The level just cleared, whose waypoint pops when Home comes back into view. */
  justCleared?: number;
  /** Draw this chapter instead of the one holding the next level (the skill page shows them all). */
  chapter?: Chapter;
  /** Dr. Scroll by the roadside (only one chapter on a screen should have him). */
  mascot?: boolean;
  /** The "Next: Chapter N" line under the map. */
  teaser?: boolean;
  /** Where the next level's waypoint sits, from the top of this component, so a screen can scroll it into view. */
  onCurrent?: (y: number) => void;
  onOpen: (levelId: string) => void;
}) {
  const [width, setWidth] = useState(340);
  const focus = nextNumber ?? Math.max(level, 1);
  const chapter = forced ?? chapterFor(skillId, focus);
  const first = chapter?.levels[0] ?? Math.floor((focus - 1) / 10) * 10 + 1;
  const last = chapter?.levels[1] ?? first + 9;
  const numbers = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const nextChapter = chapterFor(skillId, last + 1);

  const stateOf = (n: number): NodeState => (n <= level ? 'done' : n === nextNumber ? 'current' : 'locked');
  const current = numbers.findIndex((n) => stateOf(n) === 'current');
  const room = (i: number) => (current > 0 && i >= current ? CALLOUT : 0);
  const top = current === 0 ? TOP : TOP_PLAIN;
  const points = numbers.map((_, i) => ({ x: width / 2 + SWAY[i % SWAY.length]!, y: top + i * ROW + ROW / 2 + room(i) }));
  const height = top + numbers.length * ROW + space.xl + room(numbers.length - 1);
  const [mapY, setMapY] = useState<number | null>(null);
  const currentY = current >= 0 ? points[current]!.y : null;
  useEffect(() => {
    if (mapY !== null && currentY !== null) onCurrent?.(mapY + currentY);
  }, [mapY, currentY, onCurrent]);
  const road = (from: number, to: number) => {
    let d = '';
    for (let i = from; i < to; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const gap = (b.y - a.y) / 2;
      d += `${i === from ? `M ${a.x} ${a.y}` : ''} C ${a.x} ${a.y + gap} ${b.x} ${b.y - gap} ${b.x} ${b.y} `;
    }
    return d;
  };
  // The road is walked up to the next level (or the last one cleared).
  const reached = numbers.filter((n) => stateOf(n) !== 'locked').length - 1;

  return (
    <View style={{ gap: space.lg }}>
      <ChapterBanner chapter={chapter} first={first} last={last} />

      <View
        style={{ height }}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          setMapY(e.nativeEvent.layout.y);
        }}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          {reached < numbers.length - 1 && (
            <Path d={road(Math.max(reached, 0), numbers.length - 1)} stroke={color.borderStrong} strokeWidth={6} strokeLinecap="round" strokeDasharray="0.1 16" fill="none" />
          )}
          {reached > 0 && <Path d={road(0, reached)} stroke={color.brandLine} strokeWidth={8} strokeLinecap="round" strokeDasharray="0.1 14" fill="none" />}
        </Svg>

        {POCKETS.map((pocket) => {
          // Dr. Scroll has the right pocket in the chapter you're in.
          if (mascot && pocket.index === 6) return null;
          const n = numbers[pocket.index];
          const art = n !== undefined ? levelByNumber(skillId, n)?.art : undefined;
          const at = points[pocket.index];
          if (!art || !at) return null;
          return (
            <Floating
              key={pocket.index}
              art={art}
              fogged={stateOf(n!) === 'locked'}
              phase={pocket.index}
              style={{ left: width * pocket.x - SCENERY / 2, top: at.y - SCENERY / 2 }}
            />
          );
        })}
        {mascot && points[6] && (
          <DrScroll spot="home.path" size="md" style={{ position: 'absolute', left: width * POCKETS[1].x - 48, top: points[6].y - 48 }} />
        )}

        {numbers.map((n, i) => {
          const lv = levelByNumber(skillId, n);
          const state = stateOf(n);
          const boss = n % 10 === 0;
          const size = boss ? SIZE.boss : SIZE[state];
          const { x, y } = points[i]!;
          const ahead = nextNumber ? n - nextNumber : 0;
          return (
            <View key={n}>
              {state === 'current' && lv && (
                <StartBubble
                  label={dailyComplete ? 'Done for today' : resuming ? 'Resume' : 'Start'}
                  title={lv.title}
                  x={x}
                  bottom={y - size / 2 - 14}
                  width={width}
                />
              )}
              <View style={{ position: 'absolute', left: x - size / 2, top: y - size / 2 }}>
                <Waypoint
                  n={n}
                  size={size}
                  state={state}
                  boss={boss}
                  gold={n % MASTERY_BAND_SIZE === 0 && state === 'done'}
                  fog={state === 'locked' ? Math.min(0.65, 0.12 * ahead) : 0}
                  celebrate={state === 'done' && n === justCleared}
                  label={
                    state === 'current'
                      ? dailyComplete
                        ? 'Daily knowledge complete'
                        : `${resuming ? 'Resume' : 'Start'} Level ${n}`
                      : `Level ${n}${lv ? `: ${lv.title}` : ''}${state === 'done' ? ', cleared' : ', locked'}`
                  }
                  onPress={
                    lv && state !== 'locked'
                      ? () => {
                          haptic.select();
                          onOpen(lv.id);
                        }
                      : undefined
                  }
                />
                {boss && <Text style={[type.label, styles.bossLabel]}>Checkpoint</Text>}
              </View>
            </View>
          );
        })}
      </View>

      {teaser && nextChapter && (
        <View style={styles.nextChapter}>
          <Icon name="lock" tint={color.textFaint} size={18} />
          <Text style={[type.bodyStrong, { color: color.textMuted, flexShrink: 1 }]}>
            Next: Chapter {nextChapter.number} · {nextChapter.title}
          </Text>
        </View>
      )}
    </View>
  );
}

/** The chapter's banner: which chapter, which levels, its title. */
function ChapterBanner({ chapter, first, last }: { chapter?: Chapter; first?: number; last?: number }) {
  const lo = first ?? chapter?.levels[0] ?? 1;
  const hi = last ?? chapter?.levels[1] ?? lo + 9;
  return (
    <View style={styles.banner}>
      <View style={styles.bannerIcon}>
        <Icon name="map" tint="#FFFFFF" size={24} />
      </View>
      <View style={{ flex: 1, gap: space.xxs }}>
        <Eyebrow style={{ color: 'rgba(255,255,255,0.8)' }}>
          Chapter {chapter?.number ?? Math.ceil(lo / 10)} · Levels {lo}–{hi}
        </Eyebrow>
        {chapter && <H2 style={{ color: '#FFFFFF' }}>{chapter.title}</H2>}
      </View>
    </View>
  );
}

/** Pointy-top hexagon corners inside a box of `w` × `h`, starting at the top. */
function hex(w: number, h: number, dy = 0) {
  const cx = w / 2;
  const r = h / 2;
  return [-90, -30, 30, 90, 150, 210]
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      return `${cx + r * Math.cos(rad) * 1.08},${r + dy + r * Math.sin(rad)}`;
    })
    .join(' ');
}

function Waypoint({ n, size, state, boss, gold, fog, celebrate, label, onPress }: {
  n: number;
  /** 0 to 1: how deep in the fog of war a locked waypoint sits. */
  fog: number;
  size: number;
  state: NodeState;
  boss: boolean;
  gold: boolean;
  celebrate?: boolean;
  label: string;
  onPress?: () => void;
}) {
  const locked = state === 'locked';
  const fill = locked ? color.surfaceRaised : gold ? color.mastery : color.brand;
  const edge = locked ? color.border : gold ? color.masteryEdge : color.brandEdge;
  const ink = locked ? color.textFaint : gold ? '#1A1305' : '#FFFFFF';
  const pop = usePop(celebrate, { from: 0.5, delay: 250 });
  const face = size - EDGE;
  return (
    <Animated.View style={pop}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !onPress }} disabled={!onPress} onPress={onPress}>
        {({ pressed }) => (
          <View style={{ width: size, height: size }}>
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
              {state === 'current' && <Polygon points={hex(size, size - 2, 1)} fill="none" stroke={color.brandLine} strokeWidth={4} />}
              <Polygon points={hex(size, face - (state === 'current' ? 16 : 0), EDGE + (state === 'current' ? 8 : 0))} fill={edge} />
              <Polygon points={hex(size, face - (state === 'current' ? 16 : 0), (pressed ? EDGE : 0) + (state === 'current' ? 8 : 0))} fill={fill} />
            </Svg>
            <View style={[StyleSheet.absoluteFill, styles.center, { opacity: 1 - fog, paddingBottom: pressed ? 0 : EDGE, paddingTop: pressed ? EDGE : 0 }]}>
              {boss ? (
                <Icon name="shield" tint={ink} size={34} />
              ) : (
                <Text style={[styles.number, { color: ink, fontSize: state === 'current' ? 24 : 22 }]}>{n}</Text>
              )}
            </View>
            {state === 'done' && !boss && (
              <View style={[styles.badge, { backgroundColor: color.success }]}>
                <Icon name="check" tint={color.bgDeep} size={14} />
              </View>
            )}
            {locked && !boss && (
              <View style={[styles.badge, { backgroundColor: color.surface, borderWidth: 2, borderColor: color.border }]}>
                <Icon name="lock" tint={color.textFaint} size={12} />
              </View>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** A level's illustration drifting gently in a pocket of the map. Decorative. */
function Floating({ art, fogged, phase, style }: { art: string; fogged: boolean; phase: number; style: { left: number; top: number } }) {
  const reduce = useReduceMotion();
  const [drift] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 1900 + phase * 90, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 1900 + phase * 90, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const t = setTimeout(() => loop.start(), phase * 260);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [drift, reduce, phase]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', opacity: fogged ? 0.3 : 0.95 },
        style,
        { transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }] },
      ]}>
      <LevelArt art={art} size={SCENERY} />
    </Animated.View>
  );
}

/** The bouncing "Start" callout above the next level, with its title. */
function StartBubble({ label, title, x, bottom, width }: { label: string; title: string; x: number; bottom: number; width: number }) {
  const reduce = useReduceMotion();
  const [bob] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, reduce]);
  const w = 210;
  const left = Math.min(Math.max(x - w / 2, 0), width - w);
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.bubble, { width: w, left, bottom: undefined, top: bottom - 64, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}>
      <Text style={[type.label, { color: color.brand, textAlign: 'center' }]}>{label}</Text>
      <Text numberOfLines={1} style={[type.bodyStrong, { color: color.text, textAlign: 'center' }]}>
        {title}
      </Text>
      <View style={[styles.bubbleTail, { left: x - left - 7 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.brand,
    borderBottomWidth: depth.edge,
    borderBottomColor: color.brandEdge,
    borderRadius: 18,
    padding: space.lg,
  },
  bannerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  number: { ...fw('900'), fontVariant: ['tabular-nums'] },
  badge: { position: 'absolute', right: 2, bottom: 4, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bossLabel: { color: color.textMuted, textAlign: 'center', marginTop: space.xs },
  bubble: {
    position: 'absolute',
    zIndex: 2,
    backgroundColor: color.surface,
    borderWidth: depth.border,
    borderColor: color.border,
    borderBottomWidth: depth.edge,
    borderRadius: 16,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -9,
    width: 14,
    height: 14,
    backgroundColor: color.surface,
    borderRightWidth: depth.border,
    borderBottomWidth: depth.border,
    borderColor: color.border,
    transform: [{ rotate: '45deg' }],
  },
  nextChapter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.lg,
    borderTopWidth: depth.border,
    borderColor: color.border,
  },
});
