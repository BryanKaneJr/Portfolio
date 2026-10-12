import { ingredientInfo, ingredientName, RECIPES } from '../src/data/catalog';
import { EMPTY_SEARCH, type Recipe } from '../src/data/types';
import { countExact, findExactMatches } from '../src/logic/matchRecipes';
import {
  addDays,
  addToPlan,
  dateKey,
  parseDateKey,
  removeFromPlan,
  removeRecipeFromPlan,
  sanitizePlan,
  shoppingList,
  suggestSlot,
  weekDays,
  weekStart,
} from '../src/logic/mealPlan';
import { searchPantry } from '../src/logic/pantry';
import {
  buildLibrary,
  cleanRecipe,
  customIngredientId,
  newRecipeId,
  recipeProblems,
  sanitizeRecipe,
} from '../src/logic/userRecipes';
import { recipe } from './fixtures';

const known = (id: string) => ['salt', 'butter', 'olive_oil', 'chicken', 'rice', 'eggs'].includes(id);

describe('your own recipes and your versions', () => {
  const bundled = RECIPES.find(r => r.ingredients.some(i => i.ingredientId === 'butter' && !i.optional))!;
  const butterFree: Recipe = {
    ...bundled,
    ingredients: bundled.ingredients.map(i =>
      i.ingredientId === 'butter' ? { ...i, ingredientId: 'olive_oil', displayName: 'olive oil' } : i,
    ),
  };

  test('an edit replaces the bundled recipe everywhere, keeping its place and ID', () => {
    const lib = buildLibrary(RECIPES, { [bundled.id]: butterFree }, []);
    expect(lib).toHaveLength(RECIPES.length);
    expect(lib.find(r => r.id === bundled.id)!.ingredients.some(i => i.ingredientId === 'butter')).toBe(false);
    expect(lib.findIndex(r => r.id === bundled.id)).toBe(RECIPES.findIndex(r => r.id === bundled.id));
  });

  test('Avoid, Use and the pantry read your version (the owner chose this)', () => {
    const avoidButter = { ...EMPTY_SEARCH, avoidIds: ['butter'] };
    const lib = buildLibrary(RECIPES, { [bundled.id]: butterFree }, []);
    expect(findExactMatches(RECIPES, avoidButter).some(r => r.recipe.id === bundled.id)).toBe(false);
    expect(findExactMatches(lib, avoidButter).some(r => r.recipe.id === bundled.id)).toBe(true);
    const useButter = { ...EMPTY_SEARCH, useIds: ['butter'] };
    expect(findExactMatches(RECIPES, useButter).some(r => r.recipe.id === bundled.id)).toBe(true);
    expect(findExactMatches(lib, useButter).some(r => r.recipe.id === bundled.id)).toBe(false);
    expect(countExact(lib, useButter)).toBe(countExact(RECIPES, useButter) - 1);
    const pantry = butterFree.ingredients.filter(i => !i.optional).map(i => i.ingredientId);
    const canMake = searchPantry(lib, pantry, { meal: null, dishType: null }, 1).canMake;
    expect(canMake.some(r => r.recipe.id === bundled.id)).toBe(true);
  });

  test('recipes you write join the library with their meal-implied dish types', () => {
    const mine = recipe({ id: 'my-pudding', meals: ['dessert'], dishTypes: [], req: ['eggs'] });
    const lib = buildLibrary(RECIPES, {}, [mine]);
    expect(lib).toHaveLength(RECIPES.length + 1);
    expect(lib.at(-1)!.dishTypes).toEqual(['sweets']);
  });

  test('new IDs come from the title and never collide', () => {
    expect(newRecipeId("Grandma's Chili!", new Set())).toBe('my-grandma-s-chili');
    expect(newRecipeId('Chili', new Set(['my-chili']))).toBe('my-chili-2');
    expect(newRecipeId('   ', new Set())).toBe('my-recipe');
  });

  test('ingredients the catalog lacks are kept by name but invisible to search', () => {
    const id = customIngredientId('Gochujang  Paste');
    expect(id).toBe('custom:gochujang paste');
    expect(ingredientName(id)).toBe('Gochujang paste');
    expect(ingredientInfo(id).category).toBe('other');
  });

  test('the editor says what is missing, in plain words', () => {
    const blank = recipe({ id: 'x', dishTypes: [], meals: [] });
    blank.title = '';
    blank.steps = [''];
    blank.prepMinutes = 0;
    blank.cookMinutes = 0;
    expect(recipeProblems(blank)).toEqual([
      'Give it a name.',
      'Add at least one ingredient.',
      'Add at least one step.',
      'Pick at least one meal.',
      'Pick a dish type.',
      'Add a prep or cook time.',
    ]);
    const ok = recipe({ id: 'y', req: ['salt'] });
    expect(recipeProblems(ok)).toEqual([]);
    // A side needs no dish type picked: Sides comes with the meal.
    expect(recipeProblems({ ...ok, meals: ['side'], dishTypes: [] })).toEqual([]);
  });

  test('saving trims text and drops blank steps', () => {
    const r = cleanRecipe({ ...recipe({ id: 'z', req: ['salt'] }), title: '  Soup ', steps: [' Stir. ', '  '] });
    expect(r.title).toBe('Soup');
    expect(r.steps).toEqual(['Stir.']);
  });

  test('storage that went bad never crashes the app', () => {
    expect(sanitizeRecipe(null, known)).toBeNull();
    expect(sanitizeRecipe({ id: 'a' }, known)).toBeNull();
    const r = sanitizeRecipe(
      {
        id: 'my-a',
        title: 'A',
        meals: ['dinner', 'brunch'],
        dishTypes: ['skillet', 'nope'],
        servings: -3,
        prepMinutes: 'ten',
        ingredients: [
          { ingredientId: 'salt', displayName: 'salt', quantityText: '1 tsp' },
          { ingredientId: 'unicorn', displayName: 'unicorn', quantityText: '1' },
          { ingredientId: 'custom:yuzu', displayName: 'yuzu', quantityText: '1' },
          'junk',
        ],
        steps: ['Cook.', 7, ''],
      },
      known,
    )!;
    expect(r.meals).toEqual(['dinner']);
    expect(r.dishTypes).toEqual(['skillet']);
    expect(r.servings).toBe(1);
    expect(r.prepMinutes).toBe(0);
    expect(r.ingredients.map(i => i.ingredientId)).toEqual(['salt', 'custom:yuzu']);
    expect(r.steps).toEqual(['Cook.']);
  });
});

