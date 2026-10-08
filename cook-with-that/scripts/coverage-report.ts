/*
 * Run: npm run coverage-report
 * For common ingredient pairs/triples, how many exact and close results exist?
 * Use this to find gaps and write recipes deliberately to fill them.
 */
import { INGREDIENTS, RECIPES } from '../src/data/catalog';
import { DISH_TYPES, EMPTY_SEARCH, MEALS } from '../src/data/types';
import { runSearch } from '../src/logic/matchRecipes';

const COMMON = ['chicken', 'eggs', 'rice', 'pasta', 'potato', 'garlic', 'onion', 'spinach', 'tomato', 'black_beans', 'cheddar', 'ground_beef', 'broccoli', 'butter'];

function combos<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return arr.flatMap((x, i) => combos(arr.slice(i + 1), k - 1).map(c => [x, ...c]));
}

const name = (id: string) => INGREDIENTS.find(i => i.id === id)?.name ?? id;

for (const k of [2, 3]) {
  let zero = 0, exactHit = 0, closeOnly = 0;
  const gaps: string[] = [];
  const all = combos(COMMON, k);
  for (const useIds of all) {
    const res = runSearch(RECIPES, { ...EMPTY_SEARCH, useIds });
    if (res.exact.length) exactHit++;
    else if (res.close.length) closeOnly++;
    else { zero++; gaps.push(useIds.map(name).join(' + ')); }
  }
  console.log(`\n${k}-ingredient combos of ${COMMON.length} common items: ${all.length}`);
  console.log(`  exact ≥1: ${exactHit}  (${Math.round((exactHit / all.length) * 100)}%)`);
  console.log(`  close only: ${closeOnly}`);
  console.log(`  nothing: ${zero}`);
  if (k === 2 && gaps.length) console.log(`  pairs with nothing: ${gaps.slice(0, 25).join('; ')}${gaps.length > 25 ? ' …' : ''}`);
}

console.log('\nRecipes per meal:');
for (const m of MEALS) console.log(`  ${m.padEnd(10)} ${RECIPES.filter(r => r.meals.includes(m)).length}`);
console.log('Recipes per dish type:');
for (const d of DISH_TYPES) console.log(`  ${d.padEnd(12)} ${RECIPES.filter(r => r.dishTypes.includes(d)).length}`);

const usage = new Map<string, number>();
for (const r of RECIPES) for (const id of new Set(r.ingredients.filter(i => !i.optional).map(i => i.ingredientId))) usage.set(id, (usage.get(id) ?? 0) + 1);
const unused = INGREDIENTS.filter(i => !usage.has(i.id)).map(i => i.name);
console.log(`\nIngredients no recipe requires yet (${unused.length}): ${unused.join(', ')}`);
