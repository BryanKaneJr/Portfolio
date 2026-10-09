import {
  NARROW_THRESHOLD,
  additionalRequired,
  findCloseMatches,
  findExactMatches,
  runSearch,
  suggestNarrowing,
  suggestTryWithout,
} from '../src/logic/matchRecipes';
import { buildIngredientIndex, resolveIngredientId, searchIngredients } from '../src/logic/normalizeIngredient';
import { addIngredient, removeIngredient, sanitizeSearch } from '../src/state/searchState';
import { DISH_TYPES, MEALS, type Recipe } from '../src/data/types';
import { FIX_INGREDIENTS, ids, recipe, search } from './fixtures';

const CGS = ['chicken', 'garlic', 'spinach'];

describe('exact matching (Use = AND)', () => {
  const recipes = [
    recipe({ id: 'all-three', req: CGS }),
    recipe({ id: 'no-spinach', req: ['chicken', 'garlic'] }),
    recipe({ id: 'garlic-optional', req: ['chicken', 'spinach'], opt: ['garlic'] }),
    recipe({ id: 'all-plus-cream', req: [...CGS, 'heavy_cream'] }),
    recipe({ id: 'all-optional-cream', req: CGS, opt: ['heavy_cream'] }),
  ];

  test('#1 Use [chicken, garlic, spinach] returns only recipes with all three as REQUIRED', () => {
    const out = ids(findExactMatches(recipes, search({ useIds: CGS })));
    expect(out.sort()).toEqual(['all-optional-cream', 'all-plus-cream', 'all-three']);
  });

  test('#2 Avoid [cream] removes every recipe listing cream, even when optional', () => {
    const out = ids(findExactMatches(recipes, search({ useIds: CGS, avoidIds: ['heavy_cream'] })));
    expect(out).toEqual(['all-three']);
  });

  test('#11 garlic only as optional garnish does not satisfy Use [garlic]', () => {
    const out = ids(findExactMatches(recipes, search({ useIds: ['garlic'] })));
    expect(out).not.toContain('garlic-optional');
  });

  test('empty Use = browse everything allowed by hard filters', () => {
    expect(findExactMatches(recipes, search({}))).toHaveLength(recipes.length);
    const noCream = ids(findExactMatches(recipes, search({ avoidIds: ['heavy_cream'] })));
    expect(noCream.sort()).toEqual(['all-three', 'garlic-optional', 'no-spinach']);
  });

  test('alsoNeed lists required non-selected ingredients including basics, once each', () => {
    const r = recipe({ id: 'x', req: ['chicken', 'salt', 'olive_oil', 'parmesan'], opt: ['tomato'] });
    r.ingredients.push({ ingredientId: 'salt', displayName: 'more salt', quantityText: 'pinch', optional: false });
    const extra = additionalRequired(r, ['chicken']).map(i => i.ingredientId);
    expect(extra).toEqual(['salt', 'olive_oil', 'parmesan']);
  });
});

describe('Meal and Dish type facets', () => {
  const recipes = [
    recipe({ id: 'dinner-pasta', meals: ['dinner'], dishTypes: ['pasta'] }),
    recipe({ id: 'lunch-dinner-pasta', meals: ['lunch', 'dinner'], dishTypes: ['pasta', 'salad'] }),
    recipe({ id: 'dinner-soup', meals: ['dinner'], dishTypes: ['soup'] }),
    recipe({ id: 'lunch-pasta', meals: ['lunch'], dishTypes: ['pasta'] }),
  ];

  test('#3 dinner + pasta returns the intersection', () => {
    const out = ids(findExactMatches(recipes, search({ meal: 'dinner', dishType: 'pasta' })));
    expect(out.sort()).toEqual(['dinner-pasta', 'lunch-dinner-pasta']);
  });

  test('#4 dinner never excludes a recipe tagged lunch AND dinner', () => {
    expect(ids(findExactMatches(recipes, search({ meal: 'dinner' })))).toContain('lunch-dinner-pasta');
  });
});

