import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chip } from '../components/Chip';
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
  const nextKey = useRef(1);
  const key = () => nextKey.current++;

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
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(
    (base?.ingredients ?? []).map(i => ({
      key: key(),
      ingredientId: i.ingredientId,
      displayName: i.displayName,
      quantityText: i.quantityText,
      preparation: i.preparation ?? '',
      optional: i.optional,
    })),
  );
  const [steps, setSteps] = useState<StepDraft[]>(
    (base?.steps.length ? base.steps : ['']).map(s => ({ key: key(), text: s })),
  );
  const [query, setQuery] = useState('');
  const [showProblems, setShowProblems] = useState(false);
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);

  const implied = useMemo(() => new Set(meals.flatMap(m => MEAL_DISH_TYPES[m] ?? [])), [meals]);
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
    if (isNew) router.replace({ pathname: '/recipe/[id]', params: { id: savedId } });
    else router.back();
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

  const input = [styles.input, { color: c.text, backgroundColor: c.card, borderColor: c.chipBorder }];

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'New recipe' : bundled ? 'Your version' : 'Edit recipe',
          headerRight: () => (
            <Pressable onPress={save} accessibilityRole="button" hitSlop={10} style={styles.headerBtn}>
              <Text style={[t.bodyStrong, { color: c.primary }]}>Save</Text>
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
          style={[input, styles.multi]}
          multiline
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
          {DISH_TYPES.map(d => {
            const on = dishTypes.includes(d) || implied.has(d);
            return (
              <Chip
                key={d}
                small
                label={DISH_TYPE_LABELS[d]}
                variant={on ? 'filterOn' : 'neutral'}
                selected={on}
                // A dessert is always a Desserts dish: the meal decides it, so tapping it does nothing.
                onPress={implied.has(d) ? undefined : () => setDishTypes(list => toggle(list, d))}
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
                <Text style={{ color: c.textMuted, fontSize: 20 }}>×</Text>
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
              <Text style={[t.body, { color: c.primary }]}>Add “{query.trim()}” as your own ingredient</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[t.title, styles.h2, { color: c.text }]} accessibilityRole="header">
          Steps
        </Text>
        {steps.map((s, n) => (
          <View key={s.key} style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: c.primary }]}>
              <Text style={styles.stepNumText}>{n + 1}</Text>
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
                <Text style={{ color: n === 0 ? c.divider : c.textMuted, fontSize: 18 }}>↑</Text>
              </Pressable>
              <Pressable
                onPress={() => setSteps(list => list.filter(x => x.key !== s.key))}
                accessibilityRole="button"
                accessibilityLabel={`Remove step ${n + 1}`}
                style={styles.iconBtn}
              >
                <Text style={{ color: c.textMuted, fontSize: 20 }}>×</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Pressable
          onPress={() => setSteps(list => [...list, { key: key(), text: '' }])}
          accessibilityRole="button"
          style={[styles.addBtn, { borderColor: c.chipBorder }]}
        >
          <Text style={[t.bodyStrong, { color: c.primary }]}>+ Add a step</Text>
        </Pressable>

        {showProblems && problems.length ? (
          <View style={[styles.problems, { backgroundColor: c.warnSoft }]} accessibilityLiveRegion="polite">
            {problems.map(p => (
              <Text key={p} style={[t.body, { color: c.warnText }]}>
                • {p}
              </Text>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={save}
          accessibilityRole="button"
          style={({ pressed }) => [styles.saveBtn, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[t.bodyStrong, { color: c.primaryText }]}>Save</Text>
        </Pressable>

        {bundled && app.isEdited(base.id) ? (
          <Pressable
            onPress={() => {
              if (confirm !== 'reset') return setConfirm('reset');
              app.resetRecipe(base.id);
              router.back();
            }}
            accessibilityRole="button"
            style={styles.dangerBtn}
          >
            <Text style={[t.bodyStrong, { color: c.avoidText }]}>
              {confirm === 'reset' ? 'Tap again to drop your changes' : 'Go back to the original'}
            </Text>
          </Pressable>
        ) : null}
        {!isNew && app.isOwn(base.id) ? (
          <Pressable
            onPress={() => {
              if (confirm !== 'delete') return setConfirm('delete');
              app.deleteRecipe(base.id);
              router.dismissTo('/favorites');
            }}
            accessibilityRole="button"
            style={styles.dangerBtn}
          >
            <Text style={[t.bodyStrong, { color: c.avoidText }]}>
              {confirm === 'delete' ? 'Tap again to delete it for good' : 'Delete this recipe'}
            </Text>
          </Pressable>
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
  headerBtn: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: space.lg, marginBottom: space.xs },
  input: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    fontSize: 16,
    minHeight: MIN_TOUCH,
  },
  multi: { minHeight: 64, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row3: { flexDirection: 'row', gap: space.md },
  h2: { marginTop: space.xl, marginBottom: space.sm },
  ingCard: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.sm, marginBottom: space.sm },
  ingTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  qty: { width: 96, flexShrink: 0 },
  iconBtn: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  hits: { borderWidth: 1, borderRadius: radius.md, marginTop: space.xs, paddingHorizontal: space.md },
  hit: { minHeight: MIN_TOUCH, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: space.sm },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  stepNumText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  addBtn: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  problems: { borderRadius: radius.md, padding: space.md, marginTop: space.lg, gap: space.xs },
  saveBtn: {
    marginTop: space.xl,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtn: { marginTop: space.md, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
