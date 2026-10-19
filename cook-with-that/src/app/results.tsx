import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { RecipeCard } from '../components/RecipeCard';
import { SelectionSummary } from '../components/SelectionSummary';
import { Card, LinkButton, SectionLabel } from '../components/ui';
import { ingredientName } from '../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS } from '../data/labels';
import { countExact, runSearch, type RecipeResult } from '../logic/matchRecipes';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

export default function ResultsScreen() {
  const c = useColors();
  const app = useAppState();
  const { search } = app;
  // Staples are a My Pantry concept only: here every ingredient a recipe needs is listed.
  const result = useMemo(() => runSearch(app.library, search), [app.library, search]);
  const { exact, close, narrowing, tryWithout, blockers } = result;

  const hasExact = exact.length > 0;
  const title = hasExact ? `${exact.length} ${exact.length === 1 ? 'recipe' : 'recipes'}` : 'No exact matches';
  const list: RecipeResult[] = hasExact ? exact : close;

  const edit = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const open = (id: string) => router.push({ pathname: '/recipe/[id]', params: { id, from: 'find' } });

  // Use ingredients no recipe needs (catalog items that are only optional extras, or not used yet).
  const neverNeeded = hasExact
    ? []
    : search.useIds.filter(
        id => countExact(app.library, { meal: null, dishType: null, useIds: [id], avoidIds: [] }) === 0,
      );
  const single = search.useIds.length === 1 ? search.useIds[0] : null;
  const noCloseText =
    search.useIds.length === 0
      ? 'Try loosening a filter.'
      : neverNeeded.length > 0
        ? ''
        : single
          ? `No recipe with ${ingredientName(single)} fits these filters.`
          : 'Nothing close with these filters.';

  const filtersLine = [
    search.meal ? MEAL_LABELS[search.meal] : 'Any meal',
    search.dishType ? DISH_TYPE_LABELS[search.dishType] : 'Any type',
  ].join(' · ');

  const header = (
    <View>
      {/* Active selections + Edit */}
      <View style={styles.selection}>
        <SelectionSummary useIds={search.useIds} avoidIds={search.avoidIds} onRemove={app.remove} />
        <View style={styles.panelTop}>
          <Text style={[t.small, { color: c.textMuted, flex: 1 }]}>{filtersLine}</Text>
          <LinkButton label="Edit" onPress={edit} accessibilityLabel="Edit ingredients and filters" />
        </View>
      </View>

      {/* Too many results — non-blocking */}
      {narrowing.length > 0 ? (
        <Card style={styles.notice}>
          <Text style={[t.bodyStrong, { color: c.text }]}>Lots to choose from. Narrow it down?</Text>
          <View style={styles.wrap}>
            {narrowing.map(s => (
              <Chip
                key={`${s.facet}:${s.value}`}
                small
                label={s.facet === 'meal' ? MEAL_LABELS[s.value] : DISH_TYPE_LABELS[s.value]}
                hint={`(${s.count})`}
                accessibilityLabel={`Show only ${s.facet === 'meal' ? MEAL_LABELS[s.value] : DISH_TYPE_LABELS[s.value]}, ${s.count} ${s.count === 1 ? 'recipe' : 'recipes'}`}
                onPress={() => (s.facet === 'meal' ? app.setMeal(s.value) : app.setDishType(s.value))}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {/* No exact results */}
      {!hasExact ? (
        <View style={styles.noResults}>
          <Text style={[t.heading, { color: c.text }]}>
            {search.useIds.length > 0
              ? 'No recipes match every ingredient you chose.'
              : 'No recipes fit these filters.'}
          </Text>
          {neverNeeded.length > 0 ? (
            <Text style={[t.body, { color: c.textMuted }]}>
              No recipe needs {joinNames(neverNeeded.map(ingredientName))} yet.
            </Text>
          ) : null}

          {tryWithout.length > 0 ? (
            <View style={styles.tryRow}>
              <Text style={[t.small, { color: c.textMuted }]}>Try without:</Text>
              <View style={styles.wrap}>
                {tryWithout.map(tw => (
                  <Chip
                    key={tw.ingredientId}
                    small
                    label={ingredientName(tw.ingredientId)}
                    hint={`→ ${tw.count} ${tw.count === 1 ? 'recipe' : 'recipes'}`}
                    accessibilityLabel={`Remove ${ingredientName(tw.ingredientId)} from Use list. Shows ${tw.count} ${tw.count === 1 ? 'recipe' : 'recipes'}`}
                    onPress={() => app.remove(tw.ingredientId)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {close.length > 0 ? (
            <View>
              <SectionLabel text="Close matches" />
              <Text style={[t.small, styles.closeSub, { color: c.textMuted }]}>
                These skip {result.closeMaxMissing > 1 ? 'one or two' : 'one'} of your ingredients, named on each card.
                They’re not substitutions.
              </Text>
            </View>
          ) : (
            <View style={styles.adjust}>
              {noCloseText || (blockers.avoid && !blockers.meal && !blockers.dishType) ? (
                <Text style={[t.body, { color: c.textMuted }]}>
                  {noCloseText}
                  {blockers.avoid && !blockers.meal && !blockers.dishType
                    ? `${noCloseText ? ' ' : ''}Your Avoid list is hiding every match.`
                    : ''}
                </Text>
              ) : null}
              {search.meal ? (
                <AdjustButton
                  label={`Show any meal (not just ${MEAL_LABELS[search.meal]})`}
                  helps={blockers.meal}
                  onPress={() => app.setMeal(null)}
                />
              ) : null}
              {search.dishType ? (
                <AdjustButton
                  label={`Show any dish type (not just ${DISH_TYPE_LABELS[search.dishType]})`}
                  helps={blockers.dishType}
                  onPress={() => app.setDishType(null)}
                />
              ) : null}
              {single ? (
                <AdjustButton
                  label={`Remove ${ingredientName(single)}`}
                  helps={blockers.ingredients}
                  onPress={() => app.remove(single)}
                />
              ) : search.useIds.length > 0 ? (
                <AdjustButton label="Remove an ingredient" helps={blockers.ingredients} onPress={edit} />
              ) : null}
              {search.avoidIds.length > 0 ? (
                <AdjustButton label="Clear avoided ingredients" helps={blockers.avoid} onPress={app.clearAvoid} />
              ) : null}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={list}
        keyExtractor={r => r.recipe.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
        renderItem={({ item }) => (
          <RecipeCard
            result={item}
            close={!hasExact}
            meal={search.meal}
            onPress={() => open(item.recipe.id)}
            isFavorite={app.isFavorite(item.recipe.id)}
            onToggleFavorite={() => app.toggleFavorite(item.recipe.id)}
          />
        )}
      />
    </>
  );
}

/** "Lentils", "Lentils or Capers", "Lentils, Capers or Walnuts". */
function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

function AdjustButton({ label, onPress, helps }: { label: string; onPress: () => void; helps: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={helps ? 'This would show recipes' : undefined}
      style={({ pressed }) => [
        styles.adjustBtn,
        { borderColor: c.cardBorder, backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.flex}>
        <Text style={[t.bodyStrong, { color: helps ? c.accent : c.text }]}>{label}</Text>
        {helps ? <Text style={[t.small, { color: c.textMuted }]}>Shows recipes</Text> : null}
      </View>
      <Icon name="chevronRight" size={15} color={c.textMuted} weight="semibold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: space.lg, paddingBottom: space.xxl * 2 },
  selection: { gap: space.sm, marginBottom: space.lg },
  panelTop: { flexDirection: 'row', alignItems: 'center' },
  notice: { gap: space.sm, marginBottom: space.lg, padding: space.md + 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  noResults: { gap: space.md, marginBottom: space.md },
  tryRow: { gap: space.sm },
  closeSub: { paddingHorizontal: space.xs, marginBottom: space.xs },
  adjust: { gap: space.sm },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: MIN_TOUCH + 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.sm,
  },
});
