import { readFileSync } from 'fs';
import type { RawRecipe } from '../types';
import { parseMinutes } from './basedCooking';

/**
 * VA Nutrition and Food Services: the one-recipe PDFs linked from nutrition.va.gov's recipe pages
 * (Recipes.asp and the category pages under it). US government work, not copyright protected,
 * except recipes that credit an outside original; see content/import/va/README.md and
 * docs/recipe-sources.md §2.
 *
 * The site has no repository or structured data, so `npm run import:fetch-va`
 * (scripts/import/fetch-va.ts) downloads each PDF, extracts its text with `pdftotext -layout`
 * and saves a committed snapshot, content/import/va/recipes.json: one `VaEntry` per recipe, with
 * the PDF's own wording. This module parses that text into an entry (used by the fetcher) and
 * reads the snapshot into `RawRecipe`s (used by the import pipeline).
 */
export type VaEntry = {
  /** Kebab-case of the title: stable across the site's re-uploads (file names carry a date). */
  key: string;
  url: string;
  title: string;
  servings?: number;
  /** The PDF's "Serving Size:" text ("1 cup", "1 burrito"). */
  servingSize?: string;
  prepMinutes?: number;
  cookMinutes?: number;
  /** "Chill:" or "Inactive:" time in the header, when the PDF gives one. */
  restMinutes?: number;
  ingredientLines: string[];
  steps: string[];
  /** The "Recipe Notes" bullets (storage, swaps, doneness checks). */
  notes: string[];
  /**
   * The credit text in the footer ("Adapted from … | Submitted by …", "Inspired by a recipe
   * submitted by …"), or '' when the PDF has none. Anything naming an outside original is excluded.
   */
  credit: string;
  /**
   * Credits on other uploads of the same recipe that differ from `credit`. One recipe's older
   * upload says "Adapted from" where the newer one says nothing, so both count.
   */
  otherCredits?: string[];
  /** Headings of the listing pages that link the recipe ("Main Dishes: Beef", "Sides"). */
  categories: string[];
  /** Other PDFs of the same recipe (the site links many recipes from several pages); `url` is the newest. */
  alsoAt?: string[];
  /** Date the PDF was fetched (YYYY-MM-DD). */
  fetchedAt: string;
};

/** The parts of an entry that come from the PDF's text alone. */
export type VaText = Pick<
  VaEntry,
  | 'title'
  | 'servings'
  | 'servingSize'
  | 'prepMinutes'
  | 'cookMinutes'
  | 'restMinutes'
  | 'ingredientLines'
  | 'steps'
  | 'notes'
  | 'credit'
>;

/** A key from a title: lowercase words joined by hyphens, accents and punctuation dropped. */
export function vaKey(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Wording in a credit that means the recipe came from somewhere else, so it isn't VA's to release. */
export const OUTSIDE_CREDIT = /\b(adapted|reprinted|courtesy of|copyright|used with permission)\b|©/i;

const tidy = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();

const HEADER = /^\s*(?:\w+ )?Ingredients\s{2,}Directions\s*$/;
const INGREDIENTS_HEADING = /^\s*(?:[A-Z][\w-]* )?Ingredients:?\s*$/;
const DIRECTIONS_HEADING = /^\s*Directions:?\s*$/;
const NOTES_HEADING = /^(?:Recipe )?Notes:?$/;
const NUTRITION = /^\s*Nutrition Facts\b/;
/** Footer wording that credits someone; the credit runs from the first of these to the end of the line. */
const CREDIT_WORDS = /\b(?:Adapted|Submitted|Inspired|Courtesy|Reprinted|Source|Recipe (?:from|by))\b|©|copyright/i;
const NUTRIENT = /\b(?:Calories|Fat|Sodium|Carbohydrate|Fiber|Protein|Potassium|Cholesterol|Sugars?|Phosphorus)\s*:/i;

/**
 * The footer below "Nutrition Facts" → its credit text. Nutrition lines and the "For more recipes"
 * line are dropped; any other text is kept so a reviewer sees it.
 */
function footerCredit(lines: string[]): string {
  const parts: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const credit = CREDIT_WORDS.exec(line);
    if (credit) parts.push(line.slice(credit.index));
    else if (line && !NUTRIENT.test(line) && !/^For more recipes\b/i.test(line)) parts.push(line);
  }
  return tidy(parts.join(' '));
}

/**
 * One line of a two-column page ("Ingredients" left, "Directions" right, the right column starting
 * near `col`) → [left, right]. A line whose text runs across the gap with no column break is
 * full-width (a note) and stays on the left.
 */
