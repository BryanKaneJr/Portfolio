import { MASTERY_BAND_SIZE, RECAP_OPENING, SKILL_GUIDE_POSE } from '@brainscroll/core';
import { useEffect, useId, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Polygon } from 'react-native-svg';
import { Caption, DrScroll, Eyebrow, Icon, type IconName, LevelArt, Title, ease, useLoop, usePop } from '@/components/ui';
import { chapterFor, levelByNumber, skills, type Chapter } from '@/content';
import { sceneryArt } from '@/content/scenery';
import { skillTint, type SubjectTint } from '@/theme/subjectTheme';
import { feedback } from '@/theme/feedback';
import { color, depth, iconSize, space, type } from '@/theme/tokens';

type NodeState = 'done' | 'current' | 'locked';

/** How far each waypoint sits from the center line, so the road winds. */
const SWAY = [0, 56, 84, 56, 0, -56, -84, -56, 0, 0];
const ROW = 108; // vertical distance between waypoints
const TOP = 84; // room above the first waypoint when the "Start" callout is there
const TOP_PLAIN = space.md;
const SIZE = { done: 72, locked: 72, current: 84, boss: 96 } as const;
// Cleared waypoints: a muted face in the subject's colour with its light
// numbers, so only the next level is bright (UX review P4); AA either way
// (theme/subjectTheme.ts).
const EDGE = 11; // the darker side that makes a waypoint a chunky, pressable object
const CALLOUT = 72; // extra room above the next level (past the first) for its callout
/**
 * Scenery: the open pockets across from the road's two bulges (it swings right
 * around the 3rd waypoint and left around the 7th). Each pocket floats the
 * illustration of the level beside it; `x` is the pocket's center as a share
 * of the map's width. The 3rd and 7th levels match core SCENERY_LEVELS_IN_CHAPTER.
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
 *
 * Every state has a shape as well as a colour: cleared waypoints carry a
 * check, locked ones a lock, the next one a ring and its callout. Each
 * waypoint is one button to screen readers, named with its level, title,
 * kind and state ("Level 10: Rome falls, checkpoint, cleared"); the callout,
 * scenery and road are decoration. Fixed-size map labels cap their text
 * scaling so they stay on their waypoint.
 */