describe('meal plan', () => {
  test('weeks start on Monday, in local dates', () => {
    expect(weekStart('2026-10-15')).toBe('2026-10-12'); // Thursday → Monday
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // Sunday → the Monday before
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
    expect(weekDays('2026-10-12')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09'); // across a US clock change
    expect(dateKey(parseDateKey('2026-01-05'))).toBe('2026-01-05');
  });

  test('add and remove keep the plan tidy', () => {
    let plan = addToPlan({}, '2026-10-12', 'dinner', 'a');
    plan = addToPlan(plan, '2026-10-12', 'dinner', 'a'); // no duplicates in a slot
    plan = addToPlan(plan, '2026-10-12', 'lunch', 'b');
    expect(plan).toEqual({ '2026-10-12': { dinner: ['a'], lunch: ['b'] } });
    plan = removeFromPlan(plan, '2026-10-12', 'dinner', 'a');
    expect(plan).toEqual({ '2026-10-12': { lunch: ['b'] } });
    expect(removeRecipeFromPlan(plan, 'b')).toEqual({});
  });

  test('a stored plan keeps only real days, slots and recipes', () => {
    const raw = {
      '2026-10-12': { dinner: ['a', 'gone', 'a'], brunch: ['a'] },
      someday: { dinner: ['a'] },
      '2026-10-13': { lunch: 'a' },
    };
    expect(sanitizePlan(raw, new Set(['a']))).toEqual({ '2026-10-12': { dinner: ['a'] } });
    expect(sanitizePlan('junk', new Set())).toEqual({});
  });

  test('suggested slot follows the recipe’s meals', () => {
    expect(suggestSlot(recipe({ id: 'p', meals: ['breakfast', 'dinner'] }))).toBe('breakfast');
    expect(suggestSlot(recipe({ id: 'q', meals: ['dessert'] }))).toBe('dinner');
  });

  test('the shopping list leaves out what you have and optional garnish, and says who needs what', () => {
    const tacos = recipe({ id: 'tacos', req: ['chicken', 'rice', 'salt'], opt: ['eggs'] });
    const fried = recipe({ id: 'fried-rice', req: ['rice', 'eggs'] });
    tacos.ingredients.find(i => i.ingredientId === 'rice')!.quantityText = '1 cup';
    const byId = new Map([tacos, fried].map(r => [r.id, r]));
    let plan = addToPlan({}, '2026-10-12', 'dinner', 'tacos');
    plan = addToPlan(plan, '2026-10-13', 'lunch', 'fried-rice');
    plan = addToPlan(plan, '2026-10-20', 'lunch', 'fried-rice'); // next week: not on this list
    const groups = shoppingList(plan, weekDays('2026-10-12'), id => byId.get(id), new Set(['salt']), ingredientInfo);
    const items = groups.flatMap(g => g.items);
    expect(items.map(i => i.ingredientId).sort()).toEqual(['chicken', 'eggs', 'rice']);
    expect(items.find(i => i.ingredientId === 'rice')!.uses.map(u => u.recipeId)).toEqual(['tacos', 'fried-rice']);
    expect(items.find(i => i.ingredientId === 'eggs')!.uses.map(u => u.recipeId)).toEqual(['fried-rice']);
    expect(groups.map(g => g.category)).toEqual(['protein', 'grain']); // catalog aisle order; eggs are protein
  });
});
