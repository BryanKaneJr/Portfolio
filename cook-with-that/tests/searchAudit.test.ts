/**
 * Invariants over the real bundled library (not fixtures), so a new recipe or ingredient
 * can't quietly break a matching rule. Random states come from a seeded PRNG: a failure
 * prints the state and always reproduces.
 */
import { INGREDIENTS, RECIPES } from '../src/data/catalog';
import { DEFAULT_STAPLE_IDS } from '../src/data/staples';
import { DISH_TYPES, MEALS, type DishType, type Meal, type Recipe, type SearchState } from '../src/data/types';
import {
  MAX_CLOSE_MATCHES,
  NARROW_THRESHOLD,
  countExact,
  runSearch,
  type RecipeResult,
} from '../src/logic/matchRecipes';
import { MAX_ONE_SHORT, countCanMake, searchPantry } from '../src/logic/pantry';
import { buildIngredientIndex, normalizeText, searchIngredients } from '../src/logic/normalizeIngredient';
import { compareResults } from '../src/logic/sortRecipes';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REQUIRED = new Map(
  RECIPES.map(r => [r, new Set(r.ingredients.filter(i => !i.optional).map(i => i.ingredientId))]),
);
const LISTED = new Map(RECIPES.map(r => [r, new Set(r.ingredients.map(i => i.ingredientId))]));
const required = (r: Recipe) => REQUIRED.get(r)!;
const listed = (r: Recipe) => LISTED.get(r)!;

// Ingredients weighted toward ones recipes actually use, so random searches hit real results.
const USED = [...new Set(RECIPES.flatMap(r => [...required(r)]))];
const ALL_IDS = INGREDIENTS.map(i => i.id);

function randomState(rand: () => number): SearchState {
  const pick = (pool: string[]) => pool[Math.floor(rand() * pool.length)];
  const useIds = new Set<string>();
  const nUse = Math.floor(rand() * 5); // 0–4
  while (useIds.size < nUse) useIds.add(rand() < 0.85 ? pick(USED) : pick(ALL_IDS));
  const avoidIds = new Set<string>();
  const nAvoid = Math.floor(rand() * 4); // 0–3
  while (avoidIds.size < nAvoid) {
    const id = rand() < 0.85 ? pick(USED) : pick(ALL_IDS);
    if (!useIds.has(id)) avoidIds.add(id);
  }
  const meal = rand() < 0.4 ? (MEALS[Math.floor(rand() * MEALS.length)] as Meal) : null;
  const dishType = rand() < 0.3 ? (DISH_TYPES[Math.floor(rand() * DISH_TYPES.length)] as DishType) : null;
  return { meal, dishType, useIds: [...useIds], avoidIds: [...avoidIds] };
}

/** The rules written out longhand, independent of the engine's code. */
function passesHard(r: Recipe, s: SearchState): boolean {
  const all = listed(r);
  return (
    !s.avoidIds.some(id => all.has(id)) &&
    (!s.meal || r.meals.includes(s.meal)) &&
    (!s.dishType || r.dishTypes.includes(s.dishType))
  );
}
const isExact = (r: Recipe, s: SearchState) => passesHard(r, s) && s.useIds.every(id => required(r).has(id));

/** Plain comparisons (expect() per field is too slow for ~100k results); throws with the reason. */
function checkResultShape(res: RecipeResult, s: SearchState, staples: ReadonlySet<string>) {
  const req = required(res.recipe);
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const extra = [...res.alsoNeed, ...res.staplesUsed].map(i => i.ingredientId);
  const wantExtra = [...req].filter(id => !s.useIds.includes(id));
  const problems = [
    !same(
      res.usesIds,
      s.useIds.filter(id => req.has(id)),
    ) && 'usesIds',
    !same(
      res.missingIds,
      s.useIds.filter(id => !req.has(id)),
    ) && 'missingIds',
    new Set(extra).size !== extra.length && 'an ingredient listed twice under "also need"',
    !same([...extra].sort(), wantExtra.sort()) && '"also need" + staples ≠ required minus Use',
    res.alsoNeed.some(i => staples.has(i.ingredientId)) && 'a staple under "also need"',
    res.staplesUsed.some(i => !staples.has(i.ingredientId)) && 'a non-staple under staples',
    res.totalMinutes !== res.recipe.prepMinutes + res.recipe.cookMinutes && 'totalMinutes',
  ].filter(Boolean);
  if (problems.length) throw new Error(`${res.recipe.id}: ${problems.join(', ')}`);
}

function isSorted(list: RecipeResult[]) {
  for (let i = 1; i < list.length; i++) if (compareResults(list[i - 1], list[i]) > 0) return false;
  return true;
}

