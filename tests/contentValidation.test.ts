import { INGREDIENTS } from '../src/data/ingredients';
import { RECIPES } from '../src/data/recipes';
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
      expect.arrayContaining(['unknown ingredientId "ghost"', 'duplicate recipe id', 'empty step', 'implausible prepMinutes']),
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

describe('favorites', () => {
  test('#16 (logic) saved IDs resolve to valid recipes; stale and duplicate IDs are dropped', () => {
    const known = new Set(RECIPES.map(r => r.id));
    const first = RECIPES[0].id;
    expect(resolveFavoriteIds([first, 'deleted-recipe', first, 42], known)).toEqual([first]);
    expect(resolveFavoriteIds('garbage', known)).toEqual([]);
  });
});
