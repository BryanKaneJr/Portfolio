import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMinutes } from '../../components/RecipeCard';
import { ingredientIndex, recipesById } from '../../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS } from '../../data/labels';
import { additionalRequired } from '../../logic/matchRecipes';
import { displayQuantity, displayStep } from '../../logic/units';
import { useAppState } from '../../state/AppState';
import { useColors } from '../../theme/colors';
import { MIN_TOUCH, radius, space } from '../../theme/spacing';
import { type as t } from '../../theme/typography';

export default function RecipeScreen() {
  const c = useColors();
  const app = useAppState();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = id ? recipesById.get(id) : undefined;
  const [done, setDone] = useState<Set<number>>(new Set());

  if (!recipe) {
    return (
      <View style={[styles.missing, { backgroundColor: c.bg }]}>
        <Text style={[t.heading, { color: c.text }]}>This recipe isn't available.</Text>
      </View>
    );
  }

  const fav = app.isFavorite(recipe.id);
  // In pantry mode, "have" = pantry; otherwise = the ingredients picked to Use.
  const pantryMode = app.homeMode === 'pantry';
  const haveIds = pantryMode ? app.effectivePantry : app.search.useIds;
  const staples = pantryMode ? app.staples : new Set<string>();
  const alsoNeed = additionalRequired(recipe, haveIds, staples);
  const showNeedBox = pantryMode ? app.pantry.length > 0 : app.search.useIds.length > 0;
  const required = recipe.ingredients.filter(i => !i.optional);
  const optional = recipe.ingredients.filter(i => i.optional);
  const tags = [...recipe.meals.map(m => MEAL_LABELS[m]), ...recipe.dishTypes.map(d => DISH_TYPE_LABELS[d])];

  const toggleStep = (n: number) =>
    setDone(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const ingredientLine = (i: (typeof recipe.ingredients)[number], k: number) => {
    const staple = staples.has(i.ingredientId);
    const using = (pantryMode ? app.pantry : app.search.useIds).includes(i.ingredientId);
    return (
      <View key={k} style={[styles.ingRow, { borderBottomColor: c.divider }]}>
        <Text style={[t.body, styles.qty, { color: c.text }]}>
          {displayQuantity(i.quantityText, app.units, i.ingredientId, i.displayName)}
        </Text>
        <Text style={[t.body, { color: c.text, flex: 1 }]}>
          {displayStep(i.displayName, app.units)}
          {i.preparation ? (
            <Text style={{ color: c.textMuted }}>, {displayStep(i.preparation, app.units, ingredientIndex)}</Text>
          ) : null}
          {using ? <Text style={{ color: c.herbText, fontWeight: '700' }}> ✓</Text> : null}
          {staple ? <Text style={[styles.badge, { color: c.textMuted }]}> STAPLE</Text> : null}
        </Text>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Pressable
              onPress={() => app.toggleFavorite(recipe.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={fav ? 'Remove from favorites' : 'Save to favorites'}
              style={styles.headerFav}
            >
              <Text style={{ fontSize: 26, color: fav ? c.primary : c.textMuted }}>{fav ? '♥' : '♡'}</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.scroll}>
        <Text style={[t.display, { color: c.text }]} accessibilityRole="header">
          {recipe.title}
        </Text>
        <Text style={[t.body, { color: c.textMuted, marginTop: space.sm }]}>{recipe.description}</Text>

        <View style={[styles.stats, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Stat label="Serves" value={String(recipe.servings)} />
          <Stat label="Prep" value={formatMinutes(recipe.prepMinutes)} />
          <Stat label="Cook" value={recipe.cookMinutes ? formatMinutes(recipe.cookMinutes) : '—'} />
          <Stat label="Total" value={formatMinutes(recipe.prepMinutes + recipe.cookMinutes)} />
        </View>

        <View style={styles.tags}>
          {tags.map(tag => (
            <View key={tag} style={[styles.tag, { backgroundColor: c.divider }]}>
              <Text style={[t.small, { color: c.text }]}>{tag}</Text>
            </View>
          ))}
        </View>

        <Text style={[t.title, styles.h2, { color: c.text }]} accessibilityRole="header">
          Ingredients
        </Text>
        {required.map(ingredientLine)}
        {optional.length > 0 ? (
          <>
            <Text style={[t.label, styles.optLabel, { color: c.textMuted }]}>Optional</Text>
            {optional.map(ingredientLine)}
          </>
        ) : null}

        {showNeedBox && alsoNeed.length > 0 ? (
          <View style={[styles.need, { backgroundColor: c.warnSoft }]}>
            <Text style={[t.bodyStrong, { color: c.warnText }]}>
              {pantryMode ? 'Not in your pantry' : "You'll also need"}
            </Text>
            <Text style={[t.body, { color: c.warnText }]}>{alsoNeed.map(i => i.displayName).join(', ')}</Text>
          </View>
        ) : null}
        {pantryMode && showNeedBox && alsoNeed.length === 0 ? (
          <View style={[styles.need, { backgroundColor: c.herbSoft }]}>
            <Text style={[t.bodyStrong, { color: c.herbText }]}>✓ Your pantry covers every required ingredient</Text>
          </View>
        ) : null}

        <Text style={[t.title, styles.h2, { color: c.text }]} accessibilityRole="header">
          Steps
        </Text>
        <Text style={[t.small, { color: c.textMuted, marginBottom: space.sm }]}>Tap a step to check it off.</Text>
        {recipe.steps.map((raw, n) => {
          const s = displayStep(raw, app.units, ingredientIndex);
          const isDone = done.has(n);
          return (
            <Pressable
              key={n}
              onPress={() => toggleStep(n)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDone }}
              accessibilityLabel={`Step ${n + 1}. ${s}`}
              style={[styles.step, { backgroundColor: c.card, borderColor: c.cardBorder, opacity: isDone ? 0.55 : 1 }]}
            >
              <View style={[styles.stepNum, { backgroundColor: isDone ? c.herb : c.primary }]}>
                <Text style={styles.stepNumText}>{isDone ? '✓' : n + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: c.text }, isDone && styles.strike]}>{s}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={styles.stat}>
      <Text style={[t.label, { color: c.textMuted }]}>{label}</Text>
      <Text style={[t.bodyStrong, { color: c.text, marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  headerFav: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: space.lg, paddingBottom: space.xxl * 2 },
  stats: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    marginTop: space.lg,
  },
  stat: { flex: 1, alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  tag: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  h2: { marginTop: space.xl, marginBottom: space.sm },
  ingRow: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  qty: { width: 104, fontWeight: '600' },
  badge: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  optLabel: { marginTop: space.lg, marginBottom: 2 },
  need: { borderRadius: radius.md, padding: space.md, marginTop: space.lg, gap: 4 },
  step: {
    flexDirection: 'row',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  stepNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  stepText: { flex: 1, fontSize: 18, lineHeight: 27 },
  strike: { textDecorationLine: 'line-through' },
});
