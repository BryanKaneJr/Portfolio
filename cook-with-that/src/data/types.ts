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
  'baked_goods',
] as const;
export type DishType = (typeof DISH_TYPES)[number];

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
  type: 'original' | 'licensed';
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
