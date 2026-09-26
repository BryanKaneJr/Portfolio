import { MASCOT_NAME, MASCOT_SPOTS, type MascotPose, type MascotSpot } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useReduceMotion } from '@/theme/feedback';
import { color, radius, space, type } from '@/theme/tokens';
import { mascotArt } from './mascotArt';

const SIZE = { xs: 44, sm: 64, md: 96, lg: 168 } as const;
export type MascotSize = keyof typeof SIZE;

/**
 * Where he is and what he's doing. Fixed places pass a `spot` (its image can be
 * swapped on its own in mascotArt.ts); writer-placed asides pass a `pose`.
 */
type Placement = { spot: MascotSpot; pose?: MascotPose } | { spot?: undefined; pose: MascotPose };
const poseOf = (p: Placement): MascotPose => p.pose ?? MASCOT_SPOTS[p.spot!].pose;
/** testID "mascot:<spot>" (or "mascot:pose:<pose>") marks every placement for tests and inspection. */
const labelOf = (p: Placement) => (p.spot ? `mascot:${p.spot}` : `mascot:pose:${p.pose}`);

/**
 * Dr. Scroll on his own. Decorative: whatever he says must also be in text.
 * He arrives with one small bounce (none with reduce motion), never more.
 */
export function DrScroll({ size = 'md', style, ...placement }: Placement & { size?: MascotSize; style?: ViewStyle }) {
  const px = SIZE[size];
  const reduce = useReduceMotion();
  const [arrive] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return arrive.setValue(1);
    Animated.spring(arrive, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  }, [reduce, arrive]);
  const bounce = {
    opacity: arrive.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
    transform: [
      { translateY: arrive.interpolate({ inputRange: [0, 1], outputRange: [px * 0.08, 0] }) },
      { scale: arrive.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
    ],
  };
  return (
    <Animated.View testID={labelOf(placement)} style={[{ width: px, height: px }, bounce, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Image source={mascotArt(poseOf(placement), placement.pose ? undefined : placement.spot)} style={{ width: px, height: px }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </Animated.View>
  );
}

/**
 * Dr. Scroll with a speech bubble in his bow-tie plum. `row` sits him beside
 * the bubble (tips, reactions); `stack` puts him above it (intros and big
 * moments). Screen readers hear "Dr. Scroll says: …" and skip the picture.
 */
export function DrScrollSays({ lines, size, layout = 'row', action, style, ...placement }: Placement & {
  lines: readonly string[];
  size?: MascotSize;
  layout?: 'row' | 'stack';
  /** A small text button inside the bubble, e.g. "Got it" on a tip. */
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}) {
  const stack = layout === 'stack';
  return (
    <View style={[stack ? styles.stack : styles.row, style]}>
      <DrScroll {...placement} size={size ?? (stack ? 'lg' : 'sm')} />
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
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} hitSlop={12} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
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
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  stack: { alignItems: 'center', gap: space.md },
  center: { alignItems: 'center', gap: space.sm },
  bubble: { backgroundColor: BUBBLE_BG, borderColor: color.plumLine, borderWidth: 1.5, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  bubbleRow: { flex: 1 },
  bubbleStack: { alignSelf: 'stretch' },
  tail: { position: 'absolute', width: TAIL * 2, height: TAIL * 2, backgroundColor: BUBBLE_BG, borderColor: color.plumLine, transform: [{ rotate: '45deg' }] },
  tailLeft: { left: -TAIL - 1, bottom: space.lg, borderLeftWidth: 1.5, borderBottomWidth: 1.5 },
  tailUp: { top: -TAIL - 1, alignSelf: 'center', borderLeftWidth: 1.5, borderTopWidth: 1.5 },
  // A small pill button, so the tip's dismiss reads as a button (UX review P6).
  action: { alignSelf: 'flex-end', marginTop: space.xs, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.plumLine, backgroundColor: color.plumSoft },
});
