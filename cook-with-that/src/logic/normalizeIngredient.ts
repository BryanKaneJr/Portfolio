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
  /** Every name and alias, normalized once, for search. */
  searchTerms: SearchTerm[];
};

type SearchTerm = {
  ingredient: Ingredient;
  /** As written in the catalog (shown as the hint when an alias matched). */
  raw: string;
  isAlias: boolean;
  text: string;
  singular: string;
  words: string[];
};

export function buildIngredientIndex(ingredients: Ingredient[]): IngredientIndex {
  const byId = new Map<string, Ingredient>();
  const byTerm = new Map<string, string>();
  const searchTerms: SearchTerm[] = [];
  for (const ing of ingredients) {
    byId.set(ing.id, ing);
    for (const [raw, isAlias] of [[ing.name, false], ...ing.aliases.map(a => [a, true])] as [string, boolean][]) {
      const text = normalizeText(raw);
      byTerm.set(text, ing.id);
      searchTerms.push({ ingredient: ing, raw, isAlias, text, singular: singularize(text), words: text.split(' ') });
    }
  }
  return { byId, byTerm, all: ingredients, searchTerms };
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

/** "berries" → "berry", "tomatoes" → "tomato", "peas" → "pea"; leaves "hummus", "swiss", "molasses" alone. */
function singularWord(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (/(ch|sh|x|z)es$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Word-by-word singular form, so plural and singular searches meet in the middle. */
export function singularize(text: string): string {
  return text.split(' ').map(singularWord).join(' ');
}

/**
 * Words that describe the state or grade of a food, not a different food: "unsalted butter" is
 * butter, "extra virgin olive oil" is olive oil. Dropped only when the full query finds nothing.
 * Never add a word that changes the food ("dried", "ground", "canned", "smoked", "chopped" for
 * British tinned tomatoes, "minced" for British ground pork).
 */
const QUALIFIERS = new Set([
  'fresh', 'large', 'small', 'medium', 'extra', 'virgin', 'unsalted', 'salted', 'boneless', 'skinless',
  'shredded', 'grated', 'sliced', 'diced', 'cooked', 'ripe', 'organic', 'lean', 'frozen', 'firm', 'sharp',
  'mild', 'mature', 'softened', 'melted', 'low', 'reduced', 'sodium',
]); // prettier-ignore

/** Optimal string alignment distance (Levenshtein plus swapped neighbours), capped for speed. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows.push([i]);
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        rows[0].push(j);
        continue;
      }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1);
      rows[i].push(d);
    }
  }
  return rows[a.length][b.length];
}

/** How far a misspelling may be from a name: none under 6 letters ("pear" must not find Peas). */
const typoAllowance = (q: string) => (q.length >= 8 ? 2 : q.length >= 6 ? 1 : 0);

function directScore(t: SearchTerm, q: string, qSingular: string): number {
  if (t.text === q || t.singular === qSingular) return 0;
  if (t.text.startsWith(q)) return 1;
  if (t.words.some(w => w.startsWith(q)) || ` ${t.singular} `.includes(` ${qSingular} `)) return 2;
  // Mid-word matches only in names ("nut" → Coconut milk, Peanut butter), not in aliases, where they're
  // noise ("egg" → parmigiano reggiano, veggie broth).
  if (!t.isAlias && t.text.includes(q)) return 3;
  return Infinity;
}

/** Compared in singular form, so a plural doesn't stretch a short word into range ("chiles" ≠ Chives). */
function typoScore(t: SearchTerm, qSingular: string): number {
  const max = typoAllowance(qSingular);
  if (!max) return Infinity;
  const words = t.singular.split(' ');
  const d = Math.min(editDistance(qSingular, t.singular, max), ...words.map(w => editDistance(qSingular, w, max)));
  return d <= max ? 4 + d : Infinity;
}

function rank(index: IngredientIndex, score: (t: SearchTerm) => number): { hit: IngredientSearchHit; score: number }[] {
  const best = new Map<string, { hit: IngredientSearchHit; score: number }>();
  for (const t of index.searchTerms) {
    let s = score(t);
    if (s === Infinity) continue;
    if (t.isAlias) s += 0.5;
    const prev = best.get(t.ingredient.id);
    if (!prev || s < prev.score)
      best.set(t.ingredient.id, {
        hit: { ingredient: t.ingredient, ...(t.isAlias ? { matchedAlias: t.raw } : {}) },
        score: s,
      });
  }
  return [...best.values()];
}

/**
 * Search across names and aliases. Each canonical ingredient appears at most once.
 * Ranking: exact (plural or singular) > starts with > word match > contains; aliases rank just
 * below names. Only when nothing matches: drop qualifier words ("unsalted butter"), then allow a
 * typo or two ("brocoli", "parmesean"). An unknown food still returns nothing.
 */
export function searchIngredients(index: IngredientIndex, query: string, limit = 20): IngredientSearchHit[] {
  const q = normalizeText(query);
  if (!q) return [];
  let scored = rank(index, t => directScore(t, q, singularize(q)));

  const core = q
    .split(' ')
    .filter(w => !QUALIFIERS.has(w))
    .join(' ');
  if (!scored.length && core && core !== q) scored = rank(index, t => directScore(t, core, singularize(core)));
  if (!scored.length) scored = rank(index, t => typoScore(t, singularize(core || q)));

  scored.sort((a, b) => a.score - b.score || a.hit.ingredient.name.localeCompare(b.hit.ingredient.name));
  return scored.slice(0, limit).map(s => s.hit);
}

/**
 * Catalog ingredients a recipe's steps name but its ingredient list doesn't
 * ("fry in butter" with no butter listed). Avoid filters on the list, so an
 * unlisted ingredient would slip past it. Longest names win, so "garlic powder"
 * isn't read as garlic. Water is skipped: nobody avoids it, and pasta water isn't listed.
 */
export function unlistedStepIngredients(
  index: IngredientIndex,
  steps: string[],
  listedIds: Iterable<string>,
): { id: string; term: string }[] {
  const listed = new Set(listedIds);
  const terms = [...index.byTerm.entries()].sort((a, b) => b[0].length - a[0].length);
  const found = new Map<string, string>();
  for (const step of steps) {
    let text = ` ${normalizeText(step)} `;
    for (const [term, id] of terms) {
      if (!text.includes(` ${term} `)) continue;
      if (id !== 'water' && !listed.has(id) && !found.has(id)) found.set(id, term);
      text = text.split(` ${term} `).join('  ');
    }
  }
  return [...found].map(([id, term]) => ({ id, term }));
}
