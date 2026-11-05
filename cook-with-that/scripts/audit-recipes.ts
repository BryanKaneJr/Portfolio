/**
 * Recipe audit: heuristics a script can check across the whole library, written to docs/recipe-audit.md
 * (and, with --json <file>, as per-recipe flags for reviewers). Flags are leads to read, not verdicts:
 * `npm run check` already enforces the hard rules.
 *
 *   npm run audit:recipes
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INGREDIENTS } from '../src/data/ingredients';
import { RECIPES } from '../src/data/recipes';
import type { Recipe } from '../src/data/types';
import { buildIngredientIndex, normalizeText, singularize } from '../src/logic/normalizeIngredient';
import { displayQuantity } from '../src/logic/units';

const index = buildIngredientIndex(INGREDIENTS);
type Flag = { check: string; detail: string };
const flags = new Map<string, Flag[]>();
const flag = (r: Recipe, check: string, detail: string) =>
  flags.set(r.id, [...(flags.get(r.id) ?? []), { check, detail }]);

const words = (t: string) => singularize(normalizeText(t)).split(' ').filter(Boolean);
/** Words that describe rather than name a food, so they can't show an ingredient is used. */
const DESCRIBERS = new Set(
  (
    'fresh dried ground whole large small medium extra virgin unsalted salted boneless skinless shredded grated ' +
    'sliced diced chopped minced cooked raw ripe frozen canned low sodium reduced fat free plain sweet hot cold warm ' +
    'red green yellow white black brown light dark fine coarse thick thin cut and or of for the a to in with into ' +
    'about each more plus divided optional packed lean pure leaf leaves stalk stalks clove cloves can cans jar ' +
    'bunch head sprig sprigs piece pieces style homemade store bought kosher sea flaky ounce pound cup tsp tbsp'
  ).split(' '),
);
/** Steps that name ingredients collectively ("the spices", "the dry ingredients") cover what they don't name. */
const COLLECTIVE =
  /\b(ingredients|spices|seasonings?|seasoning mix|herbs|vegetables|veggies|dressing|marinade|sauce ingredients|everything|spice mix|rub|glaze|topping|filling|batter|dough)\b/;

/** Raw proteins whose recipes should give a safe internal temperature or an unmistakable doneness test. */
const NEEDS_TEMP = new Set([
  'chicken', 'turkey_breast', 'ground_turkey', 'ground_beef', 'ground_pork', 'ground_lamb', 'pork_chops',
  'pork_tenderloin', 'pork_loin', 'sausage', 'salmon', 'cod', 'tilapia', 'tuna_steak', 'lamb_chops',
  'sirloin_steak', 'flank_steak', 'ribeye_steak',
]); // prettier-ignore
/** Pantry items that are solid, so a cup measure should show in grams in metric mode. */
const SOLID_PANTRY =
  /nut|almond|pecan|walnut|peanut|seed|raisin|cranberr|apricot|date|chocolate|chip|coconut|olive|crumb|cracker|oat|sugar|cereal|marshmallow|pepper|caper|cornflake|tomato(?!.*(sauce|paste|puree|juice))/;

/** What a step may call an ingredient generically: "the beef" for flank steak, "the fish" for cod. */
function kindWords(id: string): string[] {
  if (/beef|steak|chuck|sirloin|flank|ribeye|roast/.test(id)) return ['beef', 'steak', 'meat'];
  if (/pork|ham|bacon|sausage|kielbasa|chorizo|pancetta|prosciutto/.test(id)) return ['pork', 'meat'];
  if (/lamb/.test(id)) return ['lamb', 'meat'];
  if (/chicken|turkey/.test(id)) return ['chicken', 'turkey', 'meat', 'poultry'];
  if (/cod|tilapia|salmon|tuna|sardine|fish/.test(id)) return ['fish', 'fillet'];
  if (id === 'eggs') return ['egg', 'yolk', 'white'];
  if (/bean|chickpea|lentil|pea/.test(id)) return ['bean', 'legume'];
  if (/cheese|cheddar|mozzarella|parmesan|feta|ricotta|swiss|provolone|jack|gruyere|cotija|paneer/.test(id))
    return ['cheese'];
  if (/pasta|noodle|spaghetti|macaroni/.test(id)) return ['pasta', 'noodle'];
  if (/rice/.test(id)) return ['rice'];
  return [];
}

