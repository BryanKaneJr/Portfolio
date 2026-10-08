import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { INGREDIENTS, RECIPES } from '../data/catalog';
import { DISH_TYPES, EMPTY_SEARCH, MEALS, type DishType, type Meal, type SearchState } from '../data/types';
import {
  loadFavorites,
  loadLastSearch,
  loadPantry,
  loadPrefs,
  resolveFavoriteIds,
  saveFavorites,
  saveLastSearch,
  savePantry,
  savePrefs,
} from './favoritesStorage';
import { addIngredient, removeIngredient, sanitizeSearch, type PickMode } from './searchState';

export type HomeMode = 'pick' | 'pantry';

/** Ingredients offered by the one-tap "Add basics" button (added explicitly, never assumed). */
export const BASIC_IDS = INGREDIENTS.filter(i => i.basic).map(i => i.id);

type AppState = {
  ready: boolean;
  search: SearchState;
  mode: PickMode;
  setMode: (m: PickMode) => void;
  pick: (id: string) => void;
  remove: (id: string) => void;
  setMeal: (m: Meal | null) => void;
  setDishType: (d: DishType | null) => void;
  clearAvoid: () => void;
  clearAll: () => void;
  favorites: string[];
  isFavorite: (recipeId: string) => boolean;
  toggleFavorite: (recipeId: string) => void;
  homeMode: HomeMode;
  setHomeMode: (m: HomeMode) => void;
  pantry: string[];
  togglePantry: (id: string) => void;
  addToPantry: (ids: string[]) => void;
  clearPantry: () => void;
  pantryMeal: Meal | null;
  pantryDishType: DishType | null;
  setPantryMeal: (m: Meal | null) => void;
  setPantryDishType: (d: DishType | null) => void;
  /** Seed for the shuffled pantry list; changes only when the user taps Shuffle. */
  shuffleSeed: number;
  reshuffle: () => void;
};

const Ctx = createContext<AppState | null>(null);

const KNOWN_INGREDIENTS = new Set(INGREDIENTS.map(i => i.id));
const KNOWN_RECIPES = new Set(RECIPES.map(r => r.id));

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [mode, setMode] = useState<PickMode>('use');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [homeMode, setHomeMode] = useState<HomeMode>('pick');
  const [pantry, setPantry] = useState<string[]>([]);
  const [pantryMeal, setPantryMeal] = useState<Meal | null>(null);
  const [pantryDishType, setPantryDishType] = useState<DishType | null>(null);
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const loaded = useRef(false);

  // Restore last selection + favorites from local storage.
  useEffect(() => {
    let alive = true;
    Promise.all([loadLastSearch(), loadFavorites(), loadPantry(), loadPrefs()]).then(([s, f, p, prefs]) => {
      if (!alive) return;
      setSearch(sanitizeSearch(s, KNOWN_INGREDIENTS, MEALS, DISH_TYPES));
      setFavorites(resolveFavoriteIds(f, KNOWN_RECIPES));
      setPantry(resolveFavoriteIds(p, KNOWN_INGREDIENTS));
      const pr = (prefs && typeof prefs === 'object' ? prefs : {}) as Record<string, unknown>;
      if (pr.homeMode === 'pantry' || pr.homeMode === 'pick') setHomeMode(pr.homeMode);
      if (typeof pr.pantryMeal === 'string' && (MEALS as readonly string[]).includes(pr.pantryMeal)) setPantryMeal(pr.pantryMeal as Meal);
      if (typeof pr.pantryDishType === 'string' && (DISH_TYPES as readonly string[]).includes(pr.pantryDishType))
        setPantryDishType(pr.pantryDishType as DishType);
      loaded.current = true;
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (loaded.current) saveLastSearch(search);
  }, [search]);

  useEffect(() => {
    if (loaded.current) saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    if (loaded.current) savePantry(pantry);
  }, [pantry]);

  useEffect(() => {
    if (loaded.current) savePrefs({ homeMode, pantryMeal, pantryDishType });
  }, [homeMode, pantryMeal, pantryDishType]);

  const pick = useCallback(
    (id: string) =>
      setSearch(s => {
        const list = mode === 'use' ? s.useIds : s.avoidIds;
        // Tapping something already in the active list toggles it off.
        return list.includes(id) ? removeIngredient(s, id) : addIngredient(s, id, mode);
      }),
    [mode],
  );

  const value = useMemo<AppState>(
    () => ({
      ready,
      search,
      mode,
      setMode,
      pick,
      remove: id => setSearch(s => removeIngredient(s, id)),
      setMeal: meal => setSearch(s => ({ ...s, meal })),
      setDishType: dishType => setSearch(s => ({ ...s, dishType })),
      clearAvoid: () => setSearch(s => ({ ...s, avoidIds: [] })),
      clearAll: () => setSearch(EMPTY_SEARCH),
      favorites,
      isFavorite: id => favorites.includes(id),
      toggleFavorite: id => setFavorites(f => (f.includes(id) ? f.filter(x => x !== id) : [id, ...f])),
      homeMode,
      setHomeMode,
      pantry,
      togglePantry: id => setPantry(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id])),
      addToPantry: ids => setPantry(p => [...p, ...ids.filter(id => !p.includes(id))]),
      clearPantry: () => setPantry([]),
      pantryMeal,
      pantryDishType,
      setPantryMeal,
      setPantryDishType,
      shuffleSeed,
      reshuffle: () => setShuffleSeed(s => (s + 1 + Math.floor(Math.random() * 1e9)) % 2147483647),
    }),
    [ready, search, mode, pick, favorites, homeMode, pantry, pantryMeal, pantryDishType, shuffleSeed],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}
