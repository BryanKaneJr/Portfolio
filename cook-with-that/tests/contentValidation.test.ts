import { INGREDIENTS } from '../src/data/ingredients';
import { shownDishTypes } from '../src/data/labels';
import { RECIPES, SOURCE_RECIPES, WRITTEN_RECIPES, withMealDishTypes } from '../src/data/recipes';
import { validateContent } from '../src/logic/validateContent';
import { resolveFavoriteIds } from '../src/state/favoritesStorage';
import { recipe } from './fixtures';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

describe('bundled content', () => {
  test('#15 shipped library passes validation (unique IDs, every ingredient exists)', () => {
    expect(validateContent(INGREDIENTS, RECIPES)).toEqual([]);
  });

  test('validator catches unknown ingredients, duplicate IDs, empty steps and bad times', () => {
    const bad = recipe({ id: 'dup', req: ['ghost'] });
    bad.steps = [''];
    bad.prepMinutes = -1;
    const issues = validateContent(INGREDIENTS, [bad, recipe({ id: 'dup', req: ['salt'] })]).map(i => i.message);
    expect(issues).toEqual(
      expect.arrayContaining([
        'unknown ingredientId "ghost"',
        'duplicate recipe id',
        'empty step',
        'implausible prepMinutes',
      ]),
    );
  });

  test('validator catches aliases shared by two ingredients', () => {
    const ings = [
      { id: 'milk', name: 'Milk', category: 'dairy' as const, aliases: [] },
      { id: 'almond_milk', name: 'Almond milk', category: 'dairy' as const, aliases: ['milk'] },
    ];
    expect(validateContent(ings, []).map(i => i.message)).toContain('name/alias "milk" already belongs to "milk"');
  });

  test('every recipe has rights/source metadata', () => {
    for (const r of RECIPES) expect(['original', 'licensed']).toContain(r.source.type);
  });
});

describe('dish types', () => {
  test('every recipe has one, so no Dish type filter hides it for good', () => {
    expect(RECIPES.filter(r => !r.dishTypes.length).map(r => r.id)).toEqual([]);
    const bare = recipe({ id: 'bare', dishTypes: [], req: ['salt'] });
    expect(validateContent(INGREDIENTS, [bare]).map(i => i.message)).toContain('needs at least one dish type');
  });

  test('desserts, sides and appetizers carry their dish type, without saying it twice on screen', () => {
    const r = withMealDishTypes(recipe({ id: 'pudding', meals: ['dessert', 'snack'], dishTypes: [] }));
    expect(r.dishTypes).toEqual(['sweets']);
    expect(shownDishTypes(r)).toEqual([]);
    const fries = withMealDishTypes(recipe({ id: 'fries', meals: ['side'], dishTypes: ['fried'] }));
    expect(fries.dishTypes).toEqual(['fried', 'sides']);
    expect(shownDishTypes(fries)).toEqual(['fried']);
    for (const x of RECIPES) {
      if (x.meals.includes('dessert')) expect(x.dishTypes).toContain('sweets');
      if (x.meals.includes('side')) expect(x.dishTypes).toContain('sides');
      if (x.meals.includes('appetizer')) expect(x.dishTypes).toContain('appetizers');
    }
  });
});

describe('favorites', () => {
  test('#16 (logic) saved IDs resolve to valid recipes; stale and duplicate IDs are dropped', () => {
    const known = new Set(RECIPES.map(r => r.id));
    const first = RECIPES[0].id;
    expect(resolveFavoriteIds([first, 'deleted-recipe', first, 42], known)).toEqual([first]);
    expect(resolveFavoriteIds('garbage', known)).toEqual([]);
  });
});

describe('popularity ranking', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { INGREDIENTS_BY_POPULARITY } = require('../src/data/popularity');
  test('every ranked ID exists in the catalog and appears once', () => {
    const known = new Set(INGREDIENTS.map(i => i.id));
    expect(INGREDIENTS_BY_POPULARITY.filter((id: string) => !known.has(id))).toEqual([]);
    expect(new Set(INGREDIENTS_BY_POPULARITY).size).toBe(INGREDIENTS_BY_POPULARITY.length);
  });
  test('salt, pepper and water are never suggested', () => {
    expect(INGREDIENTS_BY_POPULARITY).not.toEqual(expect.arrayContaining(['salt']));
    for (const id of ['salt', 'black_pepper', 'water']) expect(INGREDIENTS_BY_POPULARITY).not.toContain(id);
  });
});

describe('our written recipes stay apart from adapted ones (owner decision 17)', () => {
  test('each list holds only its own kind', () => {
    for (const r of WRITTEN_RECIPES)
      expect([r.id, r.source.type, r.source.origin]).toEqual([r.id, 'original', undefined]);
    for (const r of SOURCE_RECIPES) {
      expect([r.id, r.source.type]).toEqual([r.id, 'licensed']);
      expect(r.source.origin?.collection).toBeTruthy();
    }
    const written = new Set(WRITTEN_RECIPES.map(r => r.id));
    expect(SOURCE_RECIPES.filter(r => written.has(r.id)).map(r => r.id)).toEqual([]);
  });

  test('the adapted recipes alone still make a valid library, so the switch can be turned off', () => {
    const sourceOnly = SOURCE_RECIPES.map(withMealDishTypes);
    expect(validateContent(INGREDIENTS, sourceOnly)).toEqual([]);
    expect(sourceOnly.filter(r => !r.dishTypes.length).map(r => r.id)).toEqual([]);
  });
});
