import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { dayLabel, SLOT_LABELS } from '../components/AddToPlanSheet';
import { formatMinutes } from '../components/RecipeCard';
import { MEAL_LABELS } from '../data/labels';
import type { Recipe } from '../data/types';
import { PLAN_SLOTS, type PlanSlot } from '../logic/mealPlan';
import { normalizeText } from '../logic/normalizeIngredient';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

type Row = { kind: 'header'; title: string } | { kind: 'recipe'; recipe: Recipe };

/** Pick a recipe for one meal slot: your recipes and favorites first, then everything for that meal, by name. */
export default function PlanAddScreen() {
  const c = useColors();
  const app = useAppState();
  const params = useLocalSearchParams<{ day: string; slot: string }>();
  const day = params.day ?? '';
  const slot: PlanSlot = PLAN_SLOTS.includes(params.slot as PlanSlot) ? (params.slot as PlanSlot) : 'dinner';
  const [query, setQuery] = useState('');

  const rows = useMemo<Row[]>(() => {
    const q = normalizeText(query);
    const fits = (r: Recipe) => !q || normalizeText(r.title).includes(q);
    const savedIds = [...new Set([...app.ownRecipes.map(r => r.id), ...app.editedIds, ...app.favorites])];
    const saved = savedIds.map(id => app.recipeById(id)).filter((r): r is Recipe => !!r && fits(r));
    const savedSet = new Set(saved.map(r => r.id));
    const rest = app.library
      .filter(r => !savedSet.has(r.id) && fits(r) && (q ? true : r.meals.includes(slot)))
      .sort((a, b) => a.title.localeCompare(b.title));
    return [
      ...(saved.length ? [{ kind: 'header' as const, title: 'Yours and favorites' }] : []),
      ...saved.map(recipe => ({ kind: 'recipe' as const, recipe })),
      ...(rest.length ? [{ kind: 'header' as const, title: q ? 'All recipes' : `${SLOT_LABELS[slot]} recipes` }] : []),
      ...rest.map(recipe => ({ kind: 'recipe' as const, recipe })),
    ];
  }, [query, app.library, app.ownRecipes, app.editedIds, app.favorites, app.recipeById, slot]);

  const choose = (recipe: Recipe) => {
    if (day) app.planRecipe(day, slot, recipe.id);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: day ? `${dayLabel(day)} · ${SLOT_LABELS[slot]}` : 'Add a recipe' }} />
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.chipBorder }]}>
          <Text style={{ color: c.textMuted, fontSize: 16 }}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search recipes by name"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { color: c.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            accessibilityLabel="Search recipes by name"
          />
        </View>
        <FlatList
          data={rows}
          keyExtractor={(row, i) => (row.kind === 'header' ? `h${i}` : row.recipe.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={[t.body, { color: c.textMuted, textAlign: 'center', marginTop: space.xl }]}>
              No recipe has that in its name.
            </Text>
          }
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <Text style={[t.label, styles.header, { color: c.textMuted }]}>{item.title}</Text>
            ) : (
              <Pressable
                onPress={() => choose(item.recipe)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.recipe.title}`}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: c.divider, backgroundColor: pressed ? c.divider : 'transparent' },
                ]}
              >
                <Text style={[t.bodyStrong, { color: c.text }]} numberOfLines={2}>
                  {item.recipe.title}
                </Text>
                <Text style={[t.small, { color: c.textMuted }]}>
                  {formatMinutes(item.recipe.prepMinutes + item.recipe.cookMinutes)} ·{' '}
                  {item.recipe.meals.map(m => MEAL_LABELS[m]).join(', ')}
                </Text>
              </Pressable>
            )
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    minHeight: MIN_TOUCH,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2 },
  header: { marginTop: space.lg, marginBottom: space.xs },
  row: {
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
