import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../theme/colors';
import { space } from '../theme/spacing';
import { type as t } from '../theme/typography';
import { Chip } from './Chip';

type Props<T extends string> = {
  label: string;
  anyLabel: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null;
  onChange: (v: T | null) => void;
  small?: boolean;
};

/** Single-select facet row: [Any] [Option] [Option] … (build plan §4 "simple v1 selection rule"). */
export function FilterChips<T extends string>({ label, anyLabel, options, labels, value, onChange, small }: Props<T>) {
  const c = useColors();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={[t.label, styles.label, { color: c.textMuted }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip small={small} label={anyLabel} variant={value === null ? 'filterOn' : 'neutral'} selected={value === null} onPress={() => onChange(null)} />
        {options.map(o => (
          <Chip
            key={o}
            small={small}
            label={labels[o]}
            variant={value === o ? 'filterOn' : 'neutral'}
            selected={value === o}
            accessibilityLabel={`${label}: ${labels[o]}`}
            onPress={() => onChange(value === o ? null : o)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md },
  label: { paddingHorizontal: space.lg, marginBottom: space.sm },
  row: { gap: space.sm, paddingHorizontal: space.lg },
});
