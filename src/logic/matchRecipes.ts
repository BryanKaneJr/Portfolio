import {
  DISH_TYPES,
  MEALS,
  type DishType,
  type Meal,
  type Recipe,
  type RecipeIngredient,
  type SearchState,
} from '../data/types';
import { compareResults } from './sortRecipes';

/**
 * Deterministic local matching. No AI, no network.
 *
 * Precedence (build plan §4):
 *  1. Avoid  — hard exclusion, checked against ALL listed ingredients incl. optional.
 *  2. Meal / Dish type — hard restrictions.
 *  3. Use — AND over REQUIRED ingredients only (optional garnish doesn't count).
 *  4. If zero exact results, clearly-labelled close matches within the same hard limits.
 */

export const NARROW_THRESHOLD = 30;
export const MAX_CLOSE_MATCHES = 12;

type RecipeIndex = { requiredIds: Set<string>; allIds: Set<string> };
const indexCache = new WeakMap<Recipe, RecipeIndex>();

function indexOf(recipe: Recipe): RecipeIndex {
  let idx = indexCache.get(recipe);
  if (!idx) {
    idx = {
      requiredIds: new Set(recipe.ingredients.filter(i => !i.optional).map(i => i.ingredientId)),
      allIds: new Set(recipe.ingredients.map(i => i.ingredientId)),
    };
    indexCache.set(recipe, idx);
  }
  return idx;
}

export function totalMinutes(recipe: Recipe): number {
  return recipe.prepMinutes + recipe.cookMinutes;
}

export function matchesHardFilters(recipe: Recipe, state: SearchState): boolean {
  const { allIds } = indexOf(recipe);
  if (state.avoidIds.some(id => allIds.has(id))) return false;
  if (state.meal && !recipe.meals.includes(state.meal)) return false;
  if (state.dishType && !recipe.dishTypes.includes(state.dishType)) return false;
  return true;
}

/** Requested Use IDs that appear as REQUIRED ingredients in the recipe. */
export function matchingRequestedIngredients(recipe: Recipe, useIds: string[]): string[] {
  const { requiredIds } = indexOf(recipe);
  return useIds.filter(id => requiredIds.has(id));
}

export function isExactMatch(recipe: Recipe, state: SearchState): boolean {
  return (
    matchesHardFilters(recipe, state) &&
    matchingRequestedIngredients(recipe, state.useIds).length === state.useIds.length
  );
}

/** Ingredient IDs the user is assumed to keep on hand (salt, oil, flour…). Empty = assume nothing. */
export type Staples = ReadonlySet<string>;
const NO_STAPLES: Staples = new Set();

/**
 * Required ingredient lines that are NOT covered by the user's Use list, split into
 * real extras and assumed kitchen staples (one entry per canonical ID).
 */
export function splitRequired(
  recipe: Recipe,
  haveIds: string[],
  staples: Staples = NO_STAPLES,
): { extras: RecipeIngredient[]; staples: RecipeIngredient[] } {
  const have = new Set(haveIds);
  const seen = new Set<string>();
  const extras: RecipeIngredient[] = [];
  const stapleLines: RecipeIngredient[] = [];
  for (const ing of recipe.ingredients) {
    if (ing.optional || have.has(ing.ingredientId) || seen.has(ing.ingredientId)) continue;
    seen.add(ing.ingredientId);
    (staples.has(ing.ingredientId) ? stapleLines : extras).push(ing);
  }
  return { extras, staples: stapleLines };
}

/** Required ingredients beyond `haveIds`, excluding assumed staples. */
export function additionalRequired(
  recipe: Recipe,
  haveIds: string[],
  staples: Staples = NO_STAPLES,
): RecipeIngredient[] {
  return splitRequired(recipe, haveIds, staples).extras;
}

export type RecipeResult = {
  recipe: Recipe;
  /** Requested Use IDs this recipe actually uses (as required ingredients). */
  usesIds: string[];
  /** Requested Use IDs this recipe does NOT use. Always empty for exact results. */
  missingIds: string[];
  /** Required ingredients beyond the Use list, excluding assumed staples. */
  alsoNeed: RecipeIngredient[];
  /** Required ingredients covered only by the assumed kitchen staples. */
  staplesUsed: RecipeIngredient[];
  totalMinutes: number;
};

export function toResult(recipe: Recipe, useIds: string[], staples: Staples = NO_STAPLES): RecipeResult {
  const usesIds = matchingRequestedIngredients(recipe, useIds);
  const usesSet = new Set(usesIds);
  const split = splitRequired(recipe, useIds, staples);
  return {
    recipe,
    usesIds,
    missingIds: useIds.filter(id => !usesSet.has(id)),
    alsoNeed: split.extras,
    staplesUsed: split.staples,
    totalMinutes: totalMinutes(recipe),
  };
}

export function findExactMatches(recipes: Recipe[], state: SearchState, staples: Staples = NO_STAPLES): RecipeResult[] {
  return recipes
    .filter(r => isExactMatch(r, state))
    .map(r => toResult(r, state.useIds, staples))
    .sort(compareResults);
}

