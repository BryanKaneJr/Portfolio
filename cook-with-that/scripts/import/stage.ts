import { unlistedStepIngredients, type IngredientIndex } from '../../src/logic/normalizeIngredient';
import { DEFAULT_STAPLE_IDS } from '../../src/data/staples';
import type { DishType, Meal, Recipe } from '../../src/data/types';
import { mapIngredient } from './mapIngredient';
import { parseIngredientLine } from './parseIngredientLine';
import type { BlockReason, Candidate, CatalogAddition, RawRecipe, StagedIngredient } from './types';

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
  const adds: CatalogAddition[] = [];

  for (const line of raw.ingredientLines) {
    const parsed = parseIngredientLine(line);
    if (!parsed.name) continue;
    const mapped = mapIngredient(index, parsed.name);
    if (mapped.status === 'not_ingredient') continue;
    if (mapped.status === 'ambiguous') blocked.push({ kind: 'ambiguous', key: mapped.key });
    else if (mapped.status === 'missing' && !adds.some(a => a.id === mapped.addition.id)) adds.push(mapped.addition);
    else if (mapped.status === 'unmapped')
      blocked.push({
        kind: 'unmapped',
        key: mapped.key,
        ...(mapped.suggestion ? { suggestion: mapped.suggestion } : {}),
      });
    ingredients.push({
      raw: parsed.raw,
      ids: mapped.status === 'mapped' ? mapped.ids : mapped.status === 'missing' ? [mapped.addition.id] : [],
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
    adds,
    todo,
  };
}

const blockerKey = (b: BlockReason): string | undefined =>
  b.kind === 'ambiguous' || b.kind === 'unmapped' ? b.key : undefined;

/**
 * Greedy "what to review next": repeatedly pick the unreviewed or too-vague ingredient name
 * that unblocks the most recipes once everything picked so far is resolved.
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
  const excluded = candidates.filter(c => c.blocked.some(b => b.kind === 'excluded'));
  const structural = candidates.filter(
    c => !excluded.includes(c) && c.blocked.some(b => b.kind === 'no_ingredients' || b.kind === 'no_steps'),
  );
  const open = candidates.filter(c => !alreadyImported.has(c.key));
  const draftable = open.filter(c => c.blocked.length === 0);
  const counts = new Map<string, { recipes: number; only: number; suggestion?: string; vague: boolean }>();
  for (const c of candidates.filter(c => !excluded.includes(c))) {
    const keys = [...new Set(c.blocked.map(blockerKey).filter((k): k is string => !!k))];
    for (const b of c.blocked) {
      const k = blockerKey(b);
      if (!k) continue;
      const e = counts.get(k) ?? { recipes: 0, only: 0, vague: b.kind === 'ambiguous' };
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
  const pending = new Map<string, { name: string; category: string; recipes: number }>();
  for (const c of draftable)
    for (const a of c.adds) {
      const e = pending.get(a.id) ?? { name: a.name, category: a.category, recipes: 0 };
      e.recipes++;
      pending.set(a.id, e);
    }
  const lines = [
    `# Import report: ${source}`,
    '',
    'Generated by `npm run import:stage`. Do not edit by hand.',
    '',
    `- Recipes read: ${candidates.length}`,
    `- Already imported: ${candidates.length - open.length}`,
    `- Ready to draft: ${draftable.length}`,
    `  - every ingredient already in the catalog: ${draftable.filter(c => !c.adds.length).length}`,
    `  - adds at least one reviewed ingredient to the catalog when drafted: ${draftable.filter(c => c.adds.length).length}`,
    `- Excluded (provenance doubts, see the source definition): ${excluded.length}`,
    `- Missing ingredients or steps in the source: ${structural.length}`,
    `- Waiting on ingredient review: ${open.length - draftable.length - excluded.filter(c => open.includes(c)).length - structural.filter(c => open.includes(c)).length}`,
    '',
    '## Review next',
    '',
    'Ingredient names nobody has reviewed yet, or that are too vague to index. Greedy order: each row assumes',
    'the rows above it were resolved in `scripts/import/ingredient-map.ts`.',
    '',
    '| # | Name | Recipes unblocked | Running total |',
    '|---|---|---|---|',
    ...unlockOrder(candidates).map((u, i) => `| ${i + 1} | ${u.key} | ${u.unlocks} | ${u.total} |`),
    '',
    '## Catalog additions waiting on a draft',
    '',
    'Reviewed ingredients the catalog lacks. Drafting a recipe that needs one adds it to `src/data/ingredients.ts`.',
    '',
    '| ID | Name | Category | Ready recipes that need it |',
    '|---|---|---|---|',
    ...[...pending.entries()]
      .sort((a, b) => b[1].recipes - a[1].recipes || a[0].localeCompare(b[0]))
      .map(([id, e]) => `| ${id} | ${e.name} | ${e.category} | ${e.recipes} |`),
    '',
    '## Every blocking name',
    '',
    'Resolve each in `scripts/import/ingredient-map.ts`: a catalog ID, `{ add: category }` for a real ingredient',
    'the catalog should gain, `null` if too vague, or `false` for equipment. The suggestion is a word match,',
    'never applied automatically.',
    '',
    '| Name | Blocks | Only blocker | Status | Suggestion |',
    '|---|---|---|---|---|',
    ...top.map(
      ([k, e]) =>
        `| ${k} | ${e.recipes} | ${e.only} | ${e.vague ? 'too vague' : 'unreviewed'} | ${e.suggestion ?? ''} |`,
    ),
    '',
  ];
  return lines.join('\n');
}
