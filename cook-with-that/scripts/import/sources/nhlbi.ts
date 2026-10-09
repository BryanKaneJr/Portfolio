import { readFileSync } from 'fs';
import type { RawRecipe } from '../types';
import { parseMinutes } from './basedCooking';

/**
 * NHLBI (National Heart, Lung, and Blood Institute): the recipe pages under
 * nhlbi.nih.gov/health/heart-healthy-living/healthy-foods/healthy-eating-recipes. Public domain
 * unless a page says otherwise; see content/import/nhlbi/README.md and docs/recipe-sources.md §2.
 *
 * The site has no repository, so `npm run import:fetch-nhlbi` (scripts/import/fetch-nhlbi.ts)
 * saves a committed snapshot, content/import/nhlbi/recipes.json: one `NhlbiEntry` per page,
 * with the page's own wording. This module parses a page into an entry (used by the fetcher)
 * and reads the snapshot into `RawRecipe`s (used by the import pipeline).
 */
export type NhlbiEntry = {
  /** The page slug: stable, and the key `source.origin` records. */
  key: string;
  url: string;
  title: string;
  /** The bold headnote under the title. */
  description?: string;
  /** The page's "Recipe Source:" line: the NHLBI publication the recipe comes from. */
  recipeSource: string;
  servings?: number;
  /** The page's "Yields" text, kept only when it isn't a plain "N servings". */
  yields?: string;
  servingSize?: string;
  prepMinutes?: number;
  cookMinutes?: number;
  ingredientLines: string[];
  steps: string[];
  /** "Tip:" paragraphs after the directions (serving ideas, swaps). */
  tips: string[];
  /** Date the page was fetched (YYYY-MM-DD). */
  fetchedAt: string;
};

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  deg: '°',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  eacute: 'é',
  ntilde: 'ñ',
};

/** Plain text from an HTML fragment: tags dropped, entities decoded, whitespace collapsed. */
export function htmlText(fragment: string): string {
  return fragment
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
      if (e[0] === '#')
        return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Every leaf item of the HTML lists in a fragment, in order. Group labels ("For garnish:",
 * an item that only holds a nested list) are dropped, like `<p>For spread:</p>` between lists.
 */
function listItems(fragment: string): string[] {
  const items: string[] = [];
  let buf: string | null = null;
  const flush = () => {
    if (buf === null) return;
    const text = htmlText(buf);
    if (text && !/:$/.test(text)) items.push(text);
    buf = null;
  };
  for (const part of fragment.split(/(<\/?(?:li|ul|ol)\b[^>]*>)/i)) {
    if (/^<li\b/i.test(part)) {
      flush();
      buf = '';
    } else if (/^<\/?(?:li|ul|ol)\b/i.test(part)) flush();
    else if (buf !== null) buf += part;
  }
  flush();
  return items;
}

/** Text of each `<p>` in a fragment. */
const paragraphs = (fragment: string) =>
  [...fragment.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m => htmlText(m[1])).filter(Boolean);

/** The slugs a recipe listing page links to (`…/healthy-eating-recipes/<slug>`), in page order. */
export function listRecipeSlugs(listingHtml: string): string[] {
  const slugs: string[] = [];
  for (const m of listingHtml.matchAll(/href="[^"]*\/healthy-eating-recipes\/([a-z0-9-]+)"/g))
    if (!slugs.includes(m[1])) slugs.push(m[1]);
  return slugs;
}

/**
 * One recipe page → snapshot entry. The page is Drupal: an `<article>` holding the title (h1),
 * a body (headnote, "Recipe Source:", h2 Ingredients/Directions, "Tip:" paragraphs, an optional
 * "Recipe Video" embed we ignore) and a "cooking facts" table (prep, cook, yields, serving size).
 * Throws when a part the import needs is missing, so a site redesign fails loudly.
 */
export function parseNhlbiPage(key: string, url: string, html: string, fetchedAt: string): NhlbiEntry {
  const article = /<article\b[\s\S]*<\/article>/i.exec(html)?.[0];
  if (!article) throw new Error(`${key}: no <article> on the page`);
  const title = htmlText(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(article)?.[1] ?? '');
  const bodyStart = article.search(/field--name-body/);
  const factsStart = article.search(/<table\b[^>]*cooking-facts/i);
  if (!title || bodyStart < 0) throw new Error(`${key}: no title or body`);
  const body = article.slice(article.indexOf('>', bodyStart) + 1, factsStart > bodyStart ? factsStart : undefined);

  const [intro, ...rest] = body.split(/(?=<h2\b)/i);
  const sections = new Map<string, string>();
  for (const s of rest) {
    const heading = htmlText(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(s)?.[1] ?? '').toLowerCase();
    sections.set(heading, s.replace(/<h2\b[^>]*>[\s\S]*?<\/h2>/i, ''));
  }
  const introParas = paragraphs(intro);
  const recipeSource = introParas.map(p => /^Recipe Source:\s*(.+)$/i.exec(p)?.[1].trim()).find(Boolean);
  const description = introParas.find(p => !/^Recipe Source:/i.test(p));
  const ingredientLines = listItems(sections.get('ingredients') ?? '');
  const directions = sections.get('directions') ?? '';
  const steps = listItems(directions);
  const tips = paragraphs(directions.replace(/<(ol|ul)\b[\s\S]*?<\/\1>/gi, ''))
    .map(p => p.replace(/^Tips?:\s*/i, ''))
    .filter(Boolean);
  if (!recipeSource) throw new Error(`${key}: no "Recipe Source:" line`);
  if (!ingredientLines.length || !steps.length) throw new Error(`${key}: no ingredients or directions`);

  const fact = (name: string) => {
    const m = new RegExp(`<th>\\s*${name}\\s*</th>\\s*<td>([\\s\\S]*?)</td>`, 'i').exec(article);
    return m ? htmlText(m[1]) || undefined : undefined;
  };
  const minutes = (text: string | undefined) => (text === undefined ? undefined : parseMinutes(text));
  const yields = fact('Yields');
  const servings = /^(\d+)\s+servings?$/i.exec(yields ?? '')?.[1];
  const prepMinutes = minutes(fact('Prep Time'));
  const cookMinutes = minutes(fact('Cook Time'));
  const servingSize = fact('Serving Size');

  return {
    key,
    url,
    title,
    ...(description ? { description } : {}),
    recipeSource,
    ...(servings ? { servings: Number(servings) } : yields ? { yields } : {}),
    ...(servingSize ? { servingSize } : {}),
    ...(prepMinutes !== undefined ? { prepMinutes } : {}),
    ...(cookMinutes !== undefined ? { cookMinutes } : {}),
    ingredientLines,
    steps,
    tips,
    fetchedAt,
  };
}

/** Amount words before NHLBI's bare "C" for cups ("1½ C", "1/2 C", "2–3 C"). */
const CUP_AMOUNT =
  /^((?:\d+\s*)?(?:\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞]|\d+)(?:\s*(?:-|–|to)\s*(?:\d+\s*)?(?:\d+\/\d+|[½⅓⅔¼¾⅛]|\d+))?)\s+C\b(?!\.)/;

/**
 * House style quirks the shared line parser would misread: cups as a bare capital "C"
 * ("1½ C onion" → "1½ cups onion"), and "boneless, skinless chicken", whose first comma
 * would otherwise end the name at "boneless".
 */
export function normalizeNhlbiLine(line: string): string {
  return line
    .replace(CUP_AMOUNT, (_, amount: string) => {
      const single = /^(?:1|\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞])$/.test(amount.trim());
      return `${amount} ${single ? 'cup' : 'cups'}`;
    })
    .replace(/\bboneless,\s+skinless\b/gi, 'boneless skinless');
}

