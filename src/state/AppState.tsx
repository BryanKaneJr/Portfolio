import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { INGREDIENTS, RECIPES } from '../data/catalog';
import { DISH_TYPES, EMPTY_SEARCH, MEALS, type DishType, type Meal, type SearchState } from '../data/types';
import { loadFavorites, loadLastSearch, resolveFavoriteIds, saveFavorites, saveLastSearch } from './favoritesStorage';
import { addIngredient, removeIngredient, sanitizeSearch, type PickMode } from './searchState';

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
};

const Ctx = createContext<AppState | null>(null);

const KNOWN_INGREDIENTS = new Set(INGREDIENTS.map(i => i.id));
const KNOWN_RECIPES = new Set(RECIPES.map(r => r.id));

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [mode, setMode] = useState<PickMode>('use');
  const [favorites, setFavorites] = useState<string[]>([]);
  const loaded = useRef(false);

  // Restore last selection + favorites from local storage.
  useEffect(() => {
    let alive = true;
    Promise.all([loadLastSearch(), loadFavorites()]).then(([s, f]) => {
      if (!alive) return;
      setSearch(sanitizeSearch(s, KNOWN_INGREDIENTS, MEALS, DISH_TYPES));
      setFavorites(resolveFavoriteIds(f, KNOWN_RECIPES));
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
    }),
    [ready, search, mode, pick, favorites],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}
