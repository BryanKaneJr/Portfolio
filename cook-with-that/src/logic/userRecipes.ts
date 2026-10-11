import {
  DISH_TYPES,
  MEALS,
  withMealDishTypes,
  type DishType,
  type Meal,
  type Recipe,
  type RecipeIngredient,
} from '../data/types';
import { normalizeText } from './normalizeIngredient';

/**
 * Recipes the person writes or edits, kept on the phone. An edit of a bundled recipe keeps its ID and replaces it
 * everywhere (search, Avoid, pantry, meal plan); a recipe written from scratch gets a `my-` ID.
 */

/** An ingredient the catalog doesn't have: searchable by nobody, shown by its own name. */
export const CUSTOM_PREFIX = 'custom:';
export const isCustomIngredient = (id: string) => id.startsWith(CUSTOM_PREFIX);
export const customIngredientId = (name: string) => CUSTOM_PREFIX + normalizeText(name);
export function customIngredientName(id: string): string {
  const name = id.slice(CUSTOM_PREFIX.length);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export const OWN_PREFIX = 'my-';
export const isOwnRecipeId = (id: string) => id.startsWith(OWN_PREFIX);

/** A fresh ID for a recipe written in the app, from its title: "my-grandmas-chili", "my-grandmas-chili-2"… */
export function newRecipeId(title: string, taken: ReadonlySet<string>): string {
  const slug =
    normalizeText(title)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'recipe';
  let id = `${OWN_PREFIX}${slug}`;
  for (let n = 2; taken.has(id); n++) id = `${OWN_PREFIX}${slug}-${n}`;
  return id;
}

const str = (x: unknown) => (typeof x === 'string' ? x : '');
const minutes = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.round(x) : 0);

/** Rebuild a recipe read back from storage, dropping anything malformed. Returns null if it can't be used. */
export function sanitizeRecipe(raw: unknown, isKnownIngredient: (id: string) => boolean): Recipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const title = str(r.title).trim();
  if (!id || !title) return null;
  const ingredients: RecipeIngredient[] = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map(i => ({
      ingredientId: str(i.ingredientId),
      displayName: str(i.displayName),
      quantityText: str(i.quantityText),
      ...(str(i.preparation) ? { preparation: str(i.preparation) } : {}),
      optional: i.optional === true,
    }))
    .filter(i => i.ingredientId && (isCustomIngredient(i.ingredientId) || isKnownIngredient(i.ingredientId)));
  const steps = (Array.isArray(r.steps) ? r.steps : []).filter((s): s is string => typeof s === 'string' && !!s.trim());
  const meals = (Array.isArray(r.meals) ? r.meals : []).filter((m): m is Meal => MEALS.includes(m as Meal));
  const dishTypes = (Array.isArray(r.dishTypes) ? r.dishTypes : []).filter((d): d is DishType =>
    DISH_TYPES.includes(d as DishType),
  );
  const servings = minutes(r.servings) || 1;
  const source = r.source && typeof r.source === 'object' ? (r.source as Recipe['source']) : null;
  return {
    id,
    title,
    description: str(r.description),
    meals: [...new Set(meals)],
    dishTypes: [...new Set(dishTypes)],
    prepMinutes: minutes(r.prepMinutes),
    cookMinutes: minutes(r.cookMinutes),
    servings,
    ingredients,
    steps,
    source: source && typeof source.type === 'string' ? source : { type: 'user', note: 'Your recipe' },
  };
}

/** What the editor won't save yet, in plain words. Empty when the recipe is ready. */
export function recipeProblems(recipe: Recipe): string[] {
  const problems: string[] = [];
  if (!recipe.title.trim()) problems.push('Give it a name.');
  if (!recipe.ingredients.length) problems.push('Add at least one ingredient.');
  if (recipe.ingredients.some(i => !i.displayName.trim())) problems.push('Every ingredient needs a name.');
  if (!recipe.steps.some(s => s.trim())) problems.push('Add at least one step.');
  if (!recipe.meals.length) problems.push('Pick at least one meal.');
  if (!withMealDishTypes(recipe).dishTypes.length) problems.push('Pick a dish type.');
  if (recipe.prepMinutes + recipe.cookMinutes <= 0) problems.push('Add a prep or cook time.');
  return problems;
}

/** Tidy a recipe for saving: trimmed text, no blank steps, at least 1 serving, meal-implied dish types. */
export function cleanRecipe(recipe: Recipe): Recipe {
  return withMealDishTypes({
    ...recipe,
    title: recipe.title.trim(),
    description: recipe.description.trim(),
    servings: Math.max(1, Math.round(recipe.servings) || 1),
    ingredients: recipe.ingredients.map(i => ({
      ...i,
      displayName: i.displayName.trim(),
      quantityText: i.quantityText.trim(),
      ...(i.preparation?.trim() ? { preparation: i.preparation.trim() } : { preparation: undefined }),
    })),
    steps: recipe.steps.map(s => s.trim()).filter(Boolean),
  });
}

/**
 * The library this person sees: bundled recipes with their edits swapped in, then the recipes they wrote.
 * Everything that searches or plans uses this, so an edit counts everywhere.
 */
export function buildLibrary(bundled: Recipe[], edits: Readonly<Record<string, Recipe>>, own: Recipe[]): Recipe[] {
  const swapped = bundled.map(r => (edits[r.id] ? withMealDishTypes(edits[r.id]) : r));
  return [...swapped, ...own.map(withMealDishTypes)];
}
