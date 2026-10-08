import type { DishType, Ingredient, Meal, Recipe, RecipeIngredient, SearchState } from '../src/data/types';
import { EMPTY_SEARCH } from '../src/data/types';

/** Small, purpose-built fixtures. Independent of the real recipe library. */

export const FIX_INGREDIENTS: Ingredient[] = [
  { id: 'chicken', name: 'Chicken', category: 'protein', aliases: ['chicken breast'] },
  { id: 'garlic', name: 'Garlic', category: 'produce', aliases: [] },
  { id: 'garlic_powder', name: 'Garlic powder', category: 'spice', aliases: [] },
  { id: 'spinach', name: 'Spinach', category: 'produce', aliases: ['baby spinach'] },
  { id: 'heavy_cream', name: 'Cream', category: 'dairy', aliases: ['heavy cream'] },
  { id: 'pasta', name: 'Pasta', category: 'grain', aliases: ['spaghetti'] },
  { id: 'parmesan', name: 'Parmesan', category: 'dairy', aliases: [] },
  { id: 'green_onion', name: 'Green onion', category: 'produce', aliases: ['scallion', 'scallions'] },
  { id: 'salt', name: 'Salt', category: 'spice', aliases: [], basic: true },
  { id: 'olive_oil', name: 'Olive oil', category: 'pantry', aliases: [], basic: true },
  { id: 'rice', name: 'Rice', category: 'grain', aliases: [] },
  { id: 'eggs', name: 'Eggs', category: 'protein', aliases: ['egg'] },
  { id: 'tomato', name: 'Tomato', category: 'produce', aliases: [] },
];

const ing = (ingredientId: string, optional = false): RecipeIngredient => ({
  ingredientId,
  displayName: ingredientId.replace('_', ' '),
  quantityText: '1',
  optional,
});

type Spec = {
  id: string;
  meals?: Meal[];
  dishTypes?: DishType[];
  req?: string[];
  opt?: string[];
  minutes?: number;
  title?: string;
};

export function recipe({ id, meals = ['dinner'], dishTypes = ['skillet'], req = [], opt = [], minutes = 20, title }: Spec): Recipe {
  return {
    id,
    title: title ?? id,
    description: `${id} description`,
    meals,
    dishTypes,
    prepMinutes: 5,
    cookMinutes: minutes - 5,
    servings: 2,
    ingredients: [...req.map(i => ing(i)), ...opt.map(i => ing(i, true))],
    steps: ['Do the first thing properly.', 'Do the second thing properly.'],
    source: { type: 'original', note: 'test fixture' },
  };
}

export const search = (s: Partial<SearchState>): SearchState => ({ ...EMPTY_SEARCH, ...s });
export const ids = (rs: { recipe: Recipe }[]) => rs.map(r => r.recipe.id);