const LIBRARY = RECIPES;
for (const r of LIBRARY) {
  const stepText = ` ${words(r.steps.join(' ')).join(' ')} `;
  const required = r.ingredients.filter(i => !i.optional);

  // 1. Listed but never used: no step names the food (by catalog name, alias, the line's own words or its kind).
  // A collective word ("the spices", "the dressing") can stand for pantry and spice items, never for produce,
  // meat, dairy or grains.
  const collective = COLLECTIVE.test(normalizeText(r.steps.join(' ')));
  for (const ing of required) {
    const cat = index.byId.get(ing.ingredientId);
    if (collective && (cat?.category === 'spice' || cat?.category === 'pantry')) continue;
    const terms = [ing.displayName, cat?.name ?? '', ...(cat?.aliases ?? []), ...kindWords(ing.ingredientId)];
    const used = terms.some(t => {
      const ws = words(t).filter(w => !DESCRIBERS.has(w) && w.length > 2);
      return ws.length > 0 && ws.some(w => stepText.includes(` ${w} `));
    });
    if (!used) flag(r, 'unused-ingredient', `"${ing.displayName}" (${ing.quantityText}) isn't named in any step`);
  }

  // 2. Raw meat or fish with no internal temperature in the steps.
  const meats = required.filter(i => NEEDS_TEMP.has(i.ingredientId)).map(i => i.ingredientId);
  if (meats.length && !/°\s*[FC]/.test(r.steps.join(' ')))
    flag(r, 'no-doneness-temp', `${[...new Set(meats)].join(', ')} with no internal temperature in the steps`);

  // 3. Times.
  const total = r.prepMinutes + r.cookMinutes;
  const cooks = /\b(oven|bake|baked|roast|simmer|boil|fry|fried|sauté|saute|grill|broil|sear|toast|microwave)/i.test(
    r.steps.join(' '),
  );
  if (r.cookMinutes === 0 && cooks) flag(r, 'time', 'cookMinutes is 0 but the steps cook something');
  if (total < 5) flag(r, 'time', `total time ${total} min`);
  if (total > 360) flag(r, 'time', `total time ${total} min (check it includes only active waits the cook must plan)`);

  // 4. Servings.
  // (Cookies, bars and bites count pieces, so they can go higher.)
  const pieces = r.dishTypes.includes('baked_goods') || r.meals.some(m => m === 'dessert' || m === 'snack');
  if (r.servings < 1 || r.servings > (pieces ? 48 : 16)) flag(r, 'servings', `servings ${r.servings}`);

  // 5. A required line with no number and no "to taste"-style amount.
  for (const ing of required)
    if (
      !/\d|taste|pinch|dash|splash|handful|drizzle|as needed|for (serving|frying|greasing|the pan)/i.test(
        ing.quantityText,
      )
    )
      flag(r, 'vague-quantity', `"${ing.displayName}": "${ing.quantityText}"`);

  // 6. Solids shown in ml in metric mode (no weight per cup yet).
  for (const ing of r.ingredients) {
    const cat = index.byId.get(ing.ingredientId);
    if (!cat || !/\bcups?\b/.test(ing.quantityText)) continue;
    const metric = displayQuantity(ing.quantityText, 'metric', ing.ingredientId, ing.displayName);
    const solid = cat.category !== 'pantry' || SOLID_PANTRY.test(ing.ingredientId);
    const liquidish =
      /broth|stock|milk|cream|juice|sauce|oil|vinegar|wine|water|syrup|honey|yogurt|kefir|buttermilk|ketchup|mustard|mayonnaise|half_and_half|canned_tomatoes|clams|eggs/.test(
        ing.ingredientId,
      ) || /\bjuice\b/i.test(ing.displayName);
    if (/\bml\b/.test(metric) && solid && !liquidish)
      flag(r, 'metric-ml-solid', `${ing.ingredientId}: "${ing.quantityText}" → "${metric}"`);
  }

  // 7. No dish type.
  if (!r.dishTypes.length) flag(r, 'no-dish-type', r.meals.join('/'));

  // 8. Very long steps (hard to follow on a phone).
  r.steps.forEach((s, i) => s.length > 450 && flag(r, 'long-step', `step ${i + 1} is ${s.length} characters`));
}