/** Close matches — only when there are zero exact results and ≥1 Use ingredient. */
export function findCloseMatches(recipes: Recipe[], state: SearchState, staples: Staples = NO_STAPLES): RecipeResult[] {
  const n = state.useIds.length;
  if (n < 2) return []; // 1 ingredient: missing it means no meaningful overlap.

  const candidates = recipes
    .filter(r => matchesHardFilters(r, state))
    .map(r => toResult(r, state.useIds, staples))
    .filter(res => res.missingIds.length > 0 && res.usesIds.length >= 1);

  const allowedMissing = (max: number) => candidates.filter(c => c.missingIds.length <= max);

  let picked = allowedMissing(1);
  if (picked.length === 0 && n >= 3) picked = allowedMissing(2);

  return picked.sort(compareResults).slice(0, MAX_CLOSE_MATCHES);
}

export type NarrowSuggestion =
  { facet: 'meal'; value: Meal; count: number } | { facet: 'dishType'; value: DishType; count: number };

/**
 * Up to 3 Meal/Dish-type filters that would reduce a broad (> 30) result set.
 * Counts are computed from the current exact results, so they equal what the
 * user sees after tapping (same hard filters, one more restriction).
 */
export function suggestNarrowing(exact: RecipeResult[], state: SearchState, max = 3): NarrowSuggestion[] {
  if (exact.length <= NARROW_THRESHOLD) return [];
  const total = exact.length;
  const options: NarrowSuggestion[] = [];

  if (!state.meal) {
    for (const meal of MEALS) {
      const count = exact.filter(r => r.recipe.meals.includes(meal)).length;
      options.push({ facet: 'meal', value: meal, count });
    }
  }
  if (!state.dishType) {
    for (const dish of DISH_TYPES) {
      const count = exact.filter(r => r.recipe.dishTypes.includes(dish)).length;
      options.push({ facet: 'dishType', value: dish, count });
    }
  }

  const useful = options.filter(o => o.count > 0 && o.count < total);
  const inSweetSpot = (c: number) => c >= 3 && c <= 20;
  useful.sort(
    (a, b) =>
      Number(inSweetSpot(b.count)) - Number(inSweetSpot(a.count)) ||
      b.count - a.count ||
      (a.facet === b.facet ? 0 : a.facet === 'meal' ? -1 : 1) ||
      a.value.localeCompare(b.value),
  );
  return useful.slice(0, max);
}

export type TryWithout = { ingredientId: string; count: number };

/** "Try without: [Spinach]" — only offered when removing it unlocks exact results. */
export function suggestTryWithout(recipes: Recipe[], state: SearchState): TryWithout[] {
  if (state.useIds.length < 2) return [];
  return state.useIds
    .map(id => {
      const relaxed = { ...state, useIds: state.useIds.filter(u => u !== id) };
      return { ingredientId: id, count: recipes.filter(r => isExactMatch(r, relaxed)).length };
    })
    .filter(t => t.count > 0);
}

/** Which user choices are blocking results — used to offer explicit (never automatic) fixes. */
export type Blockers = {
  meal: boolean;
  dishType: boolean;
  avoid: boolean;
  ingredients: boolean;
};

export function findBlockers(recipes: Recipe[], state: SearchState): Blockers {
  const any = (s: SearchState) => recipes.some(r => isExactMatch(r, s));
  return {
    meal: state.meal !== null && any({ ...state, meal: null }),
    dishType: state.dishType !== null && any({ ...state, dishType: null }),
    avoid: state.avoidIds.length > 0 && any({ ...state, avoidIds: [] }),
    ingredients: state.useIds.length > 0 && any({ ...state, useIds: [] }),
  };
}

export type SearchResult = {
  exact: RecipeResult[];
  close: RecipeResult[];
  /** Largest number of Use ingredients any close match is missing (1 or 2). */
  closeMaxMissing: number;
  narrowing: NarrowSuggestion[];
  tryWithout: TryWithout[];
  blockers: Blockers;
};

const NO_BLOCKERS: Blockers = { meal: false, dishType: false, avoid: false, ingredients: false };

export function runSearch(recipes: Recipe[], state: SearchState, staples: Staples = NO_STAPLES): SearchResult {
  const exact = findExactMatches(recipes, state, staples);
  if (exact.length > 0) {
    return {
      exact,
      close: [],
      closeMaxMissing: 0,
      narrowing: suggestNarrowing(exact, state),
      tryWithout: [],
      blockers: NO_BLOCKERS,
    };
  }
  const close = state.useIds.length > 0 ? findCloseMatches(recipes, state, staples) : [];
  return {
    exact,
    close,
    closeMaxMissing: close.reduce((m, c) => Math.max(m, c.missingIds.length), 0),
    narrowing: [],
    tryWithout: suggestTryWithout(recipes, state),
    blockers: findBlockers(recipes, state),
  };
}

/** Cheap count for the "See 12 recipes" button. */
export function countExact(recipes: Recipe[], state: SearchState): number {
  let n = 0;
  for (const r of recipes) if (isExactMatch(r, state)) n++;
  return n;
}
