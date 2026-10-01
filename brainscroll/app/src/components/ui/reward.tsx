import { useEffect, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useReduceMotion } from '@/theme/feedback';
import { color, depth, glow, iconSize, motion, radius, space, type } from '@/theme/tokens';
import { Icon, type IconName } from './icon';
import type { UiArtName } from './uiArt';
import { UiArt } from './uiArtView';
import { ease, spring } from './motion';
import { lift, type SubjectTint } from '@/theme/subjectTheme';
import { GradientFill } from './gradient';

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
  // With reduce motion it starts (and stays) in place: no fade, no rise.
  const [v] = useState(() => new Animated.Value(reduce ? 1 : 0));
  useEffect(() => {
    if (reduce) return v.setValue(1);
    Animated.timing(v, { toValue: 1, duration: motion.slow, delay, easing: ease.out, useNativeDriver: true }).start();
  }, [v, delay, reduce]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>{children}</Animated.View>;
}

/** A spring pop for the biggest number on a reward screen. */
export function Pop({ children, active = true, delay = 0 }: { children: ReactNode; active?: boolean; delay?: number }) {
  const reduce = useReduceMotion();
  const [s] = useState(() => new Animated.Value(active && !reduce ? 0.6 : 1));
  useEffect(() => {
    if (!active || reduce) return s.setValue(1);
    const t = setTimeout(() => Animated.spring(s, { toValue: 1, ...spring.settle, useNativeDriver: true }).start(), delay);
    return () => clearTimeout(t);
  }, [active, reduce, s, delay]);
  return <Animated.View style={{ transform: [{ scale: s }] }}>{children}</Animated.View>;
}

/**
 * A skill/level emblem: a rounded geometric badge with the level numeral.
 * `tone="mastery"` (gold) only when a mastery star is involved.
 *
 * Decorative by default: every screen states the same level in words beside
 * it ("Astronomy · Lv. 3"), so screen readers skip the badge (and never hear a
 * count-up mid-count). Pass `label` when the emblem is the only place it's said.
 */
export function Emblem({ value, caption, tone = 'brand', size = 'md', glowing, label, tint }: { value: string | number; caption?: string; tone?: 'brand' | 'mastery' | 'quiet'; size?: 'sm' | 'md' | 'lg'; glowing?: boolean; label?: string; tint?: SubjectTint }) {
  // A skill's emblem wears its subject's colour (tone 'brand' with a tint); mastery stays gold.
  const sub = tone === 'brand' ? tint : undefined;
  const dim = { sm: 52, md: 72, lg: 112 }[size];
  const border = tone === 'mastery' ? color.mastery : tone === 'brand' ? color.brand : color.borderStrong;
  const fontSize = { sm: 20, md: 28, lg: 44 }[size];
  const a11y = label
    ? ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: label } as const)
    : ({ accessible: false, 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);
  return (
    <View style={{ alignItems: 'center', gap: space.xs }} {...a11y}>
      <View
        style={[
          styles.emblem,
          { width: dim, height: dim, borderRadius: dim * 0.32 },
          tone === 'quiet'
            ? { backgroundColor: color.surface, borderColor: border, borderWidth: depth.border, borderBottomWidth: depth.edge }
            : { backgroundColor: tone === 'mastery' ? color.mastery : (sub?.base ?? color.brand), borderBottomWidth: Math.round(dim / 14), borderBottomColor: tone === 'mastery' ? color.masteryEdge : (sub?.edge ?? color.brandEdge) },
          glowing && (tone === 'mastery' ? glow.mastery : sub ? [glow.brand, { shadowColor: sub.base }] : glow.brand),
        ]}>
        {tone !== 'quiet' && (
          // Lit from above, like the buttons.
          <GradientFill from={lift(tone === 'mastery' ? color.mastery : (sub?.base ?? color.brand), 0.24)} to={tone === 'mastery' ? color.mastery : (sub?.base ?? color.brand)} rx={dim * 0.32} />
        )}
        {/* A fixed-size badge: cap Dynamic Type so a 3-digit level still fits. */}
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit style={[type.number, { fontSize, color: tone === 'quiet' ? color.textMuted : tone === 'mastery' ? color.onMastery : (sub?.ink ?? color.onBrand) }]}>
          {value}
        </Text>
      </View>
      {caption && (
        <Text maxFontSizeMultiplier={1.4} style={[type.label, { color: color.textMuted }]}>
          {caption}
        </Text>
      )}
    </View>
  );
}

