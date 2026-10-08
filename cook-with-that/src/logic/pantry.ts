import type { DishType, Meal, Recipe, RecipeIngredient } from '../data/types';
import { totalMinutes } from './matchRecipes';

/**
 * "Cook from my pantry" mode.
 *
 * A recipe is CAN MAKE when every REQUIRED ingredient's canonical ID is in the
 * saved pantry. Basics (salt, oil…) are never assumed — the user adds them to the
 * pantry explicitly. Optional ingredients never block a recipe.
 *
 * Results are shown in a shuffled order so the list feels fresh; the shuffle is
 * seeded so the order stays put while the user browses and only changes when they
 * tap Shuffle.
 */

export const MAX_ONE_SHORT = 12;

export type PantryFilters = { meal: Meal | null; dishType: DishType | null };

export type PantryResult = {
  recipe: Recipe;
  /** Required ingredients not in the pantry (empty for "can make"). */
  missing: RecipeIngredient[];
  totalMinutes: number;
};

function missingFromPantry(recipe: Recipe, pantry: Set<string>): RecipeIngredient[] {
  const seen = new Set<string>();
  const out: RecipeIngredient[] = [];
  for (const ing of recipe.ingredients) {
    if (ing.optional || pantry.has(ing.ingredientId) || seen.has(ing.ingredientId)) continue;
    seen.add(ing.ingredientId);
    out.push(ing);
  }
  return out;
}

function passesFilters(recipe: Recipe, f: PantryFilters): boolean {
  if (f.meal && !recipe.meals.includes(f.meal)) return false;
  if (f.dishType && !recipe.dishTypes.includes(f.dishType)) return false;
  return true;
}

/** Small deterministic PRNG (mulberry32) so a seed always gives the same order. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates on a copy. Input is pre-sorted by ID so the result depends only on the seed. */
export function seededShuffle<T extends { recipe: Recipe }>(items: T[], seed: number): T[] {
  const arr = [...items].sort((a, b) => (a.recipe.id < b.recipe.id ? -1 : a.recipe.id > b.recipe.id ? 1 : 0));
  const rand = rng(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export type PantrySearch = {
  canMake: PantryResult[];
  /** Recipes exactly one required ingredient short — shown separately and labelled. */
  oneShort: PantryResult[];
};

export function searchPantry(
  recipes: Recipe[],
  pantryIds: string[],
  filters: PantryFilters,
  seed: number,
): PantrySearch {
  if (pantryIds.length === 0) return { canMake: [], oneShort: [] };
  const pantry = new Set(pantryIds);
  const canMake: PantryResult[] = [];
  const oneShort: PantryResult[] = [];
  for (const recipe of recipes) {
    if (!passesFilters(recipe, filters)) continue;
    const missing = missingFromPantry(recipe, pantry);
    const res = { recipe, missing, totalMinutes: totalMinutes(recipe) };
    if (missing.length === 0) canMake.push(res);
    else if (missing.length === 1) oneShort.push(res);
  }
  return {
    canMake: seededShuffle(canMake, seed),
    oneShort: seededShuffle(oneShort, seed).slice(0, MAX_ONE_SHORT),
  };
}

/** Count of can-make recipes for the home-screen button. */
export function countCanMake(recipes: Recipe[], pantryIds: string[], filters: PantryFilters): number {
  if (pantryIds.length === 0) return 0;
  const pantry = new Set(pantryIds);
  return recipes.filter(r => passesFilters(r, filters) && missingFromPantry(r, pantry).length === 0).length;
}

/** Meal / dish-type options that would narrow the current can-make list, with counts. */
export function pantryFacetCounts(recipes: Recipe[], pantryIds: string[], filters: PantryFilters) {
  const pantry = new Set(pantryIds);
  const base = recipes.filter(r => missingFromPantry(r, pantry).length === 0);
  const meal = (m: Meal) =>
    base.filter(r => r.meals.includes(m) && (!filters.dishType || r.dishTypes.includes(filters.dishType))).length;
  const dish = (d: DishType) =>
    base.filter(r => r.dishTypes.includes(d) && (!filters.meal || r.meals.includes(filters.meal))).length;
  return { meal, dish };
}
