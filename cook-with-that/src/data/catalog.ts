import { buildIngredientIndex } from '../logic/normalizeIngredient';
import { INGREDIENTS } from './ingredients';
import { RECIPES } from './recipes';

/** Immutable, bundled catalog — built once at startup, fully offline. */
export const ingredientIndex = buildIngredientIndex(INGREDIENTS);
export const recipesById = new Map(RECIPES.map(r => [r.id, r]));
export { INGREDIENTS, RECIPES };

export function ingredientName(id: string): string {
  return ingredientIndex.byId.get(id)?.name ?? id;
}
