import { readFileSync } from 'fs';
import { recipeId } from '../draft';
import type { RawRecipe } from '../types';
import { parseMinutes } from './basedCooking';
import { nhlbiRawRecipe, parseNhlbiSnapshot, type NhlbiEntry } from './nhlbi';

/**
 * NHLBI's recipe books (PDFs on nhlbi.nih.gov), the second NHLBI stream next to the web recipe
 * pages (./nhlbi.ts). Same license and credit: see content/import/nhlbi-books/README.md and
 * docs/recipe-sources.md §2.
 *
 * `npm run import:fetch-nhlbi-books` (scripts/import/fetch-nhlbi-books.ts) downloads each PDF,
 * turns it into text with `pdftotext -layout` and parses that text here into
 * content/import/nhlbi-books/recipes.json (committed). The pipeline reads only that file.
 *
 * A `-layout` page is a picture of the printed page in characters: ingredients in a left
 * column, numbered steps in a right one, a headnote, tips and a yield/nutrition block. The
 * parser finds the step column from the step numbers, splits every line there and reads each
 * column on its own. Titles and page numbers come from each book's table of contents, because
 * the printed titles are split around the prep-time box.
 */

/** A snapshot entry: the web snapshot's fields, plus the book it comes from. */
export type NhlbiBookEntry = NhlbiEntry & {
  /** The book's title, without the "Keep the Beat" program name. */
  book: string;
};

export type NhlbiBook = {
  /** Short name used in keys: `book-<id>/<recipe slug>`. */
  id: string;
  /** Title without the "Keep the Beat" name (NHLBI's trademark; never used in the app). */
  title: string;
  /** NHLBI's resource page for the book. */
  page: string;
  /** The PDF itself. */
  pdf: string;
  /** Text of the footer line that carries the printed page number. */
  footer: RegExp;
  /**
   * How the ingredient column wraps a long line: `indent` books (Deliciously Healthy) indent the
   * wrapped part under the name; `flush` books start it at the margin like a new line.
   */
  wraps: 'indent' | 'flush';
  /** Unnumbered paragraphs in the step column after the last step are notes, not more steps. */
  stepColumnNotes?: boolean;
  /** Pages in another language (the Latino book prints each recipe again in Spanish). */
  skipPage?: RegExp;
  /** Table-of-contents lines after this one belong to the other language. */
  tocEnd?: RegExp;
};

const PUBLICATIONS = 'https://www.nhlbi.nih.gov/sites/default/files/publications';

export const NHLBI_BOOKS: NhlbiBook[] = [
  {
    id: 'dinners',
    title: 'Deliciously Healthy Dinners',
    page: 'https://www.nhlbi.nih.gov/resources/keep-beat-recipes-deliciously-healthy-dinners',
    pdf: `${PUBLICATIONS}/10-2921.pdf`,
    footer: /deliciously healthy dinners/i,
    wraps: 'indent',
  },
  {
    id: 'family',
    title: 'Deliciously Healthy Family Meals',
    page: 'https://www.nhlbi.nih.gov/resources/keep-beat-recipes-deliciously-healthy-family-meals',
    pdf: `${PUBLICATIONS}/10-7531.pdf`,
    footer: /deliciously healthy family meals/i,
    wraps: 'indent',
    stepColumnNotes: true,
  },
  {
    id: 'african-american',
    title: 'Heart-Healthy Home Cooking African American Style',
    page: 'https://www.nhlbi.nih.gov/resources/heart-healthy-home-cooking-african-american-style',
    pdf: `${PUBLICATIONS}/WEHL-RecipeBook_508.pdf`,
    footer: /Heart-Healthy Home Cooking/,
    wraps: 'flush',
  },
  {
    id: 'latino',
    title: 'Delicious Heart-Healthy Latino Recipes',
    page: 'https://www.nhlbi.nih.gov/resources/delicious-heart-healthy-latino-recipes-book-platillos-latinos-sabrosos-y-saludables',
    pdf: `${PUBLICATIONS}/Your_Heart_Your_Life_Recipe_Book.pdf`,
    footer: /Hispanic\/Latino Recipes|Platillos latinos/,
    wraps: 'flush',
    skipPage: /\bRinde\s+\d|\bporciones\b/,
    tocEnd: /^\s*Índice\s*$/,
  },
];

/** Typographic noise from the PDFs: ligatures, the "º" used for degrees, no-break spaces. */
export function cleanPdfText(text: string): string {
  return text
    .replace(/ﬁ/g, 'fi')
    .replace(/ﬂ/g, 'fl')
    .replace(/ﬀ/g, 'ff')
    .replace(/ﬃ/g, 'ffi')
    .replace(/ﬄ/g, 'ffl')
    .replace(/(\d)\s*º\s*([FC])\b/g, '$1 °$2')
    .replace(/º/g, '°')
    .replace(/\u2044/g, '/')
    .replace(/[\u00a0\u2002\u2003\u2009]/g, ' ')
    .replace(/\u00ad/g, '');
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'for', 'in', 'of', 'on', 'or', 'the', 'to']);

