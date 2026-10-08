import type { Ingredient } from '../data/types';

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type IngredientIndex = {
  byId: Map<string, Ingredient>;
  /** normalized name or alias → canonical ID */
  byTerm: Map<string, string>;
  all: Ingredient[];
};

export function buildIngredientIndex(ingredients: Ingredient[]): IngredientIndex {
  const byId = new Map<string, Ingredient>();
  const byTerm = new Map<string, string>();
  for (const ing of ingredients) {
    byId.set(ing.id, ing);
    for (const term of [ing.name, ...ing.aliases]) {
      byTerm.set(normalizeText(term), ing.id);
    }
  }
  return { byId, byTerm, all: ingredients };
}

/** Resolve an exact name/alias (e.g. "scallion") to its canonical ID. */
export function resolveIngredientId(index: IngredientIndex, term: string): string | undefined {
  const t = normalizeText(term);
  if (index.byId.has(t.replace(/ /g, '_'))) return t.replace(/ /g, '_');
  return index.byTerm.get(t);
}

export type IngredientSearchHit = {
  ingredient: Ingredient;
  /** The alias that matched, when it isn't the display name (shown as a hint). */
  matchedAlias?: string;
};

/**
 * Prefix/word search across names and aliases. Each canonical ingredient appears
 * at most once. Ranking: name starts-with > alias starts-with > word match > contains.
 */
export function searchIngredients(index: IngredientIndex, query: string, limit = 20): IngredientSearchHit[] {
  const q = normalizeText(query);
  if (!q) return [];
  const scored: { hit: IngredientSearchHit; score: number }[] = [];
  for (const ing of index.all) {
    let best = Infinity;
    let alias: string | undefined;
    const terms: [string, boolean][] = [[ing.name, false], ...ing.aliases.map((a): [string, boolean] => [a, true])];
    for (const [term, isAlias] of terms) {
      const t = normalizeText(term);
      let score = Infinity;
      if (t === q) score = 0;
      else if (t.startsWith(q)) score = 1;
      else if (t.split(' ').some(w => w.startsWith(q))) score = 2;
      else if (t.includes(q)) score = 3;
      if (isAlias && score !== Infinity) score += 0.5;
      if (score < best) {
        best = score;
        alias = isAlias ? term : undefined;
      }
    }
    if (best !== Infinity) {
      scored.push({ hit: { ingredient: ing, ...(alias ? { matchedAlias: alias } : {}) }, score: best });
    }
  }
  scored.sort((a, b) => a.score - b.score || a.hit.ingredient.name.localeCompare(b.hit.ingredient.name));
  return scored.slice(0, limit).map(s => s.hit);
}
