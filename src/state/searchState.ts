import type { DishType, Meal, SearchState } from '../data/types';

export type PickMode = 'use' | 'avoid';

/**
 * Add an ingredient to the active list. If it is already in the other list it
 * moves (one atomic state change), so an ingredient can never be in both.
 * Adding something already in the target list is a no-op (no duplicates).
 */
export function addIngredient(state: SearchState, id: string, mode: PickMode): SearchState {
  const target = mode === 'use' ? state.useIds : state.avoidIds;
  if (target.includes(id)) return state;
  return mode === 'use'
    ? { ...state, useIds: [...state.useIds, id], avoidIds: state.avoidIds.filter(x => x !== id) }
    : { ...state, avoidIds: [...state.avoidIds, id], useIds: state.useIds.filter(x => x !== id) };
}

export function removeIngredient(state: SearchState, id: string): SearchState {
  return {
    ...state,
    useIds: state.useIds.filter(x => x !== id),
    avoidIds: state.avoidIds.filter(x => x !== id),
  };
}

export function setMeal(state: SearchState, meal: Meal | null): SearchState {
  return { ...state, meal };
}

export function setDishType(state: SearchState, dishType: DishType | null): SearchState {
  return { ...state, dishType };
}

export function isEmptySearch(state: SearchState): boolean {
  return !state.meal && !state.dishType && state.useIds.length === 0 && state.avoidIds.length === 0;
}

/** Drop IDs that no longer exist in the catalog (e.g. restored from an older version). */
export function sanitizeSearch(raw: unknown, knownIds: Set<string>, meals: readonly string[], dishTypes: readonly string[]): SearchState {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ids = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && knownIds.has(x)))] : [];
  const useIds = ids(obj.useIds);
  const avoidIds = ids(obj.avoidIds).filter(id => !useIds.includes(id));
  const meal = typeof obj.meal === 'string' && meals.includes(obj.meal) ? (obj.meal as Meal) : null;
  const dishType = typeof obj.dishType === 'string' && dishTypes.includes(obj.dishType) ? (obj.dishType as DishType) : null;
  return { meal, dishType, useIds, avoidIds };
}
