import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local-only persistence (no accounts, no server). Stores recipe IDs and the
 * last search — never recipe content, which is bundled with the app.
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