// 9. Ratios a cook would check: leavening, yeast and salt per cup of flour; liquid per cup of rice and other grains;
// gelatin per cup of liquid; pasta and meat per serving; oven and frying temperatures. Ranges are deliberately wide:
// a flag means "look at this", and a good recipe can sit outside them for a reason.
const CUP = 1,
  TBSP = 1 / 16,
  TSP = 1 / 48;
const OZ_PER_LB = 16;
const parseNum = (n: string) => {
  const t = n.trim();
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) return +mixed[1] + +mixed[2] / +mixed[3];
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  return frac ? +frac[1] / +frac[2] : Number(t);
};
const NUMBER = String.raw`\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?`;
/** Total volume in cups of a quantity like "1 1/2 cups", "1/4 cup + 2 tbsp", "2–3 tsp" (ranges take the middle). */
function cups(q: string): number | undefined {
  const text = q.replace(/\([^)]*\)/g, ' ');
  let total = 0;
  let found = false;
  const re = new RegExp(
    String.raw`(${NUMBER})(?:\s*[–-]\s*(${NUMBER}))?\s*(cups?|tablespoons?|tbsps?|teaspoons?|tsps?)\b`,
    'gi',
  );
  for (const m of text.matchAll(re)) {
    const n = m[2] ? (parseNum(m[1]) + parseNum(m[2])) / 2 : parseNum(m[1]);
    const unit = m[3].toLowerCase();
    total += n * (unit.startsWith('c') ? CUP : unit.startsWith('tb') || unit.startsWith('tablespoon') ? TBSP : TSP);
    found = true;
  }
  if (!found && /envelope|packet/i.test(q)) {
    const n = Number(/(\d+)/.exec(q)?.[1] ?? 1);
    return n * 2.25 * TSP; // a packet of yeast or an envelope of gelatin holds about 2 1/4 tsp
  }
  return found ? total : undefined;
}
/** Weight in ounces of "12 oz", "1 1/2 lb", "1 lb (450 g)". */
function ounces(q: string): number | undefined {
  const m = new RegExp(String.raw`(${NUMBER})(?:\s*[–-]\s*(${NUMBER}))?\s*(oz|ounces?|lbs?|pounds?)\b`, 'i').exec(q);
  if (!m) return undefined;
  const n = m[2] ? (parseNum(m[1]) + parseNum(m[2])) / 2 : parseNum(m[1]);
  return /^(lb|pound)/i.test(m[3]) ? n * OZ_PER_LB : n;
}
const sumCups = (r: Recipe, test: (id: string) => boolean) =>
  r.ingredients.filter(i => test(i.ingredientId) && !i.optional).reduce((n, i) => n + (cups(i.quantityText) ?? 0), 0);
const has = (r: Recipe, id: string) => r.ingredients.some(i => i.ingredientId === id && !i.optional);
const fmt = (x: number) => String(Math.round(x * 100) / 100);
const LIQUID = /^(water|chicken_broth|beef_broth|vegetable_broth|broth|stock|coconut_milk|milk|almond_milk|oat_milk)$/;
const GRAIN_LIQUID: [RegExp, number, number, string][] = [
  [/^rice$/, 1.2, 2.3, 'white rice'],
  [/^brown_rice$/, 1.7, 3, 'brown rice'],
  [/^wild_rice$/, 2.5, 4.5, 'wild rice'],
  [/^quinoa$/, 1.4, 2.6, 'quinoa'],
  [/^couscous$/, 0.9, 1.8, 'couscous'],
  [/^pearl_barley$/, 2.2, 4.5, 'barley'],
];
const MEATS =
  /chicken(?!_broth)|turkey(?!_bacon)|beef(?!_broth)|steak|pork|lamb|sausage|shrimp|salmon|cod|tilapia|fish|chuck|ground_/;
