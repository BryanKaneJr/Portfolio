import { MEAL_DISH_TYPES, type DishType, type IngredientCategory, type Meal } from './types';

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  appetizer: 'Appetizer',
  snack: 'Snack',
  side: 'Side',
};

export const DISH_TYPE_LABELS: Record<DishType, string> = {
  pasta: 'Pasta',
  soup: 'Soup',
  salad: 'Salad',
  sandwich: 'Sandwich/Wrap',
  skillet: 'Skillet',
  bake: 'Casserole/Bake',
  one_pot: 'One-Pot',
  bowl: 'Bowl',
  grilled: 'Grilled',
  fried: 'Fried',
  dip: 'Dips & Salsas',
  appetizers: 'Appetizers',
  sides: 'Sides',
  baked_goods: 'Baked Goods',
  sweets: 'Desserts',
};

/** A recipe's dish types worth showing next to its meals: "Dessert · Desserts" says the same thing twice. */
export function shownDishTypes(recipe: { meals: Meal[]; dishTypes: DishType[] }): DishType[] {
  return recipe.dishTypes.filter(d => !recipe.meals.some(m => MEAL_DISH_TYPES[m] === d));
}

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: 'Produce',
  protein: 'Proteins',
  dairy: 'Dairy & Eggs',
  grain: 'Grains & Pasta',
  pantry: 'Canned & Pantry',
  spice: 'Spices & Condiments',
};