export function splitColumns(line: string, col: number): [string, string] {
  if (!line.trim()) return ['', ''];
  const indent = line.length - line.trimStart().length;
  if (indent >= col - 4) return ['', line.trim()];
  if (line.trimEnd().length < col - 1) return [line.trim(), ''];
  for (const m of line.matchAll(/ {2,}/g)) {
    const next = m.index + m[0].length;
    if (m.index > indent && next >= col - 4 && next <= col + 8)
      return [line.slice(0, m.index).trim(), line.slice(next).trim()];
  }
  return [line.trim(), ''];
}

/** A group label inside an ingredient list ("Dressing", "For the topping:"), which we drop like NHLBI's. */
function isGroupLabel(line: string): boolean {
  if (/\d|[½⅓⅔¼¾⅛]/.test(line)) return false;
  if (/:$/.test(line) || line === 'Equipment') return true;
  return (
    /^(?:For (?:the )?)?[A-Z][\w'-]*(?: [\w'-]+){0,3}$/.test(line) &&
    /\b(Dressing|Sauce|Topping|Toppings|Filling|Marinade|Glaze|Crust|Salsa|Garnish|Dip|Mix|Base|Ingredients|Batter|Frosting|Icing|Streusel|Crumble|Salad|Bowls?|Slaw|Seasoning|Vinaigrette|Rub|Spread)$/.test(
      line,
    )
  );
}

/**
 * Does the item so far look unfinished, so the next line continues it? An open parenthesis, a
 * trailing comma or joining word, or an "Optional toppings: a, b" list (whose items are often
 * capitalized), which runs until a line starting with an amount.
 */
function unfinished(item: string, next: string): boolean {
  const open = (item.match(/\(/g) ?? []).length > (item.match(/\)/g) ?? []).length;
  if (open || /(?:[,;:–-]|\b(?:or|and|of|to|with|de|for|a|an|the|in|plus|into|such as|if|plain)\b)$/i.test(item))
    return true;
  return /^(?:Optional|Desired)\b[^:]*:/i.test(item) && !/^[\d½⅓⅔¼¾⅛⅜⅝⅞]/.test(next);
}

/**
 * Ingredient column lines → one string per ingredient. A line starts a new ingredient when it
 * begins with an amount or a capital letter, unless the previous one is visibly unfinished
 * (see `unfinished`); lowercase lines continue the previous one.
 */
export function joinIngredientLines(lines: string[]): string[] {
  const items: string[] = [];
  for (const raw of lines) {
    const line = tidy(raw);
    if (!line) continue;
    if (isGroupLabel(line)) {
      items.push('');
      continue;
    }
    const prev = items[items.length - 1];
    const starts = /^[\d½⅓⅔¼¾⅛⅜⅝⅞]|^[A-Z•]/.test(line) && !/^\(/.test(line);
    if (prev && (!starts || unfinished(prev, line))) items[items.length - 1] = tidy(`${prev} ${line}`);
    else items.push(line.replace(/^•\s*/, ''));
  }
  return items.filter(Boolean);
}

/**
 * Numbered direction lines ("1. Heat…", indented continuations) → one string per step. A short
 * unpunctuated line after a blank line is a group heading ("Make Dip or Dressing") and is
 * dropped. Numbering may restart (a second group, or a typo in the PDF), but a skipped number
 * throws: it means a step was lost or the two columns got mixed up.
 */
export function joinSteps(lines: string[]): string[] {
  const steps: string[] = [];
  let expected = 1;
  let gap = false;
  for (const raw of lines) {
    const line = tidy(raw);
    const afterGap = gap;
    gap = !line;
    if (!line) continue;
    const m = /^(?:(\d+)[.)]|•)\s*(.*)$/.exec(line);
    if (m?.[1] !== undefined) {
      const n = Number(m[1]);
      if (n > expected) throw new Error(`direction ${n} comes after ${expected - 1}: a step is missing`);
      expected = n + 1;
    }
    const prev = steps[steps.length - 1];
    if (!m && afterGap && prev && /^[A-Z][^.!?:]*$/.test(line) && line.split(' ').length <= 6) continue;
    if (m || !steps.length) steps.push(m ? m[2] : line);
    else steps[steps.length - 1] = tidy(`${prev} ${line}`);
  }
  return steps.filter(Boolean);
}

