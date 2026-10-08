import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '../components/Chip';
import { FilterChips } from '../components/FilterChips';
import { SelectionSummary } from '../components/SelectionSummary';
import { INGREDIENTS, RECIPES, ingredientIndex } from '../data/catalog';
import { POPULAR_INGREDIENT_IDS } from '../data/ingredients';
import { CATEGORY_LABELS, DISH_TYPE_LABELS, MEAL_LABELS } from '../data/labels';
import { DISH_TYPES, INGREDIENT_CATEGORIES, MEALS, type Ingredient } from '../data/types';
import { countExact } from '../logic/matchRecipes';
import { searchIngredients } from '../logic/normalizeIngredient';
import { useAppState } from '../state/AppState';
import { isEmptySearch } from '../state/searchState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

const BY_CATEGORY = INGREDIENT_CATEGORIES.map(cat => ({
  cat,
  items: INGREDIENTS.filter(i => i.category === cat).sort((a, b) => a.name.localeCompare(b.name)),
}));
const POPULAR = POPULAR_INGREDIENT_IDS.map(id => ingredientIndex.byId.get(id)).filter((i): i is Ingredient => !!i);

export default function FindScreen() {
  const c = useColors();
  const app = useAppState();
  const { search, mode } = app;
  const [query, setQuery] = useState('');

  const hits = useMemo(() => searchIngredients(ingredientIndex, query), [query]);
  const count = useMemo(() => countExact(RECIPES, search), [search]);
  const empty = isEmptySearch(search);
  const browsing = search.useIds.length === 0 && search.avoidIds.length === 0;

  const variantFor = (id: string) => (search.useIds.includes(id) ? 'use' : search.avoidIds.includes(id) ? 'avoid' : 'neutral');

  const ingredientChip = (ing: Ingredient, hint?: string) => {
    const v = variantFor(ing.id);
    const inActive = (mode === 'use' && v === 'use') || (mode === 'avoid' && v === 'avoid');
    return (
      <Chip
        key={ing.id}
        label={ing.name}
        hint={hint}
        variant={v}
        selected={v !== 'neutral'}
        accessibilityLabel={`${ing.name}${v === 'use' ? ', in Use list' : v === 'avoid' ? ', in Avoid list' : ''}`}
        accessibilityHint={inActive ? 'Removes it' : mode === 'use' ? 'Adds to Use list' : 'Adds to Avoid list'}
        onPress={() => {
          app.pick(ing.id);
          if (query) setQuery('');
        }}
      />
    );
  };

  const buttonLabel = empty
    ? 'Browse recipes'
    : count === 0
      ? 'No exact matches · See options'
      : browsing
        ? `Browse ${count} ${count === 1 ? 'recipe' : 'recipes'}`
        : `See ${count} ${count === 1 ? 'recipe' : 'recipes'}`;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={[t.display, { color: c.text }]} accessibilityRole="header">
              Cook With That
            </Text>
            <Text style={[t.body, { color: c.textMuted }]}>Pick what you'd like to use.</Text>
          </View>
          <Pressable
            onPress={() => router.push('/favorites')}
            accessibilityRole="button"
            accessibilityLabel={`Favorites, ${app.favorites.length} saved`}
            style={({ pressed }) => [styles.favBtn, { borderColor: c.chipBorder, backgroundColor: c.card, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ color: c.primary, fontSize: 17 }}>♥</Text>
            <Text style={[t.small, { color: c.text, fontWeight: '600' }]}>Favorites</Text>
          </Pressable>
        </View>

        <FilterChips label="Meal" anyLabel="Any meal" options={MEALS} labels={MEAL_LABELS} value={search.meal} onChange={app.setMeal} />
        <FilterChips label="Dish type" anyLabel="Any type" options={DISH_TYPES} labels={DISH_TYPE_LABELS} value={search.dishType} onChange={app.setDishType} small />

        {/* Use / Avoid mode */}
        <View style={[styles.segment, { backgroundColor: c.divider }]} accessibilityRole="tablist">
          {(['use', 'avoid'] as const).map(m => {
            const on = mode === m;
            const fg = m === 'use' ? c.herbText : c.avoidText;
            return (
              <Pressable
                key={m}
                onPress={() => app.setMode(m)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={m === 'use' ? 'Use these: tapped ingredients must be in the recipe' : 'Avoid these: hide recipes with tapped ingredients'}
                style={[styles.segBtn, on && { backgroundColor: c.card, borderColor: m === 'use' ? c.herb : c.avoid }]}
              >
                <Text style={[t.bodyStrong, { color: on ? fg : c.textMuted }]}>{m === 'use' ? '✓ Use these' : '⊘ Avoid these'}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[t.small, styles.modeHint, { color: c.textMuted }]}>
          {mode === 'use' ? 'Recipes must include every ingredient you tap.' : 'Recipes with any of these are hidden.'}
        </Text>

        <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.chipBorder }]}>
          <Text style={{ color: c.textMuted, fontSize: 16 }}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search ingredients..."
            placeholderTextColor={c.textMuted}
            style={[styles.input, { color: c.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            clearButtonMode="while-editing"
            accessibilityLabel={`Search ingredients to ${mode}`}
          />
        </View>

        {query.trim() ? (
          <View style={styles.section}>
            {hits.length ? (
              <View style={styles.wrap}>{hits.map(h => ingredientChip(h.ingredient, h.matchedAlias ? `(${h.matchedAlias})` : undefined))}</View>
            ) : (
              <View style={styles.noIng}>
                <Text style={[t.body, { color: c.text }]}>No ingredient found for “{query.trim()}”.</Text>
                <Pressable onPress={() => setQuery('')} accessibilityRole="button" style={styles.textBtn}>
                  <Text style={[t.bodyStrong, { color: c.primary }]}>Clear search</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={[t.label, styles.sectionLabel, { color: c.textMuted }]}>Popular</Text>
              <View style={styles.wrap}>{POPULAR.map(i => ingredientChip(i))}</View>
            </View>
            {BY_CATEGORY.map(({ cat, items }) => (
              <View key={cat} style={styles.section}>
                <Text style={[t.label, styles.sectionLabel, { color: c.textMuted }]}>{CATEGORY_LABELS[cat]}</Text>
                <View style={styles.wrap}>{items.map(i => ingredientChip(i))}</View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Sticky footer: selections always visible + primary action */}
      <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.divider }]}>
        <SelectionSummary useIds={search.useIds} avoidIds={search.avoidIds} onRemove={app.remove} />
        <View style={styles.actions}>
          <Pressable
            onPress={app.clearAll}
            disabled={empty}
            accessibilityRole="button"
            accessibilityLabel="Clear all selections and filters"
            style={[styles.clearBtn, empty && { opacity: 0.4 }]}
          >
            <Text style={[t.bodyStrong, { color: c.textMuted }]}>Clear all</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/results')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[t.bodyStrong, { color: c.primaryText, fontSize: 17 }]}>{buttonLabel}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md },
  favBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  segment: { flexDirection: 'row', marginHorizontal: space.lg, marginTop: space.xl, borderRadius: radius.md, padding: 4 },
  segBtn: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 2, borderWidth: 2, borderColor: 'transparent' },
  modeHint: { paddingHorizontal: space.lg, marginTop: space.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, marginTop: space.md, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1.5, minHeight: 48 },
  input: { flex: 1, fontSize: 16, paddingVertical: space.sm },
  section: { marginTop: space.lg, paddingHorizontal: space.lg },
  sectionLabel: { marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  noIng: { gap: space.xs },
  textBtn: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  clearBtn: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.xs },
  primary: { flex: 1, minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
