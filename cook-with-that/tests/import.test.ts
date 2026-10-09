import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { INGREDIENTS } from '../src/data/ingredients';
import { RECIPES } from '../src/data/recipes';
import { buildIngredientIndex, normalizeText, unlistedStepIngredients } from '../src/logic/normalizeIngredient';
import { validateContent } from '../src/logic/validateContent';
import { draftRecipeCode, q, recipeId } from '../scripts/import/draft';
import { INGREDIENT_MAP } from '../scripts/import/ingredient-map';
import { mapIngredient } from '../scripts/import/mapIngredient';
import { parseIngredientLine } from '../scripts/import/parseIngredientLine';
import { parseBasedCooking, parseMinutes } from '../scripts/import/sources/basedCooking';
import { SOURCES } from '../scripts/import/sources';
import { stageRecipe, unlockOrder } from '../scripts/import/stage';
import { recipe } from './fixtures';

const index = buildIngredientIndex(INGREDIENTS);
const ids = (name: string) => {
  const m = mapIngredient(index, name);
  return m.status === 'mapped' ? m.ids : m.status;
};

describe('ingredient line parser', () => {
  test.each([
    ['- 2 cups all-purpose flour', '2 cups', 'all-purpose flour', undefined, false],
    ['- 1 (15 oz) can black beans, drained and rinsed', '1 can (15 oz)', 'black beans', 'drained and rinsed', false],
    ['- 1/2 onion, diced', '1/2', 'onion', 'diced', false],
    ['- ¼ tsp. salt', '1/4 tsp', 'salt', undefined, false],
    ['- 1 ½ cups milk', '1 1/2 cups', 'milk', undefined, false],
    ['- 2 large eggs', '2 large', 'eggs', undefined, false],
    ['- Salt and pepper to taste', 'to taste', 'Salt and pepper', undefined, false],
    ['- Fresh parsley (optional)', '', 'Fresh parsley', undefined, true],
    ['- Parmesan, for serving', '', 'parmesan', undefined, true],
    ['- 1 cup/240 milliliters heavy cream', '1 cup (240 milliliters)', 'heavy cream', undefined, false],
    [
      '- ½ cup + 2 tablespoons (150ml) cold whole milk',
      '1/2 cup + 2 tablespoons (150ml)',
      'cold whole milk',
      undefined,
      false,
    ],
    ['- Six eggs.', '6', 'eggs', undefined, false],
    ['- A pinch of salt', '1 pinch', 'salt', undefined, false],
    ['- 1 onion chopped', '1', 'onion', 'chopped', false],
    ['- 1/2 cup Corn (frozen)', '1/2 cup', 'corn', 'frozen', false],
    ['- 1 can coconut milk (400ml)', '1 can (400ml)', 'coconut milk', undefined, false],
  ])('%s', (line, quantityText, name, preparation, optional) => {
    const p = parseIngredientLine(line);
    expect([p.quantityText, p.name, p.preparation, p.optional]).toEqual([quantityText, name, preparation, optional]);
  });
});

describe('ingredient mapping', () => {
  test('exact names, aliases, plurals and descriptors map', () => {
    expect(ids('scallions')).toEqual(['green_onion']);
    expect(ids('Carrots')).toEqual(['carrot']);
    expect(ids('boneless skinless chicken thighs')).toEqual(['chicken']);
    expect(ids('large eggs')).toEqual(['eggs']);
    expect(ids('salt and pepper')).toEqual(['salt', 'black_pepper']);
  });

  test('look-alikes never map to the wrong food', () => {
    expect(ids('garlic powder')).toEqual(['garlic_powder']);
    expect(ids('peanut butter')).toEqual(['peanut_butter']);
    expect(ids('chicken broth')).toEqual(['chicken_broth']);
    for (const name of [
      'rice vinegar',
      'tomato sauce',
      'cayenne pepper',
      'butternut squash',
      'chicken bouillon',
      'bread crumbs',
    ]) {
      expect(ids(name)).not.toEqual(expect.arrayContaining([expect.any(String)]));
    }
  });

  test('a word match is only ever a suggestion', () => {
    expect(mapIngredient(index, 'apple cider vinegar')).toEqual({
      status: 'unmapped',
      key: 'apple cider vinegar',
      suggestion: 'apple',
    });
  });

  test('variants count as one missing ingredient; equipment is dropped', () => {
    expect(mapIngredient(index, 'bay leaves')).toEqual({ status: 'not_in_catalog', key: 'bay leaf' });
    expect(mapIngredient(index, 'Thermometer').status).toBe('not_ingredient');
  });

  test('every reviewed mapping points at a real catalog ID or another reviewed key', () => {
    const known = new Set(INGREDIENTS.map(i => i.id));
    for (const [key, target] of Object.entries(INGREDIENT_MAP)) {
      expect(normalizeText(key)).toBe(key);
      if (typeof target === 'string' && target.startsWith('=')) {
        const to = target.slice(1);
        expect([key, Object.prototype.hasOwnProperty.call(INGREDIENT_MAP, to) || !!index.byTerm.get(to)]).toEqual([
          key,
          true,
        ]);
      } else if (target) {
        for (const id of Array.isArray(target) ? target : [target]) expect([key, known.has(id)]).toEqual([key, true]);
      }
    }
  });

  test('a reviewed mapping never contradicts the catalog', () => {
    for (const [key, target] of Object.entries(INGREDIENT_MAP)) {
      const catalogId = index.byTerm.get(key);
      if (catalogId && typeof target === 'string' && !target.startsWith('='))
        expect([key, target]).toEqual([key, catalogId]);
    }
  });
});

