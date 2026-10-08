import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Dropdown } from '../components/Dropdown';
import { RecipeCard } from '../components/RecipeCard';
import { RECIPES } from '../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS } from '../data/labels';
import { DISH_TYPES, MEALS } from '../data/types';
import { countCanMake, searchPantry, type PantryResult } from '../logic/pantry';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

type Row = { kind: 'header'; title: string; sub: string } | { kind: 'recipe'; res: PantryResult; short: boolean };

export default function PantryResultsScreen() {
  const c = useColors();
  const app = useAppState();
  const filters = { meal: app.pantryMeal, dishType: app.pantryDishType };
  const { canMake, oneShort } = useMemo(
    () =>
      searchPantry(
        RECIPES,
        app.effectivePantry,
        { meal: app.pantryMeal, dishType: app.pantryDishType },
        app.shuffleSeed,
      ),
    [app.effectivePantry, app.pantryMeal, app.pantryDishType, app.shuffleSeed],
  );

  const rows: Row[] = [
    ...canMake.map(res => ({ kind: 'recipe' as const, res, short: false })),
    ...(oneShort.length
      ? [
          {
            kind: 'header' as const,
            title: 'One ingredient short',
            sub: 'You’d need to pick up one thing for these. It’s named on each card.',
          },
          ...oneShort.map(res => ({ kind: 'recipe' as const, res, short: true })),
        ]
      : []),
  ];

  const title = canMake.length ? `${canMake.length} you can make` : 'Nothing you can make yet';
  const filtered = filters.meal || filters.dishType;

  const header = (
    <View style={styles.headerWrap}>
      <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View style={styles.panelTop}>
          <Text style={[t.small, { color: c.textMuted, flex: 1 }]}>
            From your pantry · {app.pantry.length} {app.pantry.length === 1 ? 'item' : 'items'}
            {app.assumeStaples ? ' + staples' : ''}
          </Text>
          <Pressable
            onPress={() => router.push('/pantry')}
            accessibilityRole="button"
            accessibilityLabel="Edit pantry"
            hitSlop={8}
            style={styles.linkBtn}
          >
            <Text style={[t.bodyStrong, { color: c.primary }]}>Edit pantry</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.filters}>
        <Dropdown
          label="Meal"
          anyLabel="Any meal"
          options={MEALS}
          labels={MEAL_LABELS}
          value={app.pantryMeal}
          onChange={app.setPantryMeal}
          countFor={meal => countCanMake(RECIPES, app.effectivePantry, { ...filters, meal })}
        />
        <Dropdown
          label="Dish type"
          anyLabel="Any type"
          options={DISH_TYPES}
          labels={DISH_TYPE_LABELS}
          value={app.pantryDishType}
          onChange={app.setPantryDishType}
          countFor={dishType => countCanMake(RECIPES, app.effectivePantry, { ...filters, dishType })}
        />
      </View>

      {canMake.length > 1 ? (
        <Pressable
          onPress={app.reshuffle}
          accessibilityRole="button"
          accessibilityLabel="Shuffle the list"
          style={({ pressed }) => [
            styles.shuffle,
            { borderColor: c.chipBorder, backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[t.bodyStrong, { color: c.text }]}>⤮ Shuffle</Text>
        </Pressable>
      ) : null}

      {canMake.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[t.heading, { color: c.text }]}>
            {filtered ? 'Nothing you can fully make with these filters.' : 'Nothing you can fully make yet.'}
          </Text>
          <Text style={[t.body, { color: c.textMuted }]}>
            {filtered
              ? 'Try Any meal or Any type, or add a few more pantry items.'
              : 'Add a few more pantry items — eggs, onions, garlic and cheese unlock a lot.'}
          </Text>
          {filtered ? (
            <Pressable
              onPress={() => {
                app.setPantryMeal(null);
                app.setPantryDishType(null);
              }}
              accessibilityRole="button"
              style={[styles.adjustBtn, { borderColor: c.primary, backgroundColor: c.card }]}
            >
              <Text style={[t.bodyStrong, { color: c.primary }]}>Show any meal and dish type</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'recipe' ? r.res.recipe.id : `h${i}`)}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <View style={[styles.sectionHead, { borderTopColor: c.divider }]}>
              <Text style={[t.title, { color: c.text }]} accessibilityRole="header">
                {item.title}
              </Text>
              <Text style={[t.small, { color: c.textMuted }]}>{item.sub}</Text>
            </View>
          ) : (
            <RecipeCard
              result={{
                recipe: item.res.recipe,
                usesIds: [],
                missingIds: [],
                alsoNeed: [],
                staplesUsed: [],
                totalMinutes: item.res.totalMinutes,
              }}
              meal={app.pantryMeal}
              note={
                item.short
                  ? { text: `Missing: ${item.res.missing.map(m => m.displayName).join(', ')}`, tone: 'warn' }
                  : { text: '✓ You have everything you need', tone: 'good' }
              }
              onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.res.recipe.id } })}
              isFavorite={app.isFavorite(item.res.recipe.id)}
              onToggleFavorite={() => app.toggleFavorite(item.res.recipe.id)}
            />
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: space.xxl * 2 },
  headerWrap: { marginBottom: space.md },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: space.md },
  panelTop: { flexDirection: 'row', alignItems: 'center' },
  linkBtn: { minHeight: 32, minWidth: MIN_TOUCH, alignItems: 'flex-end', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  shuffle: {
    alignSelf: 'flex-start',
    minHeight: MIN_TOUCH,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    marginTop: space.md,
  },
  empty: { gap: space.sm, marginTop: space.lg },
  adjustBtn: {
    minHeight: MIN_TOUCH + 4,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    marginTop: space.xs,
  },
  sectionHead: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.lg, gap: 4, marginTop: space.sm },
});
