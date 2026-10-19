import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '../../components/Chip';
import { Dropdown } from '../../components/Dropdown';
import { Icon } from '../../components/Icon';
import { RecipeCard } from '../../components/RecipeCard';
import { Button, Card, EmptyState, IconButton, LargeHeader, LinkButton, SectionLabel } from '../../components/ui';
import { ingredientName } from '../../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS } from '../../data/labels';
import { DISH_TYPES, MEALS } from '../../data/types';
import { countCanMake, searchPantry, type PantryResult } from '../../logic/pantry';
import { useAppState } from '../../state/AppState';
import { useColors } from '../../theme/colors';
import { space } from '../../theme/spacing';
import { type as t } from '../../theme/typography';

const PANTRY_PREVIEW = 10;

type Row = { kind: 'header'; title: string; sub: string } | { kind: 'recipe'; res: PantryResult; short: boolean };

/** Pantry: what you keep on hand, and every recipe you can make from it (plus the ones one ingredient short). */
export default function PantryScreen() {
  const c = useColors();
  const app = useAppState();
  const { pantry } = app;
  const filters = { meal: app.pantryMeal, dishType: app.pantryDishType };
  const { canMake, oneShort } = useMemo(
    () =>
      searchPantry(
        app.library,
        app.effectivePantry,
        { meal: app.pantryMeal, dishType: app.pantryDishType },
        app.shuffleSeed,
      ),
    [app.library, app.effectivePantry, app.pantryMeal, app.pantryDishType, app.shuffleSeed],
  );
  const filtered = !!(filters.meal || filters.dishType);
  const editPantry = () => router.push('/pantry-edit');
  const open = (id: string) => router.push({ pathname: '/recipe/[id]', params: { id, from: 'pantry' } });

  const rows: Row[] = pantry.length
    ? [
        ...canMake.map(res => ({ kind: 'recipe' as const, res, short: false })),
        ...(oneShort.length
          ? [
              {
                kind: 'header' as const,
                title: 'One ingredient short',
                sub: 'Pick up one thing for these. It’s named on each card.',
              },
              ...oneShort.map(res => ({ kind: 'recipe' as const, res, short: true })),
            ]
          : []),
      ]
    : [];

  const header = (
    <View>
      <LargeHeader
        title="Pantry"
        right={
          pantry.length ? <IconButton icon="edit" filled accessibilityLabel="Edit pantry" onPress={editPantry} /> : null
        }
      />
      {pantry.length === 0 ? (
        <EmptyState
          icon="pantry"
          title="What do you keep on hand?"
          body="Save the ingredients you usually have, and see every recipe you can make without shopping. Salt, oil, flour and other kitchen staples are already counted."
          action={<Button label="Set up my pantry" icon="plus" onPress={editPantry} style={styles.setup} />}
        />
      ) : (
        <View style={styles.pad}>
          <Pressable
            onPress={editPantry}
            accessibilityRole="button"
            accessibilityLabel={`Your pantry, ${pantry.length} items. Edit`}
          >
            <Card style={styles.pantryCard}>
              <View style={styles.cardTop}>
                <Text style={[t.heading, { color: c.text, flex: 1 }]}>
                  {pantry.length} {pantry.length === 1 ? 'item' : 'items'}
                  <Text style={[t.small, { color: c.textMuted, fontWeight: '400' }]}>
                    {app.assumeStaples ? `  +  ${app.stapleIds.length} staples` : ''}
                  </Text>
                </Text>
                <Icon name="chevronRight" size={15} color={c.textMuted} weight="semibold" />
              </View>
              <View style={styles.wrap}>
                {pantry.slice(0, PANTRY_PREVIEW).map(id => (
                  <Chip key={id} small variant="use" label={ingredientName(id)} />
                ))}
                {pantry.length > PANTRY_PREVIEW ? (
                  <Text style={[t.small, { color: c.textMuted }]}>+{pantry.length - PANTRY_PREVIEW} more</Text>
                ) : null}
              </View>
            </Card>
          </Pressable>

          <View style={styles.filters}>
            <Dropdown
              label="Meal"
              anyLabel="Any meal"
              options={MEALS}
              labels={MEAL_LABELS}
              value={app.pantryMeal}
              onChange={app.setPantryMeal}
              countFor={meal => countCanMake(app.library, app.effectivePantry, { ...filters, meal })}
            />
            <Dropdown
              label="Dish type"
              shortLabel="Dish"
              anyLabel="Any type"
              options={DISH_TYPES}
              labels={DISH_TYPE_LABELS}
              value={app.pantryDishType}
              onChange={app.setPantryDishType}
              countFor={dishType => countCanMake(app.library, app.effectivePantry, { ...filters, dishType })}
            />
            <View style={styles.flex} />
            {canMake.length > 1 ? (
              <IconButton
                icon="shuffle"
                accessibilityLabel="Shuffle the list"
                color={c.accent}
                onPress={app.reshuffle}
              />
            ) : null}
          </View>

          <SectionLabel text={canMake.length ? `You can make · ${canMake.length}` : 'You can make'} />
          {canMake.length === 0 ? (
            <Card style={styles.none}>
              <Text style={[t.heading, { color: c.text }]}>
                {filtered ? 'Nothing you can fully make with these filters.' : 'Nothing you can fully make yet.'}
              </Text>
              <Text style={[t.body, { color: c.textMuted }]}>
                {filtered
                  ? 'Try any meal and dish type, or add a few more pantry items.'
                  : 'Add a few more pantry items: eggs, onions, garlic and cheese unlock a lot.'}
              </Text>
              {filtered ? (
                <LinkButton
                  label="Show any meal and dish type"
                  onPress={() => {
                    app.setPantryMeal(null);
                    app.setPantryDishType(null);
                  }}
                />
              ) : (
                <LinkButton label="Add to my pantry" chevron onPress={editPantry} />
              )}
            </Card>
          ) : null}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <FlatList
        data={rows}
        keyExtractor={(r, i) => (r.kind === 'recipe' ? r.res.recipe.id : `h${i}`)}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <View style={styles.sectionHead}>
              <SectionLabel text={item.title} style={styles.noTop} />
              <Text style={[t.small, styles.sectionSub, { color: c.textMuted }]}>{item.sub}</Text>
            </View>
          ) : (
            <View style={styles.pad}>
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
                    ? { text: `Missing ${item.res.missing.map(m => m.displayName).join(', ')}`, tone: 'warn' }
                    : { text: 'You have everything', tone: 'good' }
                }
                onPress={() => open(item.res.recipe.id)}
                isFavorite={app.isFavorite(item.res.recipe.id)}
                onToggleFavorite={() => app.toggleFavorite(item.res.recipe.id)}
              />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: space.xxl },
  pad: { paddingHorizontal: space.lg },
  setup: { marginTop: space.md, alignSelf: 'stretch' },
  pantryCard: { gap: space.md, padding: space.md + 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2, alignItems: 'center' },
  filters: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  none: { gap: space.sm, alignItems: 'flex-start' },
  sectionHead: { paddingHorizontal: space.lg, marginTop: space.lg },
  noTop: { marginTop: space.sm, marginBottom: 2 },
  sectionSub: { paddingHorizontal: space.xs, marginBottom: space.xs },
});