for (const r of LIBRARY) {
  // Cornmeal counts too: cornbread and hush puppy batters are leavened for both.
  const flour = sumCups(r, id => id === 'flour' || id === 'whole_wheat_flour' || id === 'cornmeal');
  if (flour >= 0.5) {
    const perCup = (id: string) => sumCups(r, x => x === id) / TSP / flour;
    const bp = perCup('baking_powder');
    // A baking-soda bath (pretzels, bagels) isn't in the dough.
    const soda = r.steps.some(st => /baking soda/i.test(st) && /\b(bath|boil|simmering water)\b/i.test(st))
      ? 0
      : perCup('baking_soda');
    const yeast = perCup('yeast');
    const salt = perCup('salt');
    // Pancake and waffle batters take about 3 tsp a cup; cakes and quick breads 1–1 1/4.
    const griddle = /pancake|waffle|flapjack|hotcake/i.test(r.title);
    if (bp > (griddle ? 3.5 : 2.25))
      flag(r, 'ratio', `${fmt(bp)} tsp baking powder per cup of flour (usual 1–1 1/4; pancakes about 3)`);
    if (soda > 0.6) flag(r, 'ratio', `${fmt(soda)} tsp baking soda per cup of flour (usual 1/4, up to 1/2 with acid)`);
    if (has(r, 'yeast') && (yeast > 1.25 || yeast < 0.15))
      flag(r, 'ratio', `${fmt(yeast)} tsp yeast per cup of flour (usual 1/2–3/4)`);
    if (salt > 1.1 && r.dishTypes.includes('baked_goods'))
      flag(r, 'ratio', `${fmt(salt)} tsp salt per cup of flour (usual 1/4–3/4 in baking)`);
    const leavened = bp + soda + yeast > 0 || has(r, 'eggs');
    if (
      !leavened &&
      r.dishTypes.includes('baked_goods') &&
      !/shortbread|crust|pastry|biscotti|cracker|tortilla|pie|crisp|crumble|streusel/i.test(r.title)
    )
      flag(r, 'ratio', `${fmt(flour)} cups of flour with no leavening or eggs`);
  }
  if (!r.dishTypes.includes('soup') && !/risotto|pudding|congee|porridge|caldo|jook/i.test(r.title)) {
    const liquid = sumCups(r, id => LIQUID.test(id));
    for (const [re, lo, hi, name] of GRAIN_LIQUID) {
      const grain = r.ingredients
        .filter(
          i => re.test(i.ingredientId) && !i.optional && !/\bcooked\b/i.test(`${i.displayName} ${i.preparation ?? ''}`),
        )
        .reduce((n, i) => n + (cups(i.quantityText) ?? 0), 0);
      if (grain >= 0.25 && liquid > 0) {
        const ratio = liquid / grain;
        if (ratio < lo || ratio > hi)
          flag(
            r,
            'ratio',
            `${fmt(ratio)} cups of water or broth per cup of ${name} (usual ${lo}–${hi}; check what else the liquid is for)`,
          );
      }
    }
  }
  const gelatin = sumCups(r, id => id === 'unflavored_gelatin');
  if (gelatin > 0) {
    const liquid = sumCups(r, id => /milk|cream|juice|water|coffee|yogurt|buttermilk|half_and_half/.test(id));
    const perCup = gelatin / TSP / (liquid || 1);
    if (liquid && (perCup < 0.6 || perCup > 2.5))
      flag(r, 'ratio', `${fmt(perCup)} tsp gelatin per cup of liquid (usual about 1, firmer up to 2)`);
  }
  if (r.dishTypes.includes('pasta') && r.meals.includes('dinner')) {
    const oz = r.ingredients
      .filter(i => /^(pasta|egg_noodles)$/.test(i.ingredientId) && !i.optional)
      .reduce((n, i) => n + (ounces(i.quantityText) ?? 0), 0);
    if (oz && (oz / r.servings < 1.25 || oz / r.servings > 5))
      flag(r, 'ratio', `${fmt(oz / r.servings)} oz of dry pasta per serving (usual 2–4 for a main)`);
  }
  const meatOz = r.ingredients
    // Bone-in weights (whole pieces, bones for broth) say little about the meat on the plate.
    .filter(
      i =>
        MEATS.test(i.ingredientId) &&
        !i.optional &&
        !/bone|whole|drumstick|wing|leg/i.test(`${i.displayName} ${i.preparation ?? ''}`),
    )
    .reduce((n, i) => n + (ounces(i.quantityText) ?? 0), 0);
  if (meatOz / r.servings > 12)
    flag(r, 'ratio', `${fmt(meatOz / r.servings)} oz of meat or fish per serving (usual 4–8)`);
  for (const step of r.steps) {
    // Only heat settings ("heat the oil to 350°F", "oven to 400°F"), never a doneness temperature.
    for (const m of step.matchAll(/\boil\b[^.]{0,50}?\b(?:to|reaches|at)\s*(\d{3})\s*°\s*F/gi)) {
      const f = Number(m[1]);
      if (f < 300 || f > 400) flag(r, 'ratio', `frying oil at ${f}°F (usual 325–375)`);
    }
    for (const m of step.matchAll(/\boven\b[^.]{0,30}?\b(?:to|at)\s*(\d{3})\s*°\s*F/gi)) {
      const f = Number(m[1]);
      if (f < 200 || f > 525) flag(r, 'ratio', `oven at ${f}°F`);
    }
  }
}