const SAMPLE = `---
title: "Garlic Toast"
date: 2021-03-21
tags: ['bread', 'quick', 'side']
author: someone
---

Crisp, garlicky and done in ten minutes.

![garlic toast](/pix/garlic-toast.webp)

- ⏲️ Prep time: 5 min
- 🍳 Cook time: 1h 5 min
- 🍽️ Servings: 4

## Ingredients

- 4 slices bread
- Topping:
    - 2 tbsp butter, softened
    - 2 cloves garlic, minced
- Parsley (optional)

## Directions

1. Heat the oven to 400°F (200°C) and see [the bread recipe](/bread).
2. Mix the butter and garlic, spread it on the
   bread and bake for **8 minutes**.

## Notes

- Not part of the recipe.
`;

describe('based.cooking reader', () => {
  const raw = parseBasedCooking('garlic-toast', SAMPLE, new Map([['someone', 'Some One']]));

  test('reads front matter, intro, times, ingredients and directions', () => {
    expect(raw).toEqual({
      key: 'garlic-toast',
      title: 'Garlic Toast',
      author: 'Some One',
      description: 'Crisp, garlicky and done in ten minutes.',
      location: 'based.cooking/garlic-toast',
      ingredientLines: ['4 slices bread', '2 tbsp butter, softened', '2 cloves garlic, minced', 'Parsley (optional)'],
      steps: [
        'Heat the oven to 400°F (200°C) and see the bread recipe.',
        'Mix the butter and garlic, spread it on the bread and bake for 8 minutes.',
      ],
      tags: ['bread', 'quick', 'side'],
      prepMinutes: 5,
      cookMinutes: 65,
      servings: 4,
    });
  });

  test('minutes parse from loose text', () => {
    expect(parseMinutes('~30 minutes')).toBe(30);
    expect(parseMinutes('1.5 hours')).toBe(90);
    expect(parseMinutes('10-15 min')).toBe(15);
    expect(parseMinutes('overnight')).toBeUndefined();
  });

  test('stages into a ready candidate with guessed tags', () => {
    const c = stageRecipe(index, raw);
    expect(c.blocked).toEqual([]);
    expect(c.meals).toEqual(['side']);
    expect(c.dishTypes).toEqual(['baked_goods']);
    expect(c.ingredients.map(i => i.ids)).toEqual([['bread'], ['butter'], ['garlic'], ['parsley']]);
    expect(c.ingredients[3].optional).toBe(true);
  });

  test('flags ingredients the steps use but the list leaves out, and near-duplicates', () => {
    const withButter = {
      ...raw,
      steps: ['Fry the bread in butter with a pinch of salt.'],
      ingredientLines: ['4 slices bread'],
    };
    const library = [recipe({ id: 'buttered-toast', req: ['bread'] })];
    expect(stageRecipe(index, withButter, { library }).todo).toEqual(
      expect.arrayContaining([
        'steps use "butter" but the list doesn\'t',
        'steps use "salt" but the list doesn\'t',
        'close to "buttered-toast" already in the library',
      ]),
    );
  });

  test('an excluded page stays blocked whatever its ingredients', () => {
    expect(stageRecipe(index, raw, { exclude: 'credits a third-party original' }).blocked).toEqual([
      { kind: 'excluded', reason: 'credits a third-party original' },
    ]);
  });
});