/** "Recipe Notes" bullet lines → one string per bullet. */
function joinNotes(lines: string[]): string[] {
  const notes: string[] = [];
  for (const raw of lines) {
    const line = tidy(raw);
    if (!line) continue;
    if (/^[•●▪-]\s*/.test(line) || !notes.length) notes.push(line.replace(/^[•●▪-]\s*/, ''));
    else notes[notes.length - 1] = tidy(`${notes[notes.length - 1]} ${line}`);
  }
  return notes.filter(Boolean);
}

/**
 * `pdftotext -layout` output of one VA recipe PDF → its parts. Two layouts exist: two columns
 * (an "Ingredients … Directions" header row) and stacked (an "Ingredients" heading, then a
 * "Directions" heading). Both start with the title, a "Prep: … | Cook: …" line and a
 * "Yield: … | Serving Size: …" line, and end with "Recipe Notes", "Nutrition Facts" and a footer
 * that may carry the credit. Throws when a part the import needs is missing, so a PDF in another
 * layout fails loudly instead of saving a garbled recipe.
 */
export function parseVaText(text: string): VaText {
  const lines = text.replace(/\f/g, '').split('\n');
  // One PDF still shows its template's placeholders ("Recipe Title", "Prep: minutes", "Yield: servings")
  // under the real text, so the first header lines with numbers in them win.
  const firstPrep = lines.findIndex(l => /^\s*Prep\b[^|]*:/.test(l));
  const timesAt = lines.findIndex(l => /^\s*Prep\b[^|]*:.*\d/.test(l));
  const yieldAt = lines.findIndex(l => /\bYield:.*\d/.test(l));
  if (timesAt < 0 || yieldAt < 0) throw new Error('no "Prep:" or "Yield:" line');
  const title = tidy(
    lines
      .slice(0, firstPrep)
      .filter(l => l.trim() && !/^\s*Recipe Title\s*$/i.test(l))
      .join(' '),
  );
  if (!title) throw new Error('no title above the "Prep:" line');

  const times = new Map<string, number | undefined>();
  for (const part of lines[timesAt].split('|')) {
    const m = /^\s*([A-Za-z]+)\s*:\s*(.*)$/.exec(part);
    if (m) times.set(m[1].toLowerCase(), parseMinutes(m[2]));
  }
  const rest = (times.get('chill') ?? 0) + (times.get('inactive') ?? 0);
  const yieldLine = lines[yieldAt];
  const servings = /Yield:\s*(\d+)\s+servings?\b/i.exec(yieldLine)?.[1];
  const servingSize = /Serving Size:\s*(.+)$/i.exec(yieldLine)?.[1].trim();

  const end = lines.findIndex((l, i) => i > yieldAt && NUTRITION.test(l));
  if (end < 0) throw new Error('no "Nutrition Facts" line');
  const credit = footerCredit(lines.slice(end));

  const ingredients: string[] = [];
  const directions: string[] = [];
  const notes: string[] = [];
  const headerAt = lines.findIndex((l, i) => i > yieldAt && i < end && HEADER.test(l));
  if (headerAt >= 0) {
    const col = lines[headerAt].indexOf('Directions');
    let leftInNotes = false;
    let rightInNotes = false;
    for (const line of lines.slice(headerAt + 1, end)) {
      const [left, right] = splitColumns(line, col);
      if (NOTES_HEADING.test(left)) leftInNotes = true;
      else if (left) (leftInNotes ? notes : ingredients).push(left);
      if (NOTES_HEADING.test(right)) rightInNotes = true;
      else if (right) (rightInNotes ? notes : directions).push(right);
    }
  } else {
    const ingAt = lines.findIndex((l, i) => i > yieldAt && i < end && INGREDIENTS_HEADING.test(l));
    const dirAt = lines.findIndex((l, i) => i > ingAt && i < end && DIRECTIONS_HEADING.test(l));
    if (ingAt < 0 || dirAt < 0) throw new Error('no "Ingredients" and "Directions" headings');
    ingredients.push(...lines.slice(ingAt + 1, dirAt));
    // A few PDFs head their notes with a second "Directions" by mistake.
    const notesAt = lines.findIndex(
      (l, i) => i > dirAt && i < end && (NOTES_HEADING.test(l.trim()) || DIRECTIONS_HEADING.test(l)),
    );
    directions.push(...lines.slice(dirAt + 1, notesAt < 0 ? end : notesAt));
    if (notesAt >= 0) notes.push(...lines.slice(notesAt + 1, end));
  }

  const ingredientLines = joinIngredientLines(ingredients);
  const steps = joinSteps(directions);
  if (!ingredientLines.length || !steps.length) throw new Error('no ingredients or directions');
  const prepMinutes = times.get('prep');
  const cookMinutes = times.get('cook');
  return {
    title,
    ...(servings ? { servings: Number(servings) } : {}),
    ...(servingSize ? { servingSize } : {}),
    ...(prepMinutes !== undefined ? { prepMinutes } : {}),
    ...(cookMinutes !== undefined ? { cookMinutes } : {}),
    ...(rest ? { restMinutes: rest } : {}),
    ingredientLines,
    steps,
    notes: joinNotes(notes),
    credit,
  };
}

