import { ScrollView, StyleSheet, Pressable, Switch, Text, View } from 'react-native';

import { Chip } from '../components/Chip';
import { IngredientBrowser } from '../components/IngredientBrowser';
import { ingredientName } from '../data/catalog';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

/** Kitchen staples: things My Pantry assumes you have, so you don't have to add them one by one. */
export default function StaplesScreen() {
  const c = useColors();
  const app = useAppState();
  const on = app.assumeStaples;
  const set = new Set(app.stapleIds);

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={[t.heading, { color: c.text }]}>Assume I have kitchen staples</Text>
            <Text style={[t.small, { color: c.textMuted, marginTop: 2 }]}>
              In My Pantry, these count as on hand without adding them. Recipe pages still list them with amounts.
            </Text>
          </View>
          <Switch
            value={on}
            onValueChange={app.setAssumeStaples}
            trackColor={{ true: c.herb, false: c.chipBorder }}
            accessibilityLabel="Assume I have kitchen staples"
          />
        </View>
      </View>

      <Text style={[t.small, styles.note, { color: c.textMuted }]}>
        {on
          ? `${app.stapleIds.length} staples. Tap to remove anything you don’t usually have, or add your own.`
          : 'Turned off: My Pantry only counts what you add to your pantry.'}
      </Text>

      <View style={!on && styles.dim} pointerEvents={on ? 'auto' : 'none'}>
        <Text style={[t.label, styles.sectionLabel, { color: c.textMuted }]}>Your staples · tap to remove</Text>
        <View style={styles.wrap}>
          {app.stapleIds.length === 0 ? <Text style={[t.small, { color: c.textMuted }]}>None yet.</Text> : null}
          {[...app.stapleIds]
            .sort((a, b) => ingredientName(a).localeCompare(ingredientName(b)))
            .map(id => (
              <Chip
                key={id}
                small
                variant="use"
                label={ingredientName(id)}
                removable
                accessibilityLabel={`${ingredientName(id)}, assumed staple. Remove`}
                onPress={() => app.toggleStaple(id)}
              />
            ))}
        </View>
        <Text style={[t.label, styles.sectionLabel, { color: c.textMuted, marginTop: space.xl }]}>Add a staple</Text>
        <IngredientBrowser target="staples" layout="compact" />
      </View>

      <Pressable onPress={app.resetStaples} accessibilityRole="button" style={styles.reset}>
        <Text style={[t.bodyStrong, { color: c.primary }]}>Reset to default staples</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingTop: space.md, paddingBottom: space.xxl * 2 },
  card: { marginHorizontal: space.lg, borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  note: { marginHorizontal: space.lg, marginTop: space.md },
  dim: { opacity: 0.4 },
  sectionLabel: { marginHorizontal: space.lg, marginTop: space.lg, marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2, marginHorizontal: space.lg },
  reset: { minHeight: MIN_TOUCH, alignSelf: 'center', justifyContent: 'center', marginTop: space.xl },
});
