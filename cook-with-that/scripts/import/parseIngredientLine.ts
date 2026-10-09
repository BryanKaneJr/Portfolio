/**
 * Split one free-text ingredient line ("1 (15 oz) can black beans, drained") into the
 * parts a RecipeIngredient needs. Heuristic by design: the result is a draft that an
 * editor checks, never shipped unreviewed.
 */
export type ParsedLine = {
  raw: string;
  /** "2 cups", "1 can (15 oz)", "to taste" or '' when the line has no amount. */
  quantityText: string;
  /** What's left once amount, preparation and optional markers are removed: "black beans". */
  name: string;
  preparation?: string;
  optional: boolean;
};

const FRACTIONS: Record<string, string> = {
  '½': '1/2',
  '⅓': '1/3',
  '⅔': '2/3',
  '¼': '1/4',
  '¾': '3/4',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};

const UNITS = [
  'cups?',
  'c\\.',
  'tablespoons?',
  'tbsps?\\.?',
  'tbs\\.?',
  'teaspoons?',
  'tsps?\\.?',
  'ounces?',
  'oz\\.?',
  'fl\\.? oz\\.?',
  'pounds?',
  'lbs?\\.?',
  'grams?',
  'g',
  'kilograms?',
  'kg',
  'milliliters?',
  'millilitres?',
  'ml',
  'dl',
  'cl',
  'liters?',
  'litres?',
  'l',
  'quarts?',
  'qt\\.?',
  'pints?',
  'pt\\.?',
  'cloves?',
  'cans?',
  'jars?',
  'packages?',
  'pkg\\.?',
  'packets?',
  'sticks?',
  'slices?',
  'pieces?',
  'bunch(?:es)?',
  'heads?',
  'sprigs?',
  'stalks?',
  'ribs?',
  'pinch(?:es)?',
  'dash(?:es)?',
  'handfuls?',
  'knobs?',
  'fillets?',
  'links?',
  'leaves',
];
const SIZES = [
  '(?:small|medium|large|big)[- ]sized?',
  'small',
  'medium',
  'large',
  'extra-large',
  'heaping',
  'level',
  'scant',
  'generous',
  'big',
];

const NUMBER = String.raw`\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?`;
const AMOUNT = String.raw`(?:${NUMBER})(?:\s*(?:-|–|to|or)\s*(?:${NUMBER}))?`;
const PAREN = String.raw`\([^)]*\)`;
const LEAD = new RegExp(
  String.raw`^(${AMOUNT})\s*(${PAREN})?\s*(?:(${SIZES.join('|')})\b\s*)?(?:(${UNITS.join('|')})\b\.?)?\s*(${PAREN})?\s*(?:of\s+)?`,
  'i',
);
const OPTIONAL =
  /\s*(?:\((?:optional|opt\.?)[^)]*\)|,?\s*\boptional\b:?|\bfor (?:garnish|serving|topping|decoration)\b|\bto (?:serve|garnish)\b)/gi;
const TO_TASTE = /,?\s*\b(?:to taste|as needed|as desired|to your liking)\b\.?/i;
const WORD_AMOUNTS: Record<string, string> = {
  a: '1',
  an: '1',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  twelve: '12',
  half: '1/2',
  'half a': '1/2',
  'half an': '1/2',
};
const WORD_LEAD = new RegExp(
  String.raw`^(half an?|an?|one|two|three|four|five|six|seven|eight|nine|ten|twelve|half)\s+(?!(?:few|little|bit|couple|lot)\b)(?=\w)`,
  'i',
);
/** "pinch of salt", "a handful of spinach": a unit with no number. */
const UNIT_ONLY =
  /^(?:a\s+)?(pinch|dash|splash|handful|knob|drizzle|bunch|sprig|squeeze|little bit|little|bit|few)(?:es|s)?\s+(?:of\s+)?/i;
/** Second measure after the first: "1 cup/240 ml", "1/2 cup + 2 tbsp", "500 g or 1 lb". */
const ALT = new RegExp(String.raw`^\s*(?:/|\+|or)\s*(${AMOUNT})\s*(${UNITS.join('|')})\b\.?\s*`, 'i');
/** Preparation written after the name without a comma: "onion chopped", "oil for greasing". */
const TRAILING_PREP =
  /\s+((?:finely |roughly |thinly |coarsely )?(?:chopped|diced|minced|sliced|grated|shredded|crushed|peeled|melted|softened|beaten|whisked|cubed|halved|quartered|julienned)\b.*|for (?:greasing|frying|the pan|brushing|dusting)\b.*|to (?:fry|grease|brush)\b.*)$/i;

