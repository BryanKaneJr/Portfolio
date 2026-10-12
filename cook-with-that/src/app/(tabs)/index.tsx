import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Dropdown } from '../../components/Dropdown';
import { Icon } from '../../components/Icon';
import { IngredientBrowser, SearchBox } from '../../components/IngredientBrowser';
import { Button, IconButton, LargeHeader } from '../../components/ui';
import { UseAvoidToggle } from '../../components/UseAvoidToggle';
import { ingredientName } from '../../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS } from '../../data/labels';
import { DISH_TYPES, MEALS } from '../../data/types';
import { countExact } from '../../logic/matchRecipes';
import { useAppState } from '../../state/AppState';
import { usePickerConfig } from '../../state/pickerTarget';
import { isEmptySearch } from '../../state/searchState';
import { useColors } from '../../theme/colors';
import { MIN_TOUCH, space } from '../../theme/spacing';
import { type as t } from '../../theme/typography';

/** Find: pick ingredients to use or avoid, narrow by meal and dish type, then see the recipes. */
export default function FindScreen() {
  const c = useColors();
  const app = useAppState();
  const { search, mode } = app;
  const cfg = usePickerConfig('pick');
  const [query, setQuery] = useState('');

  const count = useMemo(() => countExact(app.library, search), [app.library, search]);
  const empty = isEmptySearch(search);
  const browsing = search.useIds.length === 0 && search.avoidIds.length === 0;
  const label = empty
    ? 'Browse all recipes'
    : count === 0
      ? 'No exact matches · See options'
      : `${browsing ? 'Browse' : 'See'} ${count} ${count === 1 ? 'recipe' : 'recipes'}`;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <LargeHeader
          title="Cook With That"
          right={
            <IconButton icon="settings" filled accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
          }
        />
        <SearchBox value={query} onChange={setQuery} placeholder={cfg.placeholder} label={cfg.searchLabel} />

        <View style={styles.controls}>
          <UseAvoidToggle style={styles.toggle} />
          <View style={styles.filters}>
            <Dropdown
              label="Meal"
              anyLabel="Any meal"
              options={MEALS}
              labels={MEAL_LABELS}
              value={search.meal}
              onChange={app.setMeal}
              countFor={meal => countExact(app.library, { ...search, meal })}
            />
            <Dropdown
              label="Dish type"
              shortLabel="Dish"
              anyLabel="Any type"
              options={DISH_TYPES}
              labels={DISH_TYPE_LABELS}
              value={search.dishType}
              onChange={app.setDishType}
              countFor={dishType => countExact(app.library, { ...search, dishType })}
            />
          </View>
        </View>
        <Text style={[t.small, styles.hint, { color: c.textMuted }]}>
          {mode === 'use'
            ? 'Recipes must use every ingredient you tap.'
            : 'Recipes with any ingredient you tap are hidden.'}
        </Text>

        <IngredientBrowser target="pick" layout="compact" query={query} onQueryChange={setQuery} hideSearch />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.divider }]}>
        {browsing ? null : (
          <Pressable
            onPress={() => router.push('/selections')}
            accessibilityRole="button"
            accessibilityLabel={`Your ingredients: using ${search.useIds.map(ingredientName).join(', ') || 'none'}, avoiding ${search.avoidIds.map(ingredientName).join(', ') || 'none'}. Open`}
            style={({ pressed }) => [styles.summary, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[t.small, styles.flex, { color: c.textMuted }]} numberOfLines={1}>
              {search.useIds.length ? (
                <>
                  <Text style={{ color: c.herbText, fontWeight: '600' }}>Using </Text>
                  {search.useIds.map(ingredientName).join(', ')}
                </>
              ) : null}
              {search.useIds.length && search.avoidIds.length ? '  ·  ' : ''}
              {search.avoidIds.length ? (
                <>
                  <Text style={{ color: c.avoidText, fontWeight: '600' }}>Avoiding </Text>
                  {search.avoidIds.map(ingredientName).join(', ')}
                </>
              ) : null}
            </Text>
            <Icon name="chevronRight" size={14} color={c.textMuted} weight="semibold" />
          </Pressable>
        )}
        <View style={styles.actions}>
          {empty ? null : (
            <Pressable
              onPress={app.clearAll}
              accessibilityRole="button"
              accessibilityLabel="Clear all selections and filters"
              hitSlop={6}
              style={styles.clearBtn}
            >
              <Text style={[t.bodyStrong, { color: c.textMuted }]}>Clear</Text>
            </Pressable>
          )}
          <Button label={label} onPress={() => router.push('/results')} style={styles.flex} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xl },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
  },
  toggle: { width: 172 },
  filters: { flexDirection: 'row', gap: space.sm },
  hint: { marginHorizontal: space.lg, marginTop: space.sm },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.xs,
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 30 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  clearBtn: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.xs },
});
