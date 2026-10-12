import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../components/Icon';
import { Card, SectionLabel, Segmented } from '../components/ui';
import { ingredientIndex } from '../data/catalog';
import { displayQuantity, displayStep, type UnitSystem } from '../logic/units';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { space } from '../theme/spacing';
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
      <SectionLabel text="Units" style={styles.first} />
      <Card style={styles.gap}>
        <Segmented
          value={app.units}
          onChange={app.setUnits}
          options={UNIT_OPTIONS.map(o => ({
            value: o.value,
            label: o.label,
            accessibilityLabel: `${o.label}: ${o.hint}`,
          }))}
        />
        <Text style={[t.small, { color: c.textMuted }]}>{UNIT_OPTIONS.find(o => o.value === app.units)?.hint}</Text>
        <View style={[styles.preview, { borderTopColor: c.divider }]}>
          <Text style={[t.label, { color: c.textMuted }]}>Recipes will read</Text>
          <Text style={[t.body, { color: c.text }]}>
            <Text style={{ fontWeight: '700' }}>{qty}</Text> {SAMPLE_QTY.name}
          </Text>
          <Text style={[t.body, { color: c.text }]}>{displayStep(SAMPLE_STEP, app.units, ingredientIndex)}</Text>
        </View>
      </Card>
      <Text style={[t.small, styles.note, { color: c.textMuted }]}>
        {app.units === 'metric'
          ? 'Recipes are written in US measures. Metric amounts are converted and rounded, with fan and gas mark oven settings. Teaspoons and tablespoons stay as they are.'
          : 'Amounts and temperatures are shown as the recipes are written, with metric in brackets where the recipe gives it.'}
      </Text>

      <SectionLabel text="Pantry" />
      <Pressable
        onPress={() => router.push('/staples')}
        accessibilityRole="button"
        accessibilityLabel={`Kitchen staples, ${app.assumeStaples ? `${app.stapleIds.length} assumed` : 'off'}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Card style={styles.row}>
          <View style={styles.flex}>
            <Text style={[t.heading, { color: c.text }]}>Kitchen staples</Text>
            <Text style={[t.small, { color: c.textMuted, marginTop: 2 }]}>
              {app.assumeStaples ? `${app.stapleIds.length} counted as on hand` : 'Not counted'}
            </Text>
          </View>
          <Icon name="chevronRight" size={16} color={c.textMuted} weight="semibold" />
        </Card>
      </Pressable>

      {/* Owner decision 10: checking for allergens is the cook's job; the app says so here, not on the Avoid list. */}
      <SectionLabel text="Allergies" />
      <Card style={styles.row}>
        <Icon name="info" size={20} color={c.textMuted} style={styles.infoIcon} />
        <Text style={[t.body, styles.flex, { color: c.text }]}>
          Avoid hides recipes that list that ingredient. It doesn’t know what’s inside packaged foods like broth,
          mayonnaise or sauces, or that bacon is pork. If you’re cooking for someone with an allergy, check every
          ingredient and label yourself.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2 },
  first: { marginTop: space.md },
  gap: { gap: space.sm },
  preview: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.sm, paddingTop: space.md, gap: space.xs },
  note: { marginTop: space.sm, paddingHorizontal: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  infoIcon: { alignSelf: 'flex-start', marginTop: 1 },
});
