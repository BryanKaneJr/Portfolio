import { StyleSheet, Text, View } from 'react-native';

import { ingredientName } from '../data/catalog';
import { useColors } from '../theme/colors';
import { space } from '../theme/spacing';
import { type as t } from '../theme/typography';
import { Chip } from './Chip';

type Props = {
  useIds: string[];
  avoidIds: string[];
  onRemove?: (id: string) => void;
};

/** The picked ingredients as chips (✓ use, ⊘ avoid), one tap to remove. */
export function SelectionSummary({ useIds, avoidIds, onRemove }: Props) {
  const c = useColors();
  if (useIds.length + avoidIds.length === 0)
    return <Text style={[t.small, { color: c.textMuted }]}>Any ingredients</Text>;
  const chip = (kind: 'use' | 'avoid', id: string) => (
    <Chip
      key={`${kind}:${id}`}
      small
      variant={kind}
      label={ingredientName(id)}
      removable={!!onRemove}
      onPress={onRemove ? () => onRemove(id) : undefined}
      accessibilityLabel={`${kind === 'use' ? 'Using' : 'Avoiding'} ${ingredientName(id)}${onRemove ? '. Remove' : ''}`}
    />
  );
  return (
    <View style={styles.wrap}>
      {useIds.map(id => chip('use', id))}
      {avoidIds.map(id => chip('avoid', id))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 },
});
