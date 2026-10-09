import { RECIPES } from '../src/data/recipes';

/**
 * The line under each recipe title (owner, 2026-10-09: "I like the tagline under the recipe name too.
 * Let's keep that going."). House style, see docs/recipe-import.md "Taglines": one concrete sentence
 * (a short second one is fine) on what the dish is and why it's worth making.
 */
const BLAND = /\b(delicious|tasty|yummy|amazing|perfect|best ever|mouth-?watering|to die for|this recipe|this is a)\b/i;

describe('taglines', () => {
  test.each(RECIPES.map(r => [r.id, r.description]))('%s', (_id, d) => {
    expect(d.length).toBeGreaterThanOrEqual(40);
    expect(d.length).toBeLessThanOrEqual(130);
    expect(d).toMatch(/^[A-Z"'(]/);
    expect(d).toMatch(/\.$/);
    expect(d).not.toMatch(/!/);
    expect(d).not.toMatch(BLAND);
    expect(d.split(/(?<=\.)\s+(?=[A-Z])/).length).toBeLessThanOrEqual(2);
  });

  test('no two recipes share a tagline', () => {
    const seen = new Set<string>();
    for (const r of RECIPES) {
      expect([r.id, seen.has(r.description)]).toEqual([r.id, false]);
      seen.add(r.description);
    }
  });
});
