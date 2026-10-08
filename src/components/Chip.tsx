import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';

export type ChipVariant = 'neutral' | 'use' | 'avoid' | 'filterOn';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ChipVariant;
  /** Show a trailing × (selected, removable chip). */
  removable?: boolean;
  small?: boolean;
  /** Small hint shown after the label, e.g. a count or matched alias. */
  hint?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  selected?: boolean;
};

/**
 * Pill used everywhere: ingredient suggestions, selected Use/Avoid chips and filters.
 * Use vs Avoid is never colour-only: Use shows ✓, Avoid shows ⊘ and strikes the text.
 */
export function Chip({
  label,
  onPress,
  variant = 'neutral',
  removable,
  small,
  hint,
  accessibilityLabel,
  accessibilityHint,
  selected,
}: Props) {
  const c = useColors();
  const palette = {
    neutral: { bg: c.chip, border: c.chipBorder, fg: c.text },
    use: { bg: c.herbSoft, border: c.herb, fg: c.herbText },
    avoid: { bg: c.avoidSoft, border: c.avoid, fg: c.avoidText },
    filterOn: { bg: c.text, border: c.text, fg: c.bg },
  }[variant];
  const icon = variant === 'use' ? '✓ ' : variant === 'avoid' ? '⊘ ' : '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      hitSlop={small ? 6 : 0}
      style={({ pressed }) => [
        styles.chip,
        small && styles.small,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.row}>
        {icon ? <Text style={[styles.label, small && styles.smallLabel, styles.bold, { color: palette.fg }]}>{icon}</Text> : null}
        <Text
          style={[
            styles.label,
            small && styles.smallLabel,
            { color: palette.fg },
            variant === 'avoid' && styles.strike,
            (variant === 'use' || variant === 'avoid' || variant === 'filterOn') && styles.bold,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {hint ? <Text style={[styles.hint, { color: variant === 'filterOn' ? palette.fg : c.textMuted }]}> {hint}</Text> : null}
        {removable ? <Text style={[styles.x, { color: palette.fg }]}>  ×</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH - 4,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  small: { minHeight: 34, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 15 },
  smallLabel: { fontSize: 14 },
  bold: { fontWeight: '600' },
  strike: { textDecorationLine: 'line-through' },
  hint: { fontSize: 13 },
  x: { fontSize: 17, fontWeight: '600', marginTop: -1 },
});
