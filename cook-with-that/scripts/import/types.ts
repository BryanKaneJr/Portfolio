import type { DishType, Meal } from '../../src/data/types';

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

export type BlockReason =
  | { kind: 'not_in_catalog'; key: string }
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
  /** Fields the editor must fill in or check (quantities, times, meal tag…). */
  todo: string[];
};
