import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip } from '../components/Chip';
import { IngredientBrowser } from '../components/IngredientBrowser';
import { Card, LinkButton, SectionLabel, Toggle } from '../components/ui';
import { ingredientName } from '../data/catalog';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { space } from '../theme/spacing';
import { type as t } from '../theme/typography';

/** Kitchen staples: things My Pantry assumes you have, so you don't have to add them one by one. */
export default function StaplesScreen() {
  const c = useColors();
  const app = useAppState();
  const on = app.assumeStaples;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={[t.heading, { color: c.text }]}>Count kitchen staples as on hand</Text>
            <Text style={[t.small, { color: c.textMuted, marginTop: 2 }]}>
              The Pantry tab treats these as things you have without adding them. Recipe pages still list them with
              amounts.
            </Text>
          </View>
          <Toggle
            value={on}
            onValueChange={app.setAssumeStaples}
            accessibilityLabel="Count kitchen staples as on hand"
          />
        </View>
      </Card>

      <Text style={[t.small, styles.note, { color: c.textMuted }]}>
        {on
          ? `${app.stapleIds.length} staples. Tap to remove anything you don’t usually have, or add your own.`
          : 'Turned off: the Pantry tab only counts what you add to your pantry.'}
      </Text>

      <View style={!on && styles.dim} pointerEvents={on ? 'auto' : 'none'}>
        <SectionLabel text="Your staples · tap to remove" style={styles.label} />
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
        <SectionLabel text="Add a staple" style={styles.label} />
        <IngredientBrowser target="staples" layout="compact" />
      </View>

      <View style={styles.reset}>
        <LinkButton label="Reset to the default staples" onPress={app.resetStaples} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingTop: space.md, paddingBottom: space.xxl * 2 },
  card: { marginHorizontal: space.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  note: { marginHorizontal: space.lg, marginTop: space.md },
  dim: { opacity: 0.4 },
  label: { marginHorizontal: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2, marginHorizontal: space.lg },
  reset: { alignItems: 'center', marginTop: space.xl },
});