/** "cocoa-spiced beef tenderloin with pineapple salsa" → "Cocoa-Spiced Beef Tenderloin With Pineapple Salsa". */
export function titleCase(title: string): string {
  if (/[A-Z]/.test(title)) return title.replace(/\s+/g, ' ').trim();
  return title
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word, i) =>
      word
        .split('-')
        .map((part, j) => {
          if ((i > 0 || j > 0) && SMALL_WORDS.has(part)) return part;
          if (j > 0 && part.length < 2) return part;
          return part.replace(/^([^a-zà-ÿ]*)([a-zà-ÿ])/, (_, lead: string, c: string) => lead + c.toUpperCase());
        })
        .join('-'),
    )
    .join(' ');
}

/** The comparable form of a title: lowercase words only, "with" and "&" dropped. */
export function titleWords(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(with|the|a)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type TocEntry = { title: string; page: number };

/** Recipe-like lines of a table of contents: "title ........ 12". Section names are filtered later. */
export function parseToc(pages: string[], book: Pick<NhlbiBook, 'tocEnd'>): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const page of pages.slice(0, 10)) {
    const lines = page.split('\n');
    const found = lines.filter(l => /\.{4,}\s*\d+\s*$/.test(l)).length;
    if (found < 4) continue;
    for (const line of lines) {
      if (book.tocEnd?.test(line)) return entries;
      const m = /^\s*(.+?)\s*\.{2,}\s*(\d+)\s*$/.exec(line);
      if (m) entries.push({ title: m[1].replace(/\.+$/, '').trim(), page: Number(m[2]) });
    }
  }
  return entries;
}

