import { countCanMake, pantryFacetCounts, searchPantry, seededShuffle } from '../src/logic/pantry';
import { recipe } from './fixtures';

const ids = (rs: { recipe: { id: string } }[]) => rs.map(r => r.recipe.id);
const NO_FILTER = { meal: null, dishType: null };

describe('pantry mode', () => {
  const recipes = [
    recipe({ id: 'eggs-salt', req: ['eggs', 'salt'] }),
    recipe({ id: 'eggs-salt-opt-tomato', req: ['eggs', 'salt'], opt: ['tomato'] }),
    recipe({ id: 'eggs-parm', req: ['eggs', 'salt', 'parmesan'] }),
    recipe({ id: 'chicken-rice-oil', req: ['chicken', 'rice', 'olive_oil'] }),
    recipe({ id: 'lunch-eggs', meals: ['lunch'], dishTypes: ['sandwich'], req: ['eggs'] }),
  ];

  test('can-make = every REQUIRED ingredient is in the pantry; optional never blocks', () => {
    const r = searchPantry(recipes, ['eggs', 'salt'], NO_FILTER, 1);
    expect(ids(r.canMake).sort()).toEqual(['eggs-salt', 'eggs-salt-opt-tomato', 'lunch-eggs']);
  });

  test('basics are never assumed: missing salt means not can-make', () => {
    const r = searchPantry(recipes, ['eggs'], NO_FILTER, 1);
    expect(ids(r.canMake)).toEqual(['lunch-eggs']);
    expect(ids(r.oneShort).sort()).toEqual(['eggs-salt', 'eggs-salt-opt-tomato']);
    expect(r.oneShort[0].missing.map(m => m.ingredientId)).toEqual(['salt']);
  });

  test('one-short lists exactly one missing required ingredient, never two+', () => {
    const r = searchPantry(recipes, ['eggs', 'salt'], NO_FILTER, 1);
    expect(ids(r.oneShort)).toEqual(['eggs-parm']);
    expect(ids(r.oneShort)).not.toContain('chicken-rice-oil');
  });

  test('meal and dish type narrow the list; counts match', () => {
    const f = { meal: 'lunch' as const, dishType: null };
    const r = searchPantry(recipes, ['eggs', 'salt'], f, 1);
    expect(ids(r.canMake)).toEqual(['lunch-eggs']);
    expect(countCanMake(recipes, ['eggs', 'salt'], f)).toBe(1);
    const counts = pantryFacetCounts(recipes, ['eggs', 'salt'], NO_FILTER);
    expect(counts.meal('dinner')).toBe(2);
    expect(counts.dish('sandwich')).toBe(1);
    expect(countCanMake(recipes, ['eggs', 'salt'], { meal: 'dinner', dishType: null })).toBe(counts.meal('dinner'));
  });

  test('empty pantry shows nothing (no guessing)', () => {
    expect(searchPantry(recipes, [], NO_FILTER, 1)).toEqual({ canMake: [], oneShort: [] });
  });

  test('shuffle: same seed = same order regardless of input order; different seeds reorder; same set', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ recipe: recipe({ id: `r${i}` }) }));
    const a = ids(seededShuffle(many, 42));
    const b = ids(seededShuffle([...many].reverse(), 42));
    const c = ids(seededShuffle(many, 43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...c].sort()).toEqual([...a].sort());
  });
});