/** Snapshot entry → the pipeline's RawRecipe. `location` has no URL scheme (src/ stays URL-free). */
export function nhlbiRawRecipe(entry: NhlbiEntry): RawRecipe {
  return {
    key: entry.key,
    title: entry.title,
    ...(entry.description ? { description: entry.description } : {}),
    location: entry.url.replace(/^https?:\/\/(?:www\.)?/, ''),
    ingredientLines: entry.ingredientLines.map(normalizeNhlbiLine),
    steps: entry.steps,
    ...(entry.servings !== undefined ? { servings: entry.servings } : {}),
    ...(entry.prepMinutes !== undefined ? { prepMinutes: entry.prepMinutes } : {}),
    // "0 minutes" on a no-cook salad is a real time; keep it.
    ...(entry.cookMinutes !== undefined ? { cookMinutes: entry.cookMinutes } : {}),
    tags: [],
  };
}

/** Parse snapshot JSON, checking the shape so a hand-edited or truncated file fails loudly. */
export function parseNhlbiSnapshot(json: string): NhlbiEntry[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error('NHLBI snapshot must be a JSON array');
  const keys = new Set<string>();
  return data.map((e, i) => {
    const entry = e as Partial<NhlbiEntry>;
    const strings = (v: unknown) => Array.isArray(v) && v.every(s => typeof s === 'string');
    if (
      typeof entry.key !== 'string' ||
      typeof entry.url !== 'string' ||
      typeof entry.title !== 'string' ||
      typeof entry.recipeSource !== 'string' ||
      typeof entry.fetchedAt !== 'string' ||
      !strings(entry.ingredientLines) ||
      !strings(entry.steps)
    )
      throw new Error(`NHLBI snapshot entry ${i} is missing key, url, title, recipeSource, fetchedAt or its lists`);
    if (keys.has(entry.key)) throw new Error(`NHLBI snapshot has "${entry.key}" twice`);
    keys.add(entry.key);
    return { ...entry, tips: strings(entry.tips) ? entry.tips! : [] } as NhlbiEntry;
  });
}

export function readNhlbi(file: string): RawRecipe[] {
  return parseNhlbiSnapshot(readFileSync(file, 'utf8')).map(nhlbiRawRecipe);
}
