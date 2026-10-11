import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { INGREDIENTS } from '../src/data/ingredients';
import { RECIPES } from '../src/data/recipes';
import { buildIngredientIndex, unlistedStepIngredients } from '../src/logic/normalizeIngredient';

/** Recipes written for the app: the seed set and src/data/originals (docs/original-recipes.md). */
const ORIGINALS = RECIPES.filter(r => r.source.type === 'original');
const index = buildIngredientIndex(INGREDIENTS);

describe('original recipes', () => {
  test('no draft markers left in any originals file', () => {
    const dir = join(__dirname, '..', 'src', 'data', 'originals');
    for (const f of readdirSync(dir)) {
      const lines = readFileSync(join(dir, f), 'utf8').split('\n');
      expect([f, lines.filter(l => /\bTODO\b|NaN/.test(l))]).toEqual([f, []]);
    }
  });

  test('every original lists each catalog ingredient its steps use', () => {
    for (const r of ORIGINALS) {
      const missing = unlistedStepIngredients(
        index,
        r.steps,
        r.ingredients.map(i => i.ingredientId),
      );
      expect([r.id, missing]).toEqual([r.id, []]);
    }
  });

  test('every original is marked for culinary review and credits no outside source', () => {
    for (const r of ORIGINALS) {
      expect(r.source.note).toMatch(/needs culinary review/);
      expect(r.source.origin).toBeUndefined();
    }
  });
});

describe('the step checker', () => {
  test('reads each clause on its own: a list "garlic, salt" is not garlic salt', () => {
    const listed = ['olive_oil', 'white_vinegar', 'garlic', 'salt', 'black_pepper'];
    expect(unlistedStepIngredients(index, ['Whisk the oil, vinegar, garlic, salt and pepper.'], listed)).toEqual([]);
    expect(unlistedStepIngredients(index, ['Season with garlic salt.'], ['garlic', 'salt'])).toEqual([
      { id: 'garlic_salt', term: 'garlic salt' },
    ]);
  });
});
