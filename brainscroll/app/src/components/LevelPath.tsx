import { CHEST, chestKey, dayNumber, mapGuidePose, mapRestPose, MASTERY_BAND_SIZE, RECAP_OPENING } from '@brainscroll/core';
import { ChestArt } from '@/components/cosmetics';
import { useEffect, useId, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, Path, Polygon } from 'react-native-svg';
import { Caption, DrScroll, Eyebrow, Gleams, Icon, type IconName, LevelArt, Title, ease, useLoop, usePop } from '@/components/ui';
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
/** The chapter's chest by the road (owner, 2026-10-06: it was too small at 60). */
const MAP_CHEST = 104;

/**
 * The chapter as an adventure map: hexagonal waypoints joined by a dotted road,
 * walked in violet up to where you are and faint beyond, fading into fog the
 * further ahead they lie. Each waypoint shows its level number. The next level
 * is ringed with a bouncing "Start" callout; the chapter's 10th level is the
 * boss: a bigger shield-marked checkpoint (gold on a mastery level). Dr. Scroll
 * stands by the road in the chapter you're in, in the skill's costume, and
 * every chapter you've finished has him goofing off in an everyday pose.
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
  live = true,
  chestsOpened,
  onChest,
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
  /**
   * Tiles stacked down the left of the road from its top (Unlimited, then this
   * week's quest; owner, 2026-10-09). A tile that renders nothing takes no room.
   */
  aside?: React.ReactNode;
  /**
   * False draws only the banner and an empty map of the right height (a
   * chapter far off screen): the waypoints, road, art and Dr. Scroll are most
   * of the skill map's cost, so they come in as a chapter nears the screen.
   */
  live?: boolean;
  /** Map chests opened (core chestKey); with `onChest`, the chapter's chest sits on the road after its 5th level. */
  chestsOpened?: readonly string[];
  onChest?: (chapter: number) => void;
}) {
  const [width, setWidth] = useState(340);
  // The skill's subject colour (theme/subjectTheme.ts).
  const tint = skillTint(skillId, skills);
  const subjectId = skills.find((s) => s.id === skillId)?.subjectId;
  const focus = nextNumber ?? Math.max(level, 1);
  const chapter = forced ?? chapterFor(skillId, focus);
  const first = chapter?.levels[0] ?? Math.floor((focus - 1) / 10) * 10 + 1;
  const last = chapter?.levels[1] ?? first + 9;
  const numbers = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const nextChapter = chapterFor(skillId, last + 1);

  const stateOf = (n: number): NodeState => (n <= level ? 'done' : n === nextNumber ? 'current' : 'locked');
  // Finished chapters (not the one you're in) get Dr. Scroll off duty in their right pocket.
  const restPose = !mascot && stateOf(last) === 'done' ? mapRestPose(skillId, Math.floor((first - 1) / 10)) : undefined;
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
  // The chapter's chest, beside the road between its 5th and 6th levels (docs/specs/REWARDS.md).
  const chapterNo = chapter?.number ?? Math.ceil(first / 10);
  const chestAt = onChest && points[CHEST.LEVEL_IN_CHAPTER] ? CHEST.LEVEL_IN_CHAPTER - 1 : -1;
  const chestState: 'locked' | 'ready' | 'opened' | null =
    chestAt < 0 ? null : chestsOpened?.includes(chestKey(skillId, chapterNo)) ? 'opened' : level >= numbers[chestAt]! ? 'ready' : 'locked';
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
        {live && (
        <>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {reached < numbers.length - 1 && (
            <Path d={road(Math.max(reached, 0), numbers.length - 1)} stroke={color.borderStrong} strokeWidth={6} strokeLinecap="round" strokeDasharray="0.1 16" fill="none" />
          )}
          {reached > 0 && <Path d={road(0, reached)} stroke={tint.line} strokeWidth={8} strokeLinecap="round" strokeDasharray="0.1 14" fill="none" />}
        </Svg>

        {POCKETS.map((pocket) => {
          // Dr. Scroll has the right pocket in the chapter you're in, and in every chapter you've finished.
          if ((mascot || restPose) && pocket.index === 6) return null;
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
        {aside && points[0] && <View style={{ position: 'absolute', left: 0, top: Math.max(points[0].y - 48, 0), gap: space.sm }}>{aside}</View>}
        {mascot && points[6] && (
          // Big beside the road, like a character in the scene (owner, 2026-10-01).
          <DrScroll spot="home.path" pose={mapGuidePose(skillId, dayNumber(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone))} size="lg" style={{ position: 'absolute', left: Math.min(width * POCKETS[1].x - 84, width - 168), top: points[6].y - 96 }} />
        )}
        {restPose && points[6] && (
          // A finished chapter: he stayed behind, goofing off by the road.
          <DrScroll spot="map.rest" pose={restPose} size="lg" style={{ position: 'absolute', left: Math.min(width * POCKETS[1].x - 84, width - 168), top: points[6].y - 96 }} />
        )}

        {chestState && (
          <MapChest
            state={chestState}
            // Off the road to the right, a half row below the 5th level (clear of the next level's callout), big enough to want.
            x={Math.min((points[chestAt]!.x + points[chestAt + 1]!.x) / 2 + 128, width - MAP_CHEST / 2)}
            y={points[chestAt]!.y + ROW / 2}
            label={chestState === 'ready' ? `Chapter ${chapterNo} chest. Open` : chestState === 'opened' ? `Chapter ${chapterNo} chest, opened` : `Chapter ${chapterNo} chest, opens after Level ${numbers[chestAt]}`}
            onPress={chestState === 'locked' ? undefined : () => { feedback('select'); onChest!(chapterNo); }}
          />
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
                  subject={subjectId}
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
        </>
        )}
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

/** The chest by the road: bobbing and lit when ready, shut and dim before, open after. */
function MapChest({ state, x, y, label, onPress }: { state: 'locked' | 'ready' | 'opened'; x: number; y: number; label: string; onPress?: () => void }) {
  const bob = useLoop(900, { active: state === 'ready' });
  const lift = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  return (
    // The button holds still; only the chest inside it bobs.
    <Pressable
      testID={`map-chest-${state}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={!onPress}
      disabled={!onPress}
      onPress={onPress}
      hitSlop={8}
      style={{ position: 'absolute', left: x - MAP_CHEST / 2, top: y - MAP_CHEST / 2, opacity: state === 'locked' ? 0.6 : 1 }}>
      <Animated.View style={{ transform: [{ translateY: lift }] }}>
        <ChestArt state={state} size={MAP_CHEST} />
      </Animated.View>
      {state === 'ready' && <Gleams count={4} tint={color.mastery} size={14} />}
    </Pressable>
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

/**
 * Pointy-top hexagon corners inside a box of `w` × `h`, starting at the top.
 * Stretched a little sideways (owner, 2026-10-03: they looked narrow) so the
 * face spans the box's full width.
 */
function hex(w: number, h: number, dy = 0) {
  const cx = w / 2;
  const r = h / 2;
  return [-90, -30, 30, 90, 150, 210]
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      return `${cx + r * Math.cos(rad) * 1.16},${r + dy + r * Math.sin(rad)}`;
    })
    .join(' ');
}

function Waypoint({ n, size, state, boss, gold, fog, celebrate, wake, label, onPress, tint, subject }: {
  n: number;
  /** The skill's subject: its regular levels wear the subject's silhouette. */
  subject?: string;
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
  // A flat face with diagonal sheen stripes, like light across glazed plastic:
  // the same angle on every waypoint, in one of five patterns (owner, 2026-10-03).
  const clip = `face${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const sheen = locked ? 0.05 : done ? 0.1 : 0.24;
  const stripes = SHEENS[(n * 3) % SHEENS.length]!;
  // What kind of level it is, at a glance (the number is in its label and callout);
  // a regular level wears its subject's silhouette.
  const special: IconName | undefined = n % MASTERY_BAND_SIZE === 0 ? 'star' : n % 50 === 0 ? 'flag' : boss ? 'shield' : undefined;
  const glyph: IconName | 'splatter' = special ?? SUBJECT_GLYPH[subject ?? ''] ?? 'book';
  const glyphSize = boss || state === 'current' ? iconSize.xl : 28;
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
              {stripes.map(([at, w]) => (
                <Polygon
                  key={at}
                  clipPath={`url(#${clip})`}
                  points={`${size * at},0 ${size * (at + w)},0 ${size * (at + w - SLANT)},${size} ${size * (at - SLANT)},${size}`}
                  fill="#FFFFFF"
                  fillOpacity={sheen}
                />
              ))}
            </Svg>
            <View style={[StyleSheet.absoluteFill, styles.center, { opacity: 1 - fog, paddingBottom: pressed ? 0 : EDGE, paddingTop: pressed ? EDGE : 0 }]}>
              {glyph === 'splatter' ? <Splatter tint={ink} size={glyphSize} /> : <Icon name={glyph} tint={ink} size={glyphSize} />}
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

/** Each subject's waypoint silhouette (owner, 2026-10-03); History keeps the book. */
const SUBJECT_GLYPH: Record<string, IconName | 'splatter'> = {
  'subject.history': 'book',
  'subject.science': 'beaker',
  'subject.geography': 'mountain',
  'subject.arts': 'splatter',
  'subject.world_systems': 'gears',
  'subject.mind': 'brain',
};

/**
 * The sheen patterns: [where a stripe starts along the top edge, its width],
 * both as fractions of the waypoint. Every stripe leans the same way (SLANT
 * across the full height); some waypoints get two. Picked by level number,
 * so neighbours differ.
 */
const SLANT = 0.3;
const SHEENS: readonly (readonly [number, number])[][] = [
  [[0.3, 0.24]],
  [[0.5, 0.14], [0.72, 0.07]],
  [[0.64, 0.2]],
  [[0.2, 0.1], [0.38, 0.17]],
  [[0.46, 0.08], [0.82, 0.16]],
];

/** Arts' waypoint silhouette: a paint splatter (no icon set has one). Decorative. */
function Splatter({ tint, size }: { tint: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {/* Uneven arms and streaks around a round middle, and a few flung drops. */}
      <Path fill={tint} d="M12.00 2.99 L12.43 1.74 L12.96 0.66 L13.46 0.50 L13.94 0.57 L14.24 1.47 L14.36 2.80 L14.39 4.02 L14.43 4.93 L14.53 5.48 L14.71 5.78 L14.94 5.94 L15.21 6.03 L15.51 6.10 L15.82 6.15 L16.15 6.19 L16.50 6.24 L16.86 6.29 L17.23 6.37 L17.59 6.47 L17.94 6.62 L18.24 6.81 L18.49 7.06 L18.67 7.35 L18.78 7.69 L18.80 8.06 L18.76 8.45 L18.65 8.85 L18.50 9.23 L18.35 9.60 L18.21 9.94 L18.16 10.23 L18.24 10.50 L18.52 10.74 L19.01 10.99 L19.69 11.26 L20.44 11.60 L21.08 12.00 L21.42 12.42 L21.37 12.83 L20.93 13.17 L20.23 13.42 L19.46 13.60 L18.78 13.74 L18.28 13.88 L17.97 14.07 L17.81 14.31 L17.76 14.60 L17.77 14.93 L17.79 15.29 L17.81 15.67 L17.80 16.05 L17.76 16.44 L17.69 16.81 L17.57 17.17 L17.40 17.49 L17.18 17.77 L16.92 18.01 L16.62 18.19 L16.28 18.32 L15.92 18.39 L15.55 18.41 L15.16 18.38 L14.78 18.32 L14.41 18.22 L14.05 18.11 L13.71 17.98 L13.39 17.85 L13.08 17.74 L12.80 17.70 L12.55 17.86 L12.30 18.37 L12.00 19.38 L11.60 20.78 L11.08 22.11 L10.54 22.70 L10.12 22.27 L9.94 20.91 L9.95 19.26 L10.02 17.89 L10.03 17.01 L9.95 16.56 L9.79 16.35 L9.57 16.26 L9.32 16.24 L9.04 16.25 L8.71 16.30 L8.32 16.39 L7.88 16.51 L7.38 16.65 L6.83 16.77 L6.27 16.85 L5.73 16.86 L5.25 16.78 L4.86 16.60 L4.61 16.31 L4.50 15.93 L4.51 15.50 L4.63 15.04 L4.82 14.58 L5.03 14.14 L5.24 13.73 L5.43 13.36 L5.57 13.02 L5.68 12.71 L5.76 12.42 L5.81 12.14 L5.84 11.87 L5.86 11.60 L5.84 11.33 L5.76 11.05 L5.54 10.75 L5.13 10.39 L4.51 9.94 L3.75 9.39 L3.04 8.77 L2.61 8.18 L2.64 7.72 L3.16 7.48 L4.02 7.45 L4.99 7.55 L5.85 7.68 L6.49 7.74 L6.90 7.68 L7.13 7.52 L7.27 7.27 L7.37 6.97 L7.46 6.64 L7.57 6.32 L7.70 6.00 L7.88 5.71 L8.09 5.46 L8.33 5.25 L8.62 5.10 L8.92 5.00 L9.25 4.96 L9.58 4.96 L9.92 4.99 L10.25 5.05 L10.56 5.11 L10.86 5.12 L11.13 5.02 L11.40 4.70 L11.67 4.03Z" />
      <Path fill={tint} d="M22.12 8.32a1.1 1.1 0 1 1-2.20 0a1.1 1.1 0 1 1 2.20 0Z M21.76 16.80a0.75 0.75 0 1 1-1.50 0a0.75 0.75 0 1 1 1.50 0Z M15.64 19.96a0.6 0.6 0 1 1-1.20 0a0.6 0.6 0 1 1 1.20 0Z M6.42 19.18a1.25 1.25 0 1 1-2.50 0a1.25 1.25 0 1 1 2.50 0Z M3.00 12.96a0.7 0.7 0 1 1-1.40 0a0.7 0.7 0 1 1 1.40 0Z M10.96 1.16a0.8 0.8 0 1 1-1.60 0a0.8 0.8 0 1 1 1.60 0Z" />
    </Svg>
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
  const bob = useLoop(950, { easing: ease.sway });
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
      <Gleams count={3} size={13} />
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
