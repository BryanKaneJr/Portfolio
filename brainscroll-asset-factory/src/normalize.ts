// Lightweight text normalization used for duplicate detection and IDs.

export const ID_CATEGORIES = [
  'object', 'animal', 'plant', 'food', 'nature', 'place',
  'vehicle', 'science', 'technology', 'person', 'clothing',
];

export const ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)+$/;

/** BrainScroll text never uses em dashes. */
export function noEmDash(s: string): string {
  return s.replace(/\s*[\u2014\u2015]\s*/g, ', ').replace(/,\s*,/g, ',');
}

const IRREGULAR: Record<string, string> = {
  people: 'person', men: 'man', women: 'woman', children: 'child', mice: 'mouse',
  geese: 'goose', teeth: 'tooth', feet: 'foot', oxen: 'ox', cacti: 'cactus', fungi: 'fungus',
  leaves: 'leaf', knives: 'knife', wolves: 'wolf', shelves: 'shelf', loaves: 'loaf',
  halves: 'half', calves: 'calf', thieves: 'thief', wives: 'wife', scarves: 'scarf',
  hooves: 'hoof', elves: 'elf', axes: 'axe', movies: 'movie', cookies: 'cookie',
  brownies: 'brownie', zombies: 'zombie', pies: 'pie', ties: 'tie', shoes: 'shoe',
  canoes: 'canoe', toes: 'toe', oboes: 'oboe', horseshoes: 'horseshoe', dice: 'die',
  buses: 'bus', viruses: 'virus', octopuses: 'octopus', walruses: 'walrus', cactuses: 'cactus',
  abacuses: 'abacus', gases: 'gas', lenses: 'lens', atlases: 'atlas', irises: 'iris', canvases: 'canvas',
};

const INVARIANT = new Set([
  'glasses', 'scissors', 'species', 'series', 'news', 'sheep', 'deer', 'fish', 'moose',
  'bison', 'aircraft', 'spacecraft', 'headphones', 'binoculars', 'pants', 'jeans', 'shorts',
  'tongs', 'pliers', 'physics', 'mathematics', 'chess', 'gas', 'lens', 'bus', 'atlas',
  'cosmos', 'chaos', 'canvas', 'iris', 'octopus', 'cactus', 'virus', 'walrus', 'platypus',
  'abacus', 'hummus', 'compass', 'glass', 'dress', 'cross', 'grass', 'moss', 'mars', 'venus',
  'uranus', 'olympus', 'pegasus', 'papyrus', 'asparagus', 'hippopotamus', 'rhinoceros',
]);

export function singularize(word: string): string {
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (INVARIANT.has(word) || word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (/(sses|xes|ches|shes|oes)$/.test(word)) return word.slice(0, -2);
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** "  1. Astronomical Telescopes " becomes "astronomical telescope". */
export function normalizeConcept(raw: string): string {
  let s = raw.normalize('NFKC').toLowerCase().trim();
  s = s.replace(/^(?:[-*\u2022]|\d+[.)])\s+/, '');
  s = s.replace(/[^a-z0-9\s'-]/g, ' ').replace(/'s\b/g, '').replace(/'/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^(a|an|the)\s+/, '');
  const words = s.split(' ').filter(Boolean);
  if (words.length) words[words.length - 1] = singularize(words[words.length - 1]);
  return words.join(' ');
}

export function slugify(s: string): string {
  return normalizeConcept(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** object.telescope becomes object_telescope.png */
export function idToFilename(id: string): string {
  return id.replace(/\./g, '_') + '.png';
}

const SMALL_WORDS = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'on', 'for', 'to', 'with']);

export function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Clean an LLM or user supplied list: strings only, trimmed, deduped (case-insensitive). */
export function cleanList(v: unknown, max = 20, lower = false): string[] {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    if (typeof x !== 'string') continue;
    let s = noEmDash(x).replace(/\s+/g, ' ').trim();
    if (lower) s = s.toLowerCase();
    const k = s.toLowerCase();
    if (!s || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.slice(0, max);
}

export function cleanText(v: unknown, max = 600): string {
  return typeof v === 'string' ? noEmDash(v).replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// Fallback abstractness check used only when no language model is available.
const ABSTRACT_WORDS = new Set([
  'democracy', 'capitalism', 'socialism', 'communism', 'inflation', 'deflation', 'gravity',
  'industrialization', 'globalization', 'freedom', 'justice', 'liberty', 'equality', 'economy',
  'supply and demand', 'greenhouse effect', 'climate change', 'evolution', 'photosynthesis',
  'culture', 'religion', 'philosophy', 'ethic', 'morality', 'love', 'happiness', 'time',
  'energy', 'entropy', 'recession', 'taxation', 'diplomacy', 'nationalism', 'imperialism',
  'colonialism', 'feudalism', 'renaissance', 'enlightenment', 'reformation', 'fall of rome',
]);

export function looksAbstract(concept: string): boolean {
  if (ABSTRACT_WORDS.has(concept)) return true;
  if (/(ism|ness)$/.test(concept)) return true;
  return /^(the )?(fall|rise|history|theory|law|concept|idea|process|cause|effect) of\b/.test(concept);
}
