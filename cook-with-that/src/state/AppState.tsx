import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { INGREDIENTS, RECIPES, recipesById } from '../data/catalog';
import { DEFAULT_STAPLE_IDS } from '../data/staples';
import {
  DISH_TYPES,
  EMPTY_SEARCH,
  MEALS,
  type DishType,
  type Meal,
  type Recipe,
  type SearchState,
} from '../data/types';
import {
  loadFavorites,
  loadLastSearch,
  loadMyRecipes,
  loadNotes,
  loadPantry,
  loadPlan,
  loadPrefs,
  loadShopping,
  resolveFavoriteIds,
  saveFavorites,
  saveLastSearch,
  saveMyRecipes,
  saveNotes,
  savePantry,
  savePlan,
  savePrefs,
  saveShopping,
} from './favoritesStorage';
import {
  addToPlan,
  removeFromPlan,
  removeRecipeFromPlan,
  sanitizePlan,
  type MealPlan,
  type PlanSlot,
} from '../logic/mealPlan';
import { defaultUnitSystem, UNIT_SYSTEMS, type UnitSystem } from '../logic/units';
import { buildLibrary, cleanRecipe, isOwnRecipeId, sanitizeRecipe } from '../logic/userRecipes';
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
  clearUse: () => void;
  /** Put an ingredient in Use or Avoid (moves it if it's in the other list). */
  moveIngredient: (id: string, to: PickMode) => void;
  clearAll: () => void;
  favorites: string[];
  isFavorite: (recipeId: string) => boolean;
  toggleFavorite: (recipeId: string) => void;
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
  /** Kitchen staples setting. */
  assumeStaples: boolean;
  setAssumeStaples: (on: boolean) => void;
  stapleIds: string[];
  toggleStaple: (id: string) => void;
  resetStaples: () => void;
  /** Staples currently in effect (empty when the setting is off). */
  staples: ReadonlySet<string>;
  /** Pantry plus assumed staples — what pantry mode treats as on hand. */
  effectivePantry: string[];
  /** US cups/°F or metric grams/°C on recipe pages (Settings). */
  units: UnitSystem;
  setUnits: (u: UnitSystem) => void;

  /** Every recipe this person sees: bundled ones with their edits swapped in, then their own. */
  library: Recipe[];
  recipeById: (id: string) => Recipe | undefined;
  /** The bundled recipe, ignoring any edit (for "Show original"). */
  originalRecipe: (id: string) => Recipe | undefined;
  isEdited: (id: string) => boolean;
  isOwn: (id: string) => boolean;
  /** Recipes written in the app, newest first. */
  ownRecipes: Recipe[];
  /** IDs of bundled recipes this person has edited. */
  editedIds: string[];
  /** Save an edit of a bundled recipe, or a recipe of their own. Returns its ID. */
  saveRecipe: (recipe: Recipe) => string;
  /** Drop an edit and go back to the bundled recipe. */
  resetRecipe: (id: string) => void;
  /** Delete a recipe of their own (and take it off favorites and the plan). */
  deleteRecipe: (id: string) => void;
  noteFor: (id: string) => string;
  setNote: (id: string, text: string) => void;
  plan: MealPlan;
  planRecipe: (day: string, slot: PlanSlot, recipeId: string) => void;
  unplanRecipe: (day: string, slot: PlanSlot, recipeId: string) => void;
  /** Shopping list ticks by week (its Monday). */
  shoppingChecked: Record<string, string[]>;
  toggleShoppingItem: (week: string, ingredientId: string) => void;
  clearShoppingChecks: (week: string) => void;
};

/** The phone's locale, for the first-launch units default. Hermes and the web both expose Intl. */
function deviceLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

const Ctx = createContext<AppState | null>(null);

const KNOWN_INGREDIENTS = new Set(INGREDIENTS.map(i => i.id));
const BUNDLED_IDS = new Set(RECIPES.map(r => r.id));
const isKnownIngredient = (id: string) => KNOWN_INGREDIENTS.has(id);

