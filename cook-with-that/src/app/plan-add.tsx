import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { dayLabel, SLOT_LABELS } from '../components/AddToPlanSheet';
import { DishIcon } from '../components/Icon';
import { SearchBox } from '../components/IngredientBrowser';
import { formatMinutes } from '../components/RecipeCard';
import { SectionLabel, Segmented } from '../components/ui';
import { MEAL_LABELS } from '../data/labels';
import type { Recipe } from '../data/types';
import { PLAN_SLOTS, type PlanSlot } from '../logic/mealPlan';
import { normalizeText } from '../logic/normalizeIngredient';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

type Row = { kind: 'header'; title: string } | { kind: 'recipe'; recipe: Recipe; first: boolean; last: boolean };

/** Pick a recipe for a day: choose the meal, then your recipes and favorites first, then everything for that meal. */
export default function PlanAddScreen() {
  const c = useColors();
  const app = useAppState();
  const params = useLocalSearchParams<{ day: string; slot?: string }>();
  const day = params.day ?? '';
  const [slot, setSlot] = useState<PlanSlot>(() => {
    if (PLAN_SLOTS.includes(params.slot as PlanSlot)) return params.slot as PlanSlot;
    // The first empty meal of the day, else dinner.
    return PLAN_SLOTS.find(s => !app.plan[day]?.[s]?.length) ?? 'dinner';
  });
  const [query, setQuery] = useState('');

  const { library, ownRecipes, editedIds, favorites, recipeById } = app;
  const rows = useMemo<Row[]>(() => {
    const q = normalizeText(query);
    const fits = (r: Recipe) => !q || normalizeText(r.title).includes(q);
    const savedIds = [...new Set([...ownRecipes.map(r => r.id), ...editedIds, ...favorites])];
    const saved = savedIds.map(id => recipeById(id)).filter((r): r is Recipe => !!r && fits(r));
    const savedSet = new Set(saved.map(r => r.id));
    const rest = library
      .filter(r => !savedSet.has(r.id) && fits(r) && (q ? true : r.meals.includes(slot)))
      .sort((a, b) => a.title.localeCompare(b.title));
    const group = (title: string, list: Recipe[]): Row[] =>
      list.length
        ? [
            { kind: 'header', title },
            ...list.map((recipe, i) => ({
              kind: 'recipe' as const,
              recipe,
              first: i === 0,
              last: i === list.length - 1,
            })),
          ]
        : [];
    return [...group('Yours and favorites', saved), ...group(q ? 'All recipes' : `${SLOT_LABELS[slot]} recipes`, rest)];
  }, [query, library, ownRecipes, editedIds, favorites, recipeById, slot]);

  const choose = (recipe: Recipe) => {
    if (day) app.planRecipe(day, slot, recipe.id);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: day ? dayLabel(day) : 'Add a recipe' }} />
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <View style={styles.top}>
          <Segmented
            value={slot}
            onChange={setSlot}
            options={PLAN_SLOTS.map(s => ({ value: s, label: SLOT_LABELS[s] }))}
          />
        </View>
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search recipes by name"
          label="Search recipes by name"
        />
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
              <SectionLabel text={item.title} />
            ) : (
              <Pressable
                onPress={() => choose(item.recipe)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.recipe.title} to ${SLOT_LABELS[slot]}`}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? c.fill : c.card, borderColor: c.cardBorder },
                  item.first && styles.firstRow,
                  item.last && styles.lastRow,
                  !item.first && { borderTopWidth: 0 },
                ]}
              >
                <DishIcon recipe={item.recipe} size={22} color={c.accent} />
                <View style={styles.flex}>
                  <Text style={[t.bodyStrong, { color: c.text }]} numberOfLines={1}>
                    {item.recipe.title}
                  </Text>
                  <Text style={[t.small, { color: c.textMuted }]} numberOfLines={1}>
                    {formatMinutes(item.recipe.prepMinutes + item.recipe.cookMinutes)} ·{' '}
                    {item.recipe.meals.map(m => MEAL_LABELS[m]).join(', ')}
                  </Text>
                </View>
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
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  firstRow: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  lastRow: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
});
