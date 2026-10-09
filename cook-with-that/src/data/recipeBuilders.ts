import type { RecipeIngredient } from './types';

/** Required ingredient. */
export const r = (
  ingredientId: string,
  displayName: string,
  quantityText: string,
  preparation?: string,
): RecipeIngredient => ({
  ingredientId,
  displayName,
  quantityText,
  ...(preparation ? { preparation } : {}),
  optional: false,
});

/** Optional ingredient (garnish, topping, serve-with). */
export const opt = (
  ingredientId: string,
  displayName: string,
  quantityText: string,
  preparation?: string,
): RecipeIngredient => ({
  ...r(ingredientId, displayName, quantityText, preparation),
  optional: true,
});
