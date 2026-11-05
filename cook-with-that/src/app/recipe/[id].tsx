import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddToPlanSheet, dayLabel, SLOT_LABELS } from '../../components/AddToPlanSheet';
import { formatMinutes } from '../../components/RecipeCard';
import { ingredientIndex } from '../../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS, shownDishTypes } from '../../data/labels';
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
  const [showOriginal, setShowOriginal] = useState(false);
  const edited = !!id && app.isEdited(id);
  const recipe = id ? (edited && showOriginal ? app.originalRecipe(id) : app.recipeById(id)) : undefined;
  const [done, setDone] = useState<Set<number>>(new Set());
  const [planOpen, setPlanOpen] = useState(false);
  const [planned, setPlanned] = useState<string | null>(null);
  const [note, setNote] = useState(() => (id ? app.noteFor(id) : ''));
  // Save the note when the page closes, in case the field still has focus. Refs, so this runs only on close.
  const latestNote = useRef(note);
  latestNote.current = note;
  const saveNote = useRef(app.setNote);
  saveNote.current = app.setNote;
  useEffect(
    () => () => {
      if (id) saveNote.current(id, latestNote.current);
    },
    [id],
  );

  if (!recipe) {
    return (
      <View style={[styles.missing, { backgroundColor: c.bg }]}>
        <Text style={[t.heading, { color: c.text }]}>This recipe isn't available.</Text>
      </View>
    );
  }

  const fav = app.isFavorite(recipe.id);
  const own = app.isOwn(recipe.id);
  // In pantry mode, "have" = pantry; otherwise = the ingredients picked to Use.
  const pantryMode = app.homeMode === 'pantry';
  const haveIds = pantryMode ? app.effectivePantry : app.search.useIds;
  const staples = pantryMode ? app.staples : new Set<string>();
  const alsoNeed = additionalRequired(recipe, haveIds, staples);
  const showNeedBox = pantryMode ? app.pantry.length > 0 : app.search.useIds.length > 0;
  const required = recipe.ingredients.filter(i => !i.optional);
  const optional = recipe.ingredients.filter(i => i.optional);
  const tags = [
    ...(own ? ['Your recipe'] : []),
    ...recipe.meals.map(m => MEAL_LABELS[m]),
    ...shownDishTypes(recipe).map(d => DISH_TYPE_LABELS[d]),
  ];

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
            <View style={styles.headerBtns}>
              <Pressable
                onPress={() => router.push({ pathname: '/edit', params: { id: recipe.id } })}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={own ? 'Edit your recipe' : edited ? 'Edit your version' : 'Edit this recipe'}
                style={styles.headerFav}
              >
                <Text style={{ fontSize: 22, color: c.primary }}>✎</Text>
              </Pressable>
              <Pressable
                onPress={() => app.toggleFavorite(recipe.id)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={fav ? 'Remove from favorites' : 'Save to favorites'}
                style={styles.headerFav}
              >
                <Text style={{ fontSize: 26, color: fav ? c.primary : c.textMuted }}>{fav ? '♥' : '♡'}</Text>
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {edited ? (
          <View style={[styles.banner, { backgroundColor: c.herbSoft }]}>
            <Text style={[t.bodyStrong, { color: c.herbText, flex: 1 }]}>
              {showOriginal ? 'The original recipe' : 'Your version'}
            </Text>
            <Pressable
              onPress={() => setShowOriginal(v => !v)}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.bannerBtn}
            >
              <Text style={[t.bodyStrong, { color: c.primary }]}>{showOriginal ? 'Show yours' : 'Show original'}</Text>
            </Pressable>
          </View>
        ) : null}
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

        <Pressable
          onPress={() => setPlanOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.planBtn,
            { borderColor: c.chipBorder, backgroundColor: c.card, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[t.bodyStrong, { color: c.primary }]}>+ Add to meal plan</Text>
        </Pressable>
        {planned ? (
          <Pressable
            onPress={() => router.push({ pathname: '/favorites', params: { tab: 'plan' } })}
            accessibilityRole="button"
            accessibilityLiveRegion="polite"
          >
            <Text style={[t.small, { color: c.herbText, marginTop: space.sm }]}>
              ✓ Added to {planned}. <Text style={{ color: c.primary, fontWeight: '700' }}>See the plan</Text>
            </Text>
          </Pressable>
        ) : null}

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

        <Text style={[t.title, styles.h2, { color: c.text }]} accessibilityRole="header">
          My notes
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={() => app.setNote(recipe.id, note)}
          placeholder="What you changed, how it turned out, what to try next time…"
          placeholderTextColor={c.textMuted}
          multiline
          style={[styles.notes, { color: c.text, backgroundColor: c.card, borderColor: c.cardBorder }]}
          accessibilityLabel="My notes"
        />
      </ScrollView>
      <AddToPlanSheet
        recipe={recipe}
        visible={planOpen}
        onClose={() => setPlanOpen(false)}
        onAdd={(day, slot) => {
          app.planRecipe(day, slot, recipe.id);
          setPlanned(`${dayLabel(day)} · ${SLOT_LABELS[slot]}`);
          setPlanOpen(false);
        }}
      />
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
  headerBtns: { flexDirection: 'row', alignItems: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingLeft: space.md,
    marginBottom: space.md,
  },
  bannerBtn: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.md },
  planBtn: {
    marginTop: space.lg,
    minHeight: MIN_TOUCH,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notes: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 96,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: 'top',
  },
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
