export const INGREDIENT_CATEGORIES = ['produce', 'protein', 'dairy', 'grain', 'pantry', 'spice'] as const;
export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export const MEALS = ['breakfast', 'lunch', 'dinner', 'dessert', 'appetizer', 'snack', 'side'] as const;
export type Meal = (typeof MEALS)[number];

export const DISH_TYPES = [
  'pasta',
  'soup',
  'salad',
  'sandwich',
  'skillet',
  'bake',
  'one_pot',
  'bowl',
  'grilled',
  'fried',
  'dip',
  'appetizers',
  'sides',
  'baked_goods',
  'sweets',
] as const;
export type DishType = (typeof DISH_TYPES)[number];

/**
 * Dish types that follow from a meal: every dessert is also a Desserts dish, every side a Sides dish,
 * every appetizer an Appetizers dish. `RECIPES` adds them (see `withMealDishTypes`), so recipe files don't list them.
 */
export const MEAL_DISH_TYPES: Partial<Record<Meal, DishType>> = {
  dessert: 'sweets',
  side: 'sides',
  appetizer: 'appetizers',
};

export type Ingredient = {
  id: string;
  name: string;
  category: IngredientCategory;
  /** Ordinary synonyms only (scallion / green onion). Never substitutions. */
  aliases: string[];
};

export type RecipeIngredient = {
  /** Canonical ID used for matching. */
  ingredientId: string;
  /** What the cook actually buys/uses, e.g. "boneless chicken thighs". */
  displayName: string;
  /** Exact authored quantity, e.g. "1 lb". */
  quantityText: string;
  preparation?: string;
  optional: boolean;
};

/** Where an imported recipe came from: enough to credit it and to find the original again. */
export type RecipeOrigin = {
  /** Key in RECIPE_COLLECTIONS (src/data/collections.ts). */
  collection: string;
  /** The entry's stable key inside that collection (e.g. its file name). */
  key: string;
  /** Title and author as the collection credits them. */
  title: string;
  author?: string;
};

export type RecipeSource = {
  /** `user`: written or edited by the person using the app (stored on the phone, never bundled). */
  type: 'original' | 'licensed' | 'user';
  note: string;
  license?: string;
  /** Set on every recipe imported from an outside collection. */
  origin?: RecipeOrigin;
};

export type Recipe = {
  id: string;
  title: string;
  description: string;
  meals: Meal[];
  dishTypes: DishType[];
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  imageAsset?: string;
  source: RecipeSource;
};

export type SearchState = {
  meal: Meal | null;
  dishType: DishType | null;
  useIds: string[];
  avoidIds: string[];
};

export const EMPTY_SEARCH: SearchState = {
  meal: null,
  dishType: null,
  useIds: [],
  avoidIds: [],
};

/** Adds the dish types a recipe's meals imply (a dessert is also a Desserts dish); see `MEAL_DISH_TYPES`. */
export function withMealDishTypes(recipe: Recipe): Recipe {
  const implied = recipe.meals.flatMap(m => MEAL_DISH_TYPES[m] ?? []).filter(d => !recipe.dishTypes.includes(d));
  return implied.length ? { ...recipe, dishTypes: [...recipe.dishTypes, ...implied] } : recipe;
}
