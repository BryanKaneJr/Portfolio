import { ingredientIndex, RECIPES } from '../src/data/catalog';
import { defaultUnitSystem, displayQuantity, displayStep } from '../src/logic/units';

const metric = (q: string, id?: string, name = '') => displayQuantity(q, 'metric', id, name);
const step = (s: string) => displayStep(s, 'metric', ingredientIndex);

describe('default units', () => {
  test.each([
    ['en-US', 'us'],
    ['en-GB', 'metric'],
    ['en-AU', 'metric'],
    ['de-DE', 'metric'],
    ['fr-CA', 'metric'],
    ['es-PR', 'us'],
    ['en', 'us'],
    [undefined, 'us'],
  ])('%s → %s', (locale, expected) => {
    expect(defaultUnitSystem(locale)).toBe(expected);
  });
});

describe('quantities in metric', () => {
  test('US mode shows recipes exactly as written', () => {
    expect(displayQuantity('1 lb (about 450 g)', 'us', 'salmon')).toBe('1 lb (about 450 g)');
    expect(displayStep('Heat the oven to 350°F (175°C).', 'us')).toBe('Heat the oven to 350°F (175°C).');
  });

  test.each([
    // weights
    ['12 oz', 'pasta', '340 g'],
    ['1 1/2 lb', 'ground_beef', '680 g'],
    ['2 lb', 'potato', '900 g'],
    // the author's own metric wins
    ['1 lb (about 450 g)', 'salmon', 'about 450 g'],
    ['2 3/4 cups (350 g)', 'flour', '350 g'],
    ['2 cups (about 7 oz / 200 g)', 'cheddar', 'about 200 g'],
    ['2 lb (900 g, 4–5 apples)', 'apple', '900 g (4–5 apples)'],
    // cups: weighed when we know the weight, ml otherwise
    ['2 cups', 'flour', '250 g'],
    ['1/2 cup (1 stick)', 'butter', '115 g'],
    ['8 tbsp (1 stick)', 'butter', '115 g'],
    ['1 cup', 'milk', '240 ml'],
    ['1/3 cup', 'olive_oil', '80 ml'],
    ['8 cups', 'chicken_broth', '1.9 litres'],
    ['2 packed cups', 'spinach', '60 g'],
    ['3 cups (about 5 oz)', 'egg_noodles', 'about 140 g'],
    ['12 oz (about 3 cups)', 'cheddar', '340 g'],
    // cans become the tin a metric shopper buys
    ['1 can (15 oz)', 'black_beans', '1 can (400 g)'],
    ['2 cans (28 oz each)', 'canned_tomatoes', '2 cans (800 g each)'],
    ['1 can (13.5 oz)', 'coconut_milk', '1 can (400 ml)'],
    ['1 can (28 oz / 800 g)', 'canned_tomatoes', '1 can (800 g)'],
    // counts and notes
    ['1 large head (about 1 1/4 lb)', 'broccoli', '1 large head (about 570 g)'],
    ['4–5 (about 1 1/2 cups mashed)', 'banana', '4–5 (about 340 g mashed)'],
    // combinations and spoons
    ['1/4 cup + 1 1/2 cups', 'sugar', '50 g + 300 g'],
    ['3/4 cup + 2 tbsp', 'butter', '170 g + 2 tbsp'],
    ['1 cup, plus 2 tbsp for the glaze', 'milk', '240 ml, plus 2 tbsp for the glaze'],
    ['1 1/2 tsp', 'baking_powder', '1 1/2 tsp'],
    ['1–2 tbsp', 'butter', '1–2 tbsp'],
    ['to taste', 'salt', 'to taste'],
    ['3', 'garlic', '3'],
  ])('%s %s → %s', (q, id, expected) => {
    expect(metric(q, id)).toBe(expected);
  });

  test('rice is weighed raw or cooked', () => {
    expect(metric('1 cup', 'rice', 'long-grain white rice')).toBe('185 g');
    expect(metric('3 cups', 'rice', 'cooked white rice, chilled')).toBe('480 g');
  });
});