describe('close matches', () => {
  test('#5 zero exact → labelled close match missing only spinach', () => {
    const recipes = [recipe({ id: 'garlic-chicken', req: ['chicken', 'garlic'] }), recipe({ id: 'unrelated', req: ['rice'] })];
    const res = runSearch(recipes, search({ useIds: CGS }));
    expect(res.exact).toHaveLength(0);
    expect(ids(res.close)).toEqual(['garlic-chicken']);
    expect(res.close[0].missingIds).toEqual(['spinach']);
    expect(res.close[0].usesIds).toEqual(['chicken', 'garlic']);
  });

  test('#6 Use [chicken] with zero exact → no 0-of-1 close matches', () => {
    const recipes = [recipe({ id: 'rice', req: ['rice'] }), recipe({ id: 'eggs', req: ['eggs'] })];
    const res = runSearch(recipes, search({ useIds: ['chicken'] }));
    expect(res.exact).toHaveLength(0);
    expect(res.close).toHaveLength(0);
  });

  test('#7 Use [] with zero results → adjustment actions, never random close matches', () => {
    const recipes = [recipe({ id: 'a', meals: ['lunch'], req: ['rice'] })];
    const res = runSearch(recipes, search({ meal: 'dinner' }));
    expect(res.exact).toHaveLength(0);
    expect(res.close).toHaveLength(0);
    expect(res.blockers.meal).toBe(true);
  });

  test('#8 close matches never include Avoid ingredients (incl. optional)', () => {
    const recipes = [
      recipe({ id: 'has-cream', req: ['chicken', 'garlic', 'heavy_cream'] }),
      recipe({ id: 'opt-cream', req: ['chicken', 'garlic'], opt: ['heavy_cream'] }),
      recipe({ id: 'ok', req: ['chicken', 'spinach'] }),
    ];
    const res = runSearch(recipes, search({ useIds: CGS, avoidIds: ['heavy_cream'] }));
    expect(ids(res.close)).toEqual(['ok']);
  });

  test('two Use ingredients: close match must contain at least one', () => {
    const recipes = [recipe({ id: 'chicken-only', req: ['chicken'] }), recipe({ id: 'neither', req: ['rice'] })];
    expect(ids(findCloseMatches(recipes, search({ useIds: ['chicken', 'garlic'] })))).toEqual(['chicken-only']);
  });

  test('three+ Use: prefer missing-one; fall back to missing-two only if none', () => {
    const missingOne = recipe({ id: 'missing-one', req: ['chicken', 'garlic'] });
    const missingTwo = recipe({ id: 'missing-two', req: ['chicken'] });
    expect(ids(findCloseMatches([missingOne, missingTwo], search({ useIds: CGS })))).toEqual(['missing-one']);
    const res = findCloseMatches([missingTwo], search({ useIds: CGS }));
    expect(ids(res)).toEqual(['missing-two']);
    expect(res[0].missingIds.sort()).toEqual(['garlic', 'spinach']);
  });

  test('close matches respect Meal/Dish type and cap at 12', () => {
    const many = Array.from({ length: 20 }, (_, i) => recipe({ id: `c${String(i).padStart(2, '0')}`, req: ['chicken', 'garlic'] }));
    many.push(recipe({ id: 'wrong-meal', meals: ['breakfast'], req: ['chicken', 'garlic'] }));
    const res = findCloseMatches(many, search({ useIds: CGS, meal: 'dinner' }));
    expect(res).toHaveLength(12);
    expect(ids(res)).not.toContain('wrong-meal');
  });

  test('"Try without" only offers removals that unlock exact results', () => {
    const recipes = [recipe({ id: 'cg', req: ['chicken', 'garlic'] })];
    const tw = suggestTryWithout(recipes, search({ useIds: CGS }));
    expect(tw).toEqual([{ ingredientId: 'spinach', count: 1 }]);
  });

  test('no results due entirely to Avoid → flagged, never overridden', () => {
    const recipes = [recipe({ id: 'a', req: ['chicken', 'heavy_cream'] })];
    const res = runSearch(recipes, search({ useIds: ['chicken'], avoidIds: ['heavy_cream'] }));
    expect(res.exact).toHaveLength(0);
    expect(res.close).toHaveLength(0);
    expect(res.blockers.avoid).toBe(true);
  });
});

describe('search state', () => {
  test('#9 moving Use → Avoid removes it from Use atomically', () => {
    const s1 = addIngredient(search({}), 'garlic', 'use');
    const s2 = addIngredient(s1, 'garlic', 'avoid');
    expect(s2.useIds).toEqual([]);
    expect(s2.avoidIds).toEqual(['garlic']);
    const s3 = addIngredient(s2, 'garlic', 'use');
    expect(s3).toEqual(expect.objectContaining({ useIds: ['garlic'], avoidIds: [] }));
  });

  test('#10 "green onion" and "scallion" cannot add duplicate canonical entries', () => {
    const index = buildIngredientIndex(FIX_INGREDIENTS);
    const a = resolveIngredientId(index, 'green onion')!;
    const b = resolveIngredientId(index, 'Scallion')!;
    expect(a).toBe('green_onion');
    expect(b).toBe('green_onion');
    let s = addIngredient(search({}), a, 'use');
    s = addIngredient(s, b, 'use');
    expect(s.useIds).toEqual(['green_onion']);
  });

  test('duplicates do not inflate match counts', () => {
    const recipes = [recipe({ id: 'a', req: ['chicken', 'garlic'] })];
    const res = runSearch(recipes, search({ useIds: ['chicken', 'chicken'] as string[] }));
    expect(res.exact).toHaveLength(1);
  });

  test('removeIngredient clears from either list', () => {
    const s = removeIngredient(search({ useIds: ['a', 'b'], avoidIds: ['c'] }), 'c');
    expect(s.avoidIds).toEqual([]);
  });

  test('sanitizeSearch drops unknown IDs, conflicts and bad facets', () => {
    const s = sanitizeSearch(
      { useIds: ['chicken', 'ghost', 'chicken'], avoidIds: ['chicken', 'garlic'], meal: 'brunch', dishType: 'pasta' },
      new Set(['chicken', 'garlic']),
      MEALS,
      DISH_TYPES,
    );
    expect(s).toEqual({ useIds: ['chicken'], avoidIds: ['garlic'], meal: null, dishType: 'pasta' });
  });
});