const STATES: SearchState[] = (() => {
  const rand = rng(20261009);
  return Array.from({ length: 1500 }, () => randomState(rand));
})();

describe('search invariants over the real library (1,500 random searches)', () => {
  test('exact results are exactly the recipes that pass every rule, sorted, with correct labels', () => {
    for (const s of STATES) {
      const out = runSearch(RECIPES, s);
      const want = RECIPES.filter(r => isExact(r, s))
        .map(r => r.id)
        .sort();
      try {
        expect(out.exact.map(r => r.recipe.id).sort()).toEqual(want);
        expect(isSorted(out.exact)).toBe(true);
        expect(countExact(RECIPES, s)).toBe(out.exact.length);
        for (const res of out.exact) {
          expect(res.missingIds).toEqual([]);
          checkResultShape(res, s, new Set());
        }
      } catch (e) {
        throw new Error(`state ${JSON.stringify(s)}: ${(e as Error).message}`);
      }
    }
  });

  test('Avoid, Meal and Dish type are never relaxed, in exact results or close matches', () => {
    for (const s of STATES) {
      const out = runSearch(RECIPES, s);
      for (const res of [...out.exact, ...out.close]) {
        const ok = passesHard(res.recipe, s);
        if (!ok) throw new Error(`${res.recipe.id} breaks a hard filter for ${JSON.stringify(s)}`);
      }
    }
  });

  test('close matches follow the plan: only with zero exact, n ≥ 2, missing 1 (then 2 for n ≥ 3), best first, max 12', () => {
    let seen = 0;
    for (const s of STATES) {
      const out = runSearch(RECIPES, s);
      const n = s.useIds.length;
      if (out.exact.length > 0 || n < 2) {
        expect(out.close).toEqual([]);
        continue;
      }
      // Every candidate the rules allow, sorted: the shown list must be its head.
      const scored = RECIPES.filter(r => passesHard(r, s)).map(r => {
        const req = required(r);
        return { r, missing: s.useIds.filter(id => !req.has(id)).length };
      });
      const limit = scored.some(c => c.missing === 1) ? 1 : n >= 3 ? 2 : 1;
      const allowed = scored.filter(c => c.missing >= 1 && c.missing <= limit && c.missing < n);
      try {
        expect(out.close.length).toBe(Math.min(allowed.length, MAX_CLOSE_MATCHES));
        expect(isSorted(out.close)).toBe(true);
        for (const res of out.close) {
          expect(res.missingIds.length).toBeGreaterThanOrEqual(1);
          expect(res.missingIds.length).toBeLessThanOrEqual(limit);
          expect(res.usesIds.length).toBeGreaterThanOrEqual(1);
          checkResultShape(res, s, new Set());
        }
        expect(out.closeMaxMissing).toBe(out.close.reduce((m, c) => Math.max(m, c.missingIds.length), 0));
      } catch (e) {
        throw new Error(`state ${JSON.stringify(s)}: ${(e as Error).message}`);
      }
      if (out.close.length) seen++;
    }
    expect(seen).toBeGreaterThan(20); // the random states really exercised close matches
  });

  test('narrowing chips appear only above 30 and their counts equal the results after tapping', () => {
    let seen = 0;
    for (const s of STATES) {
      const out = runSearch(RECIPES, s);
      if (out.exact.length <= NARROW_THRESHOLD) {
        expect(out.narrowing).toEqual([]);
        continue;
      }
      seen++;
      expect(out.narrowing.length).toBeLessThanOrEqual(3);
      for (const sug of out.narrowing) {
        const tapped = sug.facet === 'meal' ? { ...s, meal: sug.value } : { ...s, dishType: sug.value };
        expect(s[sug.facet]).toBeNull(); // never re-suggests a chosen facet
        expect(runSearch(RECIPES, tapped).exact.length).toBe(sug.count);
        expect(sug.count).toBeGreaterThan(0);
        expect(sug.count).toBeLessThan(out.exact.length);
      }
    }
    expect(seen).toBeGreaterThan(20);
  });

  test('Meal / Dish type dropdown counts equal the results after choosing that option', () => {
    for (const s of STATES.slice(0, 300)) {
      for (const meal of [null, ...MEALS]) {
        const next = { ...s, meal };
        expect(countExact(RECIPES, next)).toBe(runSearch(RECIPES, next).exact.length);
      }
      for (const dishType of [null, ...DISH_TYPES]) {
        const next = { ...s, dishType };
        expect(countExact(RECIPES, next)).toBe(runSearch(RECIPES, next).exact.length);
      }
    }
  });

  test('"Try without" and the adjust buttons tell the truth', () => {
    for (const s of STATES) {
      const out = runSearch(RECIPES, s);
      if (out.exact.length > 0) continue;
      const wantTry =
        s.useIds.length < 2
          ? []
          : s.useIds.filter(id => countExact(RECIPES, { ...s, useIds: s.useIds.filter(u => u !== id) }) > 0);
      expect(out.tryWithout.map(t => t.ingredientId)).toEqual(wantTry);
      for (const t of out.tryWithout)
        expect(t.count).toBe(countExact(RECIPES, { ...s, useIds: s.useIds.filter(u => u !== t.ingredientId) }));
      expect(out.blockers.meal).toBe(!!s.meal && countExact(RECIPES, { ...s, meal: null }) > 0);
      expect(out.blockers.dishType).toBe(!!s.dishType && countExact(RECIPES, { ...s, dishType: null }) > 0);
      expect(out.blockers.avoid).toBe(s.avoidIds.length > 0 && countExact(RECIPES, { ...s, avoidIds: [] }) > 0);
      expect(out.blockers.ingredients).toBe(s.useIds.length > 0 && countExact(RECIPES, { ...s, useIds: [] }) > 0);
    }
  });

  test('order of the Use list never changes which recipes match', () => {
    for (const s of STATES.filter(x => x.useIds.length > 1).slice(0, 200)) {
      const a = runSearch(RECIPES, s);
      const b = runSearch(RECIPES, { ...s, useIds: [...s.useIds].reverse() });
      expect(b.exact.map(r => r.recipe.id)).toEqual(a.exact.map(r => r.recipe.id));
      expect(b.close.map(r => r.recipe.id).sort()).toEqual(a.close.map(r => r.recipe.id).sort());
    }
  });

  test('staples (pantry only) never change which recipes match, only the card wording', () => {
    const staples = new Set(DEFAULT_STAPLE_IDS);
    for (const s of STATES.slice(0, 300)) {
      const plain = runSearch(RECIPES, s);
      const withStaples = runSearch(RECIPES, s, staples);
      expect(withStaples.exact.map(r => r.recipe.id).sort()).toEqual(plain.exact.map(r => r.recipe.id).sort());
      for (const res of withStaples.exact) checkResultShape(res, s, staples);
    }
  });
});

