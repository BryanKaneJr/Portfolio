import { unlistedStepIngredients, type IngredientIndex } from '../../src/logic/normalizeIngredient';
import { DEFAULT_STAPLE_IDS } from '../../src/data/staples';
import type { DishType, Meal, Recipe } from '../../src/data/types';
import { mapIngredient } from './mapIngredient';
import { parseIngredientLine } from './parseIngredientLine';
import type { BlockReason, Candidate, RawRecipe, StagedIngredient } from './types';

const STAPLES = new Set(DEFAULT_STAPLE_IDS);

/** Guesses only: every draft's meal and dish tags are checked by the editor. */
const MEAL_HINTS: [Meal, RegExp][] = [
  [
    'breakfast',
    /\b(breakfast|brunch|pancakes?|waffles?|omelett?es?|oatmeal|porridge|granola|french toast|frittata|scrambled)\b/,
  ],
  [
    'dessert',
    /\b(desserts?|sweets?|cakes?|cookies?|brownies?|pudding|ice cream|cobbler|crumble|tart|fudge|candy|custard)\b/,
  ],
  ['appetizer', /\b(appetizers?|starters?|dips?|hummus|bruschetta|finger food)\b/],
  ['snack', /\b(snacks?|popcorn|energy balls?|trail mix)\b/],
  ['side', /\b(sides?|side dish)\b/],
  ['lunch', /\b(lunch|sandwich(es)?|wraps?)\b/],
  ['dinner', /\b(dinner|mains?|main course|entree|supper)\b/],
];
const DISH_HINTS: [DishType, RegExp][] = [
  ['pasta', /\b(pasta|spaghetti|penne|linguine|fettuccine|lasagna|macaroni|carbonara|rigatoni|noodles?)\b/],
  ['soup', /\b(soups?|stews?|chowder|bisque|broth|gazpacho)\b/],
  ['salad', /\b(salads?|slaw)\b/],
  ['sandwich', /\b(sandwich(es)?|wraps?|burgers?|burritos?|quesadillas?|tacos?|panini|toastie)\b/],
  ['skillet', /\b(skillet|stir[ -]?fry|fried rice|saute|hash)\b/],
  ['bake', /\b(casseroles?|bake|baked|gratin|lasagna|enchiladas?)\b/],
  ['one_pot', /\b(one[ -]pot|curry|chili|risotto|jambalaya|paella)\b/],
  ['bowl', /\b(bowls?)\b/],
  ['baked_goods', /\b(bread|muffins?|biscuits?|scones?|cakes?|cookies?|brownies?|rolls|buns|pie|loaf)\b/],
];

function guessTags<T>(hints: [T, RegExp][], text: string): T[] {
  return hints.filter(([, re]) => re.test(text)).map(([tag]) => tag);
}

export type StageOptions = {
  /** Why this entry is on the source's exclude list. */
  exclude?: string;
  /** The current library, to flag near-duplicates. */
  library?: Recipe[];
};

/** Share of required ingredients two recipes have in common (Jaccard). */
function overlap(a: Set<string>, b: Set<string>): number {
  const both = [...a].filter(x => b.has(x)).length;
  return both / (a.size + b.size - both || 1);
}

export function stageRecipe(index: IngredientIndex, raw: RawRecipe, opts: StageOptions = {}): Candidate {
  const blocked: BlockReason[] = opts.exclude ? [{ kind: 'excluded', reason: opts.exclude }] : [];
  const todo: string[] = [];
  const ingredients: StagedIngredient[] = [];

  for (const line of raw.ingredientLines) {
    const parsed = parseIngredientLine(line);
    if (!parsed.name) continue;
    const mapped = mapIngredient(index, parsed.name);
    if (mapped.status === 'not_ingredient') continue;
    if (mapped.status === 'not_in_catalog') blocked.push({ kind: 'not_in_catalog', key: mapped.key });
    else if (mapped.status === 'unmapped')
      blocked.push({
        kind: 'unmapped',
        key: mapped.key,
        ...(mapped.suggestion ? { suggestion: mapped.suggestion } : {}),
      });
    ingredients.push({
      raw: parsed.raw,
      ids: mapped.status === 'mapped' ? mapped.ids : [],
      displayName: parsed.name,
      quantityText: parsed.quantityText,
      ...(parsed.preparation ? { preparation: parsed.preparation } : {}),
      optional: parsed.optional,
    });
    if (!parsed.quantityText && !parsed.optional) todo.push(`quantity for "${parsed.name}"`);
  }
  const listed = ingredients.flatMap(i => i.ids);
  for (const { term } of unlistedStepIngredients(index, raw.steps, listed))
    todo.push(`steps use "${term}" but the list doesn't`);
  // Staples (flour, butter, salt…) don't define a dish, so they don't count toward "the same recipe".
  const defining = (ids: string[]) => new Set(ids.filter(id => !STAPLES.has(id)));
  const required = defining(ingredients.filter(i => !i.optional).flatMap(i => i.ids));
  const headNoun = (title: string) =>
    title
      .toLowerCase()
      .replace(/[^a-z ]/g, '')
      .trim()
      .split(/\s+/)
      .pop();
  for (const r of opts.library ?? []) {
    const theirs = defining(r.ingredients.filter(i => !i.optional).map(i => i.ingredientId));
    const same = overlap(required, theirs);
    // Same dish name ("Fresh Guacamole" / "Simple Guacamole") needs less ingredient overlap to count.
    if (required.size && (same >= 0.75 || (same >= 0.4 && headNoun(r.title) === headNoun(raw.title))))
      todo.push(`close to "${r.id}" already in the library`);
  }
  if (!ingredients.length) blocked.push({ kind: 'no_ingredients' });
  if (!raw.steps.length) blocked.push({ kind: 'no_steps' });

  const text = `${raw.title} ${raw.tags.join(' ')}`.toLowerCase();
  const meals = guessTags(MEAL_HINTS, text);
  const dishTypes = guessTags(DISH_HINTS, text);
  if (!meals.length) todo.push('meal tag');
  if (raw.servings === undefined) todo.push('servings');
  if (raw.prepMinutes === undefined) todo.push('prep minutes');
  if (raw.cookMinutes === undefined) todo.push('cook minutes');

  return {
    key: raw.key,
    title: raw.title,
    ...(raw.author ? { author: raw.author } : {}),
    ...(raw.description ? { description: raw.description } : {}),
    location: raw.location,
    ingredients,
    steps: raw.steps,
    ...(raw.servings !== undefined ? { servings: raw.servings } : {}),
    ...(raw.prepMinutes !== undefined ? { prepMinutes: raw.prepMinutes } : {}),
    ...(raw.cookMinutes !== undefined ? { cookMinutes: raw.cookMinutes } : {}),
    tags: raw.tags,
    meals,
    dishTypes,
    blocked,
    todo,
  };
}

