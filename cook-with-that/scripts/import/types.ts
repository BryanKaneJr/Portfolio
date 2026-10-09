import type { DishType, IngredientCategory, Meal } from '../../src/data/types';

/** One recipe as a source adapter reads it: free text, nothing mapped yet. */
export type RawRecipe = {
  /** Stable key inside the source (file slug, record number). Never changes between imports. */
  key: string;
  title: string;
  author?: string;
  /** The source's own intro or headnote, if any. */
  description?: string;
  /** Where the original lives, without a URL scheme (src/ must stay URL-free), e.g. "based.cooking/chili". */
  location: string;
  ingredientLines: string[];
  steps: string[];
  servings?: number;
  prepMinutes?: number;
  cookMinutes?: number;
  tags: string[];
};

export type StagedIngredient = {
  raw: string;
  ids: string[];
  displayName: string;
  quantityText: string;
  preparation?: string;
  optional: boolean;
};

/** A catalog entry the draft step creates for a reviewed ingredient the catalog doesn't have yet. */
export type CatalogAddition = {
  id: string;
  name: string;
  category: IngredientCategory;
  aliases: string[];
};

export type BlockReason =
  /** Reviewed, but too vague to index ("cheese", "vinegar"): the editor names the specific food. */
  | { kind: 'ambiguous'; key: string }
  /** Nobody has reviewed this wording yet (scripts/import/ingredient-map.ts). */
  | { kind: 'unmapped'; key: string; suggestion?: string }
  | { kind: 'excluded'; reason: string }
  | { kind: 'no_ingredients' }
  | { kind: 'no_steps' };

/** A raw recipe after parsing and mapping, plus everything still missing. */
export type Candidate = {
  key: string;
  title: string;
  author?: string;
  description?: string;
  location: string;
  ingredients: StagedIngredient[];
  steps: string[];
  servings?: number;
  prepMinutes?: number;
  cookMinutes?: number;
  tags: string[];
  meals: Meal[];
  dishTypes: DishType[];
  /** Hard blockers: the recipe can't be imported until these are fixed. */
  blocked: BlockReason[];
  /** Ingredients the catalog gains when this recipe is drafted (owner rule: add what a recipe needs). */
  adds: CatalogAddition[];
  /** Fields the editor must fill in or check (quantities, times, meal tag…). */
  todo: string[];
};
