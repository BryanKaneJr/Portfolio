import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useReduceMotion } from '@/theme/feedback';
import { color, glow, motion, radius, space, type } from '@/theme/tokens';

/**
 * Progression-mode primitives. These are where BrainScroll gets loud: glow,
 * big numerals, motion. Never use them on lesson screens.
 */

/** Counts a number up from `from` to `to`. Snaps when reduce-motion is on. */
export function useCountUp(to: number, { from = 0, delay = 0, duration = motion.celebrate * 0.8 } = {}): number {
  const reduce = useReduceMotion();
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (reduce || to === from) return;
    let raf = 0;
    const timer = setTimeout(() => {
      const start = Date.now();
      const tick = () => {
        const t = Math.min((Date.now() - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(from + (to - from) * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [to, from, delay, duration, reduce]);
  return reduce || to === from ? to : value;
}

/** Fades and rises in after `delay` ms: a staggered reveal for reward screens. */
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: motion.slow, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay, reduce]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>{children}</Animated.View>;
}

/** A spring pop for the biggest number on a reward screen. */
export function Pop({ children, active = true, delay = 0 }: { children: ReactNode; active?: boolean; delay?: number }) {
  const reduce = useReduceMotion();
  const [s] = useState(() => new Animated.Value(active ? 0.6 : 1));
  useEffect(() => {
    if (!active || reduce) return s.setValue(1);
    const t = setTimeout(() => Animated.spring(s, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start(), delay);
    return () => clearTimeout(t);
  }, [active, reduce, s, delay]);
  return <Animated.View style={{ transform: [{ scale: s }] }}>{children}</Animated.View>;
}

/**
 * A skill/level emblem: a rounded geometric badge with the level numeral.
 * `tone="mastery"` (gold) only when a mastery star is involved.
 */
export function Emblem({ value, caption, tone = 'brand', size = 'md', glowing }: { value: string | number; caption?: string; tone?: 'brand' | 'mastery' | 'quiet'; size?: 'sm' | 'md' | 'lg'; glowing?: boolean }) {
  const dim = { sm: 52, md: 72, lg: 112 }[size];
  const border = tone === 'mastery' ? color.mastery : tone === 'brand' ? color.brand : color.borderStrong;
  const fontSize = { sm: 20, md: 28, lg: 44 }[size];
  return (
    <View style={{ alignItems: 'center', gap: space.xs }}>
      <View
        style={[
          styles.emblem,
          { width: dim, height: dim, borderRadius: dim * 0.32, borderColor: border, backgroundColor: tone === 'mastery' ? color.masterySoft : tone === 'brand' ? color.brandSoft : color.surface },
          glowing && (tone === 'mastery' ? glow.mastery : glow.brand),
        ]}>
        <View style={[styles.emblemInner, { borderRadius: dim * 0.26, borderColor: tone === 'quiet' ? color.border : `${border}55` }]} />
        <Text style={[type.number, { fontSize, color: tone === 'quiet' ? color.textMuted : color.text }]}>{value}</Text>
      </View>
      {caption && <Text style={[type.label, { color: color.textMuted }]}>{caption}</Text>}
    </View>
  );
}

/** Mastery stars (★ per completed 100-level band). Gold is reserved for this. */
export function Stars({ count, size = 18 }: { count: number; size?: number }) {
  if (count <= 0) return null;
  return (
    <Text accessibilityLabel={`${count} mastery ${count === 1 ? 'star' : 'stars'}`} style={{ color: color.mastery, fontSize: size, letterSpacing: 2 }}>
      {'★'.repeat(Math.min(count, 5))}
      {count > 5 ? ` ×${count}` : ''}
    </Text>
  );
}

/** A compact labeled number for secondary stats on progression screens. */
export function StatTile({ label, value, tone = 'text' }: { label: string; value: string | number; tone?: 'text' | 'brand' | 'success' | 'mastery' }) {
  const c = { text: color.text, brand: color.brand, success: color.success, mastery: color.mastery }[tone];
  return (
    <View style={styles.tile}>
      <Text style={[type.label, { color: color.textMuted }]}>{label}</Text>
      <Text style={[type.number, { fontSize: 22, color: c }]}>{value}</Text>
    </View>
  );
}

/** A soft radial-ish halo behind a reward numeral. Purely decorative. */
export function Halo({ tone = 'brand' }: { tone?: 'brand' | 'mastery' }) {
  return <View pointerEvents="none" style={[styles.halo, { backgroundColor: tone === 'mastery' ? 'rgba(255,200,87,0.10)' : 'rgba(124,92,255,0.16)' }, tone === 'mastery' ? glow.mastery : glow.brand]} />;
}

const styles = StyleSheet.create({
  emblem: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  emblemInner: { ...StyleSheet.absoluteFill, margin: 5, borderWidth: 1 },
  tile: { flex: 1, backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, paddingVertical: space.md, paddingHorizontal: space.md, gap: space.xs, alignItems: 'center' },
  halo: { position: 'absolute', alignSelf: 'center', top: -20, width: 220, height: 220, borderRadius: 110 },
});