describe('every single-ingredient search over the real library', () => {
  test('Use [x] returns exactly the recipes that need x; optional-only never counts', () => {
    for (const id of ALL_IDS) {
      const out = runSearch(RECIPES, { meal: null, dishType: null, useIds: [id], avoidIds: [] });
      const want = RECIPES.filter(r => required(r).has(id)).map(r => r.id);
      expect([id, out.exact.map(r => r.recipe.id).sort()]).toEqual([id, want.sort()]);
      expect(out.close).toEqual([]); // one ingredient: no close matches, ever
    }
  });

  test('Avoid [x] hides every recipe that lists x anywhere, including optional lines', () => {
    for (const id of ALL_IDS) {
      const out = runSearch(RECIPES, { meal: null, dishType: null, useIds: [], avoidIds: [id] });
      const leaked = out.exact.filter(r => listed(r.recipe).has(id)).map(r => r.recipe.id);
      expect([id, leaked]).toEqual([id, []]);
      expect(out.exact.length).toBe(RECIPES.filter(r => !listed(r).has(id)).length);
    }
  });
});

describe('pantry mode over the real library (500 random pantries)', () => {
  const rand = rng(77);
  const pantries = Array.from({ length: 500 }, () => {
    const size = 10 + Math.floor(rand() * 40);
    const p = new Set<string>();
    while (p.size < size) p.add(USED[Math.floor(rand() * USED.length)]);
    return [...p, ...(rand() < 0.7 ? DEFAULT_STAPLE_IDS : [])];
  });

  test('can-make needs every required ingredient; one-short is exactly one; filters and counts agree', () => {
    let canMakeSeen = 0;
    for (const [i, pantry] of pantries.entries()) {
      const have = new Set(pantry);
      const filters = {
        meal: i % 3 === 0 ? MEALS[i % MEALS.length] : null,
        dishType: i % 5 === 0 ? DISH_TYPES[i % DISH_TYPES.length] : null,
      };
      const out = searchPantry(RECIPES, pantry, filters, i);
      const fits = (r: Recipe) =>
        (!filters.meal || r.meals.includes(filters.meal)) &&
        (!filters.dishType || r.dishTypes.includes(filters.dishType));
      const short = (r: Recipe) => [...required(r)].filter(id => !have.has(id));

      expect(out.canMake.map(r => r.recipe.id).sort()).toEqual(
        RECIPES.filter(r => fits(r) && short(r).length === 0)
          .map(r => r.id)
          .sort(),
      );
      expect(countCanMake(RECIPES, pantry, filters)).toBe(out.canMake.length);
      const oneShortAll = RECIPES.filter(r => fits(r) && short(r).length === 1);
      expect(out.oneShort.length).toBe(Math.min(oneShortAll.length, MAX_ONE_SHORT));
      for (const res of out.oneShort) {
        expect(res.missing.map(m => m.ingredientId)).toEqual(short(res.recipe));
        expect(res.missing[0].optional).toBe(false);
      }
      // Same seed, same order; the list is a permutation of the matches.
      expect(searchPantry(RECIPES, [...pantry].reverse(), filters, i).canMake.map(r => r.recipe.id)).toEqual(
        out.canMake.map(r => r.recipe.id),
      );
      canMakeSeen += out.canMake.length;
    }
    expect(canMakeSeen).toBeGreaterThan(100);
  });
});