describe('drafting', () => {
  test('ids, quoting and TODO markers', () => {
    expect(recipeId('Spaghetti aglio e olio')).toBe('spaghetti-aglio-e-olio');
    expect(recipeId('Mac & Cheese!')).toBe('mac-and-cheese');
    expect(q("Grandma's")).toBe('"Grandma\'s"');
    const c = stageRecipe(index, { ...parseBasedCooking('x', SAMPLE), servings: undefined, description: undefined });
    const code = draftRecipeCode(index, c, SOURCES['based-cooking'], 'garlic-toast');
    expect(code).toContain('servings: NaN, // TODO');
    expect(code).toContain("description: 'TODO:");
    expect(code).toContain("r('butter', 'butter', '2 tbsp', 'softened'),");
    expect(code).toContain("opt('parsley', 'parsley', 'TODO'),");
    expect(code).toContain("source: from('x', 'Garlic Toast', 'someone'),");
  });

  test('a rewrite-only source never carries its wording into a draft', () => {
    const c = stageRecipe(index, parseBasedCooking('x', SAMPLE));
    const code = draftRecipeCode(index, c, { ...SOURCES['based-cooking'], textPolicy: 'rewrite' }, 'garlic-toast');
    expect(code).not.toContain('spread it on the bread');
    expect(code).toContain('TODO: write original directions');
  });

  test('greedy unlock order picks the ingredient that frees the most recipes', () => {
    const c = (key: string, missing: string[]) => ({
      ...stageRecipe(index, parseBasedCooking(key, SAMPLE)),
      blocked: missing.map(k => ({ kind: 'not_in_catalog' as const, key: k })),
    });
    expect(
      unlockOrder([c('a', ['nutmeg']), c('b', ['nutmeg']), c('c', ['dill', 'nutmeg']), c('d', ['leek'])], 2),
    ).toEqual([
      { key: 'nutmeg', unlocks: 2, total: 2 },
      { key: 'dill', unlocks: 1, total: 3 },
    ]);
  });
});

describe('imported recipe metadata', () => {
  const collections = { demo: { name: 'Demo', license: 'CC0 1.0', home: 'example.org', credit: 'Demo credit.' } };
  const imported = (id: string, key: string, license = 'CC0 1.0', collection = 'demo') => {
    const r = recipe({ id, req: ['salt'] });
    r.source = { type: 'licensed', license, note: 'Adapted', origin: { collection, key, title: 'T' } };
    return r;
  };
  const issues = (...recipes: ReturnType<typeof recipe>[]) =>
    validateContent(INGREDIENTS, recipes, collections).map(i => i.message);

  test('origin must name a known collection with its exact license', () => {
    expect(issues(imported('a', 'k'))).toEqual([]);
    expect(issues(imported('a', 'k', 'CC BY 4.0'))).toEqual(['license must read "CC0 1.0" for demo recipes']);
    expect(issues(imported('a', 'k', 'CC0 1.0', 'nope'))).toEqual(['unknown source collection "nope"']);
  });

  test('the same original is never imported twice', () => {
    expect(issues(imported('a', 'k'), imported('b', 'k'))).toEqual(['imports demo/k again (already "a")']);
  });

  test('licensed recipes need an origin; drafts with TODOs fail', () => {
    const r = recipe({ id: 'a', req: ['salt'] });
    r.source = { type: 'licensed', license: 'CC0 1.0', note: 'Adapted' };
    r.description = 'TODO: describe';
    expect(issues(r)).toEqual(
      expect.arrayContaining([
        'licensed recipe needs its origin (collection, key, title)',
        'placeholder title/description',
      ]),
    );
  });
});

describe('imported recipes in the library', () => {
  const dir = join(__dirname, '..', 'src', 'data', 'imported');

  test('no draft markers left in any imported file (comments included)', () => {
    for (const f of readdirSync(dir)) {
      const lines = readFileSync(join(dir, f), 'utf8').split('\n');
      expect([f, lines.filter(l => /\bTODO\b|NaN/.test(l))]).toEqual([f, []]);
    }
  });

  test('every imported recipe lists each catalog ingredient its steps use', () => {
    for (const r of RECIPES.filter(r => r.source.origin)) {
      const missing = unlistedStepIngredients(
        index,
        r.steps,
        r.ingredients.map(i => i.ingredientId),
      );
      expect([r.id, missing]).toEqual([r.id, []]);
    }
  });

  test('every imported recipe is still marked for culinary review until someone has checked it', () => {
    // Remove this test once review sign-off is recorded per recipe.
    for (const r of RECIPES.filter(r => r.source.origin)) expect(r.source.note).toMatch(/needs culinary review/);
  });
});
