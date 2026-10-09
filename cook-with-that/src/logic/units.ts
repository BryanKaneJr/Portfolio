import type { IngredientIndex } from './normalizeIngredient';
import { normalizeText } from './normalizeIngredient';

/**
 * Display-time unit conversion. Recipes are authored in US units (often with metric in
 * parentheses); in metric mode the recipe page shows grams, millilitres, °C and cm instead.
 *
 * Metric follows UK/Australian cookbook habits: weigh solids where we know a cup's weight,
 * give liquids in ml, keep tsp/tbsp as spoon measures, show US cans as the usual tin size,
 * and give oven temperatures with the fan and gas mark settings. An amount the author already
 * wrote in metric ("1 lb (450 g)") is used as written.
 */
export type UnitSystem = 'us' | 'metric';
export const UNIT_SYSTEMS: readonly UnitSystem[] = ['us', 'metric'];

/** Countries that cook in US customary units. Everyone else defaults to metric. */
const US_UNIT_REGIONS = new Set(['US', 'LR', 'MM', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM']);

/** Default for a BCP 47 locale ("en-GB" → metric). Unknown → US, the app's home market. */
export function defaultUnitSystem(locale: string | undefined): UnitSystem {
  const region = locale?.match(/[-_]([A-Za-z]{2})(?:[-_@]|$)/)?.[1]?.toUpperCase();
  if (!region) return 'us';
  return US_UNIT_REGIONS.has(region) ? 'us' : 'metric';
}

/** Grams per US cup, for ingredients a metric cook would weigh. Anything else in cups becomes ml. */
const GRAMS_PER_CUP: Record<string, number> = {
  flour: 125,
  sugar: 200,
  brown_sugar: 210,
  powdered_sugar: 115,
  butter: 227,
  oats: 90,
  brown_rice: 190,
  lentils: 190,
  cheddar: 113,
  mozzarella: 113,
  parmesan: 100,
  pecorino_romano: 100,
  feta: 150,
  cream_cheese: 225,
  greek_yogurt: 245,
  sour_cream: 240,
  chocolate_chips: 170,
  berries: 150,
  peas: 140,
  corn: 150,
  black_beans: 170,
  kidney_beans: 170,
  chickpeas: 165,
  bread_crumbs: 110,
  walnuts: 120,
  spinach: 30,
  onion: 160,
  bell_pepper: 150,
  tomato: 180,
  potato: 150,
  broccoli: 90,
  green_beans: 110,
  parsley: 60,
  cilantro: 60,
  basil: 25,
  banana: 225, // mashed
  apple: 110, // sliced
  carrot: 130,
  celery: 120,
  zucchini: 125,
  mushroom: 70,
  honey: 340,
  peanut_butter: 255,
};
/** Rice is weighed raw or cooked, and the two differ a lot. */
const RICE_RAW = 185;
const RICE_COOKED = 160;

const ML_PER_CUP = 240; // the US labelling cup
const G_PER_OZ = 28.35;
const G_PER_LB = 453.6;
const G_PER_STICK = 113;
const ML_PER_QUART = 946;
const CM_PER_INCH = 2.54;

/** US can sizes → the tin a metric shopper buys. */
const CAN_SIZES: Record<string, { amount: number; unit: 'g' | 'ml' }> = {
  '13.5': { amount: 400, unit: 'ml' },
  '14': { amount: 400, unit: 'g' },
  '14.5': { amount: 400, unit: 'g' },
  '15': { amount: 400, unit: 'g' },
  '15.5': { amount: 400, unit: 'g' },
  '28': { amount: 800, unit: 'g' },
};
const LIQUIDS = new Set([
  'water',
  'milk',
  'heavy_cream',
  'chicken_broth',
  'vegetable_broth',
  'coconut_milk',
  'olive_oil',
  'vegetable_oil',
  'sesame_oil',
  'soy_sauce',
  'marinara_sauce',
  'salsa',
  'maple_syrup',
  'white_vinegar',
  'red_wine_vinegar',
  'balsamic_vinegar',
  'lemon',
  'lime',
]);

const NUM = String.raw`\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?`;
const AMOUNT = String.raw`(${NUM})(?:\s*[–-]\s*(${NUM}))?`;

function parseNumber(s: string): number {
  const t = s.trim();
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(t);
}

function roundMetric(x: number): number {
  if (x < 15) return Math.round(x);
  if (x < 250) return Math.round(x / 5) * 5;
  if (x < 750) return Math.round(x / 10) * 10;
  return Math.round(x / 50) * 50;
}

/** 340 → "340 g"; 1134 → "1.1 kg"; 1920 ml → "1.9 litres". */
function formatMass(g: number): string {
  if (g >= 1000) return `${trim1(g / 1000)} kg`;
  return `${roundMetric(g)} g`;
}
function formatVolume(ml: number): string {
  if (ml >= 1000) return `${trim1(ml / 1000)} litres`;
  return `${roundMetric(ml)} ml`;
}
function formatLength(cm: number): string {
  if (cm < 1) return `${Math.max(1, Math.round(cm * 10))} mm`;
  if (cm < 5) return `${trim1(Math.round(cm * 2) / 2)} cm`;
  return `${Math.round(cm)} cm`;
}
const trim1 = (x: number) => String(Math.round(x * 10) / 10);

function rangeOf(lo: string, hi: string | undefined, f: (n: number) => string): string {
  if (!hi) return f(parseNumber(lo));
  // "1–2 cups" → "240–480 ml": convert both ends, keep one unit.
  const a = f(parseNumber(lo));
  const b = f(parseNumber(hi));
  const unit = b.replace(/^[\d.]+\s*/, '');
  return `${a.replace(/\s*\D+$/, '')}–${b.replace(/\s*\D+$/, '')} ${unit}`;
}

type Kind = 'author_metric' | 'weight' | 'derived_weight' | 'volume' | 'spoon';
type Measure = { start: number; end: number; text: string; kind: Kind };

const UNIT_RE = new RegExp(
  String.raw`\b${AMOUNT}\s*(?:(packed)\s+)?(cups?|c\.|ounces?|oz|pounds?|lbs?|sticks?|quarts?|qt|pints?|tablespoons?|tbsps?|teaspoons?|tsps?|kg|g|grams?|ml|millilit(?:er|re)s?|dl|l|lit(?:er|re)s?)\b\.?`,
  'gi',
);

/** Grams per cup for this ingredient line, or undefined if it's measured by volume. */
export function gramsPerCup(ingredientId: string | undefined, displayName = ''): number | undefined {
  if (!ingredientId) return undefined;
  if (ingredientId === 'rice') return /\bcooked\b/i.test(displayName) ? RICE_COOKED : RICE_RAW;
  return GRAMS_PER_CUP[ingredientId];
}

/** Convert every measure in `text`; returns the new text plus what each measure was. */
function convertMeasures(
  text: string,
  ingredientId: string | undefined,
  displayName: string,
): { text: string; measures: Measure[] } {
  const measures: Measure[] = [];
  let out = '';
  let last = 0;
  UNIT_RE.lastIndex = 0;
  for (let m = UNIT_RE.exec(text); m; m = UNIT_RE.exec(text)) {
    const [whole, lo, hi, , rawUnit] = m;
    const unit = rawUnit.toLowerCase().replace(/\.$/, '');
    let converted: string;
    let kind: Kind;
    if (/^(tablespoons?|tbsps?|teaspoons?|tsps?)$/.test(unit)) {
      converted = whole;
      kind = 'spoon';
    } else if (/^(kg|g|grams?|ml|millilit|dl|l$|lit)/.test(unit)) {
      converted = whole;
      kind = 'author_metric';
    } else if (/^(cups?|c)$/.test(unit)) {
      const g = gramsPerCup(ingredientId, displayName);
      if (g && !LIQUIDS.has(ingredientId ?? '')) {
        converted = rangeOf(lo, hi, n => formatMass(n * g));
        kind = 'derived_weight';
      } else {
        converted = rangeOf(lo, hi, n => formatVolume(n * ML_PER_CUP));
        kind = 'volume';
      }
    } else if (/^(ounces?|oz)$/.test(unit)) {
      converted = rangeOf(lo, hi, n => formatMass(n * G_PER_OZ));
      kind = 'weight';
    } else if (/^(pounds?|lbs?)$/.test(unit)) {
      converted = rangeOf(lo, hi, n => formatMass(n * G_PER_LB));
      kind = 'weight';
    } else if (/^sticks?$/.test(unit)) {
      converted = rangeOf(lo, hi, n => formatMass(n * G_PER_STICK));
      kind = 'weight';
    } else if (/^(quarts?|qt)$/.test(unit)) {
      converted = rangeOf(lo, hi, n => formatVolume(n * ML_PER_QUART));
      kind = 'volume';
    } else {
      converted = rangeOf(lo, hi, n => formatVolume(n * 473));
      kind = 'volume';
    }
    measures.push({ start: out.length + (m.index - last), end: 0, text: converted, kind });
    out += text.slice(last, m.index) + converted;
    measures[measures.length - 1].end = out.length;
    last = m.index + whole.length;
  }
  return { text: out + text.slice(last), measures };
}

const RANK: Record<Kind, number> = { author_metric: 4, weight: 3, derived_weight: 2, volume: 1, spoon: 0 };
/** Words that may sit beside the measures in an "equivalent amount" note: "(about 7 oz / 200 g)". */
const FILLER = /^(?:about|approx\.?|approximately|roughly|each|shredded|packed|or|\/|,|\+|\s)*$/i;

/**
 * Quantity column text in the chosen system. US returns the authored text untouched.
 * "1 lb (about 450 g)" → "about 450 g"; "1 can (15 oz)" → "1 can (400 g)";
 * "1/2 cup (1 stick)" butter → "115 g"; "2 cups" flour → "250 g"; "1 tbsp" → "1 tbsp".
 */
export function displayQuantity(
  quantityText: string,
  system: UnitSystem,
  ingredientId?: string,
  displayName = '',
): string {
  if (system === 'us') return quantityText;
  const groups: { start: number; end: number; inner: string }[] = [];
  for (const m of quantityText.matchAll(/\(([^()]*)\)/g))
    groups.push({ start: m.index!, end: m.index! + m[0].length, inner: m[1] });
  const head = groups.length ? quantityText.slice(0, groups[0].start) : quantityText;
  const tail = groups.length ? quantityText.slice(groups[groups.length - 1].end) : '';
  const headC = convertMeasures(head, ingredientId, displayName);
  const headHasMeasure = headC.measures.length > 0;

  const parts: string[] = [];
  let main = headC.text.trimEnd();
  let mainRank = Math.max(-1, ...headC.measures.map(m => RANK[m.kind]));
  for (const g of groups) {
    const can = /\bcans?\b/i.test(head) ? /^(\d+(?:\.\d+)?)\s*oz\b(.*)$/i.exec(g.inner.trim()) : null;
    if (can && CAN_SIZES[can[1]]) {
      const size = CAN_SIZES[can[1]];
      const unit = size.unit === 'g' && LIQUIDS.has(ingredientId ?? '') ? 'ml' : size.unit;
      parts.push(`(${size.amount} ${unit}${can[2].replace(/^\s*\/.*$/, '').trimEnd()})`);
      continue;
    }
    const c = convertMeasures(g.inner, ingredientId, displayName);
    const metricOnly = c.measures.some(m => m.kind === 'author_metric');
    // Keep only the author's metric figure when the note gives both ("28 oz / 800 g").
    let inner = c.text;
    if (metricOnly)
      inner = c.measures
        .filter(m => m.kind === 'author_metric')
        .map(m => m.text)
        .join(' / ');
    const qualifier = /^\s*(about|approx\.?|approximately|roughly)\b/i.exec(g.inner)?.[1];
    let leftover = c.text;
    for (const m of [...c.measures].reverse()) leftover = leftover.slice(0, m.start) + leftover.slice(m.end);
    const pureNote = c.measures.length > 0 && FILLER.test(leftover);
    const noteRank = Math.max(-1, ...c.measures.map(m => RANK[m.kind]));
    if (headHasMeasure && c.measures.length > 0 && (pureNote || metricOnly)) {
      // The note restates the head amount: show whichever reads best in metric, once.
      if (noteRank > mainRank) {
        const best = metricOnly ? inner : [...c.measures].sort((a, b) => RANK[b.kind] - RANK[a.kind])[0].text;
        main = `${qualifier ? `${qualifier} ` : ''}${best}`;
        mainRank = noteRank;
      }
      const extra = leftover
        .replace(/^[\s,/+]+|[\s,/+]+$/g, '')
        .replace(/^(about|approx\.?|approximately|roughly)$/i, '');
      if (!pureNote && extra) parts.push(`(${extra})`);
      continue;
    }
    parts.push(`(${qualifier && metricOnly ? `${qualifier} ` : ''}${inner})`);
  }
  return convertLengths([main, ...parts].join(' ').replace(/\s+/g, ' ').trim() + tail);
}

/** "a 9-by-13-inch pan" → "a 23 × 33 cm pan"; "1/4-inch" → "6 mm"; "1-inch-thick" → "2.5 cm thick". */
function convertLengths(text: string): string {
  let s = text;
  // "9-by-13-inch", "12 by 16 inches".
  s = s.replace(
    new RegExp(String.raw`(${NUM})(?:-| )by(?:-| )(${NUM})(?:-| )inch(?:es)?\b`, 'g'),
    (_, a: string, b: string) =>
      `${formatLength(parseNumber(a) * CM_PER_INCH).replace(/ cm$/, '')} × ${formatLength(parseNumber(b) * CM_PER_INCH)}`,
  );
  // "1-inch-thick", "1/4-inch", "3/4 inch", "8 inches".
  s = s.replace(
    new RegExp(String.raw`(${NUM})(-| )inch(?:es)?(-thick)?\b`, 'g'),
    (_, a: string, _sep: string, thick?: string) =>
      `${formatLength(parseNumber(a) * CM_PER_INCH)}${thick ? ' thick' : ''}`,
  );
  return s;
}

/** Gas mark for an oven temperature in °F. */
function gasMark(f: number): string {
  if (f < 263) return '1/2';
  if (f < 288) return '1';
  return String(Math.min(10, Math.round((f - 250) / 25)));
}

const LIQUID_WORDS = /\b(water|milk|broth|stock|juice|oil|cream|sauce|wine|vinegar|batter)\b/i;
const STEP_FILLERS = new Set(['of', 'the', 'remaining', 'softened', 'melted', 'cold', 'warm', 'chopped', 'grated']);

/** Which ingredient a step measure refers to: "1/2 cup of the softened butter" → butter. */
function stepIngredient(index: IngredientIndex | undefined, after: string): string | undefined {
  if (!index) return undefined;
  const words = normalizeText(after).split(' ').slice(0, 5);
  while (words.length && STEP_FILLERS.has(words[0])) words.shift();
  for (let n = Math.min(3, words.length); n > 0; n--) {
    const id = index.byTerm.get(words.slice(0, n).join(' '));
    if (id) return id;
  }
  return undefined;
}

/**
 * Step text in the chosen system. US returns it untouched.
 * Temperatures: "350°F (175°C)" → "175°C (155°C fan, gas 4)" for ovens, "74°C" for doneness.
 * Lengths: "a 9-by-13-inch pan" → "a 23 × 33 cm pan". Cups: "1/2 cup of the pasta water" →
 * "120 ml of the pasta water"; "1/4 cup of the sugar" → "50 g of the sugar". "12-cup muffin tin" stays.
 */
export function displayStep(text: string, system: UnitSystem, index?: IngredientIndex): string {
  if (system === 'us') return text;
  let s = text;

  // Temperatures.
  s = s.replace(
    /(\d+)\s*°\s*F(?:\s*\(\s*(\d+)\s*°\s*C\s*\)|\s*\/\s*(\d+)\s*°\s*C)?/g,
    (whole, f: string, c1?: string, c2?: string, offset?: number) => {
      const fahrenheit = Number(f);
      const sentence = text.slice(Math.max(0, (offset ?? 0) - 60), (offset ?? 0) + whole.length + 20);
      const oven = fahrenheit >= 250 && !/air[ -]?fryer/i.test(sentence);
      // The author's °C when given; otherwise convert (ovens to the nearest 10, like UK recipes).
      const exact = (fahrenheit - 32) * (5 / 9);
      const celsius = Number(c1 ?? c2 ?? (oven ? Math.round(exact / 10) * 10 : Math.round(exact)));
      return oven
        ? `${celsius}°C (${Math.round((celsius - 20) / 5) * 5}°C fan, gas ${gasMark(fahrenheit)})`
        : `${celsius}°C`;
    },
  );

  s = convertLengths(s);
  // "1 1/2-quart baking dish".
  s = s.replace(new RegExp(String.raw`(${NUM})-quart\b`, 'g'), (_, a: string) =>
    formatVolume(parseNumber(a) * ML_PER_QUART).replace(' litres', '-litre'),
  );

  // Cups, ounces, pounds, sticks in running text (never "12-cup muffin tin").
  // (No lookbehind: keep the preceding character in a group instead, for older regex engines.)
  const before = s;
  s = s.replace(
    new RegExp(String.raw`(^|[^\d-])${AMOUNT}\s+(cups?|ounces?|oz|pounds?|lbs?|sticks?)\b(?!-)`, 'g'),
    (whole: string, pre: string, lo: string, hi: string | undefined, unit: string, offset: number) => {
      const u = unit.toLowerCase();
      if (/^(ounces?|oz)$/.test(u)) return pre + rangeOf(lo, hi, n => formatMass(n * G_PER_OZ));
      if (/^(pounds?|lbs?)$/.test(u)) return pre + rangeOf(lo, hi, n => formatMass(n * G_PER_LB));
      if (/^sticks?$/.test(u)) return pre + rangeOf(lo, hi, n => formatMass(n * G_PER_STICK));
      const after = before.slice(offset + whole.length);
      const id = LIQUID_WORDS.test(after.split(/[,.;]/)[0].split(' ').slice(0, 5).join(' '))
        ? undefined
        : stepIngredient(index, after);
      const g = gramsPerCup(id);
      if (g && !LIQUIDS.has(id ?? '')) return pre + rangeOf(lo, hi, n => formatMass(n * g));
      return pre + rangeOf(lo, hi, n => formatVolume(n * ML_PER_CUP));
    },
  );
  return s;
}