/** The printed page number in a page's footer line, if any. */
export function printedPageNumber(page: string, footer: RegExp): number | undefined {
  const lines = page.split('\n').filter(l => l.trim());
  for (const line of lines.slice(-3).reverse()) {
    if (!footer.test(line)) continue;
    const m = /^\s*(\d+)\s+\S/.exec(line) ?? /\s(\d+)\s*$/.exec(line);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/** A quantity at the start of an ingredient line: "1", "½", "2–3", "one", "a pinch". */
const QUANTITY = /^(?:[\d½¼¾⅓⅔⅛⅜⅝⅞]|(?:one|two|three|four|six|half|dash|pinch)\b|an?\s+(?:pinch|dash|few|handful)\b)/i;
/** Lines without a quantity that are still ingredients of their own. */
const STANDALONE = /\bspray\b|to taste|as needed|\(to coat|^juice (?:of|from)\b|^fresh [a-z]+ (?:leaves|sprigs)$/i;
/** Nutrition-panel wording (left column of the flush books). */
const NUTRITION_LABEL =
  /^(?:Makes:?\s+\d|Serving size|(?:Calories|Total(?: Fat| Fiber| Carbohydrates| Sugars)?|Saturated [Ff]at|Cholesterol|Sodium|Dietary Fiber|Fiber|Protein|Carbohydrates|Potassium|Fat)\s*:?\s*(?:[<\d]|$))/;
/** Section names printed down the page edge ("main dishes", "beef"), which land in the header. */
const SIDE_LABEL =
  /^(?:main dishes|main-dish meals|main-dish pastas|pastas|side dishes|vegetable side dishes|grain side dishes|vegetarian|beef|poultry|seafood|pork|pasta dishes|lunch\/brunch|snacks)$/i;
const NUTRIENT_ANYWHERE =
  /\b(?:Calories|Sodium|Protein|Carbohydrates|Potassium|Fiber|Cholesterol|Fat)\s*:?\s*[<\d]|\bTotal Dietary\b/i;
/** Where a page's two columns end: a full-width tip or note, a "Make It a Meal" box, the yield block. */
const FOOTER_START =
  /^\s{0,12}(?:(?:Tips?|Hint|Notes?|Variations?)\s*:|\*\s?[A-Z]|Make It a Meal\b)|\b(?:yield|prep time):/i;
/** A paragraph that is a tip, not a step or an ingredient. */
const NOTE_START = /^(?:(?:Tips?|Hint|Notes?|Variations?)\s*:|\*\s?[A-Z]|Make It a Meal\b)/i;
const stripNoteLabel = (text: string) =>
  text.replace(/^(?:(?:Tips?|Hint|Notes?|Variations?)\s*:|\*|Make It a Meal\b)\s*/i, '');
/** Step numbers: "1", "1." at a column start. */
const STEP_MARK = /(^|\s{2,}|^\s*)(\d{1,2})(\.?)(\s+)(?=\S)/g;

type Mark = { line: number; col: number; n: number };

/** Step-number marks right of the margin (ingredient quantities sit at the margin). */
function stepMarks(lines: string[]): Mark[] {
  const marks: Mark[] = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(STEP_MARK)) {
      const col = (m.index ?? 0) + m[1].length;
      const rest = line.slice(col + m[2].length + m[3].length + m[4].length);
      // A step starts with a capital: "1. Preheat", "2    For the salsa" (not "10 g" in a nutrition panel).
      // At the margin only "1." counts (steps printed below the ingredients); "1 cup" is an ingredient.
      const stacked = col <= 3 && m[3] === '.';
      if ((col >= 30 || stacked) && Number(m[2]) > 0 && /^[A-Z(“"]/.test(rest))
        marks.push({ line: i, col, n: Number(m[2]) });
    }
  });
  return marks;
}

/** `line` with its first `width` characters replaced by `text`, padded so later columns stay put. */
const overwrite = (line: string, width: number, text: string) =>
  `${text}${' '.repeat(Math.max(0, width - text.length))}${line.slice(width)}`;

/**
 * Fractions the PDFs print with a raised numerator come out of pdftotext on two or three lines:
 * "1" over " /8 tsp salt", "1" / " / tsp" / "  8   pepper", or "/4 C" / "3" / "   kasha". Put
 * them back together ("1/8 tsp salt"), keeping the columns where they were.
 */
export function joinSplitFractions(lines: string[]): string[] {
  const out = [...lines];
  const numerator = (line: string | undefined) => (line === undefined ? null : /^(\d)(?=\s{3,}|\s*$)/.exec(line));
  for (let i = 0; i + 1 < out.length; i++) {
    const n = numerator(out[i]);
    const below = /^ ?\/(\d+)(?=\s)/.exec(out[i + 1]);
    const unitOnly = /^ ?\/ ([A-Za-z]+)\s*$/.exec(out[i + 1]);
    const denominator = out[i + 2] === undefined ? null : /^\s+(\d+)\s+(?=\S)/.exec(out[i + 2]);
    if (n && below) {
      out[i + 1] = overwrite(out[i + 1], below[0].length, `${n[1]}/${below[1]}`);
      out[i] = out[i].replace(/^\d/, ' ');
    } else if (n && unitOnly && denominator) {
      out[i + 2] = overwrite(out[i + 2], denominator[0].length, `${n[1]}/${denominator[1]} ${unitOnly[1]} `);
      out[i + 1] = '';
      out[i] = out[i].replace(/^\d/, ' ');
    } else {
      const over = /^\/(\d+) ([A-Za-z]+)\s*$/.exec(out[i]);
      const num = numerator(out[i + 1]);
      const name = out[i + 2] === undefined ? null : /^\s+(?=\S)/.exec(out[i + 2]);
      if (over && num && name) {
        out[i + 2] = overwrite(out[i + 2], name[0].length, `${num[1]}/${over[1]} ${over[2]} `);
        out[i] = '';
        out[i + 1] = out[i + 1].replace(/^\d/, ' ');
      }
    }
  }
  return out;
}

/** Split a line into its left and right column at the gutter (the step-number column). */
export function splitColumns(line: string, gutter: number): { left: string; right: string; col: number } {
  if (line.length > gutter - 2)
    for (let i = Math.max(2, gutter - 3); i < line.length; i++)
      if (line[i] !== ' ' && line[i - 1] === ' ' && line[i - 2] === ' ') {
        const left = line.slice(0, i).trimEnd();
        // A step number set tight against the ingredient text ("black beans, 4.   Place pitas…").
        const glued = /\s(\d{1,2}\.)$/.exec(left);
        if (glued && glued.index + 1 >= gutter - 6)
          return {
            left: left.slice(0, glued.index).trimEnd(),
            right: `${glued[1]} ${line.slice(i).trim()}`,
            col: gutter,
          };
        return { left, right: line.slice(i).trim(), col: i };
      }
  return { left: line.trimEnd(), right: '', col: -1 };
}

/**
 * Letters of the round recipe symbols in Family Meals ("Healthier Classics", "Healthy Eating Two
 * Ways") come out as stray capitals between columns: "HE A W T", "Y EAT", "IN G", "S".
 */
export function dropSymbolLetters(line: string): string {
  return line.replace(
    /(^|\s{2,})[A-Z]{1,7}(?: [A-Z]{1,4}){0,3}(?=\s{2,}|\s*$)/g,
    (m, lead: string) => lead + ' '.repeat(m.length - lead.length),
  );
}

const joinText = (parts: string[]) =>
  parts
    .map(p => p.trim())
    .filter(Boolean)
    .reduce((acc, p) => (!acc ? p : /[a-z]-$/.test(acc) && /^[a-z]/.test(p) ? acc + p : `${acc} ${p}`), '')
    .replace(/\s+/g, ' ')
    .trim();

/** "4C   low-sodium broth" → "4 C low-sodium broth", "11/3 C" (pdftotext's 1⅓) → "1 1/3 C"; runs of spaces → one. */
export function tidyIngredient(text: string): string {
  return text
    .replace(/^(\d)(\d)\/(\d)(?=\s)/, (m, whole: string, n: string, d: string) =>
      Number(n) < Number(d) ? `${whole} ${n}/${d}` : m,
    )
    .replace(/^((?:\d+\s*)?(?:\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞]|\d+)(?:\s*[-–]\s*\d+)?)\s*C(?=\s|$)/, '$1 C')
    .replace(/\s*\((?:Leftover Friendly)\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type Fields = {
  description?: string;
  servings?: number;
  yields?: string;
  servingSize?: string;
  prepMinutes?: number;
  cookMinutes?: number;
  ingredientLines: string[];
  steps: string[];
  tips: string[];
};

/** Column text of the value under a label ("yield:" over "4 servings"), read from the lines after it. */
function valueBelow(lines: string[], at: number, col: number): string[] {
  const values: string[] = [];
  for (let i = at + 1; i < lines.length && i < at + 6; i++) {
    const slice = lines[i].slice(Math.max(0, col - 1));
    const text = slice.split(/\s{3,}/)[0].trim();
    const startsHere = slice.length > 0 && /^\s{0,2}\S/.test(slice);
    if (!text || !startsHere) {
      // A value that ends mid-phrase ("1 pork chop, ¼ C sauce,") goes on below a gap.
      if (values.length && !/(?:,|\band)$/.test(values[values.length - 1])) break;
      continue;
    }
    if (/:\s*$/.test(text)) break;
    values.push(text);
  }
  return values;
}

/**
 * The bottom block of a Deliciously Healthy page: "Tip:"/"Hint:"/"*" notes, then yield,
 * serving size and (Family Meals) prep and cook time, laid out over the nutrition panel.
 */
function readFooterBlock(lines: string[], fields: Fields) {
  let tip: string[] | null = null;
  const flush = () => {
    if (tip) fields.tips.push(stripNoteLabel(joinText(tip)));
    tip = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // A nutrition panel under the columns (African American–style pages).
    const makes = /^\s*Makes:?\s+(\d+)\s+servings?/i.exec(line);
    if (makes) {
      flush();
      fields.servings = Number(makes[1]);
      continue;
    }
    const size = /^\s*Serving size: {0,2}(\S.*?)(?:\s{3,}|$)/i.exec(line);
    if (size) {
      fields.servingSize = size[1].trim();
      continue;
    }
    const labels = [...line.matchAll(/\b(yield|serving size|prep time|cook time):/gi)];
    if (labels.length) {
      flush();
      for (const m of labels) {
        const value = valueBelow(lines, i, m.index ?? 0);
        const label = m[1].toLowerCase();
        if (label === 'yield') {
          const n = /^(\d+)\s+servings?$/i.exec(value[0] ?? '');
          if (n) fields.servings = Number(n[1]);
          else if (value.length) fields.yields = value[0];
        } else if (label === 'serving size' && value.length) fields.servingSize = joinText(value);
        else if (label === 'prep time' && value.length) fields.prepMinutes = parseMinutes(value[0]);
        else if (label === 'cook time' && value.length) fields.cookMinutes = parseMinutes(value[0]);
      }
      continue;
    }
    if (/^\s{0,12}(?:(?:Tips?|Hint|Notes?|Variations?)\s*:|\*\s?\S|Make It a Meal\b)/i.test(line)) {
      flush();
      tip = [line];
    } else if (
      tip &&
      line.trim() &&
      !/each serving provides|calories\s+\d|^\s{20,}|^\s*(?:Calories|Total|Saturated|Cholesterol|Sodium|Fat)\b/i.test(
        line,
      )
    )
      tip.push(line);
    else flush();
  }
  flush();
}

/** Ingredient lines from the left column (wrapped lines joined, labels and nutrition dropped). */
function readIngredients(left: LeftLine[], book: NhlbiBook, fields: Fields): string[] {
  const items: string[] = [];
  const base = Math.min(...left.filter(l => l.text).map(l => l.indent));
  let lastWasNutrition = false;
  let lastWasServingSize = false;
  let note: string[] | null = null;
  for (const { text, indent } of left) {
    // A note under the ingredients runs until a blank line.
    if (note && text) {
      note.push(text);
      continue;
    }
    if (note) {
      fields.tips.push(stripNoteLabel(joinText(note)));
      note = null;
    }
    if (!text) continue;
    if (NOTE_START.test(text)) {
      note = [text];
      continue;
    }
    if (NUTRITION_LABEL.test(text) || NUTRIENT_ANYWHERE.test(text)) {
      const makes = /^Makes:?\s+(\d+)\s+servings?/i.exec(text);
      if (makes) fields.servings = Number(makes[1]);
      const size = /^Serving size:\s*(.*)$/i.exec(text.split(/\s{3,}/)[0]);
      if (size) fields.servingSize = size[1].trim() || undefined;
      else if (lastWasServingSize && !NUTRITION_LABEL.test(text))
        fields.servingSize = joinText([fields.servingSize ?? '', text.split(/\s{3,}/)[0]]);
      lastWasNutrition = true;
      lastWasServingSize = !!size;
      continue;
    }
    // "Serving size: ½ breast or" / "2 small drumsticks"
    if (
      lastWasNutrition &&
      lastWasServingSize &&
      (!QUANTITY.test(text) || /\b(?:or|and)$|,$/.test(fields.servingSize ?? ''))
    ) {
      fields.servingSize = joinText([fields.servingSize ?? '', text]);
      continue;
    }
    lastWasNutrition = false;
    lastWasServingSize = false;
    const heading = book.wraps === 'flush' && /^[A-Z][a-z]+(?: [A-Z][a-z]+){0,3}$/.test(text) && !STANDALONE.test(text);
    if (heading || /^[A-Za-z][A-Za-z ,'’&-]{0,40}:$/.test(text)) {
      items.push('');
      continue;
    }
    const prev = items[items.length - 1];
    // Flush books: a line without a quantity continues the one above, and so does "2-inch strips"
    // after "cut in", or anything inside an open parenthesis ("(4 breasts," / "4 drumsticks)").
    const open = prev ? (prev.match(/\(/g) ?? []).length > (prev.match(/\)/g) ?? []).length : false;
    const wrapped =
      book.wraps === 'indent'
        ? indent >= base + 3
        : open ||
          /^(?:or|and)\b/.test(text) ||
          /\bor$/.test(prev ?? '') ||
          (!QUANTITY.test(text) && !STANDALONE.test(text)) ||
          (/[,]$|\b(?:in|into|and|or|of|to|about|cut)$/.test(prev ?? '') && /^[\d½¼¾⅓⅔⅛]+-/.test(text));
    if (wrapped && prev) items[items.length - 1] = joinText([prev, text]);
    else items.push(text);
  }
  if (note) fields.tips.push(stripNoteLabel(joinText(note)));
  return items.filter(Boolean).map(tidyIngredient);
}

type RightLine = { text: string; atGutter: boolean; far: boolean };

/**
 * Steps from the right column: a step starts at a number in the step column. Text before the
 * first step is the headnote (Latino book). A "Note:"/"Tip:" paragraph is a tip; with
 * `stepColumnNotes`, so is an unlabeled paragraph after a gap, unless another step follows it
 * (then it was the step's own text, split by a symbol or the column beside it).
 */
function readSteps(right: RightLine[], book: NhlbiBook, fields: Fields) {
  const steps: string[][] = [];
  const intro: string[] = [];
  /** Paragraphs after the latest step; `guessed` ones turn back into step text if a step follows. */
  let pending: { lines: string[]; guessed: boolean }[] = [];
  let panel = false;
  let gap = 0;
  let restartAt = 0;
  const ended = (lines: string[]) => /[.!?)"”]$/.test(lines[lines.length - 1] ?? '.');
  const settle = (laterStep: boolean) => {
    for (const p of pending)
      if (p.guessed && laterStep) steps[steps.length - 1].push(...p.lines);
      else fields.tips.push(stripNoteLabel(joinText(p.lines)));
    pending = [];
  };
  for (const { text, atGutter, far } of right) {
    if (!text) {
      gap++;
      continue;
    }
    if (/^continued on page \d+$/i.test(text) || far) continue;
    const m = /^(\d{1,2})\.?\s+(\S.*)$/.exec(text);
    const lone = /^(\d{1,2})\.?$/.exec(text);
    const makes = /^Makes:?\s+(\d+)\s+servings?/i.exec(text);
    const last = pending[pending.length - 1];
    if (steps.length && /^[A-Z][a-z]+ (?:Preparation|Directions)$/.test(text)) {
      // A second numbered list ("Crust Preparation" 1–5, then "Filling Preparation" 1–6) carries on the steps.
      restartAt = steps.length;
      continue;
    }
    if (m && atGutter && Number(m[1]) === steps.length - restartAt + 1) {
      settle(true);
      panel = false;
      steps.push([m[2]]);
    } else if (lone && atGutter && steps.length && Number(lone[1]) === steps.length - restartAt + 1) {
      // A step number printed on a line of its own, a line off from where its step starts:
      // the step starts at the sentence beside it (the line just above, when that starts one).
      settle(true);
      const prev = steps[steps.length - 1];
      const moved = prev.length > 1 && /^[A-Z]/.test(prev[prev.length - 1]) && /[.)]$/.test(prev[prev.length - 2]);
      steps.push(moved ? [prev.pop()!] : []);
    } else if (makes || (panel && (NUTRITION_LABEL.test(text) || NUTRIENT_ANYWHERE.test(text) || gap === 0))) {
      // The nutrition panel printed beside the last steps (some African American–style pages).
      if (makes) fields.servings = Number(makes[1]);
      const size = /^Serving size:\s*(.*)$/i.exec(text);
      if (size) fields.servingSize = size[1].trim();
      else if (panel && !NUTRITION_LABEL.test(text) && fields.servingSize && !/:/.test(text))
        fields.servingSize = joinText([fields.servingSize, text]);
      panel = true;
    } else if (!steps.length) intro.push(text);
    else if (NOTE_START.test(text)) pending.push({ lines: [text], guessed: false });
    else if (last && !(gap >= 1 && ended(last.lines) && /^[A-Z]/.test(text))) last.lines.push(text);
    else if (book.stepColumnNotes && (last || gap >= 2) && /^[A-Z]/.test(text) && ended(steps[steps.length - 1]))
      pending.push({ lines: [text], guessed: true });
    else if (last) last.lines.push(text);
    else steps[steps.length - 1].push(text);
    gap = 0;
  }
  settle(false);
  fields.steps = steps.map(joinText);
  return intro;
}

type LeftLine = { text: string; indent: number };

/** The most common column (past the margin) where text starts after a run of spaces, if any. */
function secondColumn(lines: string[]): number | undefined {
  const counts = new Map<number, number>();
  for (const line of lines)
    for (const m of line.matchAll(/\s{2,}(?=\S)/g)) {
      const col = (m.index ?? 0) + m[0].length;
      if (col >= 20 && m.index !== 0) counts.set(col, (counts.get(col) ?? 0) + 1);
    }
  const best = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return best && best[1] >= 2 ? best[0] : undefined;
}

/**
 * A page whose steps run full width below the ingredients (a few African American–style pages).
 * Above the steps: ingredients, with a second ingredient column or the nutrition panel to their
 * right. Beside the steps: the nutrition panel.
 */
function readStackedPage(lines: string[], stepsAt: number, left: LeftLine[], right: RightLine[]) {
  const top = lines.slice(0, stepsAt);
  const second = secondColumn(top);
  const columns: LeftLine[][] = [[], []];
  for (const line of top) {
    const parts = second ? splitColumns(line, second) : { left: line.trimEnd(), right: '' };
    columns[0].push({ text: parts.left.trim(), indent: 0 });
    columns[1].push({ text: parts.right, indent: 0 });
  }
  const bottom = lines.slice(stepsAt);
  const panel = bottom.map(l => /\s{2,}Makes:?\s+\d/.exec(l)).find(Boolean);
  const panelCol = panel ? (panel.index ?? 0) + panel[0].search(/M/) : undefined;
  for (const line of bottom) {
    const parts = panelCol ? splitColumns(line, panelCol) : { left: line.trimEnd(), right: '' };
    const text = parts.left.trim();
    // Stacked steps are numbered "1." at the margin; their wrapped lines are indented ("   2 minutes…").
    const indent = parts.left.length - parts.left.trimStart().length;
    right.push({ text, atGutter: /^\d{1,2}\.\s/.test(text) && indent <= 1, far: false });
    columns[1].push({ text: parts.right, indent: 0 });
  }
  // A heading over a column ("Salmon") separates groups like "For salsa:" does.
  left.push(...columns[0], { text: 'Next:', indent: 0 }, ...columns[1]);
}

/** True when a header segment is part of the printed title (which wraps around the prep-time box). */
function inTitle(segment: string, title: string): boolean {
  const s = titleWords(segment.replace(/\(continued\)/i, ''));
  return !!s && ` ${titleWords(title)} `.includes(` ${s} `);
}

/**
 * One recipe from its page(s) of `pdftotext -layout` text (footers removed). Returns undefined
 * when the page has no numbered steps (a section divider, a photo, an appendix page).
 */
export function parseRecipePages(pageTexts: string[], title: string, book: NhlbiBook): Fields | undefined {
  const fields: Fields = { ingredientLines: [], steps: [], tips: [] };
  const left: LeftLine[] = [];
  const right: RightLine[] = [];
  const header: string[] = [];
  const footer: string[] = [];

  for (const [p, pageText] of pageTexts.entries()) {
    const lines = joinSplitFractions(pageText.split('\n').map(dropSymbolLetters));
    const marks = stepMarks(lines);
    if (!marks.length) {
      if (p === 0) return undefined;
      continue;
    }
    // The lowest step number on the page (1 on a recipe's first page), highest on the page first.
    const first = marks.reduce((a, b) => (b.n < a.n || (b.n === a.n && b.line < a.line) ? b : a));
    if (p === 0 && first.n !== 1) return undefined;
    const gutter = first.col;
    // Where the two-column body starts: the first step, or an earlier ingredient line.
    let start = first.line;
    for (let i = 0; i < first.line; i++) {
      const l = splitColumns(lines[i], gutter).left;
      if (p === 0 && i > 0 && QUANTITY.test(l.trim()) && /^\s{0,4}\S/.test(l) && !/\b(minutes|hours?)\b/.test(l)) {
        start = i;
        break;
      }
    }
    // A continued page repeats the title ("… (continued)"); the columns start below it.
    if (p === 0) header.push(...lines.slice(0, start));
    else start = lines.findIndex(l => /\(continued\)/i.test(l)) + 1;
    // Where the columns end: the first full-width note or the yield block.
    let end = lines.length;
    for (let i = Math.max(start, p === 0 ? first.line : 0); i < lines.length; i++) {
      // A tip in the ingredient column, beside a step, is still part of the columns.
      const besideStep =
        gutter > 3 && lines.slice(i, i + 2).some(l => /^\d{1,2}\.?\s/.test(splitColumns(l, gutter).right));
      if (/\b(?:yield|prep time):/i.test(lines[i]) || (FOOTER_START.test(lines[i]) && !besideStep)) {
        end = i;
        break;
      }
    }
    if (gutter <= 3) readStackedPage(lines.slice(start, end), first.line - start, left, right);
    else
      for (const line of lines.slice(start, end)) {
        const { left: l, right: r, col } = splitColumns(line, gutter);
        left.push({ text: l.trim(), indent: l.length - l.trimStart().length });
        right.push({ text: r, atGutter: Math.abs(col - gutter) <= 2, far: col > gutter + 30 });
      }
    footer.push(...lines.slice(end));
  }

  fields.ingredientLines = readIngredients(left, book, fields);
  const intro = readSteps(right, book, fields);
  readFooterBlock(footer, fields);

  // Header: title pieces, the prep/cook box and symbols; what's left is the headnote.
  const times: number[] = [];
  const note: string[] = [];
  for (const line of header) {
    for (const segment of line.trim().split(/\s{3,}/)) {
      const s = segment.trim();
      // Flush books print column headings ("Crust Ingredients", "Spicy Tomato Relish") above the body.
      const heading = book.wraps === 'flush' && /^[A-Z][a-z]+(?: [A-Z][a-z]+){0,3}$/.test(s);
      if (!s || /^(?:prep|cook) time:?$/i.test(s) || /^[A-Z]{1,8}$/.test(s) || SIDE_LABEL.test(s) || heading) continue;
      if (inTitle(s, title)) continue;
      const minutes = /^\d+\s*(?:minutes?|hours?|hour \d+ minutes)$/i.test(s) ? parseMinutes(s) : undefined;
      if (minutes !== undefined) times.push(minutes);
      else note.push(s);
    }
  }
  if (times.length >= 1 && fields.prepMinutes === undefined) fields.prepMinutes = times[0];
  if (times.length >= 2 && fields.cookMinutes === undefined) fields.cookMinutes = times[1];
  const description = joinText([...note, ...intro]);
  if (description) fields.description = description;
  // "1 cup Sodium: 248 mg": the panel's next column, read on the same line.
  const size = fields.servingSize
    ?.replace(/\s+(?:Calories|Total|Saturated|Cholesterol|Sodium|Dietary|Protein|Carbohydrates|Potassium)\b.*$/, '')
    .replace(/[,\s]+$/, '');
  fields.servingSize = size || undefined;
  if (!fields.ingredientLines.length || !fields.steps.length) return undefined;
  return fields;
}

/** Pages of a `pdftotext -layout` file, footers removed, keyed by printed page number. */
function pagesByNumber(pages: string[], book: NhlbiBook): Map<number, { index: number; text: string }> {
  const byNumber = new Map<number, { index: number; text: string }>();
  pages.forEach((text, index) => {
    const n = printedPageNumber(text, book.footer);
    if (n === undefined || byNumber.has(n)) return;
    const lines = text.split('\n');
    const footerAt = lines
      .map((l, i) => (book.footer.test(l) ? i : -1))
      .filter(i => i >= 0)
      .pop()!;
    byNumber.set(n, { index, text: lines.filter((_, i) => i !== footerAt).join('\n') });
  });
  return byNumber;
}

export type BookParse = { entries: NhlbiBookEntry[]; skipped: { title: string; page: number; reason: string }[] };

/**
 * A whole book's `pdftotext -layout` output → snapshot entries, in table-of-contents order.
 * Table-of-contents lines that don't lead to a recipe page (sections, appendixes) are skipped
 * silently; a recipe-looking page that doesn't parse is reported in `skipped`.
 */
export function parseNhlbiBook(text: string, book: NhlbiBook, fetchedAt: string): BookParse {
  const pages = cleanPdfText(text).split('\f');
  const byNumber = pagesByNumber(pages, book);
  const entries: NhlbiBookEntry[] = [];
  const skipped: BookParse['skipped'] = [];
  const keys = new Set<string>();
  for (const { title: rawTitle, page } of parseToc(pages, book)) {
    const first = byNumber.get(page);
    if (!first || book.skipPage?.test(first.text)) continue;
    const lines = first.text.split('\n').filter(l => l.trim());
    // Section and appendix pages have no numbered steps, or (dividers) a bulleted list of recipes.
    if (!stepMarks(first.text.split('\n')).length || lines.filter(l => /^\s*•/.test(l)).length > 2) continue;
    // A recipe that runs over says so: "continued on page 15", and page 15 repeats the title "(continued)".
    const texts = [first.text];
    for (let more = /continued on page (\d+)/i.exec(first.text); more && texts.length < 4;) {
      const next = byNumber.get(Number(more[1]));
      if (!next) break;
      texts.push(next.text);
      more = /continued on page (\d+)/i.exec(next.text);
    }
    const title = titleCase(rawTitle);
    const fields = parseRecipePages(texts, title, book);
    if (!fields) {
      skipped.push({ title, page, reason: 'no ingredient list or numbered steps found' });
      continue;
    }
    const key = `book-${book.id}/${recipeId(title)}`;
    if (keys.has(key)) continue;
    keys.add(key);
    const { description, servings, yields, servingSize, prepMinutes, cookMinutes, ingredientLines, steps, tips } =
      fields;
    entries.push({
      key,
      url: `${book.pdf}#page=${first.index + 1}`,
      title,
      ...(description ? { description } : {}),
      recipeSource: book.title,
      book: book.title,
      ...(servings !== undefined ? { servings } : yields ? { yields } : {}),
      ...(servingSize ? { servingSize } : {}),
      ...(prepMinutes !== undefined ? { prepMinutes } : {}),
      ...(cookMinutes !== undefined ? { cookMinutes } : {}),
      ingredientLines,
      steps,
      tips,
      fetchedAt,
    });
  }
  return { entries, skipped };
}

/** Parse the books snapshot, checking the shape (the web snapshot's checks, plus `book`). */
export function parseNhlbiBooksSnapshot(json: string): NhlbiBookEntry[] {
  const entries = parseNhlbiSnapshot(json) as NhlbiBookEntry[];
  entries.forEach((e, i) => {
    if (typeof e.book !== 'string' || !e.book) throw new Error(`NHLBI books snapshot entry ${i} has no book`);
    if (!/^book-[a-z-]+\//.test(e.key)) throw new Error(`NHLBI books snapshot key "${e.key}" needs a book- prefix`);
  });
  return entries;
}

export function readNhlbiBooks(file: string): RawRecipe[] {
  return parseNhlbiBooksSnapshot(readFileSync(file, 'utf8')).map(nhlbiRawRecipe);
}

/**
 * Book recipes that are the same dish as a web recipe (or as an earlier book's copy): the books
 * reprint each other and the website, and `validateContent` only catches identical keys. Titles
 * are compared word for word, ignoring case, punctuation and "with"; a parenthetical alternative
 * name counts too ("Chickadillo (Chicken Picadillo)").
 */
export function duplicateBookRecipes(
  books: Pick<NhlbiBookEntry, 'key' | 'title'>[],
  web: Pick<NhlbiEntry, 'key' | 'title'>[],
): Record<string, string> {
  const names = (title: string) => {
    const alt = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(title);
    return (alt ? [alt[1], alt[2], title] : [title]).map(titleWords).filter(Boolean);
  };
  const seen = new Map<string, string>();
  for (const w of web) for (const n of names(w.title)) seen.set(n, `nhlbi/${w.key}`);
  const out: Record<string, string> = {};
  for (const b of books) {
    const twin = names(b.title)
      .map(n => seen.get(n))
      .find(Boolean);
    if (twin)
      out[b.key] = `same recipe as ${twin}${twin.startsWith('nhlbi/') ? ' (the web page)' : ''}; import that one`;
    else for (const n of names(b.title)) seen.set(n, b.key);
  }
  return out;
}

/** `duplicateBookRecipes` over the two committed snapshots (paths relative to the project root). */
export function duplicatesInSnapshots(root: string, booksPath: string, webPath: string): Record<string, string> {
  try {
    const books = parseNhlbiBooksSnapshot(readFileSync(`${root}/${booksPath}`, 'utf8'));
    const web = parseNhlbiSnapshot(readFileSync(`${root}/${webPath}`, 'utf8'));
    return duplicateBookRecipes(books, web);
  } catch {
    // A missing snapshot is reported by openSnapshot when the source is staged.
    return {};
  }
}