/** Read back { edits, own } from storage, keeping only recipes that still make sense. */
function restoreMyRecipes(raw: unknown): { edits: Record<string, Recipe>; own: Recipe[] } {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const list = (x: unknown) =>
    (Array.isArray(x) ? x : []).map(r => sanitizeRecipe(r, isKnownIngredient)).filter((r): r is Recipe => !!r);
  const edits: Record<string, Recipe> = {};
  for (const r of list(data.edits)) if (BUNDLED_IDS.has(r.id)) edits[r.id] = r;
  const own = list(data.own).filter(r => isOwnRecipeId(r.id) && !BUNDLED_IDS.has(r.id));
  return { edits, own: own.filter((r, i) => own.findIndex(x => x.id === r.id) === i) };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH);
  const [mode, setMode] = useState<PickMode>('use');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [pantry, setPantry] = useState<string[]>([]);
  const [pantryMeal, setPantryMeal] = useState<Meal | null>(null);
  const [pantryDishType, setPantryDishType] = useState<DishType | null>(null);
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [assumeStaples, setAssumeStaples] = useState(true);
  const [stapleIds, setStapleIds] = useState<string[]>(DEFAULT_STAPLE_IDS);
  const [units, setUnits] = useState<UnitSystem>(() => defaultUnitSystem(deviceLocale()));
  const [edits, setEdits] = useState<Record<string, Recipe>>({});
  const [own, setOwn] = useState<Recipe[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [plan, setPlan] = useState<MealPlan>({});
  const [shoppingChecked, setShoppingChecked] = useState<Record<string, string[]>>({});
  const loaded = useRef(false);

  // Restore last selection + favorites from local storage.
  useEffect(() => {
    let alive = true;
    Promise.all([
      loadLastSearch(),
      loadFavorites(),
      loadPantry(),
      loadPrefs(),
      loadMyRecipes(),
      loadNotes(),
      loadPlan(),
      loadShopping(),
    ]).then(([s, f, p, prefs, mine, n, pl, shop]) => {
      if (!alive) return;
      const restored = restoreMyRecipes(mine);
      const knownRecipes = new Set([...BUNDLED_IDS, ...restored.own.map(r => r.id)]);
      setEdits(restored.edits);
      setOwn(restored.own);
      setNotes(
        Object.fromEntries(
          Object.entries(n && typeof n === 'object' ? (n as Record<string, unknown>) : {}).filter(
            (e): e is [string, string] => knownRecipes.has(e[0]) && typeof e[1] === 'string' && !!e[1].trim(),
          ),
        ),
      );
      setPlan(sanitizePlan(pl, knownRecipes));
      setShoppingChecked(
        Object.fromEntries(
          Object.entries(shop && typeof shop === 'object' ? (shop as Record<string, unknown>) : {})
            .filter(([week]) => /^\d{4}-\d{2}-\d{2}$/.test(week))
            .map(([week, ids]) => [week, resolveFavoriteIds(ids, new Set(Array.isArray(ids) ? ids : []))]),
        ),
      );
      setSearch(sanitizeSearch(s, KNOWN_INGREDIENTS, MEALS, DISH_TYPES));
      setFavorites(resolveFavoriteIds(f, knownRecipes));
      setPantry(resolveFavoriteIds(p, KNOWN_INGREDIENTS));
      const pr = (prefs && typeof prefs === 'object' ? prefs : {}) as Record<string, unknown>;
      if (typeof pr.pantryMeal === 'string' && (MEALS as readonly string[]).includes(pr.pantryMeal))
        setPantryMeal(pr.pantryMeal as Meal);
      if (typeof pr.pantryDishType === 'string' && (DISH_TYPES as readonly string[]).includes(pr.pantryDishType))
        setPantryDishType(pr.pantryDishType as DishType);
      if (typeof pr.assumeStaples === 'boolean') setAssumeStaples(pr.assumeStaples);
      if (Array.isArray(pr.stapleIds)) setStapleIds(resolveFavoriteIds(pr.stapleIds, KNOWN_INGREDIENTS));
      if (typeof pr.units === 'string' && (UNIT_SYSTEMS as readonly string[]).includes(pr.units))
        setUnits(pr.units as UnitSystem);
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
    if (loaded.current) savePrefs({ pantryMeal, pantryDishType, assumeStaples, stapleIds, units });
  }, [pantryMeal, pantryDishType, assumeStaples, stapleIds, units]);

  useEffect(() => {
    if (loaded.current) saveMyRecipes({ edits: Object.values(edits), own });
  }, [edits, own]);

  useEffect(() => {
    if (loaded.current) saveNotes(notes);
  }, [notes]);

  useEffect(() => {
    if (loaded.current) savePlan(plan);
  }, [plan]);

  useEffect(() => {
    if (loaded.current) saveShopping(shoppingChecked);
  }, [shoppingChecked]);

  const library = useMemo(() => buildLibrary(RECIPES, edits, own), [edits, own]);
  const libraryById = useMemo(() => new Map(library.map(r => [r.id, r])), [library]);

  const saveRecipe = useCallback((recipe: Recipe): string => {
    const clean = cleanRecipe(recipe);
    const original = recipesById.get(clean.id);
    if (original) setEdits(e => ({ ...e, [clean.id]: { ...clean, source: original.source } }));
    else {
      const mine = { ...clean, source: { type: 'user' as const, note: 'Your recipe' } };
      setOwn(list => [mine, ...list.filter(r => r.id !== clean.id)]);
    }
    return clean.id;
  }, []);

  const deleteRecipe = useCallback((id: string) => {
    if (!isOwnRecipeId(id)) return;
    setOwn(list => list.filter(r => r.id !== id));
    setFavorites(f => f.filter(x => x !== id));
    setPlan(p => removeRecipeFromPlan(p, id));
    setNotes(({ [id]: _gone, ...rest }) => rest);
  }, []);

  const staples = useMemo<ReadonlySet<string>>(
    () => new Set(assumeStaples ? stapleIds : []),
    [assumeStaples, stapleIds],
  );
  const effectivePantry = useMemo(() => [...new Set([...pantry, ...staples])], [pantry, staples]);

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
      clearUse: () => setSearch(s => ({ ...s, useIds: [] })),
      moveIngredient: (id, to) => setSearch(s => addIngredient(s, id, to)),
      clearAll: () => setSearch(EMPTY_SEARCH),
      favorites,
      isFavorite: id => favorites.includes(id),
      toggleFavorite: id => setFavorites(f => (f.includes(id) ? f.filter(x => x !== id) : [id, ...f])),
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
      assumeStaples,
      setAssumeStaples,
      stapleIds,
      toggleStaple: id => setStapleIds(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])),
      resetStaples: () => setStapleIds(DEFAULT_STAPLE_IDS),
      staples,
      effectivePantry,
      units,
      setUnits,
      library,
      recipeById: id => libraryById.get(id),
      originalRecipe: id => recipesById.get(id),
      isEdited: id => !!edits[id],
      isOwn: id => isOwnRecipeId(id) && libraryById.has(id),
      ownRecipes: own,
      editedIds: Object.keys(edits),
      saveRecipe,
      resetRecipe: id => setEdits(({ [id]: _gone, ...rest }) => rest),
      deleteRecipe,
      noteFor: id => notes[id] ?? '',
      setNote: (id, text) =>
        setNotes(prev => {
          if ((prev[id] ?? '') === (text.trim() ? text : '')) return prev; // unchanged: no re-render
          const { [id]: _old, ...rest } = prev;
          return text.trim() ? { ...rest, [id]: text } : rest;
        }),
      plan,
      planRecipe: (day, slot, recipeId) => setPlan(p => addToPlan(p, day, slot, recipeId)),
      unplanRecipe: (day, slot, recipeId) => setPlan(p => removeFromPlan(p, day, slot, recipeId)),
      shoppingChecked,
      toggleShoppingItem: (week, ingredientId) =>
        setShoppingChecked(all => {
          const list = all[week] ?? [];
          const next = list.includes(ingredientId) ? list.filter(x => x !== ingredientId) : [...list, ingredientId];
          return { ...all, [week]: next };
        }),
      clearShoppingChecks: week => setShoppingChecked(({ [week]: _gone, ...rest }) => rest),
    }),
    [
      ready,
      search,
      mode,
      pick,
      favorites,
      pantry,
      pantryMeal,
      pantryDishType,
      shuffleSeed,
      assumeStaples,
      stapleIds,
      staples,
      effectivePantry,
      units,
      library,
      libraryById,
      edits,
      own,
      saveRecipe,
      deleteRecipe,
      notes,
      plan,
      shoppingChecked,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}