describe('ingredient search over the real catalog', () => {
  const index = buildIngredientIndex(INGREDIENTS);
  const top = (q: string) => searchIngredients(index, q).map(h => h.ingredient.id);

  test('every name and alias finds its own ingredient first', () => {
    for (const ing of INGREDIENTS)
      for (const term of [ing.name, ...ing.aliases]) expect([term, top(term)[0]]).toEqual([term, ing.id]);
  });

  test('the plural or singular of every name finds it in the top three', () => {
    const flip = (w: string) =>
      /ies$/.test(w)
        ? `${w.slice(0, -3)}y`
        : /oes$/.test(w)
          ? w.slice(0, -2)
          : /s$/.test(w) && !/(ss|us)$/.test(w)
            ? w.slice(0, -1)
            : /[^aeiou]y$/.test(w)
              ? `${w.slice(0, -1)}ies`
              : /(ch|sh|x|o)$/.test(w)
                ? `${w}es`
                : `${w}s`;
    for (const ing of INGREDIENTS) {
      const words = normalizeText(ing.name).split(' ');
      const q = [...words.slice(0, -1), flip(words[words.length - 1])].join(' ');
      if (q.endsWith('us')) continue; // "tofus": not a word, and "-us" stays as typed (hummus, asparagus)
      expect([q, top(q).slice(0, 3).includes(ing.id)]).toEqual([q, true]);
    }
  });

  test('common misspellings still find the ingredient', () => {
    const cases: [string, string][] = [
      ['brocoli', 'broccoli'],
      ['brocolli', 'broccoli'],
      ['zuchini', 'zucchini'],
      ['parmesean', 'parmesan'],
      ['jalepeno', 'jalapeno'],
      ['mozarella', 'mozzarella'],
      ['cinammon', 'cinnamon'],
      ['worchestershire', 'worcestershire_sauce'],
      ['tumeric', 'turmeric'],
      ['canelini', 'cannellini_beans'],
      ['avacado', 'avocado'],
      ['chiken', 'chicken'],
      ['prosciuto', 'prosciutto'],
    ];
    for (const [q, id] of cases) expect([q, top(q)[0]]).toEqual([q, id]);
  });

  test('describing words are dropped only when the full phrase finds nothing', () => {
    expect(top('unsalted butter')[0]).toBe('butter');
    expect(top('extra virgin olive oil')[0]).toBe('olive_oil');
    expect(top('boneless skinless chicken thighs')[0]).toBe('chicken');
    expect(top('large eggs')[0]).toBe('eggs');
    expect(top('extra firm tofu')[0]).toBe('tofu');
    expect(top('low sodium chicken broth')[0]).toBe('chicken_broth');
  });

  test('near-miss foods are not passed off as something else', () => {
    expect(top('pear')).not.toContain('peas'); // short words get no typo allowance
    expect(top('pears')).not.toContain('peas');
    expect(top('beet')).not.toContain('beer');
    expect(top('chiles')).not.toContain('chives');
    expect(top('chopped tomatoes')).not.toContain('tomato'); // British for tinned: ambiguous, so nothing
    expect(top('egg')).toEqual(['eggs', 'egg_noodles', 'eggplant']);
    expect(top('unobtainium')).toEqual([]);
  });

  test('an exact singular or plural beats a longer name that merely starts the same', () => {
    expect(top('pea')[0]).toBe('peas');
    expect(top('clam')[0]).toBe('clams');
    expect(top('berry')[0]).toBe('berries');
  });
});