const blockerKey = (b: BlockReason): string | undefined =>
  b.kind === 'not_in_catalog' || b.kind === 'unmapped' ? b.key : undefined;

/**
 * Greedy "what to add next": repeatedly pick the missing ingredient that unblocks the
 * most recipes once everything picked so far is in the catalog.
 */
export function unlockOrder(candidates: Candidate[], limit = 30): { key: string; unlocks: number; total: number }[] {
  const need = candidates
    .filter(c => !c.blocked.some(b => b.kind === 'no_ingredients' || b.kind === 'no_steps' || b.kind === 'excluded'))
    .map(c => new Set(c.blocked.map(blockerKey).filter((k): k is string => !!k)))
    .filter(s => s.size > 0);
  const added = new Set<string>();
  const out: { key: string; unlocks: number; total: number }[] = [];
  let total = 0;
  while (out.length < limit) {
    const score = new Map<string, number>();
    for (const s of need) {
      const left = [...s].filter(k => !added.has(k));
      if (left.length === 0) continue;
      // Weight by how close the recipe is to importable: one missing item counts most.
      for (const k of left) score.set(k, (score.get(k) ?? 0) + 1 / left.length);
    }
    const best = [...score.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (!best) break;
    added.add(best[0]);
    const unlocked = need.filter(s => [...s].every(k => added.has(k))).length;
    out.push({ key: best[0], unlocks: unlocked - total, total: unlocked });
    total = unlocked;
  }
  return out;
}

export function stageReport(source: string, candidates: Candidate[], alreadyImported: Set<string>): string {
  const ready = candidates.filter(c => c.blocked.length === 0);
  const excluded = candidates.filter(c => c.blocked.some(b => b.kind === 'excluded'));
  const structural = candidates.filter(
    c => !excluded.includes(c) && c.blocked.some(b => b.kind === 'no_ingredients' || b.kind === 'no_steps'),
  );
  const counts = new Map<string, { recipes: number; only: number; suggestion?: string; inMap: boolean }>();
  for (const c of candidates.filter(c => !excluded.includes(c))) {
    const keys = [...new Set(c.blocked.map(blockerKey).filter((k): k is string => !!k))];
    for (const b of c.blocked) {
      const k = blockerKey(b);
      if (!k) continue;
      const e = counts.get(k) ?? { recipes: 0, only: 0, inMap: b.kind === 'not_in_catalog' };
      if (b.kind === 'unmapped' && b.suggestion) e.suggestion = b.suggestion;
      counts.set(k, e);
    }
    for (const k of keys) {
      const e = counts.get(k)!;
      e.recipes++;
      if (keys.length === 1) e.only++;
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1].recipes - a[1].recipes || a[0].localeCompare(b[0]));
  const lines = [
    `# Import report: ${source}`,
    '',
    'Generated by `npm run import:stage`. Do not edit by hand.',
    '',
    `- Recipes read: ${candidates.length}`,
    `- Every ingredient maps to the catalog: ${ready.length}`,
    `  - already imported: ${ready.filter(c => alreadyImported.has(c.key)).length}`,
    `  - ready to draft: ${ready.filter(c => !alreadyImported.has(c.key)).length}`,
    `- Excluded (provenance doubts, see the source definition): ${excluded.length}`,
    `- Missing ingredients or steps in the source: ${structural.length}`,
    `- Blocked by at least one ingredient: ${candidates.length - ready.length - excluded.length - structural.length}`,
    '',
    '## Add to the catalog next',
    '',
    'Greedy order: each row assumes the rows above it were added.',
    '',
    '| # | Ingredient | Recipes unlocked | Running total |',
    '|---|---|---|---|',
    ...unlockOrder(candidates).map((u, i) => `| ${i + 1} | ${u.key} | ${u.unlocks} | ${u.total} |`),
    '',
    '## Every blocking ingredient',
    '',
    '`mapped: no` means nobody has reviewed the name yet: add it to `scripts/import/ingredient-map.ts`',
    '(a catalog ID, or `null` if it needs a new catalog entry). The suggestion is a word match, never applied automatically.',
    '',
    '| Ingredient | Blocks | Only blocker | Reviewed | Suggestion |',
    '|---|---|---|---|---|',
    ...top.map(([k, e]) => `| ${k} | ${e.recipes} | ${e.only} | ${e.inMap ? 'yes' : 'no'} | ${e.suggestion ?? ''} |`),
    '',
  ];
  return lines.join('\n');
}
