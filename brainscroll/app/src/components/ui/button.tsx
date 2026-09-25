import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { haptic } from '@/theme/feedback';
import { Icon, type IconName } from './icon';
import { color, depth, layout, radius, space, type } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'mastery' | 'danger';

/**
 * One obvious action per screen: `primary` (violet, filled). `success` is the
 * Continue after a correct answer; `mastery` is reserved for mastery moments.
 * Buttons depress on press (their 4 px darker edge collapses) and are full-width by default.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  compact,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
}) {
  const v = disabled ? 'disabled' : variant;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (variant !== 'ghost') haptic.select();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        styles[v],
        v !== 'ghost' && v !== 'disabled' && (pressed ? { borderBottomWidth: v === 'secondary' || v === 'danger' ? depth.border : 0, transform: [{ translateY: depth.edge }] } : { borderBottomWidth: depth.edge }),
        pressed && v === 'ghost' && { opacity: 0.6 },
        style,
      ]}>
      {icon}
      <Text style={[type.button, { textAlign: 'center', flexShrink: 1 }, compact && { fontSize: 14 }, { color: LABEL[v] }]}>{label}</Text>
    </Pressable>
  );
}

const LABEL: Record<ButtonVariant | 'disabled', string> = {
  primary: color.text,
  secondary: color.text,
  ghost: color.textMuted,
  success: '#0D171B',
  mastery: '#1A1305',
  danger: color.danger,
  disabled: color.textFaint,
};

const styles = StyleSheet.create({
  base: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  compact: { minHeight: 44, paddingHorizontal: space.lg },
  primary: { backgroundColor: color.brand, borderBottomColor: color.brandEdge },
  secondary: { backgroundColor: color.surface, borderWidth: depth.border, borderColor: color.border },
  ghost: { backgroundColor: 'transparent' },
  success: { backgroundColor: color.success, borderBottomColor: color.successEdge },
  mastery: { backgroundColor: color.mastery, borderBottomColor: color.masteryEdge },
  // Irreversible actions only (e.g. delete account). Outlined, never a filled red slab.
  danger: { backgroundColor: color.dangerSoft, borderWidth: depth.border, borderColor: color.dangerLine },
  disabled: { backgroundColor: color.surfaceRaised, marginBottom: depth.edge },
});

/** A quiet icon-only button (close, report). Always has a spoken label. */
export function IconButton({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [iconStyles.hit, pressed && { opacity: 0.5 }]}>
      <Icon name={icon} tint={color.textMuted} size={24} />
    </Pressable>
  );
}
const iconStyles = StyleSheet.create({
  hit: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
});
