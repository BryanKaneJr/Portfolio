import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '@/theme/feedback';
import { color, motion, radius, space } from '@/theme/tokens';

/** Bar thickness per size; the lesson bar is thick on purpose (it's the lesson's one piece of chrome). */
const BAR = { sm: 8, md: 10, lesson: 16 } as const;

type Tone = 'brand' | 'info' | 'success' | 'mastery';

/**
 * A progress bar that settles into place (snaps with reduce motion).
 * `size="lesson"` is the thick lesson bar. Screen readers hear `label` and
 * the percentage.
 */
export function ProgressBar({ value, tone = 'brand', size = 'md', label = 'Progress' }: { value: number; tone?: Tone; size?: 'sm' | 'md' | 'lesson'; label?: string }) {
  const pct = Math.min(Math.max(value, 0), 1);
  const reduce = useReduceMotion();
  const [anim] = useState(() => new Animated.Value(pct));
  useEffect(() => {
    if (reduce) anim.setValue(pct);
    else Animated.timing(anim, { toValue: pct, duration: motion.slow, useNativeDriver: false }).start();
  }, [pct, reduce, anim]);
  const height = BAR[size];
  return (
    <View
      style={[styles.track, { height }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}>
      <Animated.View
        style={[styles.fill, { backgroundColor: color[tone], width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
        {size === 'lesson' && <View style={styles.sheen} />}
      </Animated.View>
    </View>
  );
}

/** Discrete progress, e.g. today's 5 new levels. Filled pips are violet; the rest are quiet. */
export function Pips({ filled, total, tone = 'brand', label }: { filled: number; total: number; tone?: Tone; label?: string }) {
  return (
    <View
      style={{ flexDirection: 'row', gap: space.xs }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? `${filled} of ${total}`}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={filled}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.pip, { backgroundColor: i < filled ? color[tone] : color.surfaceRaised }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, backgroundColor: color.surfaceRaised, overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: radius.pill },
  sheen: { position: 'absolute', top: space.xs, left: space.sm, right: space.sm, height: space.xs, borderRadius: radius.pill, backgroundColor: color.sheen },
  pip: { flex: 1, height: BAR.md, borderRadius: radius.pill },
});
