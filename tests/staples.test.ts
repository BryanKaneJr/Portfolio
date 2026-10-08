import { INGREDIENTS } from '../src/data/ingredients';
import { DEFAULT_STAPLE_IDS } from '../src/data/staples';
import { findExactMatches, runSearch, splitRequired } from '../src/logic/matchRecipes';
import { searchPantry } from '../src/logic/pantry';
import { ids, recipe, search } from './fixtures';

const STAPLES = new Set(['salt', 'olive_oil', 'butter']);

describe('kitchen staples', () => {
  test('every default staple exists in the catalog, no duplicates', () => {
    const known = new Set(INGREDIENTS.map(i => i.id));
    expect(DEFAULT_STAPLE_IDS.filter(id => !known.has(id))).toEqual([]);
    expect(new Set(DEFAULT_STAPLE_IDS).size).toBe(DEFAULT_STAPLE_IDS.length);
  });

  test('staples are moved out of "also need" but still reported separately', () => {
    const r = recipe({ id: 'x', req: ['chicken', 'salt', 'olive_oil', 'parmesan'] });
    const split = splitRequired(r, ['chicken'], STAPLES);
    expect(split.extras.map(i => i.ingredientId)).toEqual(['parmesan']);
    expect(split.staples.map(i => i.ingredientId)).toEqual(['salt', 'olive_oil']);
    const [res] = runSearch([r], search({ useIds: ['chicken'] }), STAPLES).exact;
    expect(res.alsoNeed.map(i => i.ingredientId)).toEqual(['parmesan']);
    expect(res.staplesUsed.map(i => i.ingredientId)).toEqual(['salt', 'olive_oil']);
  });

  test('with no staples (setting off) everything is listed, as before', () => {
    const r = recipe({ id: 'x', req: ['chicken', 'salt'] });
    const [res] = runSearch([r], search({ useIds: ['chicken'] })).exact;
    expect(res.alsoNeed.map(i => i.ingredientId)).toEqual(['salt']);
  });

  test('ranking ignores staples: a staple-heavy recipe is not penalised', () => {
    const recipes = [
      recipe({ id: 'needs-parm', title: 'A', req: ['chicken', 'parmesan'] }),
      recipe({ id: 'staples-only', title: 'B', req: ['chicken', 'salt', 'olive_oil', 'butter'] }),
    ];
    expect(ids(findExactMatches(recipes, search({ useIds: ['chicken'] }), STAPLES))).toEqual(['staples-only', 'needs-parm']);
  });

  test('Avoid always wins over staples', () => {
    const recipes = [recipe({ id: 'buttery', req: ['chicken', 'butter'] }), recipe({ id: 'plain', req: ['chicken'] })];
    expect(ids(runSearch(recipes, search({ useIds: ['chicken'], avoidIds: ['butter'] }), STAPLES).exact)).toEqual(['plain']);
  });

  test('pantry mode: staples + pantry together decide can-make', () => {
    const recipes = [recipe({ id: 'eggs-butter-salt', req: ['eggs', 'butter', 'salt'] })];
    const pantry = ['eggs'];
    expect(ids(searchPantry(recipes, pantry, { meal: null, dishType: null }, 1).canMake)).toEqual([]);
    expect(ids(searchPantry(recipes, [...pantry, ...STAPLES], { meal: null, dishType: null }, 1).canMake)).toEqual(['eggs-butter-salt']);
  });
});
