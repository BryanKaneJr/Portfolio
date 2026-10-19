import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { Icon } from './Icon';

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
 * Use vs Avoid is never colour-only: Use shows a check, Avoid shows a no-entry sign and strikes the text.
 * filterOn (a picked option in a single list, like a day or a meal) is solid ink.
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
    use: { bg: c.herbSoft, border: c.herbSoft, fg: c.herbText },
    avoid: { bg: c.avoidSoft, border: c.avoidSoft, fg: c.avoidText },
    filterOn: { bg: c.primary, border: c.primary, fg: c.primaryText },
  }[variant];
  const iconSize = small ? 13 : 15;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      hitSlop={small ? 6 : 0}
      style={({ pressed }) => [
        styles.chip,
        small && styles.small,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <View style={styles.row}>
        {variant === 'use' ? <Icon name="check" size={iconSize} color={palette.fg} weight="bold" /> : null}
        {variant === 'avoid' ? <Icon name="avoid" size={iconSize} color={palette.fg} weight="semibold" /> : null}
        <Text
          style={[
            styles.label,
            small && styles.smallLabel,
            { color: palette.fg },
            variant === 'avoid' && styles.strike,
            variant !== 'neutral' && styles.bold,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.hint, { color: variant === 'neutral' ? c.textMuted : palette.fg }]}>{hint}</Text>
        ) : null}
        {removable ? <Icon name="close" size={iconSize} color={palette.fg} weight="semibold" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH - 6,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  small: { minHeight: 32, paddingHorizontal: space.md - 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: { fontSize: 15 },
  smallLabel: { fontSize: 14 },
  bold: { fontWeight: '600' },
  strike: { textDecorationLine: 'line-through' },
  hint: { fontSize: 13 },
});