describe('ingredient search', () => {
  const index = buildIngredientIndex(FIX_INGREDIENTS);

  test('aliases resolve to the same canonical ingredient, shown once', () => {
    const hits = searchIngredients(index, 'scall');
    expect(hits.map(h => h.ingredient.id)).toEqual(['green_onion']);
    expect(hits[0].matchedAlias).toBe('scallion');
  });

  test('garlic and garlic powder stay separate', () => {
    expect(searchIngredients(index, 'garlic').map(h => h.ingredient.id)).toEqual(['garlic', 'garlic_powder']);
  });

  test('unknown ingredient returns nothing', () => {
    expect(searchIngredients(index, 'unobtainium')).toEqual([]);
  });
});

describe('sorting and narrowing', () => {
  test('#14 many extra ingredients ranks behind an otherwise equal recipe', () => {
    const recipes = [
      recipe({ id: 'many-extras', title: 'A', req: ['chicken', 'salt', 'olive_oil', 'parmesan', 'tomato'] }),
      recipe({ id: 'few-extras', title: 'B', req: ['chicken', 'salt'] }),
    ];
    expect(ids(findExactMatches(recipes, search({ useIds: ['chicken'] })))).toEqual(['few-extras', 'many-extras']);
  });

  test('ties break on time, then title, deterministically', () => {
    const recipes = [
      recipe({ id: 'slow', title: 'A', minutes: 40 }),
      recipe({ id: 'b', title: 'B', minutes: 20 }),
      recipe({ id: 'a', title: 'A', minutes: 20 }),
    ];
    const out1 = ids(findExactMatches(recipes, search({})));
    const out2 = ids(findExactMatches([...recipes].reverse(), search({})));
    expect(out1).toEqual(['a', 'b', 'slow']);
    expect(out2).toEqual(out1);
  });

  const makeMany = (n: number): Recipe[] =>
    Array.from({ length: n }, (_, i) =>
      recipe({
        id: `r${String(i).padStart(3, '0')}`,
        meals: i % 3 === 0 ? ['lunch', 'dinner'] : ['dinner'],
        dishTypes: i % 4 === 0 ? ['pasta'] : ['skillet'],
        req: ['chicken'],
      }),
    );

  test('#13 prompt does NOT appear at exactly 30, does above 30', () => {
    expect(NARROW_THRESHOLD).toBe(30);
    const at30 = runSearch(makeMany(30), search({ useIds: ['chicken'] }));
    expect(at30.exact).toHaveLength(30);
    expect(at30.narrowing).toEqual([]);
    const at31 = runSearch(makeMany(31), search({ useIds: ['chicken'] }));
    expect(at31.narrowing.length).toBeGreaterThan(0);
    expect(at31.narrowing.length).toBeLessThanOrEqual(3);
  });

  test('#12 suggested counts equal results after applying the filter; only reducing, unselected options', () => {
    const recipes = makeMany(45);
    const state = search({ useIds: ['chicken'] });
    const { exact, narrowing } = runSearch(recipes, state);
    expect(narrowing.length).toBeGreaterThan(0);
    for (const s of narrowing) {
      const applied = s.facet === 'meal' ? { ...state, meal: s.value } : { ...state, dishType: s.value };
      expect(findExactMatches(recipes, applied)).toHaveLength(s.count);
      expect(s.count).toBeLessThan(exact.length);
      expect(s.count).toBeGreaterThan(0);
    }
    // 'dinner' covers all 45 so it is not a reducing suggestion
    expect(narrowing.find(s => s.facet === 'meal' && s.value === 'dinner')).toBeUndefined();
  });

  test('narrowing never suggests an already-selected facet', () => {
    const recipes = makeMany(60);
    const state = search({ meal: 'dinner' });
    const exact = findExactMatches(recipes, state);
    expect(suggestNarrowing(exact, state).every(s => s.facet === 'dishType')).toBe(true);
  });
});