/** Mastery stars (★ per completed 100-level band). Gold is reserved for this. */
export function Stars({ count, size = 18 }: { count: number; size?: number }) {
  if (count <= 0) return null;
  return (
    // The owner's gold star, up to five, then "×N".
    <View accessible accessibilityLabel={`${count} mastery ${count === 1 ? 'star' : 'stars'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
      {Array.from({ length: Math.min(count, 5) }, (_, i) => (
        <UiArt key={i} name="mastery-star" size={size + 4} />
      ))}
      {count > 5 ? <Text style={{ color: color.mastery, fontSize: size }}>{` ×${count}`}</Text> : null}
    </View>
  );
}

/** A compact labeled number for secondary stats on progression screens. */
export function StatTile({ label, value, tone = 'text', icon, art }: { label: string; value: string | number; tone?: 'text' | 'brand' | 'success' | 'mastery' | 'streak'; icon?: IconName; art?: UiArtName }) {
  const c = { text: color.text, brand: color.brandText, success: color.success, mastery: color.mastery, streak: color.streak }[tone];
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[type.label, { color: color.textMuted }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {art ? <UiArt name={art} size={iconSize.lg} /> : icon && <Icon name={icon} tint={tone === 'text' ? color.textMuted : c} size={iconSize.md} />}
        <Text style={[type.numberSm, { color: c }]}>{value}</Text>
      </View>
    </View>
  );
}

/** A soft radial-ish halo behind a reward numeral. Purely decorative. */
export function Halo({ tone = 'brand' }: { tone?: 'brand' | 'mastery' }) {
  return <View pointerEvents="none" style={[styles.halo, { backgroundColor: tone === 'mastery' ? color.masteryHalo : color.brandHalo }, tone === 'mastery' ? glow.mastery : glow.brand]} />;
}

const styles = StyleSheet.create({
  shimmer: { position: 'absolute', left: 0, backgroundColor: color.masteryShine },
  emblem: { alignItems: 'center', justifyContent: 'center' },
  tile: { flex: 1, backgroundColor: color.surface, borderRadius: radius.md, borderWidth: depth.border, borderBottomWidth: depth.edge, borderColor: color.border, paddingVertical: space.md, paddingHorizontal: space.md, gap: space.xs, alignItems: 'center' },
  // Sized to sit behind a hero numeral; decorative geometry, not layout.
  halo: { position: 'absolute', alignSelf: 'center', top: 10, width: 200, height: 200, borderRadius: radius.pill },
});

/**
 * A light sweep across its child, twice, after `delay`: a gold trophy
 * catching the light as it arrives. Gold only (gold means the top of
 * something). Nothing moves with reduce motion.
 */
export function Shimmer({ children, size, delay = 0, radius: r = radius.lg }: { children: ReactNode; size: number; delay?: number; radius?: number }) {
  const reduce = useReduceMotion();
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const sweep = Animated.timing(x, { toValue: 1, duration: 700, easing: ease.out, useNativeDriver: true });
    const run = Animated.sequence([sweep, Animated.delay(350), Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }), sweep]);
    const t = setTimeout(() => run.start(), delay);
    return () => {
      clearTimeout(t);
      run.stop();
    };
  }, [x, delay, reduce]);
  const band = size * 0.28;
  return (
    <View style={{ width: size, height: size, borderRadius: r, overflow: 'hidden' }}>
      {children}
      {!reduce && (
        <Animated.View
          pointerEvents="none"
          accessible={false}
          style={[
            styles.shimmer,
            { width: band, height: size * 1.6, top: -size * 0.3, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-band * 2, size + band] }) }, { rotate: '20deg' }] },
          ]}
        />
      )}
    </View>
  );
}
