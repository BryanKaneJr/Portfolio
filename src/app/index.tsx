import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '../components/Chip';
import { Dropdown } from '../components/Dropdown';
import { IngredientBrowser } from '../components/IngredientBrowser';
import { UseAvoidToggle } from '../components/UseAvoidToggle';
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

  const { effectivePantry } = app;
  const count = useMemo(() => countExact(RECIPES, search), [search]);
  const canMake = useMemo(
    () => countCanMake(RECIPES, effectivePantry, { meal: app.pantryMeal, dishType: app.pantryDishType }),
    [effectivePantry, app.pantryMeal, app.pantryDishType],
  );
  const pantryFilters = { meal: app.pantryMeal, dishType: app.pantryDishType };
  const empty = isEmptySearch(search);
  const browsing = search.useIds.length === 0 && search.avoidIds.length === 0;

  const pickLabel = empty
    ? 'Browse recipes'
    : count === 0
      ? 'No exact matches · See options'
      : `${browsing ? 'Browse' : 'See'} ${count} ${count === 1 ? 'recipe' : 'recipes'}`;
  const pantryLabel =
    pantry.length === 0
      ? 'Set up my pantry'
      : canMake === 0
        ? 'Nothing yet · See what’s close'
        : `Show ${canMake} I can make`;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={[t.display, { color: c.text }]} accessibilityRole="header">
              Cook With That
            </Text>
            <Text style={[t.body, { color: c.textMuted }]}>
              {homeMode === 'pick'
                ? "Pick what you'd like to use."
                : 'Recipes you can make with what you keep on hand.'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/favorites')}
            accessibilityRole="button"
            accessibilityLabel={`Favorites, ${app.favorites.length} saved`}
            style={({ pressed }) => [
              styles.favBtn,
              { borderColor: c.chipBorder, backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ color: c.primary, fontSize: 17 }}>♥</Text>
            <Text style={[t.small, { color: c.text, fontWeight: '600' }]}>Favorites</Text>
          </Pressable>
        </View>

        {/* Top-level mode toggle */}
        <View
          style={[styles.modeToggle, { borderColor: c.chipBorder, backgroundColor: c.card }]}
          accessibilityRole="tablist"
        >
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
            <View style={styles.dropdowns}>
              <Dropdown
                label="Meal"
                anyLabel="Any meal"
                options={MEALS}
                labels={MEAL_LABELS}
                value={search.meal}
                onChange={app.setMeal}
                countFor={meal => countExact(RECIPES, { ...search, meal })}
              />
              <Dropdown
                label="Dish type"
                anyLabel="Any type"
                options={DISH_TYPES}
                labels={DISH_TYPE_LABELS}
                value={search.dishType}
                onChange={app.setDishType}
                countFor={dishType => countExact(RECIPES, { ...search, dishType })}
              />
            </View>

            <UseAvoidToggle />
            <IngredientBrowser target="pick" layout="compact" />
          </>
        ) : (
          <>
            <View style={styles.dropdowns}>
              <Dropdown
                label="Meal"
                anyLabel="Any meal"
                options={MEALS}
                labels={MEAL_LABELS}
                value={app.pantryMeal}
                onChange={app.setPantryMeal}
                countFor={meal => countCanMake(RECIPES, effectivePantry, { ...pantryFilters, meal })}
              />
              <Dropdown
                label="Dish type"
                anyLabel="Any type"
                options={DISH_TYPES}
                labels={DISH_TYPE_LABELS}
                value={app.pantryDishType}
                onChange={app.setPantryDishType}
                countFor={dishType => countCanMake(RECIPES, effectivePantry, { ...pantryFilters, dishType })}
              />
            </View>
            <StaplesLine />

            <View style={[styles.pantryCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
              <View style={styles.pantryTop}>
                <Text style={[t.heading, { color: c.text, flex: 1 }]}>
                  Your pantry{pantry.length ? ` · ${pantry.length} ${pantry.length === 1 ? 'item' : 'items'}` : ''}
                </Text>
                <Pressable
                  onPress={() => router.push('/pantry')}
                  accessibilityRole="button"
                  accessibilityLabel="Edit pantry"
                  hitSlop={8}
                  style={styles.editBtn}
                >
                  <Text style={[t.bodyStrong, { color: c.primary }]}>{pantry.length ? 'Edit' : 'Set up'}</Text>
                </Pressable>
              </View>
              {pantry.length === 0 ? (
                <Text style={[t.body, { color: c.textMuted }]}>
                  Save the ingredients you usually have and we’ll show recipes you can make without shopping. Kitchen
                  staples are already assumed.
                </Text>
              ) : (
                <View style={styles.wrap}>
                  {pantry.slice(0, PANTRY_PREVIEW).map(id => (
                    <Chip
                      key={id}
                      small
                      variant="use"
                      label={ingredientName(id)}
                      onPress={() => router.push('/pantry')}
                      accessibilityHint="Opens pantry editor"
                    />
                  ))}
                  {pantry.length > PANTRY_PREVIEW ? (
                    <Text style={[t.small, styles.more, { color: c.textMuted }]}>
                      +{pantry.length - PANTRY_PREVIEW} more
                    </Text>
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
        {homeMode === 'pick' ? (
          <View style={styles.selRow}>
            <SelectionButton kind="use" ids={search.useIds} />
            <SelectionButton kind="avoid" ids={search.avoidIds} />
          </View>
        ) : null}
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
            onPress={() =>
              router.push(homeMode === 'pick' ? '/results' : pantry.length ? '/pantry-results' : '/pantry')
            }
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[t.bodyStrong, { color: c.primaryText, fontSize: 17 }]}>
              {homeMode === 'pick' ? pickLabel : pantryLabel}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

/** Footer button: "✓ USE 3 — Chicken, Garlic…" → opens the full selections screen. */
function SelectionButton({ kind, ids }: { kind: 'use' | 'avoid'; ids: string[] }) {
  const c = useColors();
  const use = kind === 'use';
  const fg = use ? c.herbText : c.avoidText;
  const names = ids.map(ingredientName);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/selections', params: { focus: kind } })}
      accessibilityRole="button"
      accessibilityLabel={`${use ? 'Use' : 'Avoid'} list, ${ids.length} ${ids.length === 1 ? 'ingredient' : 'ingredients'}${names.length ? `: ${names.join(', ')}` : ''}. Open`}
      style={({ pressed }) => [
        styles.selBtn,
        {
          backgroundColor: use ? c.herbSoft : c.avoidSoft,
          borderColor: use ? c.herb : c.avoid,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.selTop}>
        <Text style={[t.label, { color: fg }]}>{use ? '✓ Use' : '⊘ Avoid'}</Text>
        <View style={[styles.badge, { backgroundColor: use ? c.herb : c.avoid }]}>
          <Text style={[styles.badgeText, { color: c.card }]}>{ids.length}</Text>
        </View>
        <Text style={[styles.chev, { color: fg }]}>›</Text>
      </View>
      <Text style={[t.small, { color: fg }]} numberOfLines={1}>
        {names.length ? names.join(', ') : use ? 'Nothing yet' : 'Nothing'}
      </Text>
    </Pressable>
  );
}

/** "Assuming 20 kitchen staples · Edit" */
function StaplesLine() {
  const c = useColors();
  const app = useAppState();
  const n = app.stapleIds.length;
  return (
    <Pressable
      onPress={() => router.push('/staples')}
      accessibilityRole="button"
      accessibilityLabel={
        app.assumeStaples
          ? `Assuming ${n} kitchen staples like salt, oil and butter. Edit`
          : 'Kitchen staples are not assumed. Edit'
      }
      style={styles.staples}
      hitSlop={6}
    >
      <Text style={[t.small, { color: c.textMuted }]}>
        {app.assumeStaples
          ? `Assuming you have ${n} kitchen staples (salt, oil, butter…)`
          : 'Kitchen staples not assumed'}
        <Text style={{ color: c.primary, fontWeight: '700' }}> Edit</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dropdowns: { flexDirection: 'row', gap: space.sm, marginHorizontal: space.lg, marginTop: space.lg },
  staples: { marginHorizontal: space.lg, marginTop: space.sm, minHeight: 28, justifyContent: 'center' },
  selRow: { flexDirection: 'row', gap: space.sm },
  selBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 58,
    gap: 2,
  },
  selTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 13, fontWeight: '800' },
  chev: { marginLeft: 'auto', fontSize: 22, fontWeight: '600', marginTop: -3 },
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.md,
  },
  favBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: space.lg,
    marginTop: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    padding: 4,
  },
  modeBtn: { flex: 1, minHeight: MIN_TOUCH, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  modeHint: { paddingHorizontal: space.lg, marginTop: space.sm },
  pantryCard: {
    marginHorizontal: space.lg,
    marginTop: space.xl,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
  },
  pantryTop: { flexDirection: 'row', alignItems: 'center' },
  editBtn: { minHeight: 32, minWidth: MIN_TOUCH, alignItems: 'flex-end', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2, alignItems: 'center' },
  more: { marginLeft: space.xs },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  clearBtn: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.xs },
  primary: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
});
