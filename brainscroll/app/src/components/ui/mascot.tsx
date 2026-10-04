import { dayNumber, MASCOT_NAME, MASCOT_SPOTS, spotPose, type MascotPose, type MascotSpot } from '@brainscroll/core';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useReduceMotion } from '@/theme/feedback';
import { color, radius, space, type } from '@/theme/tokens';
import { MASCOT_ANIMATIONS, POSE_ANIMATION, type MascotAnimationName } from './mascotAnim';
import { mascotArt } from './mascotArt';
import { spring } from './motion';

const SIZE = { xs: 44, sm: 64, md: 96, lg: 168 } as const;
export type MascotSize = keyof typeof SIZE;

/**
 * Where he is and what he's doing. Fixed places pass a `spot` (its image can be
 * swapped on its own in mascotArt.ts); writer-placed asides pass a `pose`.
 */
type Placement = { spot: MascotSpot; pose?: MascotPose } | { spot?: undefined; pose: MascotPose };
/** A placement's own pose, else the spot's pose today (some spots take turns, one a day: SPOT_POSE_VARIANTS). */
const poseOf = (p: Placement): MascotPose => p.pose ?? spotPose(p.spot!, dayNumber(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone));
/** testID "mascot:<spot>" (or "mascot:pose:<pose>") marks every placement for tests and inspection. */
const labelOf = (p: Placement) => (p.spot ? `mascot:${p.spot}` : `mascot:pose:${p.pose}`);

/**
 * Dr. Scroll on his own. Decorative: whatever he says must also be in text.
 * He arrives with one small bounce (none with reduce motion), never more.
 */
/** `size` is a named size, or pixels where a layout sizes him to the room (a lesson card's picture). */
/** `animation` plays one of his sprite animations once, ending on its last frame (straight to it with reduce motion). */
export function DrScroll({ size = 'md', style, animation, ...placement }: Placement & { size?: MascotSize | number; style?: ViewStyle; animation?: MascotAnimationName }) {
  const px = typeof size === 'number' ? size : SIZE[size];
  const reduce = useReduceMotion();
  // A pose with an animation plays it, except inside lessons (they stay calm) and with reduce motion (the still).
  const lesson = !!placement.spot && 'lesson' in MASCOT_SPOTS[placement.spot];
  const posed = lesson || reduce ? undefined : POSE_ANIMATION[poseOf(placement)];
  const play = animation ?? posed;
  const [arrive] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    if (reduce) return arrive.setValue(1);
    Animated.spring(arrive, { toValue: 1, ...spring.arrive, useNativeDriver: true }).start();
  }, [reduce, arrive]);
  const bounce = {
    opacity: arrive.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateY: arrive.interpolate({ inputRange: [0, 1], outputRange: [px * 0.08, 0] }) },
      { scale: arrive.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
    ],
  };
  return (
    <Animated.View
      testID={labelOf(placement)}
      style={[{ width: px, height: px }, bounce, style]}
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {play ? (
        <Sprite name={play} px={px} reduce={reduce} />
      ) : (
        <Image source={mascotArt(poseOf(placement), placement.pose ? undefined : placement.spot)} style={{ width: px, height: px }} resizeMode="contain" accessibilityIgnoresInvertColors />
      )}
    </Animated.View>
  );
}

/**
 * One frame of a sprite sheet at a time, stepping through once and holding the
 * last (or round and round, for a looping one). The sheet slides by whole frames on the native thread, timed by the
 * clock rather than by JS renders, so a busy JS thread can't slow him down
 * (a timer per frame played at about half speed on phones). Starts once the
 * sheet has loaded, so the first frames aren't spent on a blank square.
 */
