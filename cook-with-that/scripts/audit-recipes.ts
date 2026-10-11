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

// 9. Near-duplicates: most of the same required ingredients and a shared dish type or meal.
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
