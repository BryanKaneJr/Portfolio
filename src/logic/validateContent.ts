import { DISH_TYPES, INGREDIENT_CATEGORIES, MEALS, type Ingredient, type Recipe } from '../data/types';
import { normalizeText } from './normalizeIngredient';

export type ValidationIssue = { where: string; message: string };

/**
 * Content gate. Anything returned here must be fixed before the data ships —
 * broken recipes are blocked at build time, never shown as broken cards.
 */
export function validateContent(ingredients: Ingredient[], recipes: Recipe[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (where: string, message: string) => issues.push({ where, message });

  // ── Ingredients ──
  const ingredientIds = new Set<string>();
  const termOwner = new Map<string, string>();
  for (const ing of ingredients) {
    const where = `ingredient:${ing.id || '(no id)'}`;
    if (!/^[a-z0-9_]+$/.test(ing.id)) add(where, 'id must be lowercase snake_case');
    if (ingredientIds.has(ing.id)) add(where, 'duplicate ingredient id');
    ingredientIds.add(ing.id);
    if (!ing.name?.trim()) add(where, 'missing name');
    if (!INGREDIENT_CATEGORIES.includes(ing.category)) add(where, `invalid category "${ing.category}"`);
    for (const term of [ing.name, ...ing.aliases]) {
      const t = normalizeText(term);
      const owner = termOwner.get(t);
      if (owner && owner !== ing.id) add(where, `name/alias "${term}" already belongs to "${owner}"`);
      termOwner.set(t, ing.id);
    }
  }

  // ── Recipes ──
  const recipeIds = new Set<string>();
  for (const rec of recipes) {
    const where = `recipe:${rec.id || '(no id)'}`;
    if (!/^[a-z0-9-]+$/.test(rec.id)) add(where, 'id must be lowercase kebab-case');
    if (recipeIds.has(rec.id)) add(where, 'duplicate recipe id');
    recipeIds.add(rec.id);
    if (!rec.title?.trim()) add(where, 'missing title');
    if (!rec.description?.trim()) add(where, 'missing description');
    if (!rec.meals?.length) add(where, 'needs at least one meal tag');
    for (const m of rec.meals ?? []) if (!MEALS.includes(m)) add(where, `invalid meal "${m}"`);
    if (new Set(rec.meals).size !== rec.meals.length) add(where, 'duplicate meal tag');
    for (const d of rec.dishTypes ?? []) if (!DISH_TYPES.includes(d)) add(where, `invalid dish type "${d}"`);
    if (new Set(rec.dishTypes).size !== rec.dishTypes.length) add(where, 'duplicate dish type tag');

    if (!Number.isInteger(rec.prepMinutes) || rec.prepMinutes < 0 || rec.prepMinutes > 24 * 60)
      add(where, 'implausible prepMinutes');
    if (!Number.isInteger(rec.cookMinutes) || rec.cookMinutes < 0 || rec.cookMinutes > 24 * 60)
      add(where, 'implausible cookMinutes');
    if (rec.prepMinutes + rec.cookMinutes <= 0) add(where, 'total time must be > 0');
    if (!Number.isInteger(rec.servings) || rec.servings < 1 || rec.servings > 100) add(where, 'implausible servings');

    const required = rec.ingredients.filter(i => !i.optional);
    if (required.length === 0) add(where, 'needs at least one required ingredient');
    const seenLines = new Set<string>();
    rec.ingredients.forEach((ing, n) => {
      const w = `${where} ingredient #${n + 1}`;
      if (!ingredientIds.has(ing.ingredientId)) add(w, `unknown ingredientId "${ing.ingredientId}"`);
      if (!ing.displayName?.trim()) add(w, 'missing displayName');
      if (!ing.quantityText?.trim()) add(w, 'missing quantityText');
      if (/\b(tbd|todo|xx|\?\?)\b/i.test(ing.quantityText ?? '')) add(w, 'placeholder quantity');
      if (typeof ing.optional !== 'boolean') add(w, 'optional must be true/false');
      const key = `${ing.ingredientId}|${ing.optional}`;
      if (seenLines.has(key)) add(w, `"${ing.ingredientId}" listed twice with the same optional flag`);
      seenLines.add(key);
    });
    const requiredIds = new Set(required.map(i => i.ingredientId));
    for (const ing of rec.ingredients) {
      if (ing.optional && requiredIds.has(ing.ingredientId)) {
        add(where, `"${ing.ingredientId}" is both required and optional`);
      }
    }

    if (!rec.steps?.length) add(where, 'needs at least one step');
    rec.steps?.forEach((s, n) => {
      if (!s?.trim()) add(`${where} step ${n + 1}`, 'empty step');
      else if (s.trim().length < 8) add(`${where} step ${n + 1}`, 'step is suspiciously short');
      if (/\b(tbd|todo|lorem)\b/i.test(s ?? '')) add(`${where} step ${n + 1}`, 'placeholder text');
    });

    if (!rec.source || !['original', 'licensed'].includes(rec.source.type)) add(where, 'missing/invalid source type');
    if (!rec.source?.note?.trim()) add(where, 'missing source note');
    if (rec.source?.type === 'licensed' && !rec.source.license?.trim()) add(where, 'licensed recipe needs a license');
  }

  return issues;
}
