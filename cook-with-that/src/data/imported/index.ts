import type { Recipe } from '../types';
import { BASED_COOKING_RECIPES } from './basedCooking';
import { NHLBI_RECIPES } from './nhlbi';

/** Recipes imported from open collections (scripts/import, docs/recipe-import.md). */
export const IMPORTED_RECIPES: Recipe[] = [...BASED_COOKING_RECIPES, ...NHLBI_RECIPES];
