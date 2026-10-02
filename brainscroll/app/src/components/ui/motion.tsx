import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, type ViewStyle } from 'react-native';
import { useReduceMotion } from '@/theme/feedback';
import { motion } from '@/theme/tokens';

/**
 * Small, quick motion that makes the app feel alive without slowing anyone
 * down. Everything here snaps into place when reduce motion is on.
 *
 * Every animation in the app draws from these presets (roadmap §14 row 1), so
 * the same kind of moment always moves the same way: `ease.out` for things
 * arriving, `ease.breathe` for idle loops, and three springs by weight.
 */
export const ease = {
  /** Arriving and settling: fast start, soft landing. */
  out: Easing.out(Easing.cubic),
  /** Idle loops (floating art, skeleton pulse): even and calm. */
  breathe: Easing.inOut(Easing.sin),
  /** Short back-and-forth: a nudge, a bouncing callout. */
  sway: Easing.inOut(Easing.quad),
};

export const spring = {
  /** A quick, lively pop: a picked answer, a cleared node. */
  pop: { friction: 4, tension: 160 },
  /** Dr. Scroll arriving. */
  arrive: { friction: 5, tension: 140 },
  /** A weighty settle: the big number on a reward screen. */
  settle: { friction: 5, tension: 120 },
} as const;

/**
 * A value that swings 0 → 1 → 0 forever, `period` ms each way, starting after
 * `delay`: floating art, a bouncing callout, a skeleton's pulse. Stays at 0
 * with reduce motion (or while `active` is false).
 */
export function useLoop(period: number, { delay = 0, active = true, easing = ease.breathe }: { delay?: number; active?: boolean; easing?: (t: number) => number } = {}) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active || reduce) return v.setValue(0);
    const half = { duration: period, easing, useNativeDriver: true };
    const loop = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, ...half }), Animated.timing(v, { toValue: 0, ...half })]));
    const t = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [v, period, delay, active, easing, reduce]);
  return v;
}

/** Slides in from the side (or up) and fades in when it mounts: a new lesson card, a verdict. */
export function SlideIn({ children, from = 'right', delay = 0, style }: { children: ReactNode; from?: 'right' | 'below'; delay?: number; style?: ViewStyle }) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    if (reduce) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: motion.normal, delay, easing: ease.out, useNativeDriver: true }).start();
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
    const t = setTimeout(() => Animated.spring(s, { toValue: 1, ...spring.pop, useNativeDriver: true }).start(), delay);
    return () => clearTimeout(t);
  }, [trigger, reduce, s, from, delay]);
  return { transform: [{ scale: s }] };
}

/**
 * A small side-to-side nudge when `trigger` turns truthy: a wrong pick's
 * "not quite". A few pixels, under a third of a second, never a shake of
 * disapproval. Stays still with reduce motion.
 */
export function useNudge(trigger: unknown) {
  const reduce = useReduceMotion();
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!trigger || reduce) return;
    x.setValue(0);
    const step = (toValue: number) => Animated.timing(x, { toValue, duration: 55, easing: ease.sway, useNativeDriver: true });
    Animated.sequence([step(-5), step(4), step(-2), step(0)]).start();
  }, [trigger, reduce, x]);
  return { transform: [{ translateX: x }] };
}
