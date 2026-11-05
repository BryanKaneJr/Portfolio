import { buildIngredientIndex } from '../logic/normalizeIngredient';
import { customIngredientName, isCustomIngredient } from '../logic/userRecipes';
import type { IngredientCategory } from './types';
import { INGREDIENTS } from './ingredients';
import { RECIPES } from './recipes';

/** Immutable, bundled catalog — built once at startup, fully offline. */
export const ingredientIndex = buildIngredientIndex(INGREDIENTS);
export const recipesById = new Map(RECIPES.map(r => [r.id, r]));
export { INGREDIENTS, RECIPES };

export function ingredientName(id: string): string {
  if (isCustomIngredient(id)) return customIngredientName(id);
  return ingredientIndex.byId.get(id)?.name ?? id;
}

/** Name and shopping aisle for an ingredient ID; ingredients a person typed in go under "Other". */
export function ingredientInfo(id: string): { name: string; category: IngredientCategory | 'other' } {
  return { name: ingredientName(id), category: ingredientIndex.byId.get(id)?.category ?? 'other' };
}
