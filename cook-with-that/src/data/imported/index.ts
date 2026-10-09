import type { Recipe } from '../types';
import { BASED_COOKING_RECIPES } from './basedCooking';

/** Recipes imported from open collections (scripts/import, docs/recipe-import.md). */
export const IMPORTED_RECIPES: Recipe[] = [...BASED_COOKING_RECIPES];
