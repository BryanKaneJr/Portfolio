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
import { COMFORT_RECIPES } from './comfort';
import { BREAKFAST_RECIPES } from './breakfast';
import { GRILL_FRY_RECIPES } from './grillFry';
import { SOUPS_SALADS_DIPS_RECIPES } from './soupsSaladsDips';
import { WORLD_KITCHEN_RECIPES } from './worldKitchen';
import { DESSERTS_SNACKS_RECIPES } from './dessertsSnacks';
import { TIGER_SAUCE_RECIPES } from './tigerSauce';
import { OWNER_RECIPES } from './ownerRecipes';

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
  ...COMFORT_RECIPES,
  ...BREAKFAST_RECIPES,
  ...GRILL_FRY_RECIPES,
  ...SOUPS_SALADS_DIPS_RECIPES,
  ...WORLD_KITCHEN_RECIPES,
  ...DESSERTS_SNACKS_RECIPES,
  ...TIGER_SAUCE_RECIPES,
  ...OWNER_RECIPES,
];
