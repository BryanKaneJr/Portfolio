import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { haptic } from '@/theme/feedback';
import { color, layout, radius, space, type } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'mastery';

/**
 * One obvious action per screen: `primary` (violet, filled). `success` is the
 * Continue after a correct answer; `mastery` is reserved for mastery moments.
 * Buttons depress on press (a 3 px "base" collapses) and are full-width by default.
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
        v !== 'ghost' && v !== 'disabled' && { borderBottomWidth: pressed ? 0 : 3, marginTop: pressed ? 3 : 0 },
        pressed && v === 'ghost' && { opacity: 0.6 },
        style,
      ]}>
      {icon}
      <Text style={[type.button, compact && { fontSize: 14 }, { color: LABEL[v] }]}>{label}</Text>
    </Pressable>
  );
}

const LABEL: Record<ButtonVariant | 'disabled', string> = {
  primary: color.text,
  secondary: color.text,
  ghost: color.textMuted,
  success: '#0B1120',
  mastery: '#1A1305',
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
  primary: { backgroundColor: color.brand, borderBottomColor: color.brandPressed },
  secondary: { backgroundColor: color.surfaceRaised, borderWidth: 1, borderColor: color.border, borderBottomColor: color.borderStrong },
  ghost: { backgroundColor: 'transparent' },
  success: { backgroundColor: color.success, borderBottomColor: '#25B36E' },
  mastery: { backgroundColor: color.mastery, borderBottomColor: '#D9A43C' },
  disabled: { backgroundColor: color.surfaceRaised },
});

/** A quiet icon-sized control for top bars (close, report). */
export function IconButton({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => [iconStyles.hit, pressed && { opacity: 0.5 }]}>
      <Text style={iconStyles.glyph}>{glyph}</Text>
    </Pressable>
  );
}
const iconStyles = StyleSheet.create({
  hit: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  glyph: { color: color.textMuted, fontSize: 22, fontWeight: '600' },
});