export function LevelPath({
  skillId,
  level,
  nextNumber,
  dailyComplete,
  justCleared,
  chapter: forced,
  mascot = true,
  teaser = true,
  onCurrent,
  onOpen,
  aside,
}: {
  skillId: string;
  /** Highest level cleared. */
  level: number;
  /** The next level to play, if any is published. */
  nextNumber?: number;
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
  /** Pinned beside the top of the road, on the left (this week's quest tile). */
  aside?: React.ReactNode;
}) {
  const [width, setWidth] = useState(340);
  // The skill's subject colour (theme/subjectTheme.ts).
  const tint = skillTint(skillId, skills);
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
      <ChapterBanner chapter={chapter} first={first} last={last} level={level} tint={tint} />

      <View
        style={{ height }}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width);
          setMapY(e.nativeEvent.layout.y);
        }}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {reached < numbers.length - 1 && (
            <Path d={road(Math.max(reached, 0), numbers.length - 1)} stroke={color.borderStrong} strokeWidth={6} strokeLinecap="round" strokeDasharray="0.1 16" fill="none" />
          )}
          {reached > 0 && <Path d={road(0, reached)} stroke={tint.line} strokeWidth={8} strokeLinecap="round" strokeDasharray="0.1 14" fill="none" />}
        </Svg>

        {POCKETS.map((pocket) => {
          // Dr. Scroll has the right pocket in the chapter you're in.
          if (mascot && pocket.index === 6) return null;
          const n = numbers[pocket.index];
          // Chosen so no picture repeats within three chapters (content/scenery.ts).
          const art = n !== undefined ? sceneryArt(skillId, n) : undefined;
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
        {aside && points[0] && <View style={{ position: 'absolute', left: 0, top: Math.max(points[0].y - 48, 0) }}>{aside}</View>}
        {mascot && points[6] && (
          // Big beside the road, like a character in the scene (owner, 2026-10-01).
          <DrScroll spot="home.path" pose={SKILL_GUIDE_POSE[skillId]} size="lg" style={{ position: 'absolute', left: Math.min(width * POCKETS[1].x - 84, width - 168), top: points[6].y - 96 }} />
        )}

        {numbers.map((n, i) => {
          const lv = levelByNumber(skillId, n);
          const state = stateOf(n);
          const boss = n % 10 === 0;
          const size = boss ? SIZE.boss : SIZE[state];
          const { x, y } = points[i]!;
          const ahead = nextNumber ? n - nextNumber : 0;
          const kind = !boss ? '' : n % MASTERY_BAND_SIZE === 0 ? 'Mastery' : n % 50 === 0 ? 'Milestone' : 'Checkpoint';
          const title = lv ? `: ${lv.title}` : '';
          const kindSaid = kind ? `, ${kind.toLowerCase()}` : '';
          return (
            <View key={n}>
              {state === 'current' && lv && (
                <StartBubble tint={tint}
                  label={`${dailyComplete ? 'No Brainpower' : 'Start'} · Level ${n}`}
                  title={lv.title}
                  x={x}
                  bottom={y - size / 2 - 14}
                  width={width}
                />
              )}
              <View style={{ position: 'absolute', left: x - size / 2, top: y - size / 2 }}>
                <Waypoint
                  tint={tint}
                  n={n}
                  size={size}
                  state={state}
                  boss={boss}
                  gold={n % MASTERY_BAND_SIZE === 0 && state === 'done'}
                  fog={state === 'locked' ? Math.min(0.65, 0.12 * ahead) : 0}
                  celebrate={state === 'done' && n === justCleared}
                  wake={state === 'current' && justCleared === n - 1}
                  label={
                    state === 'current'
                      ? dailyComplete
                        ? `Out of Brainpower. Next: Level ${n}${title}${kindSaid}`
                        : `Start Level ${n}${title}${kindSaid}`
                      : `Level ${n}${title}${kindSaid}${state === 'done' ? ', cleared' : ', locked'}`
                  }
                  onPress={
                    lv && state !== 'locked'
                      ? () => {
                          feedback('select');
                          onOpen(lv.id);
                        }
                      : undefined
                  }
                />
                {boss && (
                  // Said in the waypoint's own label, so screen readers skip this one.
                  <Text maxFontSizeMultiplier={1.3} style={[type.label, styles.bossLabel]} accessible={false} aria-hidden importantForAccessibility="no">
                    {kind}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {teaser && nextChapter && (
        <View style={styles.nextChapter}>
          <Icon name="lock" tint={color.textFaint} size={iconSize.md} />
          <Text style={[type.bodyStrong, { color: color.textMuted, flexShrink: 1 }]}>
            Next: Chapter {nextChapter.number} · {nextChapter.title}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * The chapter's banner: which chapter, which levels, its title, and one line
 * of what it means (the first line of its checkpoint recap). A solid slab in
 * the subject's colour with a chunky edge (owner, 2026-10-01: big blocks of
 * colour, like a unit header), ink chosen for contrast on it.
 */
function ChapterBanner({ chapter, first, last, level, tint }: { chapter?: Chapter; first?: number; last?: number; level: number; tint: SubjectTint }) {
  const lo = first ?? chapter?.levels[0] ?? 1;
  const hi = last ?? chapter?.levels[1] ?? lo + 9;
  const meaning = chapter?.learned?.[0];
  return (
    <View style={[styles.banner, { backgroundColor: tint.base, borderBottomColor: tint.edge }]}>
      <View style={[styles.bannerIcon, { backgroundColor: tint.ink === '#FFFFFF' ? 'rgba(255,255,255,0.18)' : 'rgba(13,23,27,0.12)' }]}>
        <Icon name="map" tint={tint.ink} size={iconSize.lg} />
      </View>
      <View style={{ flex: 1, gap: space.xxs }}>
        <Eyebrow style={{ color: tint.ink, opacity: 0.8 }}>
          Chapter {chapter?.number ?? Math.ceil(lo / 10)} · Levels {lo}–{hi}
        </Eyebrow>
        {chapter && <Title style={{ color: tint.ink }}>{chapter.title}</Title>}
        {meaning && <Caption style={{ color: tint.ink, opacity: 0.85 }}>{knows(meaning, level >= hi, hi)}</Caption>}
      </View>
    </View>
  );
}

/** "You know how …" / "By Level 20, you'll know why …" from a recap line that opens with How, Why, What… */
function knows(line: string, cleared: boolean, by: number) {
  const phrase = RECAP_OPENING.test(line) ? line.charAt(0).toLowerCase() + line.slice(1) : null;
  if (cleared) return phrase ? `You know ${phrase}` : `You know: ${line}`;
  return phrase ? `By Level ${by}, you'll know ${phrase}` : `By Level ${by}: ${line}`;
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

function Waypoint({ n, size, state, boss, gold, fog, celebrate, wake, label, onPress, tint }: {
  n: number;
  /** 0 to 1: how deep in the fog of war a locked waypoint sits. */
  fog: number;
  size: number;
  state: NodeState;
  boss: boolean;
  gold: boolean;
  celebrate?: boolean;
  /** The level that just opened: it wakes up after the cleared one settles. */
  wake?: boolean;
  label: string;
  onPress?: () => void;
  tint: SubjectTint;
}) {
  const locked = state === 'locked';
  // Cleared waypoints go quiet, so the bright, ringed next level is the
  // strongest thing on the map (UX review P4).
  const done = state === 'done' && !gold;
  const fill = locked ? color.surfaceRaised : gold ? color.mastery : done ? tint.clearedFace : tint.base;
  const edge = locked ? color.border : gold ? color.masteryEdge : done ? tint.clearedEdge : tint.edge;
  const ink = locked ? color.textFaint : gold ? color.onMastery : done ? tint.text : tint.ink;
  const pop = usePop(celebrate, { from: 0.5, delay: 250 });
  // A flat face with one diagonal sheen stripe, like light across glazed plastic.
  const clip = `face${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const sheen = locked ? 0.05 : done ? 0.1 : 0.24;
  // What kind of level it is, at a glance (the number is in its label and callout).
  const glyph: IconName = n % MASTERY_BAND_SIZE === 0 ? 'star' : n % 50 === 0 ? 'flag' : boss ? 'shield' : 'book';
  const woken = usePop(wake, { from: 0.75, delay: 700 });
  const face = size - EDGE;
  // The top face, pushed down onto its side while pressed.
  const faceAt = (pressed: boolean) => hex(size, face - (state === 'current' ? 16 : 0), (pressed ? EDGE : 0) + (state === 'current' ? 8 : 0));
  return (
    <Animated.View style={wake ? woken : pop}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} aria-disabled={!onPress} disabled={!onPress} onPress={onPress}>
        {({ pressed }) => (
          <View style={{ width: size, height: size }}>
            <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
              <Defs>
                <ClipPath id={clip}>
                  <Polygon points={faceAt(pressed)} />
                </ClipPath>
              </Defs>
              {state === 'current' && <Polygon points={hex(size, size - 2, 1)} fill="none" stroke={tint.line} strokeWidth={4} />}
              <Polygon points={hex(size, face - (state === 'current' ? 16 : 0), EDGE + (state === 'current' ? 8 : 0))} fill={edge} />
              <Polygon points={faceAt(pressed)} fill={fill} />
              <Polygon
                clipPath={`url(#${clip})`}
                points={`${size * 0.3},0 ${size * 0.54},0 ${size * 0.24},${size} ${size * 0},${size}`}
                fill="#FFFFFF"
                fillOpacity={sheen}
              />
            </Svg>
            <View style={[StyleSheet.absoluteFill, styles.center, { opacity: 1 - fog, paddingBottom: pressed ? 0 : EDGE, paddingTop: pressed ? EDGE : 0 }]}>
              <Icon name={glyph} tint={ink} size={boss || state === 'current' ? iconSize.xl : 28} />
            </View>
            {/* State marks for every waypoint, checkpoints too, so cleared and locked never rest on colour alone. */}
            {state === 'done' && (
              <View style={[styles.badge, { backgroundColor: color.success }]}>
                {/* Badge glyphs sit inside a fixed 24 px disc. */}
                <Icon name="check" tint={color.bgDeep} size={14} />
              </View>
            )}
            {locked && (
              <View style={[styles.badge, { backgroundColor: color.surface, borderWidth: 2, borderColor: color.border }]}>
                <Icon name="lock" tint={color.textFaint} size={iconSize.xs} />
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
  const drift = useLoop(1900 + phase * 90, { delay: phase * 260 });
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
function StartBubble({ label, title, x, bottom, width, tint }: { label: string; title: string; x: number; bottom: number; width: number; tint: SubjectTint }) {
  const bob = useLoop(700, { easing: ease.sway });
  const w = 210;
  const left = Math.min(Math.max(x - w / 2, 0), width - w);
  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      aria-hidden
      style={[styles.bubble, { width: w, left, bottom: undefined, top: bottom - 64, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }]}>
      {/* A fixed-width callout at a fixed height above its waypoint: text grows a little, never out of the bubble. */}
      <Text maxFontSizeMultiplier={1.3} style={[type.label, { color: tint.text, textAlign: 'center' }]}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[type.bodyStrong, { color: color.text, textAlign: 'center' }]}>
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
    borderBottomWidth: depth.edge + 2,
    borderRadius: 18,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  bannerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
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