// 10. Near-duplicates: most of the same required ingredients and a shared dish type or meal.
const req = (r: Recipe) => new Set(r.ingredients.filter(i => !i.optional).map(i => i.ingredientId));
const STAPLE = new Set(['salt', 'black_pepper', 'water', 'olive_oil', 'vegetable_oil', 'butter', 'garlic', 'onion']);
for (let a = 0; a < LIBRARY.length; a++)
  for (let b = a + 1; b < LIBRARY.length; b++) {
    const A = [...req(LIBRARY[a])].filter(x => !STAPLE.has(x));
    const B = new Set([...req(LIBRARY[b])].filter(x => !STAPLE.has(x)));
    if (A.length < 3 || B.size < 3) continue;
    const inter = A.filter(x => B.has(x)).length;
    const jac = inter / (A.length + B.size - inter);
    const share = LIBRARY[a].dishTypes.some(d => LIBRARY[b].dishTypes.includes(d));
    // Bakes share flour, sugar, eggs and butter by nature; only compare savory dishes.
    const sweet = (x: Recipe) => x.dishTypes.includes('baked_goods') || x.meals.includes('dessert');
    if (sweet(LIBRARY[a]) || sweet(LIBRARY[b])) continue;
    if (jac >= 0.6 && share) {
      flag(LIBRARY[a], 'near-duplicate', `${LIBRARY[b].id} (${Math.round(jac * 100)}% of key ingredients shared)`);
      flag(LIBRARY[b], 'near-duplicate', `${LIBRARY[a].id} (${Math.round(jac * 100)}% of key ingredients shared)`);
    }
  }

// Report.
const byCheck = new Map<string, { id: string; detail: string }[]>();
for (const [id, fs] of flags)
  for (const f of fs) byCheck.set(f.check, [...(byCheck.get(f.check) ?? []), { id, detail: f.detail }]);
const ORDER = [
  'ratio',
  'no-doneness-temp',
  'unused-ingredient',
  'vague-quantity',
  'time',
  'servings',
  'metric-ml-solid',
  'near-duplicate',
  'long-step',
  'no-dish-type',
];
const lines = [
  '# Recipe audit',
  '',
  'Generated by `npm run audit:recipes`. Do not edit by hand. Heuristic leads for review, not verdicts:',
  '`npm run check` enforces the hard rules.',
  '',
  `${LIBRARY.length} recipes; ${flags.size} with at least one flag.`,
  '',
  '| Check | Recipes |',
  '|---|---|',
  ...ORDER.map(c => `| ${c} | ${new Set((byCheck.get(c) ?? []).map(x => x.id)).size} |`),
];
for (const c of ORDER) {
  const rows = byCheck.get(c) ?? [];
  if (!rows.length) continue;
  lines.push('', `## ${c}`, '');
  for (const r of rows) lines.push(`- \`${r.id}\`: ${r.detail}`);
}
const root = join(__dirname, '..');
writeFileSync(join(root, 'docs', 'recipe-audit.md'), lines.join('\n') + '\n');
const jsonAt = process.argv.indexOf('--json');
if (jsonAt > 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify(Object.fromEntries(flags), null, 1));
console.log(`✓ ${LIBRARY.length} recipes, ${flags.size} flagged. Report: docs/recipe-audit.md`);
for (const c of ORDER) console.log(`  ${c.padEnd(20)} ${new Set((byCheck.get(c) ?? []).map(x => x.id)).size}`);
