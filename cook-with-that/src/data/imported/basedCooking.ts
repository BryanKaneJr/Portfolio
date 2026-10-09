import { opt, r } from '../recipeBuilders';
import type { Recipe, RecipeSource } from '../types';

/**
 * Adapted from Based Cooking (based.cooking, Unlicense / public domain).
 *
 * Drafted by `npm run import:draft -- based-cooking …`, then edited by hand: tags, times,
 * descriptions and wording are ours to change, the origin stays. Every ingredient a step
 * uses must be listed (Avoid filters on the list). Every recipe keeps "needs culinary
 * review" in its note until someone has cooked or checked it.
 */
const from = (key: string, title: string, author?: string): RecipeSource => ({
  type: 'licensed',
  license: 'Unlicense (public domain)',
  note: 'Adapted from Based Cooking — needs culinary review',
  origin: { collection: 'based-cooking', key, title, ...(author ? { author } : {}) },
});

export const BASED_COOKING_RECIPES: Recipe[] = [];
