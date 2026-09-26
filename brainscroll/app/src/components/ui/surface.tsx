import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { color, depth, glow, radius, space } from '@/theme/tokens';
import { Icon, type IconName } from './icon';

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
export function Chip({ children, tone = 'muted', icon }: { children: ReactNode; tone?: 'muted' | 'brand' | 'success' | 'mastery'; icon?: IconName }) {
  const c = { muted: color.border, brand: color.brandLine, success: color.successLine, mastery: color.mastery }[tone];
  const tint = { muted: color.textMuted, brand: color.brandText, success: color.success, mastery: color.mastery }[tone];
  return (
    <View style={[styles.chip, { borderColor: c }]}>
      {icon && <Icon name={icon} tint={tint} size={16} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: depth.border, borderBottomWidth: depth.edge },
  plain: { backgroundColor: color.surface, borderColor: color.border },
  quiet: { backgroundColor: 'transparent', borderColor: color.border, borderBottomWidth: depth.border },
  raised: { backgroundColor: color.surfaceRaised, borderColor: color.border },
  accent: { backgroundColor: color.surface, borderColor: color.brandLine },
  reward: { backgroundColor: color.surface, borderColor: color.brand, ...glow.brand },
  mastery: { backgroundColor: color.surface, borderColor: color.mastery, ...glow.mastery },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: depth.border, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
});
