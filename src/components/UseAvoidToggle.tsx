import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

/** "✓ Use these | ⊘ Avoid these" — decides which list an ingredient tap goes to. */
export function UseAvoidToggle({ compactHint }: { compactHint?: boolean }) {
  const c = useColors();
  const { mode, setMode } = useAppState();
  return (
    <>
      <View style={[styles.segment, { backgroundColor: c.divider }]} accessibilityRole="tablist">
        {(['use', 'avoid'] as const).map(m => {
          const on = mode === m;
          const fg = m === 'use' ? c.herbText : c.avoidText;
          return (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={
                m === 'use'
                  ? 'Use these: tapped ingredients must be in the recipe'
                  : 'Avoid these: hide recipes with tapped ingredients'
              }
              style={[styles.segBtn, on && { backgroundColor: c.card, borderColor: m === 'use' ? c.herb : c.avoid }]}
            >
              <Text style={[t.bodyStrong, { color: on ? fg : c.textMuted }]}>
                {m === 'use' ? '✓ Use these' : '⊘ Avoid these'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {compactHint ? null : (
        <Text style={[t.small, styles.hint, { color: c.textMuted }]}>
          {mode === 'use' ? 'Recipes must include every ingredient you tap.' : 'Recipes with any of these are hidden.'}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    marginHorizontal: space.lg,
    marginTop: space.xl,
    borderRadius: radius.md,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm + 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  hint: { paddingHorizontal: space.lg, marginTop: space.sm },
});
