import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip } from '../components/Chip';
import { RecipeCard } from '../components/RecipeCard';
import { SelectionSummary } from '../components/SelectionSummary';
import { RECIPES, ingredientName } from '../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS } from '../data/labels';
import { runSearch, type RecipeResult } from '../logic/matchRecipes';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

export default function ResultsScreen() {
  const c = useColors();
  const app = useAppState();
  const { search } = app;
  // Staples are a My Pantry concept only: here every ingredient a recipe needs is listed.
  const result = useMemo(() => runSearch(RECIPES, search), [search]);
  const { exact, close, narrowing, tryWithout, blockers } = result;

  const hasExact = exact.length > 0;
  const title = hasExact ? `${exact.length} ${exact.length === 1 ? 'recipe' : 'recipes'}` : 'No exact matches';
  const list: RecipeResult[] = hasExact ? exact : close;

  const edit = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const open = (id: string) => router.push({ pathname: '/recipe/[id]', params: { id } });

  const filtersLine = [
    search.meal ? MEAL_LABELS[search.meal] : 'Any meal',
    search.dishType ? DISH_TYPE_LABELS[search.dishType] : 'Any type',
  ].join(' · ');

  const header = (
    <View>
      {/* Active selections + Edit */}
      <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
        <View style={styles.panelTop}>
          <Text style={[t.small, { color: c.textMuted, flex: 1 }]}>{filtersLine}</Text>
          <Pressable
            onPress={edit}
            accessibilityRole="button"
            accessibilityLabel="Edit ingredients and filters"
            style={styles.editBtn}
            hitSlop={8}
          >
            <Text style={[t.bodyStrong, { color: c.primary }]}>Edit</Text>
          </Pressable>
        </View>
        <SelectionSummary useIds={search.useIds} avoidIds={search.avoidIds} onRemove={app.remove} wrap />
      </View>

      {/* Too many results — non-blocking */}
      {narrowing.length > 0 ? (
        <View style={[styles.notice, { backgroundColor: c.herbSoft }]}>
          <Text style={[t.bodyStrong, { color: c.herbText }]}>Lots to choose from. Narrow it down?</Text>
          <View style={styles.wrap}>
            {narrowing.map(s => (
              <Chip
                key={`${s.facet}:${s.value}`}
                small
                label={s.facet === 'meal' ? MEAL_LABELS[s.value] : DISH_TYPE_LABELS[s.value]}
                hint={`(${s.count})`}
                accessibilityLabel={`Show only ${s.facet === 'meal' ? MEAL_LABELS[s.value] : DISH_TYPE_LABELS[s.value]}, ${s.count} recipes`}
                onPress={() => (s.facet === 'meal' ? app.setMeal(s.value) : app.setDishType(s.value))}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* No exact results */}
      {!hasExact ? (
        <View style={styles.noResults}>
          <Text style={[t.heading, { color: c.text }]}>
            {search.useIds.length > 0
              ? 'No recipes match every ingredient you chose.'
              : 'No recipes fit these filters.'}
          </Text>

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
                    accessibilityLabel={`Remove ${ingredientName(tw.ingredientId)} from Use list. Shows ${tw.count} recipes`}
                    onPress={() => app.remove(tw.ingredientId)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {close.length > 0 ? (
            <View style={[styles.closeHead, { borderTopColor: c.divider }]}>
              <Text style={[t.title, { color: c.text }]} accessibilityRole="header">
                Close matches
              </Text>
              <Text style={[t.small, { color: c.textMuted }]}>
                These skip {result.closeMaxMissing > 1 ? 'one or two' : 'one'} of your ingredients — shown on each card.
                They're not substitutions.
              </Text>
            </View>
          ) : (
            <View style={styles.adjust}>
              <Text style={[t.body, { color: c.textMuted }]}>
                {search.useIds.length > 0 ? 'Nothing close with these filters.' : 'Try loosening a filter.'}
                {blockers.avoid && !blockers.meal && !blockers.dishType
                  ? ' Your Avoid list is hiding every match.'
                  : ''}
              </Text>
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
              {search.useIds.length > 0 ? (
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

function AdjustButton({ label, onPress, helps }: { label: string; onPress: () => void; helps: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={helps ? 'This would show recipes' : undefined}
      style={({ pressed }) => [
        styles.adjustBtn,
        { borderColor: helps ? c.primary : c.chipBorder, backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[t.bodyStrong, { color: helps ? c.primary : c.text }]}>{label}</Text>
      {helps ? <Text style={[t.small, { color: c.textMuted }]}>Shows recipes</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: space.xxl * 2 },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.xs, marginBottom: space.md },
  panelTop: { flexDirection: 'row', alignItems: 'center' },
  editBtn: { minHeight: 32, minWidth: MIN_TOUCH, alignItems: 'flex-end', justifyContent: 'center' },
  notice: { borderRadius: radius.md, padding: space.md, gap: space.sm, marginBottom: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  noResults: { gap: space.md, marginBottom: space.md },
  tryRow: { gap: space.sm },
  closeHead: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md, gap: 4 },
  adjust: { gap: space.sm },
  adjustBtn: {
    minHeight: MIN_TOUCH + 4,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    justifyContent: 'center',
  },
});
