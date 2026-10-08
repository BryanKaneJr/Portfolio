import type { DishType, IngredientCategory, Meal } from './types';

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
  baked_goods: 'Baked Goods',
};

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: 'Produce',
  protein: 'Proteins',
  dairy: 'Dairy & Eggs',
  grain: 'Grains & Pasta',
  pantry: 'Canned & Pantry',
  spice: 'Spices & Condiments',
};