describe('steps in metric', () => {
  test('oven temperatures get fan and gas mark; doneness temperatures stay plain', () => {
    expect(step('Heat the oven to 350°F (175°C).')).toBe('Heat the oven to 175°C (155°C fan, gas 4).');
    expect(step('Bake at 425°F (220°C) until golden.')).toBe('Bake at 220°C (200°C fan, gas 7) until golden.');
    expect(step('until cooked through (165°F / 74°C inside).')).toBe('until cooked through (74°C inside).');
    expect(step('Warm the milk (about 100°F / 38°C).')).toBe('Warm the milk (about 38°C).');
    expect(step('Heat the air fryer to 400°F (200°C).')).toBe('Heat the air fryer to 200°C.');
    expect(step('Bake at 400°F.')).toBe('Bake at 200°C (180°C fan, gas 6).');
    expect(step('Fry until it reads 350°F on a thermometer')).toContain('180°C');
  });

  test('lengths become centimetres or millimetres', () => {
    expect(step('Grease a 9-by-5-inch loaf pan.')).toBe('Grease a 23 × 13 cm loaf pan.');
    expect(step('roll it into a rectangle about 12 by 16 inches')).toBe('roll it into a rectangle about 30 × 41 cm');
    expect(step('Pound to an even 1/4-inch thickness.')).toBe('Pound to an even 6 mm thickness.');
    expect(step('Shape into a 1-inch-thick square.')).toBe('Shape into a 2.5 cm thick square.');
    expect(step('about 3/4 inch thick')).toBe('about 2 cm thick');
    expect(step('Butter a 1 1/2-quart baking dish.')).toBe('Butter a 1.4-litre baking dish.');
  });

  test('cups in steps follow the ingredient they measure', () => {
    expect(step('Save 1/2 cup of the pasta water.')).toBe('Save 120 ml of the pasta water.');
    expect(step('Toss with 1/4 cup of the sugar.')).toBe('Toss with 50 g of the sugar.');
    expect(step('Knead in 1/4 cup of the softened butter.')).toBe('Knead in 55 g of the softened butter.');
    expect(step('Melt 8 tbsp (1 stick) of the butter.')).toBe('Melt 8 tbsp (115 g) of the butter.');
  });

  test('counts that look like measures are left alone', () => {
    expect(step('Line a 12-cup muffin tin.')).toBe('Line a 12-cup muffin tin.');
    expect(step('Scoop rounded 2-tablespoon balls.')).toBe('Scoop rounded 2-tablespoon balls.');
  });
});

describe('the whole library in metric', () => {
  const IMPERIAL =
    /°\s*F\b|\b\d[\d/ –-]*\s*(?:cups?|ounces?|oz|pounds?|lbs?|quarts?|sticks?|inch(?:es)?)\b(?!-)|\d-inch\b|\d-quart\b/i;

  test('no US measures are left in any quantity', () => {
    const left = RECIPES.flatMap(r =>
      r.ingredients
        .map(i => displayQuantity(i.quantityText, 'metric', i.ingredientId, i.displayName))
        .filter(q => IMPERIAL.test(q))
        .map(q => `${r.id}: ${q}`),
    );
    expect(left).toEqual([]);
  });

  test('no US measures or °F are left in any step', () => {
    const left = RECIPES.flatMap(r =>
      r.steps
        .map(s => displayStep(s, 'metric', ingredientIndex))
        .filter(s => IMPERIAL.test(s.replace(/\b\d+-cup muffin\b/g, '')))
        .map(s => `${r.id}: ${s}`),
    );
    expect(left).toEqual([]);
  });

  test('no US measures are left in ingredient names or preparation notes', () => {
    const left = RECIPES.flatMap(r =>
      r.ingredients
        .flatMap(i => [i.displayName, i.preparation ?? ''])
        .map(t => displayStep(t, 'metric', ingredientIndex))
        .filter(t => IMPERIAL.test(t))
        .map(t => `${r.id}: ${t}`),
    );
    expect(left).toEqual([]);
  });

  test('US mode never changes a recipe', () => {
    for (const r of RECIPES) {
      for (const i of r.ingredients) expect(displayQuantity(i.quantityText, 'us', i.ingredientId)).toBe(i.quantityText);
      for (const s of r.steps) expect(displayStep(s, 'us', ingredientIndex)).toBe(s);
    }
  });
});
