import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '@/theme/feedback';
import { color, motion, radius, space } from '@/theme/tokens';

type Tone = 'brand' | 'info' | 'success' | 'mastery';

/** A progress bar that settles into place. `size="lesson"` is the thick lesson bar. */
export function ProgressBar({ value, tone = 'brand', size = 'md' }: { value: number; tone?: Tone; size?: 'sm' | 'md' | 'lesson' }) {
  const pct = Math.min(Math.max(value, 0), 1);
  const reduce = useReduceMotion();
  const [anim] = useState(() => new Animated.Value(pct));
  useEffect(() => {
    if (reduce) anim.setValue(pct);
    else Animated.timing(anim, { toValue: pct, duration: motion.slow, useNativeDriver: false }).start();
  }, [pct, reduce, anim]);
  const height = { sm: 8, md: 10, lesson: 16 }[size];
  return (
    <View
      style={[styles.track, { height }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      <Animated.View
        style={[styles.fill, { backgroundColor: color[tone], width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
        {size === 'lesson' && <View style={styles.sheen} />}
      </Animated.View>
    </View>
  );
}

/** Discrete progress, e.g. today's 5 new levels. Filled pips are violet; the rest are quiet. */
export function Pips({ filled, total, tone = 'brand' }: { filled: number; total: number; tone?: Tone }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.xs }} accessibilityLabel={`${filled} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.pip, { backgroundColor: i < filled ? color[tone] : color.surfaceRaised }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, backgroundColor: color.surfaceRaised, overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: radius.pill },
  sheen: { position: 'absolute', top: 4, left: 8, right: 8, height: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.22)' },
  pip: { flex: 1, height: 10, borderRadius: radius.pill },
});
