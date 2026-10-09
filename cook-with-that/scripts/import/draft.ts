import type { IngredientIndex } from '../../src/logic/normalizeIngredient';
import { DEFAULT_STAPLE_IDS } from '../../src/data/staples';
import { INGREDIENTS_BY_POPULARITY } from '../../src/data/popularity';
import type { SourceDef } from './sources';
import type { Candidate } from './types';

/** Single-quoted TS string literal (double quotes when that avoids escapes, like Prettier). */
export function q(text: string): string {
  if (text.includes("'") && !text.includes('"')) return `"${text.replace(/\\/g, '\\\\')}"`;
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function recipeId(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Line = { id: string; displayName: string; quantityText: string; preparation?: string; optional: boolean };

/** One RecipeIngredient per catalog ID: split "salt and pepper", merge repeats, drop optional repeats of required items. */
function ingredientLines(index: IngredientIndex, c: Candidate): Line[] {
  const lines: Line[] = [];
  for (const ing of c.ingredients) {
    const ids = ing.ids.length ? ing.ids : [`TODO_${ing.displayName.replace(/\W+/g, '_').toLowerCase()}`];
    for (const id of ids) {
      const displayName =
        ids.length > 1 ? (index.byId.get(id)?.name.toLowerCase() ?? ing.displayName) : ing.displayName.trim();
      const quantityText = ing.quantityText || 'TODO';
      const existing = lines.find(l => l.id === id && l.optional === ing.optional);
      if (existing) {
        existing.quantityText = `${existing.quantityText} + ${quantityText}`;
        if (ing.preparation) existing.preparation = [existing.preparation, ing.preparation].filter(Boolean).join('; ');
        continue;
      }
      lines.push({
        id,
        displayName,
        quantityText,
        ...(ing.preparation ? { preparation: ing.preparation } : {}),
        optional: ing.optional,
      });
    }
  }
  const required = new Set(lines.filter(l => !l.optional).map(l => l.id));
  return lines.filter(l => !l.optional || !required.has(l.id));
}

const num = (n: number | undefined) => (n === undefined ? 'NaN, // TODO' : `${n},`);

/** TypeScript for one draft recipe, in the src/data/recipes.ts format. */
export function draftRecipeCode(index: IngredientIndex, c: Candidate, source: SourceDef, id: string): string {
  const description = c.description ?? 'TODO: one line on what makes this dish worth cooking';
  const steps =
    source.textPolicy === 'reuse'
      ? c.steps
      : ['TODO: write original directions. This source allows ideas and ingredient lists only, not its wording.'];
  const ing = ingredientLines(index, c).map(l => {
    const args = [l.id, l.displayName, l.quantityText, ...(l.preparation ? [l.preparation] : [])].map(q).join(', ');
    return `      ${l.optional ? 'opt' : 'r'}(${args}),`;
  });
  const checks = c.todo.filter(t => t.startsWith('steps use') || t.startsWith('close to'));
  return [
    '  {',
    ...checks.map(t => `    // TODO check: ${t}`),
    `    id: ${q(id)},`,
    `    title: ${q(c.title)},`,
    `    description: ${q(description)},`,
    `    meals: [${c.meals.map(q).join(', ')}],${c.meals.length ? '' : ' // TODO'}`,
    `    dishTypes: [${c.dishTypes.map(q).join(', ')}],`,
    `    prepMinutes: ${num(c.prepMinutes)}`,
    `    cookMinutes: ${num(c.cookMinutes)}`,
    `    servings: ${num(c.servings)}`,
    '    ingredients: [',
    ...ing,
    '    ],',
    '    steps: [',
    ...steps.map(s => `      ${q(s)},`),
    '    ],',
    `    source: from(${[c.key, c.title, ...(c.author ? [c.author] : [])].map(q).join(', ')}),`,
    '  },',
  ].join('\n');
}

const RANK = new Map(INGREDIENTS_BY_POPULARITY.map((id, i) => [id, i]));
const STAPLES = new Set(DEFAULT_STAPLE_IDS);

/**
 * Order ready candidates for "--next N": recipes built on common, non-staple
 * ingredients first (they fill the most searches), then the ones needing the
 * fewest editor fixes. Deterministic, so two runs pick the same batch.
 */
export function draftOrder(candidates: Candidate[]): Candidate[] {
  const score = (c: Candidate) => {
    const ids = new Set(c.ingredients.filter(i => !i.optional).flatMap(i => i.ids));
    let s = 0;
    for (const id of ids) if (!STAPLES.has(id)) s += Math.max(0, 70 - (RANK.get(id) ?? 70)) / 70;
    return s - c.todo.length * 0.25;
  };
  return [...candidates].sort((a, b) => score(b) - score(a) || a.key.localeCompare(b.key));
}
