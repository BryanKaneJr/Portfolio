import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { color, depth, glow, iconSize, radius, space } from '@/theme/tokens';
import { Icon, type IconName } from './icon';

export type CardVariant = 'plain' | 'raised' | 'accent' | 'reward' | 'mastery' | 'quiet';

export type CardState = 'selected' | 'completed' | 'locked';

/**
 * Surfaces. `plain` for most content; `accent` marks the ONE primary thing on a
 * tab screen; `reward` and `mastery` glow and belong to progression moments only.
 *
 * States: default; pressed (tappable cards darken); `selected` (violet
 * outline and tint, for a choice like a plan or a first skill; pair it with
 * `role="radio"`); `completed` (a mint outline and a check in the corner);
 * `locked` (flat and dimmed with a lock, and it ignores taps). The corner
 * badge means state is never shown by colour alone.
 */
export function Card({ children, variant, accent, state, role = 'button', style, onPress, accessibilityLabel }: {
  children: ReactNode;
  variant?: CardVariant;
  /** @deprecated use variant="accent" */
  accent?: boolean;
  state?: CardState;
  /** A tappable card's role: `radio` when it's one of a set of choices. */
  role?: 'button' | 'radio';
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const v = variant ?? (accent ? 'accent' : 'plain');
  const s = [styles.card, styles[v], state && styles[state], style];
  const badge = state === 'completed' || state === 'locked' ? <StateBadge state={state} /> : null;
  if (!onPress || state === 'locked')
    return (
      <View style={s} accessibilityLabel={accessibilityLabel} accessibilityState={state === 'locked' ? { disabled: true } : undefined}>
        {children}
        {badge}
      </View>
    );
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={role === 'radio' ? { selected: state === 'selected' } : undefined}
      onPress={onPress}
      style={({ pressed }) => [...s, pressed && { backgroundColor: state === 'selected' ? color.brandSoft : color.surfacePressed, transform: [{ scale: 0.99 }] }]}>
      {children}
      {badge}
    </Pressable>
  );
}

/** The corner mark for a completed (check) or locked (lock) card. */
function StateBadge({ state }: { state: 'completed' | 'locked' }) {
  const done = state === 'completed';
  return (
    <View style={[styles.badge, { backgroundColor: done ? color.success : color.surfaceRaised }]} aria-hidden accessible={false}>
      <Icon name={done ? 'check' : 'lock'} tint={done ? color.onSuccess : color.textFaint} size={iconSize.xs} />
    </View>
  );
}

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Stack({ children, gap = space.md, style }: { children: ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Divider() {
  // The one true hairline: a divider inside a card, never a surface's edge.
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.border }} />;
}

/** Small rounded label for statuses ("2 / 5 today"). */
export function Chip({ children, tone = 'muted', icon }: { children: ReactNode; tone?: 'muted' | 'brand' | 'success' | 'mastery' | 'streak'; icon?: IconName }) {
  const c = { muted: color.border, brand: color.brandLine, success: color.successLine, mastery: color.mastery, streak: color.streak }[tone];
  const tint = { muted: color.textMuted, brand: color.brandText, success: color.success, mastery: color.mastery, streak: color.streak }[tone];
  return (
    <View style={[styles.chip, { borderColor: c }]}>
      {icon && <Icon name={icon} tint={tint} size={iconSize.sm} />}
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
  selected: { borderColor: color.brand, backgroundColor: color.brandSoft },
  completed: { borderColor: color.successLine },
  locked: { backgroundColor: 'transparent', borderColor: color.border, borderBottomWidth: depth.border, opacity: 0.7 },
  // A fixed-size mark on the card's corner (outside the text, so it never covers it), ringed in bg to stand off the border.
  badge: { position: 'absolute', top: -space.sm, right: -space.sm, width: 24, height: 24, borderRadius: radius.pill, borderWidth: depth.border, borderColor: color.bg, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: depth.border, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
});