function Sprite({ name, px, reduce }: { name: MascotAnimationName; px: number; reduce: boolean }) {
  const a = MASCOT_ANIMATIONS[name];
  const last = a.frames - 1;
  const [t] = useState(() => new Animated.Value(reduce ? last : 0));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (reduce) return t.setValue(last);
    // Should onLoad never come (a cached sheet on some platforms), start anyway.
    if (!loaded) {
      const late = setTimeout(() => setLoaded(true), 400);
      return () => clearTimeout(late);
    }
    const once = Animated.timing(t, { toValue: a.frames, duration: a.frames * a.frameMs, easing: Easing.linear, useNativeDriver: true });
    const run = 'loop' in a && a.loop ? Animated.loop(once) : once;
    run.start();
    return () => run.stop();
  }, [reduce, loaded, t, last, a]);
  const move = useMemo(() => {
    // Frame i shows for t in [i, i + 1): a step for each frame, no sliding between them.
    const input: number[] = [];
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < a.frames; i++) {
      const fx = -(i % a.cols) * px;
      const fy = -Math.floor(i / a.cols) * px;
      input.push(i, i + 0.999);
      x.push(fx, fx);
      y.push(fy, fy);
    }
    return {
      translateX: t.interpolate({ inputRange: input, outputRange: x, extrapolate: 'clamp' }),
      translateY: t.interpolate({ inputRange: input, outputRange: y, extrapolate: 'clamp' }),
    };
  }, [t, px, a.frames, a.cols]);
  const rows = Math.ceil(a.frames / a.cols);
  return (
    <View style={{ width: px, height: px, overflow: 'hidden' }}>
      <Animated.Image
        source={a.sheet}
        onLoad={() => setLoaded(true)}
        style={{ position: 'absolute', left: 0, top: 0, width: px * a.cols, height: px * rows, transform: [{ translateX: move.translateX }, { translateY: move.translateY }] }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/**
 * Dr. Scroll with a speech bubble in his bow-tie plum. `row` sits him beside
 * the bubble (tips, reactions); `stack` puts him above it (intros and big
 * moments). Screen readers hear "Dr. Scroll says: …" and skip the picture.
 */
export function DrScrollSays({ lines, size, layout = 'row', action, style, animation, ...placement }: Placement & {
  lines: readonly string[];
  size?: MascotSize;
  layout?: 'row' | 'stack';
  /** A small text button inside the bubble, e.g. "Got it" on a tip. */
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
  animation?: MascotAnimationName;
}) {
  const stack = layout === 'stack';
  return (
    <View style={[stack ? styles.stack : styles.row, style]}>
      <DrScroll {...placement} animation={animation} size={size ?? (stack ? 'lg' : 'sm')} />
      <View style={[styles.bubble, stack ? styles.bubbleStack : styles.bubbleRow]}>
        <View style={[styles.tail, stack ? styles.tailUp : styles.tailLeft]} />
        <View accessible accessibilityLabel={`${MASCOT_NAME} says: ${lines.join(' ')}`} style={{ gap: space.sm }}>
          {lines.map((line, i) => (
            <Text key={i} style={i === 0 && lines.length > 1 ? [type.title, { color: color.text }] : [type.body, { color: lines.length > 1 ? color.textMuted : color.text }]}>
              {line}
            </Text>
          ))}
        </View>
        {action && (
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} hitSlop={space.md} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
            <Text style={[type.bodyStrong, { color: color.plum }]}>{action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * A loading state: nothing for the first moment (most loads are instant, and a
 * flash of him would be noise), then Dr. Scroll checking his watch.
 */
export function DrScrollLoading({ label = 'Loading…', delay = 500 }: { label?: string; delay?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!show) return null;
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <DrScroll spot="loading" size="md" />
      <Text style={[type.caption, { color: color.textMuted }]}>{label}</Text>
    </View>
  );
}

const TAIL = 10;
const BUBBLE_BG = color.surface;
/** His speech bubble's outline: a touch lighter than a card's 2 px border, so it reads as speech, not a surface. */
const BUBBLE_LINE = 1.5;
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  stack: { alignItems: 'center', gap: space.md },
  center: { alignItems: 'center', gap: space.sm },
  bubble: { backgroundColor: BUBBLE_BG, borderColor: color.plumLine, borderWidth: BUBBLE_LINE, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  bubbleRow: { flex: 1 },
  bubbleStack: { alignSelf: 'stretch' },
  tail: { position: 'absolute', width: TAIL * 2, height: TAIL * 2, backgroundColor: BUBBLE_BG, borderColor: color.plumLine, transform: [{ rotate: '45deg' }] },
  tailLeft: { left: -TAIL - 1, bottom: space.lg, borderLeftWidth: BUBBLE_LINE, borderBottomWidth: BUBBLE_LINE },
  tailUp: { top: -TAIL - 1, alignSelf: 'center', borderLeftWidth: BUBBLE_LINE, borderTopWidth: BUBBLE_LINE },
  // A small pill button, so the tip's dismiss reads as a button (UX review P6). Outlined, not
  // filled: plum text needs the bubble's own surface behind it (4.8:1; 4.1:1 on a plum tint).
  // Its hitSlop brings the touch area past 44 pt.
  action: { alignSelf: 'flex-end', marginTop: space.xs, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, borderWidth: BUBBLE_LINE, borderColor: color.plumLine },
});
