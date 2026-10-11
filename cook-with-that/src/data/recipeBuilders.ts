import type { RecipeIngredient, RecipeSource } from './types';

/** Source metadata for a recipe written for the app (seed or src/data/originals). */
export const ORIGINAL_DRAFT: RecipeSource = {
  type: 'original',
  note: 'Original draft for Cook With That — needs culinary review',
};

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
