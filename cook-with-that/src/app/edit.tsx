import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { Button, LinkButton } from '../components/ui';
import { ingredientIndex, ingredientName } from '../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS } from '../data/labels';
import { DISH_TYPES, MEAL_DISH_TYPES, MEALS, type DishType, type Meal, type Recipe } from '../data/types';
import { searchIngredients } from '../logic/normalizeIngredient';
import { customIngredientId, isCustomIngredient, newRecipeId, recipeProblems } from '../logic/userRecipes';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

type IngredientDraft = {
  key: number;
  ingredientId: string;
  displayName: string;
  quantityText: string;
  preparation: string;
  optional: boolean;
};
type StepDraft = { key: number; text: string };

// Stable React keys for the editable rows.
let nextKey = 1;
const key = () => nextKey++;

const toNumber = (s: string) => {
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Edit a recipe (yours, or your version of a bundled one), or write a new one. Saving a bundled recipe keeps its ID,
 * so your version replaces it in search, Avoid, the pantry and the meal plan; "Go back to the original" undoes that.
 */
export default function EditRecipeScreen() {
  const c = useColors();
  const app = useAppState();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const base = id ? app.recipeById(id) : undefined;
  const isNew = !base;
  const bundled = !!(base && app.originalRecipe(base.id));

  const [title, setTitle] = useState(base?.title ?? '');
  const [description, setDescription] = useState(base?.description ?? '');
  const [meals, setMeals] = useState<Meal[]>(base?.meals ?? ['dinner']);
  const [dishTypes, setDishTypes] = useState<DishType[]>(
    // Meal-implied types are shown from the meals, not stored as picks.
    (base?.dishTypes ?? []).filter(d => !(base?.meals ?? []).some(m => MEAL_DISH_TYPES[m] === d)),
  );
  const [prep, setPrep] = useState(String(base?.prepMinutes ?? ''));
  const [cook, setCook] = useState(String(base?.cookMinutes ?? ''));
  const [servings, setServings] = useState(String(base?.servings ?? 4));
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    (base?.ingredients ?? []).map(i => ({
      key: key(),
      ingredientId: i.ingredientId,
      displayName: i.displayName,
      quantityText: i.quantityText,
      preparation: i.preparation ?? '',
      optional: i.optional,
    })),
  );
  const [steps, setSteps] = useState<StepDraft[]>(() =>
    (base?.steps.length ? base.steps : ['']).map(s => ({ key: key(), text: s })),
  );
  const [query, setQuery] = useState('');
  const [showProblems, setShowProblems] = useState(false);
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);

  const implied = useMemo(() => new Set(meals.flatMap(m => MEAL_DISH_TYPES[m] ?? [])), [meals]);
  // Desserts, Sides and Appetizers come from the meal, so the dish-type list leaves them out.
  const pickable = DISH_TYPES.filter(d => !Object.values(MEAL_DISH_TYPES).includes(d));
  const hits = useMemo(() => (query.trim() ? searchIngredients(ingredientIndex, query, 6) : []), [query]);

  const draft = (): Recipe => ({
    id: base?.id ?? '',
    title,
    description,
    meals,
    dishTypes: [...dishTypes, ...[...implied].filter(d => !dishTypes.includes(d))],
    prepMinutes: Math.round(toNumber(prep)),
    cookMinutes: Math.round(toNumber(cook)),
    servings: Math.max(1, Math.round(toNumber(servings)) || 1),
    ingredients: ingredients.map(i => ({
      ingredientId: i.ingredientId,
      displayName: i.displayName,
      quantityText: i.quantityText,
      ...(i.preparation.trim() ? { preparation: i.preparation } : {}),
      optional: i.optional,
    })),
    steps: steps.map(s => s.text),
    source: base?.source ?? { type: 'user', note: 'Your recipe' },
  });
  const problems = recipeProblems(draft());

  const save = () => {
    if (problems.length) {
      setShowProblems(true);
      return;
    }
    const taken = new Set(app.library.map(r => r.id));
    const recipe = draft();
    const savedId = app.saveRecipe({ ...recipe, id: isNew ? newRecipeId(recipe.title, taken) : recipe.id });
    // The editor is a sheet: close it, then open a brand-new recipe's page.
    router.back();
    if (isNew) router.push({ pathname: '/recipe/[id]', params: { id: savedId } });
  };

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  const updateIngredient = (k: number, patch: Partial<IngredientDraft>) =>
    setIngredients(list => list.map(i => (i.key === k ? { ...i, ...patch } : i)));
  const addIngredient = (ingredientId: string, displayName: string) => {
    setIngredients(list => [
      ...list,
      { key: key(), ingredientId, displayName, quantityText: '', preparation: '', optional: false },
    ]);
    setQuery('');
  };
  const moveStep = (index: number) =>
    setSteps(list => {
      if (index === 0) return list;
      const next = [...list];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });

  const input = [styles.input, { color: c.text, backgroundColor: c.card, borderColor: c.cardBorder }];

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'New recipe' : bundled ? 'Your version' : 'Edit recipe',
          headerLeft: () => (
            <View style={styles.cancel}>
              <LinkButton label="Cancel" onPress={() => router.back()} />
            </View>
          ),
          headerRight: () => (
            <Pressable onPress={save} accessibilityRole="button" hitSlop={10} style={styles.headerBtn}>
              <Text style={[t.bodyStrong, { color: c.accent }]}>Save</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {bundled ? (
          <Text style={[t.small, { color: c.textMuted, marginBottom: space.md }]}>
            Your changes replace this recipe for you everywhere: search, Avoid, your pantry and the meal plan. You can
            always go back to the original.
          </Text>
        ) : null}

        <Label text="Name" />
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Grandma's chili"
          placeholderTextColor={c.textMuted}
          style={input}
          accessibilityLabel="Recipe name"
        />
        <Label text="About it" />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="One line about the dish (optional)"
          placeholderTextColor={c.textMuted}
          style={[input, styles.about]}
          multiline
          numberOfLines={3}
          accessibilityLabel="About this recipe"
        />

        <Label text="Meal" />
        <View style={styles.wrap}>
          {MEALS.map(m => (
            <Chip
              key={m}
              small
              label={MEAL_LABELS[m]}
              variant={meals.includes(m) ? 'filterOn' : 'neutral'}
              selected={meals.includes(m)}
              onPress={() => setMeals(list => toggle(list, m))}
            />
          ))}
        </View>
        <Label text="Dish type" />
        <View style={styles.wrap}>
          {pickable.map(d => {
            const on = dishTypes.includes(d);
            return (
              <Chip
                key={d}
                small
                label={DISH_TYPE_LABELS[d]}
                variant={on ? 'filterOn' : 'neutral'}
                selected={on}
                onPress={() => setDishTypes(list => toggle(list, d))}
              />
            );
          })}
        </View>

        <View style={styles.row3}>
          {(
            [
              ['Prep (min)', prep, setPrep],
              ['Cook (min)', cook, setCook],
              ['Serves', servings, setServings],
            ] as const
          ).map(([label, value, set]) => (
            <View key={label} style={styles.flex}>
              <Label text={label} />
              <TextInput
                value={value}
                onChangeText={set}
                keyboardType="number-pad"
                style={input}
                accessibilityLabel={label}
              />
            </View>
          ))}
        </View>

        <Text style={[t.title, styles.h2, { color: c.text }]} accessibilityRole="header">
          Ingredients
        </Text>
        {ingredients.map(i => (
          <View key={i.key} style={[styles.ingCard, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
            <View style={styles.ingTop}>
              <TextInput
                value={i.quantityText}
                onChangeText={v => updateIngredient(i.key, { quantityText: v })}
                placeholder="Amount"
                placeholderTextColor={c.textMuted}
                style={[input, styles.qty]}
                accessibilityLabel={`Amount of ${i.displayName}`}
              />
              <TextInput
                value={i.displayName}
                onChangeText={v => updateIngredient(i.key, { displayName: v })}
                placeholder="Ingredient"
                placeholderTextColor={c.textMuted}
                style={[input, styles.grow]}
                accessibilityLabel="Ingredient name"
              />
              <Pressable
                onPress={() => setIngredients(list => list.filter(x => x.key !== i.key))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${i.displayName}`}
                hitSlop={6}
                style={styles.iconBtn}
              >
                <Icon name="close" size={16} color={c.textMuted} weight="semibold" />
              </Pressable>
            </View>
            <View style={styles.ingTop}>
              <TextInput
                value={i.preparation}
                onChangeText={v => updateIngredient(i.key, { preparation: v })}
                placeholder="Notes: chopped, divided…"
                placeholderTextColor={c.textMuted}
                style={[input, styles.grow]}
                accessibilityLabel={`Notes for ${i.displayName}`}
              />
              <Chip
                small
                label="Optional"
                variant={i.optional ? 'filterOn' : 'neutral'}
                selected={i.optional}
                onPress={() => updateIngredient(i.key, { optional: !i.optional })}
              />
            </View>
            <Text style={[t.small, { color: c.textMuted }]}>
              {isCustomIngredient(i.ingredientId)
                ? 'Your own ingredient: ingredient search and Avoid can’t see it.'
                : `Counts as ${ingredientName(i.ingredientId)} in search and Avoid.`}
            </Text>
          </View>
        ))}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Add an ingredient…"
          placeholderTextColor={c.textMuted}
          style={input}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Add an ingredient"
        />
        {query.trim() ? (
          <View style={[styles.hits, { borderColor: c.cardBorder, backgroundColor: c.card }]}>
            {hits.map(h => (
              <Pressable
                key={h.ingredient.id}
                onPress={() => addIngredient(h.ingredient.id, h.ingredient.name.toLowerCase())}
                accessibilityRole="button"
                style={[styles.hit, { borderBottomColor: c.divider }]}
              >
                <Text style={[t.body, { color: c.text }]}>
                  {h.ingredient.name}
                  {h.matchedAlias ? <Text style={{ color: c.textMuted }}> ({h.matchedAlias})</Text> : null}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => addIngredient(customIngredientId(query), query.trim())}
              accessibilityRole="button"
              style={styles.hit}
            >
              <Text style={[t.body, { color: c.accent }]}>Add “{query.trim()}” as your own ingredient</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[t.title, styles.h2, { color: c.text }]} accessibilityRole="header">
          Steps
        </Text>
        {steps.map((s, n) => (
          <View key={s.key} style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: c.accentSoft }]}>
              <Text style={[styles.stepNumText, { color: c.accent }]}>{n + 1}</Text>
            </View>
            <TextInput
              value={s.text}
              onChangeText={v => setSteps(list => list.map(x => (x.key === s.key ? { ...x, text: v } : x)))}
              placeholder="What to do"
              placeholderTextColor={c.textMuted}
              style={[input, styles.multi, styles.grow]}
              multiline
              accessibilityLabel={`Step ${n + 1}`}
            />
            <View>
              <Pressable
                onPress={() => moveStep(n)}
                disabled={n === 0}
                accessibilityRole="button"
                accessibilityLabel={`Move step ${n + 1} up`}
                style={styles.iconBtn}
              >
                <Icon name="arrowUp" size={16} color={n === 0 ? c.divider : c.textMuted} weight="semibold" />
              </Pressable>
              <Pressable
                onPress={() => setSteps(list => list.filter(x => x.key !== s.key))}
                accessibilityRole="button"
                accessibilityLabel={`Remove step ${n + 1}`}
                style={styles.iconBtn}
              >
                <Icon name="close" size={16} color={c.textMuted} weight="semibold" />
              </Pressable>
            </View>
          </View>
        ))}
        <Button
          label="Add a step"
          icon="plus"
          variant="secondary"
          compact
          onPress={() => setSteps(list => [...list, { key: key(), text: '' }])}
          style={styles.addBtn}
        />

        {showProblems && problems.length ? (
          <View style={[styles.problems, { backgroundColor: c.warnSoft }]} accessibilityLiveRegion="polite">
            {problems.map(p => (
              <Text key={p} style={[t.body, { color: c.warnText }]}>
                • {p}
              </Text>
            ))}
          </View>
        ) : null}

        <Button label="Save" onPress={save} style={styles.saveBtn} />

        {bundled && app.isEdited(base.id) ? (
          <Button
            variant="danger"
            icon="undo"
            label={confirm === 'reset' ? 'Tap again to drop your changes' : 'Go back to the original'}
            onPress={() => {
              if (confirm !== 'reset') return setConfirm('reset');
              app.resetRecipe(base.id);
              router.back();
            }}
            style={styles.dangerBtn}
          />
        ) : null}
        {!isNew && app.isOwn(base.id) ? (
          <Button
            variant="danger"
            icon="trash"
            label={confirm === 'delete' ? 'Tap again to delete it for good' : 'Delete this recipe'}
            onPress={() => {
              if (confirm !== 'delete') return setConfirm('delete');
              app.deleteRecipe(base.id);
              router.dismissTo('/saved');
            }}
            style={styles.dangerBtn}
          />
        ) : null}
      </ScrollView>
    </>
  );
}

function Label({ text }: { text: string }) {
  const c = useColors();
  return <Text style={[t.label, styles.label, { color: c.textMuted }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // minWidth 0 lets a text box shrink inside a row (web inputs otherwise keep their default width).
  grow: { flex: 1, minWidth: 0 },
  scroll: { padding: space.lg, paddingBottom: space.xxl * 3 },
  cancel: { paddingRight: space.md },
  headerBtn: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: space.lg, marginBottom: space.xs },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontSize: 16,
    minHeight: MIN_TOUCH,
  },
  multi: { minHeight: 64, textAlignVertical: 'top' },
  about: { minHeight: 88, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row3: { flexDirection: 'row', gap: space.md },
  h2: { marginTop: space.xl, marginBottom: space.sm },
  ingCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
    marginBottom: space.sm,
  },
  ingTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  qty: { width: 96, flexShrink: 0 },
  iconBtn: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  hits: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    marginTop: space.xs,
    paddingHorizontal: space.md,
  },
  hit: { minHeight: MIN_TOUCH, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: space.sm },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  stepNumText: { fontWeight: '700', fontSize: 14 },
  addBtn: { alignSelf: 'flex-start', marginTop: space.xs },
  problems: { borderRadius: radius.md, padding: space.md, marginTop: space.lg, gap: space.xs },
  saveBtn: { marginTop: space.xl },
  dangerBtn: { marginTop: space.sm },
});
