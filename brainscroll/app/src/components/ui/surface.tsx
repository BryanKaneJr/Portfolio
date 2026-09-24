import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { color, glow, radius, space } from '@/theme/tokens';

export type CardVariant = 'plain' | 'raised' | 'accent' | 'reward' | 'mastery' | 'quiet';

/**
 * Surfaces. `plain` for most content; `accent` marks the ONE primary thing on a
 * tab screen; `reward` and `mastery` glow and belong to progression moments only.
 */
export function Card({ children, variant, accent, style, onPress, accessibilityLabel }: {
  children: ReactNode;
  variant?: CardVariant;
  /** @deprecated use variant="accent" */
  accent?: boolean;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const v = variant ?? (accent ? 'accent' : 'plain');
  const s = [styles.card, styles[v], style];
  if (!onPress) return <View style={s}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...s, pressed && { backgroundColor: color.surfacePressed }]}>
      {children}
    </Pressable>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Stack({ children, gap = space.md, style }: { children: ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.border }} />;
}

/** Small rounded label for statuses ("2 / 5 today"). */
export function Chip({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'brand' | 'success' | 'mastery' }) {
  const c = { muted: color.border, brand: color.brandLine, success: color.successLine, mastery: color.mastery }[tone];
  return <View style={[styles.chip, { borderColor: c }]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: 1 },
  plain: { backgroundColor: color.surface, borderColor: color.border },
  quiet: { backgroundColor: 'transparent', borderColor: color.border },
  raised: { backgroundColor: color.surfaceRaised, borderColor: color.border },
  accent: { backgroundColor: color.surface, borderColor: color.brandLine, borderWidth: 1.5 },
  reward: { backgroundColor: color.surface, borderColor: color.brand, ...glow.brand },
  mastery: { backgroundColor: color.surface, borderColor: color.mastery, ...glow.mastery },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
});
