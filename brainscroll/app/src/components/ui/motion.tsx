import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';
import { useReduceMotion } from '@/theme/feedback';
import { motion } from '@/theme/tokens';

/**
 * Small, quick motion that makes the app feel alive without slowing anyone
 * down. Everything here snaps into place when reduce motion is on.
 */

/** Slides in from the side (or up) and fades in when it mounts: a new lesson card, a verdict. */
export function SlideIn({ children, from = 'right', delay = 0, style }: { children: ReactNode; from?: 'right' | 'below'; delay?: number; style?: ViewStyle }) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    if (reduce) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: motion.normal, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay, reduce]);
  const offset = v.interpolate({ inputRange: [0, 1], outputRange: [from === 'right' ? 28 : 18, 0] });
  return (
    <Animated.View style={[{ opacity: v, transform: [from === 'right' ? { translateX: offset } : { translateY: offset }] }, style]}>{children}</Animated.View>
  );
}

/**
 * A springy scale "pop" whenever `trigger` changes to a truthy value: a newly
 * selected answer, a verdict badge, a level node that was just cleared.
 */
export function usePop(trigger: unknown, { from = 0.9, delay = 0 }: { from?: number; delay?: number } = {}) {
  const reduce = useReduceMotion();
  const [s] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!trigger || reduce) return;
    s.setValue(from);
    const t = setTimeout(() => Animated.spring(s, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start(), delay);
    return () => clearTimeout(t);
  }, [trigger, reduce, s, from, delay]);
  return { transform: [{ scale: s }] };
}
