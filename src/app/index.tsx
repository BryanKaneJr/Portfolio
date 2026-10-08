import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '../components/Chip';
import { FilterChips } from '../components/FilterChips';
import { IngredientBrowser } from '../components/IngredientBrowser';
import { SelectionSummary } from '../components/SelectionSummary';
import { RECIPES, ingredientName } from '../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS } from '../data/labels';
import { DISH_TYPES, MEALS } from '../data/types';
import { countExact } from '../logic/matchRecipes';
import { countCanMake } from '../logic/pantry';
import { useAppState, type HomeMode } from '../state/AppState';
import { isEmptySearch } from '../state/searchState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

const PANTRY_PREVIEW = 14;

export default function FindScreen() {
  const c = useColors();
  const app = useAppState();
  const { search, mode, homeMode, pantry } = app;

  const count = useMemo(() => countExact(RECIPES, search), [search]);
  const canMake = useMemo(
    () => countCanMake(RECIPES, pantry, { meal: app.pantryMeal, dishType: app.pantryDishType }),
    [pantry, app.pantryMeal, app.pantryDishType],
  );
  const empty = isEmptySearch(search);
  const browsing = search.useIds.length === 0 && search.avoidIds.length === 0;

  const pickLabel = empty
    ? 'Browse recipes'
    : count === 0
      ? 'No exact matches · See options'
      : `${browsing ? 'Browse' : 'See'} ${count} ${count === 1 ? 'recipe' : 'recipes'}`;
  const pantryLabel =
    pantry.length === 0 ? 'Set up my pantry' : canMake === 0 ? 'Nothing yet · See what’s close' : `Show ${canMake} I can make`;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={[t.display, { color: c.text }]} accessibilityRole="header">
              Cook With That
            </Text>
            <Text style={[t.body, { color: c.textMuted }]}>
              {homeMode === 'pick' ? "Pick what you'd like to use." : 'Recipes you can make with what you keep on hand.'}
            </Text>
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

        {/* Top-level mode toggle */}
        <View style={[styles.modeToggle, { borderColor: c.chipBorder, backgroundColor: c.card }]} accessibilityRole="tablist">
          {(
            [
              ['pick', 'Pick ingredients'],
              ['pantry', 'My pantry'],
            ] as [HomeMode, string][]
          ).map(([m, label]) => {
            const on = homeMode === m;
            return (
              <Pressable
                key={m}
                onPress={() => app.setHomeMode(m)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.modeBtn, on && { backgroundColor: c.primary }]}
              >
                <Text style={[t.bodyStrong, { color: on ? c.primaryText : c.text }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {homeMode === 'pick' ? (
          <>
            <FilterChips label="Meal" anyLabel="Any meal" options={MEALS} labels={MEAL_LABELS} value={search.meal} onChange={app.setMeal} />
            <FilterChips label="Dish type" anyLabel="Any type" options={DISH_TYPES} labels={DISH_TYPE_LABELS} value={search.dishType} onChange={app.setDishType} small />

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

            <IngredientBrowser
              searchLabel={`Search ingredients to ${mode}`}
              variantFor={id => (search.useIds.includes(id) ? 'use' : search.avoidIds.includes(id) ? 'avoid' : 'neutral')}
              stateLabelFor={id => (search.useIds.includes(id) ? ', in Use list' : search.avoidIds.includes(id) ? ', in Avoid list' : '')}
              hintFor={id =>
                (mode === 'use' ? search.useIds : search.avoidIds).includes(id) ? 'Removes it' : mode === 'use' ? 'Adds to Use list' : 'Adds to Avoid list'
              }
              onPick={app.pick}
            />
          </>
        ) : (
          <>
            <FilterChips label="Meal" anyLabel="Any meal" options={MEALS} labels={MEAL_LABELS} value={app.pantryMeal} onChange={app.setPantryMeal} />
            <FilterChips
              label="Dish type"
              anyLabel="Any type"
              options={DISH_TYPES}
              labels={DISH_TYPE_LABELS}
              value={app.pantryDishType}
              onChange={app.setPantryDishType}
              small
            />

            <View style={[styles.pantryCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
              <View style={styles.pantryTop}>
                <Text style={[t.heading, { color: c.text, flex: 1 }]}>
                  Your pantry{pantry.length ? ` · ${pantry.length} ${pantry.length === 1 ? 'item' : 'items'}` : ''}
                </Text>
                <Pressable onPress={() => router.push('/pantry')} accessibilityRole="button" accessibilityLabel="Edit pantry" hitSlop={8} style={styles.editBtn}>
                  <Text style={[t.bodyStrong, { color: c.primary }]}>{pantry.length ? 'Edit' : 'Set up'}</Text>
                </Pressable>
              </View>
              {pantry.length === 0 ? (
                <Text style={[t.body, { color: c.textMuted }]}>
                  Save the ingredients you usually have — including basics like salt and oil — and we’ll show recipes you can make without shopping.
                </Text>
              ) : (
                <View style={styles.wrap}>
                  {pantry.slice(0, PANTRY_PREVIEW).map(id => (
                    <Chip key={id} small variant="use" label={ingredientName(id)} onPress={() => router.push('/pantry')} accessibilityHint="Opens pantry editor" />
                  ))}
                  {pantry.length > PANTRY_PREVIEW ? (
                    <Text style={[t.small, styles.more, { color: c.textMuted }]}>+{pantry.length - PANTRY_PREVIEW} more</Text>
                  ) : null}
                </View>
              )}
            </View>
            <Text style={[t.small, styles.modeHint, { color: c.textMuted }]}>
              Shows recipes where you have every required ingredient. Optional toppings don’t count.
            </Text>
          </>
        )}
      </ScrollView>

      {/* Sticky footer */}
      <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.divider }]}>
        {homeMode === 'pick' ? <SelectionSummary useIds={search.useIds} avoidIds={search.avoidIds} onRemove={app.remove} /> : null}
        <View style={styles.actions}>
          {homeMode === 'pick' ? (
            <Pressable
              onPress={app.clearAll}
              disabled={empty}
              accessibilityRole="button"
              accessibilityLabel="Clear all selections and filters"
              style={[styles.clearBtn, empty && { opacity: 0.4 }]}
            >
              <Text style={[t.bodyStrong, { color: c.textMuted }]}>Clear all</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push(homeMode === 'pick' ? '/results' : pantry.length ? '/pantry-results' : '/pantry')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[t.bodyStrong, { color: c.primaryText, fontSize: 17 }]}>{homeMode === 'pick' ? pickLabel : pantryLabel}</Text>
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
  modeToggle: { flexDirection: 'row', marginHorizontal: space.lg, marginTop: space.lg, borderRadius: radius.pill, borderWidth: 1, padding: 4 },
  modeBtn: { flex: 1, minHeight: MIN_TOUCH, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', marginHorizontal: space.lg, marginTop: space.xl, borderRadius: radius.md, padding: 4 },
  segBtn: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm + 2, borderWidth: 2, borderColor: 'transparent' },
  modeHint: { paddingHorizontal: space.lg, marginTop: space.sm },
  pantryCard: { marginHorizontal: space.lg, marginTop: space.xl, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  pantryTop: { flexDirection: 'row', alignItems: 'center' },
  editBtn: { minHeight: 32, minWidth: MIN_TOUCH, alignItems: 'flex-end', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2, alignItems: 'center' },
  more: { marginLeft: space.xs },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  clearBtn: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.xs },
  primary: { flex: 1, minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