export function parseIngredientLine(line: string): ParsedLine {
  const raw = line.trim();
  let text = raw
    .replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, '')
    .replace(/(\d?)\s*([½⅓⅔¼¾⅛⅜⅝⅞])/g, (_, d: string, f: string) => (d ? `${d} ${FRACTIONS[f]}` : ` ${FRACTIONS[f]}`))
    .replace(/\(\s+/g, '(')
    .replace(/(\d)\s+(\d\/\d)/g, '$1 $2')
    .replace(/\*\*|__|`/g, '')
    .replace(/^(?:~|about |approx\.? |approximately )/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const word = WORD_LEAD.exec(text);
  if (word) text = `${WORD_AMOUNTS[word[1].toLowerCase()]} ${text.slice(word[0].length)}`;

  let optional = false;
  if (OPTIONAL.test(text)) {
    optional = true;
    text = text.replace(OPTIONAL, '').trim();
  }
  OPTIONAL.lastIndex = 0;

  let quantityText = '';
  const lead = LEAD.exec(text);
  if (lead && lead[0].trim()) {
    const [, amount, paren1, size, unit, paren2] = lead;
    // "1 (15 oz) can" reads better as "1 can (15 oz)", matching the seed recipes.
    const parts = [amount.trim(), size?.trim(), unit?.trim(), paren1?.trim(), paren2?.trim()].filter(Boolean);
    quantityText = parts.join(' ');
    text = text.slice(lead[0].length).trim();
    const alt = ALT.exec(text);
    if (alt) {
      quantityText += text.startsWith('+') ? ` + ${alt[1]} ${alt[2]}` : ` (${alt[1]} ${alt[2]})`;
      text = text.slice(alt[0].length).replace(/^\([^)]*\)\s*/, m => ((quantityText += ` ${m.trim()}`), ''));
    }
    text = text.replace(/^\+\s*/, '');
  } else {
    const unitOnly = UNIT_ONLY.exec(text);
    if (unitOnly) {
      const unit = unitOnly[1].toLowerCase();
      quantityText = /little|bit|few/.test(unit) ? `a ${unit}` : `1 ${unit}`;
      text = text.slice(unitOnly[0].length).trim();
    }
  }

  if (TO_TASTE.test(text)) {
    text = text.replace(TO_TASTE, '').trim();
    if (!quantityText) quantityText = 'to taste';
  }

  let preparation: string | undefined;
  const comma = text.indexOf(',');
  if (comma > 0) {
    preparation =
      text
        .slice(comma + 1)
        .trim()
        .replace(/\.$/, '') || undefined;
    text = text.slice(0, comma).trim();
  }

  // A trailing note in parentheses: a size ("(400ml)") goes with the amount, anything else ("(frozen)") is preparation.
  const note = /\s*\(([^)]*)\)$/.exec(text);
  if (note) {
    if (/\d/.test(note[1]) && quantityText) quantityText = `${quantityText} (${note[1].trim()})`;
    else preparation = [note[1].trim(), preparation].filter(Boolean).join(', ');
    text = text.slice(0, note.index).trim();
  }
  const prep = TRAILING_PREP.exec(text);
  if (prep && prep.index > 0 && !/[/&]$/.test(text.slice(0, prep.index).trim())) {
    preparation = [prep[1].trim(), preparation].filter(Boolean).join(', ');
    text = text.slice(0, prep.index).trim();
  }

  let name = text.replace(/[.:;]+$/, '').trim();
  // Title Case from the source ("Green Bell Peppers") reads oddly in a list; proper nouns get fixed in review.
  if (/^(?:[A-Z][\w'’-]*)(?:\s+[A-Z][\w'’-]*)*$/.test(name) && /\s/.test(name)) name = name.toLowerCase();
  else if (/^[A-Z][a-z]+$/.test(name)) name = name.toLowerCase();
  return { raw, quantityText, name, ...(preparation ? { preparation } : {}), optional };
}
