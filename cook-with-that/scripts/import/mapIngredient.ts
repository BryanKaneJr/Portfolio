import { normalizeText, resolveIngredientId, type IngredientIndex } from '../../src/logic/normalizeIngredient';
import { INGREDIENT_MAP } from './ingredient-map';

/**
 * Resolve a source ingredient name ("boneless skinless chicken thighs") to catalog IDs.
 *
 * Only exact catalog names/aliases and reviewed entries in `ingredient-map.ts` map
 * automatically. Anything else is reported as unmapped, with at most a *suggestion*
 * for the editor: a word match like "rice vinegar" → rice is exactly the kind of false
 * positive the catalog rules forbid, so suggestions never map on their own.
 */
export type MapResult =
  | { status: 'mapped'; key: string; ids: string[]; via: 'catalog' | 'map' }
  | { status: 'not_ingredient'; key: string }
  | { status: 'not_in_catalog'; key: string }
  | { status: 'unmapped'; key: string; suggestion?: string };

/** Words that describe the form or freshness, not the food. Never "ground" or "dried" alone: they change the food. */
const DESCRIPTORS = new Set([
  'fresh',
  'freshly',
  'finely',
  'thinly',
  'roughly',
  'coarsely',
  'small',
  'medium',
  'large',
  'extra',
  'big',
  'whole',
  'chopped',
  'minced',
  'diced',
  'sliced',
  'grated',
  'shredded',
  'crushed',
  'peeled',
  'boneless',
  'skinless',
  'organic',
  'ripe',
  'very',
  'sharp',
  'mild',
  'free',
  'range',
  'hass',
  'lean',
  'raw',
  'cold',
  'warm',
  'softened',
  'melted',
  'room',
  'temperature',
  'good',
  'quality',
  'some',
  'a',
  'of',
]);

export function ingredientKey(name: string): string {
  return normalizeText(name);
}

function stripDescriptors(key: string): string {
  const words = key.split(' ');
  while (words.length > 1 && DESCRIPTORS.has(words[0])) words.shift();
  return words.join(' ');
}

function variants(key: string): string[] {
  const out = [key, stripDescriptors(key)];
  for (const k of [...out]) {
    if (k.endsWith('ies')) out.push(`${k.slice(0, -3)}y`);
    if (k.endsWith('oes')) out.push(k.slice(0, -2));
    if (k.endsWith('s')) out.push(k.slice(0, -1));
    else out.push(`${k}s`);
  }
  return [...new Set(out)];
}

/** Longest catalog name/alias that appears as whole words inside the key. Editor hint only. */
function suggest(index: IngredientIndex, key: string): string | undefined {
  let best: { term: string; id: string } | undefined;
  const padded = ` ${key} `;
  for (const [term, id] of index.byTerm) {
    if (padded.includes(` ${term} `) && (!best || term.length > best.term.length)) best = { term, id };
  }
  return best?.id;
}

export function mapIngredient(index: IngredientIndex, name: string, depth = 0): MapResult {
  const key = ingredientKey(name);
  for (const k of variants(key)) {
    if (Object.prototype.hasOwnProperty.call(INGREDIENT_MAP, k)) {
      const target = INGREDIENT_MAP[k];
      if (target === null) return { status: 'not_in_catalog', key: k };
      if (target === false) return { status: 'not_ingredient', key: k };
      if (typeof target === 'string' && target.startsWith('=') && depth < 4) {
        const same = mapIngredient(index, target.slice(1), depth + 1);
        return same.status === 'mapped' ? { ...same, key } : same;
      }
      return { status: 'mapped', key, ids: Array.isArray(target) ? target : [target], via: 'map' };
    }
  }
  for (const k of variants(key)) {
    const id = resolveIngredientId(index, k);
    if (id) return { status: 'mapped', key, ids: [id], via: 'catalog' };
  }
  const suggestion = suggest(index, stripDescriptors(key));
  return { status: 'unmapped', key: stripDescriptors(key), ...(suggestion ? { suggestion } : {}) };
}
