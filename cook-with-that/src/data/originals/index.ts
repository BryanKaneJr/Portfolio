import type { Recipe } from '../types';
import { CHICKEN_RECIPES } from './chicken';
import { BEEF_RECIPES } from './beef';
import { PORK_SEAFOOD_RECIPES } from './porkSeafood';
import { VEGETARIAN_RECIPES } from './vegetarian';
import { WORLD_RECIPES } from './world';
import { WEEKNIGHT_RECIPES } from './weeknight';
import { SIDES_APPETIZERS_RECIPES } from './sidesAppetizers';
import { BAKING_BREAKFAST_RECIPES } from './bakingBreakfast';
import { SOUPS_SALADS_SANDWICHES_RECIPES } from './soupsSaladsSandwiches';
import { BREAKFAST_SIDES_RECIPES } from './breakfastSides';
import { BAKING_RECIPES } from './baking';

/**
 * Original recipes written for the app, one file per theme so parallel writers don't collide.
 * Rules for writing them: docs/original-recipes.md.
 */
export const ORIGINAL_RECIPES: Recipe[] = [
  ...CHICKEN_RECIPES,
  ...BEEF_RECIPES,
  ...PORK_SEAFOOD_RECIPES,
  ...VEGETARIAN_RECIPES,
  ...SOUPS_SALADS_SANDWICHES_RECIPES,
  ...BREAKFAST_SIDES_RECIPES,
  ...BAKING_RECIPES,
  ...WORLD_RECIPES,
  ...WEEKNIGHT_RECIPES,
  ...SIDES_APPETIZERS_RECIPES,
  ...BAKING_BREAKFAST_RECIPES,
];
