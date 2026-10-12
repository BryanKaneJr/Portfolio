import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AddToPlanSheet, dayLabel, SLOT_LABELS } from '../../components/AddToPlanSheet';
import { Icon } from '../../components/Icon';
import { formatMinutes } from '../../components/RecipeCard';
import { Button, Card, IconButton, LinkButton } from '../../components/ui';
import { ingredientIndex } from '../../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS, shownDishTypes } from '../../data/labels';
import { additionalRequired } from '../../logic/matchRecipes';
import { displayQuantity, displayStep } from '../../logic/units';
import { useAppState } from '../../state/AppState';
import { useColors } from '../../theme/colors';
import { radius, space } from '../../theme/spacing';
import { type as t } from '../../theme/typography';

export default function RecipeScreen() {
  const c = useColors();
  const app = useAppState();
  // `from` says which tab opened the recipe: Find marks the ingredients you picked, Pantry what you have.
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const [showOriginal, setShowOriginal] = useState(false);
  const edited = !!id && app.isEdited(id);
  const recipe = id ? (edited && showOriginal ? app.originalRecipe(id) : app.recipeById(id)) : undefined;
  const [done, setDone] = useState<Set<number>>(new Set());
  const [gathered, setGathered] = useState<Set<number>>(new Set());
  const [planOpen, setPlanOpen] = useState(false);
  const [planned, setPlanned] = useState<string | null>(null);
  const [note, setNote] = useState(() => (id ? app.noteFor(id) : ''));
  // Save the note when the page closes, in case the field still has focus. Refs, so this runs only on close.
  const latestNote = useRef(note);
  const saveNote = useRef(app.setNote);
  useEffect(() => {
    latestNote.current = note;
    saveNote.current = app.setNote;
  });
  useEffect(
    () => () => {
      if (id) saveNote.current(id, latestNote.current);
    },
    [id],
  );

  if (!recipe) {
    return (
      <View style={[styles.missing, { backgroundColor: c.bg }]}>
        <Text style={[t.heading, { color: c.text }]}>This recipe isn’t available.</Text>
      </View>
    );
  }

  const fav = app.isFavorite(recipe.id);
  const own = app.isOwn(recipe.id);
  // From Pantry, "have" = pantry; from Find, the ingredients picked to Use; from Plan or Saved, nothing is marked.
  const pantryMode = from === 'pantry';
  const findMode = from === 'find';
  const haveIds = pantryMode ? app.effectivePantry : findMode ? app.search.useIds : [];
  const staples = pantryMode ? app.staples : new Set<string>();
  const alsoNeed = additionalRequired(recipe, haveIds, staples);
  const showNeedBox = pantryMode ? app.pantry.length > 0 : findMode && app.search.useIds.length > 0;
  const required = recipe.ingredients.filter(i => !i.optional);
  const optional = recipe.ingredients.filter(i => i.optional);
  const tags = [
    ...(own ? ['Your recipe'] : []),
    ...recipe.meals.map(m => MEAL_LABELS[m]),
    ...shownDishTypes(recipe).map(d => DISH_TYPE_LABELS[d]),
  ];

  const flip = (set: typeof setDone) => (n: number) =>
    set(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  const toggleStep = flip(setDone);
  const toggleGathered = flip(setGathered);

  const ingredientLine = (i: (typeof recipe.ingredients)[number], k: number) => {
    const staple = staples.has(i.ingredientId);
    const using = (pantryMode ? app.pantry : findMode ? app.search.useIds : []).includes(i.ingredientId);
    const got = gathered.has(k);
    const qty = displayQuantity(i.quantityText, app.units, i.ingredientId, i.displayName);
    return (
      <Pressable
        key={k}
        onPress={() => toggleGathered(k)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: got }}
        style={[styles.ingRow, k > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }]}
      >
        <Icon name={got ? 'checkCircle' : 'circle'} size={22} color={got ? c.herb : c.textFaint} />
        <Text style={[t.body, styles.qty, { color: c.text }, got && styles.faded]}>{qty}</Text>
        <Text style={[t.body, styles.flex, { color: c.text }, got && styles.faded]}>
          {displayStep(i.displayName, app.units)}
          {i.preparation ? (
            <Text style={{ color: c.textMuted }}>, {displayStep(i.preparation, app.units, ingredientIndex)}</Text>
          ) : null}
          {using ? <Text style={{ color: c.herbText, fontWeight: '700' }}> ✓</Text> : null}
          {staple ? <Text style={[styles.badge, { color: c.textMuted }]}> STAPLE</Text> : null}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={styles.headerBtns}>
              <IconButton
                icon="edit"
                color={c.accent}
                onPress={() => router.push({ pathname: '/edit', params: { id: recipe.id } })}
                accessibilityLabel={own ? 'Edit your recipe' : edited ? 'Edit your version' : 'Edit this recipe'}
              />
              <IconButton
                icon={fav ? 'heartFill' : 'heart'}
                color={c.accent}
                onPress={() => app.toggleFavorite(recipe.id)}
                accessibilityLabel={fav ? 'Remove from favorites' : 'Save to favorites'}
              />
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
            <LinkButton
              label={showOriginal ? 'Show yours' : 'Show original'}
              onPress={() => setShowOriginal(v => !v)}
            />
          </View>
        ) : null}
        <Text style={[t.display, { color: c.text }]} accessibilityRole="header">
          {recipe.title}
        </Text>
        <Text style={[t.body, { color: c.textMuted, marginTop: space.sm }]}>{recipe.description}</Text>

        <Card style={styles.stats}>
          <Stat label="Serves" value={String(recipe.servings)} />
          <Stat label="Prep" value={formatMinutes(recipe.prepMinutes)} />
          <Stat label="Cook" value={recipe.cookMinutes ? formatMinutes(recipe.cookMinutes) : '—'} />
          <Stat label="Total" value={formatMinutes(recipe.prepMinutes + recipe.cookMinutes)} />
        </Card>

        <View style={styles.tags}>
          {tags.map(tag => (
            <View key={tag} style={[styles.tag, { backgroundColor: c.fill }]}>
              <Text style={[t.small, { color: c.text }]}>{tag}</Text>
            </View>
          ))}
        </View>

        <Button label="Add to meal plan" icon="calendar" onPress={() => setPlanOpen(true)} style={styles.planBtn} />
        {planned ? (
          <Pressable
            onPress={() => router.navigate('/plan')}
            accessibilityRole="button"
            accessibilityLiveRegion="polite"
          >
            <Text style={[t.small, styles.planned, { color: c.herbText }]}>
              Added to {planned}. <Text style={{ color: c.accent, fontWeight: '600' }}>See the plan</Text>
            </Text>
          </Pressable>
        ) : null}

        <Text style={[t.title, styles.h2, { color: c.text }]} accessibilityRole="header">
          Ingredients
        </Text>
        <Card style={styles.listCard}>{required.map(ingredientLine)}</Card>
        {optional.length > 0 ? (
          <>
            <Text style={[t.label, styles.optLabel, { color: c.textMuted }]}>Optional</Text>
            <Card style={styles.listCard}>{optional.map((i, k) => ingredientLine(i, required.length + k))}</Card>
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
          <View style={[styles.need, styles.needRow, { backgroundColor: c.herbSoft }]}>
            <Icon name="checkCircle" size={18} color={c.herbText} />
            <Text style={[t.bodyStrong, { color: c.herbText, flex: 1 }]}>
              Your pantry covers every required ingredient
            </Text>
          </View>
        ) : null}

        <Text style={[t.title, styles.h2, { color: c.text }]} accessibilityRole="header">
          Steps
        </Text>
        <Card style={styles.listCard}>
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
                style={[styles.step, n > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }]}
              >
                <View style={[styles.stepNum, { backgroundColor: isDone ? c.herbSoft : c.accentSoft }]}>
                  {isDone ? (
                    <Icon name="check" size={15} color={c.herbText} weight="bold" />
                  ) : (
                    <Text style={[styles.stepNumText, { color: c.accent }]}>{n + 1}</Text>
                  )}
                </View>
                <Text style={[styles.stepText, { color: c.text }, isDone && styles.faded]}>{s}</Text>
              </Pressable>
            );
          })}
        </Card>
        <Text style={[t.small, styles.tip, { color: c.textMuted }]}>Tap an ingredient or a step to check it off.</Text>

        <Text style={[t.title, styles.h2, { color: c.text }]} accessibilityRole="header">
          My notes
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          onBlur={() => app.setNote(recipe.id, note)}
          placeholder="What you changed, how it turned out, what to try next time…"
          multiline
          style={[styles.notes, { color: c.text, backgroundColor: c.card, borderColor: c.cardBorder }]}
          placeholderTextColor={c.textFaint}
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
  flex: { flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  headerBtns: { flexDirection: 'row', alignItems: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    marginBottom: space.md,
  },
  planBtn: { marginTop: space.lg },
  planned: { marginTop: space.sm, textAlign: 'center' },
  notes: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.md,
    minHeight: 96,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  scroll: { padding: space.lg, paddingBottom: space.xxl * 2 },
  stats: { flexDirection: 'row', paddingVertical: space.md, paddingHorizontal: 0, marginTop: space.lg },
  stat: { flex: 1, alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  tag: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  h2: { marginTop: space.xl, marginBottom: space.sm },
  listCard: { paddingVertical: 0, paddingHorizontal: space.md },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  qty: { width: 100, fontWeight: '600' },
  faded: { opacity: 0.45 },
  badge: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  optLabel: { marginTop: space.lg, marginBottom: space.sm, paddingHorizontal: space.xs },
  need: { borderRadius: radius.md, padding: space.md, marginTop: space.lg, gap: 4 },
  needRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: { flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontWeight: '700', fontSize: 14 },
  stepText: { flex: 1, fontSize: 17, lineHeight: 25 },
  tip: { marginTop: space.sm, paddingHorizontal: space.xs },
});
