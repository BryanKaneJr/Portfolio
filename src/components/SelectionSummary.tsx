import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ingredientName } from '../data/catalog';
import { useColors } from '../theme/colors';
import { space } from '../theme/spacing';
import { type as t } from '../theme/typography';
import { Chip } from './Chip';

type Props = {
  useIds: string[];
  avoidIds: string[];
  onRemove?: (id: string) => void;
  /** Wrap chips onto multiple lines instead of a horizontal scroller. */
  wrap?: boolean;
};

/** "USE ✓Chicken × ✓Garlic ×" / "AVOID ⊘Cream ×" — always visible, one tap to remove. */
export function SelectionSummary({ useIds, avoidIds, onRemove, wrap }: Props) {
  const c = useColors();
  const row = (kind: 'use' | 'avoid', list: string[]) => (
    <View style={styles.line}>
      <Text style={[t.label, styles.tag, { color: kind === 'use' ? c.herbText : c.avoidText }]}>
        {kind === 'use' ? 'Use' : 'Avoid'}
      </Text>
      {list.length === 0 ? (
        <Text style={[t.small, { color: c.textMuted }]}>{kind === 'use' ? 'Nothing yet' : 'Nothing'}</Text>
      ) : (
        <Container wrap={wrap}>
          {list.map(id => (
            <Chip
              key={id}
              small
              variant={kind}
              label={ingredientName(id)}
              removable={!!onRemove}
              onPress={onRemove ? () => onRemove(id) : undefined}
              accessibilityLabel={`${kind === 'use' ? 'Using' : 'Avoiding'} ${ingredientName(id)}${onRemove ? '. Remove' : ''}`}
            />
          ))}
        </Container>
      )}
    </View>
  );
  return (
    <View style={styles.wrap}>
      {row('use', useIds)}
      {row('avoid', avoidIds)}
    </View>
  );
}

function Container({ wrap, children }: { wrap?: boolean; children: ReactNode }) {
  return wrap ? (
    <View style={styles.wrapChips}>{children}</View>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2 },
  line: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  tag: { width: 58 },
  chips: { gap: space.xs + 2, paddingRight: space.lg },
  wrapChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2, paddingVertical: 2 },
});