const ENTITIES: Record<string, string> = { amp: '&', nbsp: ' ', quot: '"', apos: "'", rsquo: '’', ndash: '–' };
const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|[a-z]+);/gi, (m, e: string) =>
      e[0] === '#' ? String.fromCodePoint(Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/\s+/g, ' ')
    .trim();

/**
 * One listing page → its heading, the recipe pages it links (`/NUTRITION/Recipes…asp`) and the
 * recipe PDFs it links, in page order. Only the content area counts (from the page title to the
 * crisis-line banner), so site navigation and the cookbook PDFs in the menus are left out, and
 * PDFs outside a `Recipes` folder (the multi-recipe cookbooks) are skipped.
 */
export function parseVaListing(html: string): { heading: string; pages: string[]; pdfs: string[] } {
  const start = html.search(/class="page-title"/);
  const stop = html.search(/id="va-crisis-title"/);
  if (start < 0) throw new Error('no page title on the listing page: has the site moved?');
  const body = html.slice(start, stop > start ? stop : undefined);
  const heading = decode(/^class="page-title"[^>]*>([\s\S]*?)<\/h2>/.exec(body)?.[1] ?? '');
  const unique = (xs: string[]) => [...new Set(xs)];
  const hrefs = [...body.matchAll(/href="([^"]+)"/gi)].map(m => m[1].trim().replace(/#.*$/, ''));
  return {
    heading,
    pages: unique(hrefs.filter(h => /^\/NUTRITION\/Recipes[\w/-]*\.asp$/i.test(h))),
    pdfs: unique(hrefs.filter(h => /^\/NUTRITION\/(?:docs\/)?Recipes\/[\w/.-]+\.pdf$/i.test(h))),
  };
}

/** Snapshot entry → the pipeline's RawRecipe. `location` has no URL scheme (src/ stays URL-free). */
export function vaRawRecipe(entry: VaEntry): RawRecipe {
  return {
    key: entry.key,
    title: entry.title,
    location: entry.url.replace(/^https?:\/\/(?:www\.)?/, ''),
    ingredientLines: entry.ingredientLines,
    steps: entry.steps,
    ...(entry.servings !== undefined ? { servings: entry.servings } : {}),
    // Chilling or resting counts toward prep: the app has prep and cook times only.
    ...(entry.prepMinutes !== undefined ? { prepMinutes: entry.prepMinutes + (entry.restMinutes ?? 0) } : {}),
    ...(entry.cookMinutes !== undefined ? { cookMinutes: entry.cookMinutes } : {}),
    tags: entry.categories,
  };
}

/** Parse snapshot JSON, checking the shape so a hand-edited or truncated file fails loudly. */
export function parseVaSnapshot(json: string): VaEntry[] {
  const data: unknown = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error('VA snapshot must be a JSON array');
  const keys = new Set<string>();
  return data.map((e, i) => {
    const entry = e as Partial<VaEntry>;
    const strings = (v: unknown) => Array.isArray(v) && v.every(s => typeof s === 'string');
    if (
      typeof entry.key !== 'string' ||
      typeof entry.url !== 'string' ||
      typeof entry.title !== 'string' ||
      typeof entry.credit !== 'string' ||
      typeof entry.fetchedAt !== 'string' ||
      !strings(entry.ingredientLines) ||
      !strings(entry.steps)
    )
      throw new Error(`VA snapshot entry ${i} is missing key, url, title, credit, fetchedAt or its lists`);
    if (keys.has(entry.key)) throw new Error(`VA snapshot has "${entry.key}" twice`);
    keys.add(entry.key);
    return {
      ...entry,
      notes: strings(entry.notes) ? entry.notes! : [],
      categories: strings(entry.categories) ? entry.categories! : [],
    } as VaEntry;
  });
}

export function readVa(file: string): RawRecipe[] {
  return parseVaSnapshot(readFileSync(file, 'utf8')).map(vaRawRecipe);
}
