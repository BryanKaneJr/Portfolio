import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ingredientIndex } from '../data/catalog';
import { displayQuantity, displayStep, type UnitSystem } from '../logic/units';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

const UNIT_OPTIONS: { value: UnitSystem; label: string; hint: string }[] = [
  { value: 'us', label: 'US', hint: 'cups, ounces, °F' },
  { value: 'metric', label: 'Metric', hint: 'grams, ml, °C' },
];

/** A real line from the library, so the preview shows exactly what recipe pages will. */
const SAMPLE_QTY = { text: '2 cups', id: 'flour', name: 'all-purpose flour' };
const SAMPLE_STEP = 'Heat the oven to 350°F (175°C) and butter a 9-by-5-inch loaf pan.';

export default function SettingsScreen() {
  const c = useColors();
  const app = useAppState();
  const qty = displayQuantity(SAMPLE_QTY.text, app.units, SAMPLE_QTY.id, SAMPLE_QTY.name);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.scroll}>
      <Text style={[t.label, styles.sectionLabel, { color: c.textMuted }]}>Units</Text>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View
          style={[styles.segment, { borderColor: c.chipBorder, backgroundColor: c.bg }]}
          accessibilityRole="radiogroup"
          accessibilityLabel="Units"
        >
          {UNIT_OPTIONS.map(o => {
            const on = app.units === o.value;
            return (
              <Pressable
                key={o.value}
                onPress={() => app.setUnits(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${o.label}: ${o.hint}`}
                style={[styles.segBtn, on && { backgroundColor: c.primary }]}
              >
                <Text style={[t.bodyStrong, { color: on ? c.primaryText : c.text }]}>{o.label}</Text>
                <Text style={[t.small, { color: on ? c.primaryText : c.textMuted }]}>{o.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.preview, { borderTopColor: c.divider }]}>
          <Text style={[t.label, { color: c.textMuted }]}>Recipes will read</Text>
          <Text style={[t.body, { color: c.text }]}>
            <Text style={{ fontWeight: '700' }}>{qty}</Text> {SAMPLE_QTY.name}
          </Text>
          <Text style={[t.body, { color: c.text }]}>{displayStep(SAMPLE_STEP, app.units, ingredientIndex)}</Text>
        </View>
      </View>
      <Text style={[t.small, styles.note, { color: c.textMuted }]}>
        {app.units === 'metric'
          ? 'Recipes are written in US measures. Metric amounts are converted and rounded, with fan and gas mark oven settings. Teaspoons and tablespoons stay as they are.'
          : 'Amounts and temperatures are shown as the recipes are written, with metric in brackets where the recipe gives it.'}
      </Text>

      <Text style={[t.label, styles.sectionLabel, { color: c.textMuted, marginTop: space.xl }]}>My pantry</Text>
      <Pressable
        onPress={() => router.push('/staples')}
        accessibilityRole="button"
        accessibilityLabel={`Kitchen staples, ${app.assumeStaples ? `${app.stapleIds.length} assumed` : 'off'}`}
        style={({ pressed }) => [
          styles.card,
          styles.row,
          { backgroundColor: c.card, borderColor: c.cardBorder, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <View style={styles.flex}>
          <Text style={[t.heading, { color: c.text }]}>Kitchen staples</Text>
          <Text style={[t.small, { color: c.textMuted, marginTop: 2 }]}>
            {app.assumeStaples ? `${app.stapleIds.length} assumed on hand` : 'Not assumed'}
          </Text>
        </View>
        <Text style={[styles.chev, { color: c.textMuted }]}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingTop: space.md, paddingBottom: space.xxl * 2 },
  sectionLabel: { marginHorizontal: space.lg, marginBottom: space.sm },
  card: { marginHorizontal: space.lg, borderWidth: 1, borderRadius: radius.lg, padding: space.lg },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.md, padding: 4, gap: 4 },
  segBtn: {
    flex: 1,
    minHeight: MIN_TOUCH + 8,
    borderRadius: radius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xs,
  },
  preview: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.lg, paddingTop: space.md, gap: space.xs },
  note: { marginHorizontal: space.lg, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: MIN_TOUCH },
  chev: { fontSize: 26, fontWeight: '600' },
});
