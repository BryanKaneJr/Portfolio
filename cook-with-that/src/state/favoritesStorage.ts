import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local-only persistence (no accounts, no server). Stores recipe IDs, the last search, the pantry and prefs, plus the
 * person's own recipes, notes, meal plan and shopping ticks. Bundled recipe content is never stored.
 */
const FAVORITES_KEY = 'cwt:favorites:v1';
const LAST_SEARCH_KEY = 'cwt:lastSearch:v1';

/** Keep only IDs that still resolve to a bundled recipe, de-duplicated, in saved order. */
export function resolveFavoriteIds(raw: unknown, knownRecipeIds: Set<string>): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is string => typeof x === 'string' && knownRecipeIds.has(x)))];
}

async function readJson(key: string): Promise<unknown> {
  try {
    const s = await AsyncStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage failure must never break cooking; worst case the choice isn't remembered.
  }
}

export const loadFavorites = () => readJson(FAVORITES_KEY);
export const saveFavorites = (ids: string[]) => writeJson(FAVORITES_KEY, ids);
export const loadLastSearch = () => readJson(LAST_SEARCH_KEY);
export const saveLastSearch = (state: unknown) => writeJson(LAST_SEARCH_KEY, state);

const PANTRY_KEY = 'cwt:pantry:v1';
const PREFS_KEY = 'cwt:prefs:v1';

/** Pantry = canonical ingredient IDs the user says they usually have. */
export const loadPantry = () => readJson(PANTRY_KEY);
export const savePantry = (ids: string[]) => writeJson(PANTRY_KEY, ids);
/** Small UI prefs: which home mode was last used, pantry meal/dish filters, staples, units. */
export const loadPrefs = () => readJson(PREFS_KEY);
export const savePrefs = (prefs: unknown) => writeJson(PREFS_KEY, prefs);

const MY_RECIPES_KEY = 'cwt:myRecipes:v1';
const NOTES_KEY = 'cwt:notes:v1';
const PLAN_KEY = 'cwt:plan:v1';
const SHOPPING_KEY = 'cwt:shopping:v1';

/** The person's own recipe content: edits of bundled recipes (by ID) and recipes they wrote. */
export const loadMyRecipes = () => readJson(MY_RECIPES_KEY);
export const saveMyRecipes = (data: unknown) => writeJson(MY_RECIPES_KEY, data);
/** Personal notes by recipe ID. */
export const loadNotes = () => readJson(NOTES_KEY);
export const saveNotes = (notes: unknown) => writeJson(NOTES_KEY, notes);
/** Meal plan: recipe IDs by day and slot. */
export const loadPlan = () => readJson(PLAN_KEY);
export const savePlan = (plan: unknown) => writeJson(PLAN_KEY, plan);
/** Shopping list ticks, by week (Monday) and ingredient ID. */
export const loadShopping = () => readJson(SHOPPING_KEY);
export const saveShopping = (checked: unknown) => writeJson(SHOPPING_KEY, checked);
