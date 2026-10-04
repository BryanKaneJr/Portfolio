import type { Question } from './content-schema';

/**
 * How every question is graded, in one place: local play, review, chapter
 * reviews and the Final Round all call gradeAnswer, and the server's
 * grade_answer (SQL) mirrors it.
 *
 * An answer travels as one string, whatever the question:
 *   mcq   : the chosen option's id ("b")
 *   match : a JSON array of right-hand labels, one per left item in order
 *   order : a JSON array of the item labels, in the order the learner chose
 *
 * Match and order are graded by label (owner, 2026-10-03): two identical
 * labels are interchangeable, so neither can be "wrong" for being the other.
 * An answer that isn't a rearrangement of the question's own labels is wrong.
 */
export interface Grade {
  correct: boolean;
  /** Why a wrong option is wrong (multiple choice only). */
  rationale?: string;
  /** For match and order: the positions that are wrong (never what belongs there). */
  wrong?: number[];
}

export const isArrangement = (q: Question): q is Extract<Question, { kind: 'match' | 'order' }> => q.kind === 'match' || q.kind === 'order';

/** The labels a correct answer lists, in order. */
export function expectedLabels(q: Extract<Question, { kind: 'match' | 'order' }>): string[] {
  return q.kind === 'match' ? q.pairs.map((p) => p.right) : q.items;
}

/** The answer string for a list of labels (match: right labels by left; order: items in order). */
export const encodeArrangement = (labels: readonly string[]) => JSON.stringify(labels);

function decode(answer: string): string[] | null {
  try {
    const v: unknown = JSON.parse(answer);
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;
  } catch {
    return null;
  }
}

const sameMultiset = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');

export function gradeAnswer(q: Question, answer: string): Grade {
  // Anything not marked match or order is multiple choice (older data has no kind).
  if (!isArrangement(q)) {
    const option = q.options.find((o) => o.id === answer);
    const correct = option?.correct ?? false;
    return correct ? { correct } : { correct, ...(option?.rationale ? { rationale: option.rationale } : {}) };
  }
  const expected = expectedLabels(q);
  const given = decode(answer);
  // Not a rearrangement of this question's own labels: every position is wrong.
  if (!given || !sameMultiset(given, expected)) return { correct: false, wrong: expected.map((_, i) => i) };
  const wrong = expected.flatMap((label, i) => (given[i] === label ? [] : [i]));
  return wrong.length ? { correct: false, wrong } : { correct: true };
}

/** A small, stable hash, so a question is shuffled the same way every time it's shown. */
function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** A Fisher-Yates shuffle seeded by `seedText`: the same text always gives the same order. */
function seededShuffle<T>(seedText: string, items: readonly T[]): T[] {
  const out = [...items];
  let seed = hash(seedText);
  for (let i = out.length - 1; i > 0; i--) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The labels to present, jumbled: match's right-hand column, or the items to
 * order. Stable per question (it doesn't reshuffle on every render), and
 * never already in the right order.
 */
export function shuffledLabels(questionId: string, labels: readonly string[], expected: readonly string[] = labels): string[] {
  const out = seededShuffle(questionId, labels);
  // Already solved by chance (or every label is the same): rotate once.
  if (out.every((l, i) => l === expected[i]) && new Set(out).size > 1) out.push(out.shift()!);
  return out;
}

/**
 * A multiple-choice (or fill-in-the-blank) question's options in the order to
 * show them. Content tends to put the right answer second, so every surface
 * (lessons, reviews, chapter reviews, the Final Round; local and remote) shows
 * them in one stable order per question, from its id. When every option is a
 * number or quantity of one kind ("125", "3.3 million years", "82 BCE",
 * "About 200 m"), they show smallest first instead (content QA: numbers read
 * best in their natural order). Display only: answers
 * still travel and are graded by option id, and it never looks at `correct`
 * (learner bundles don't carry it).
 */
export function shuffledOptions<O extends { id: string; label?: string }>(question: { id: string; options: readonly O[] }): O[] {
  const values = question.options.map((o) => (o.label === undefined ? null : quantityOf(o.label)));
  if (values.length > 1 && values.every((v) => v !== null) && new Set(values.map((v) => v!.unit)).size === 1) {
    return question.options
      .map((o, i) => ({ o, v: values[i]!.value, i }))
      .sort((a, b) => a.v - b.v || a.i - b.i)
      .map((x) => x.o);
  }
  return seededShuffle(question.id, question.options);
}

/** Words that soften a quantity ("About 200 m", "Just over 1,000"); they don't change its place in the order. */
const QUALIFIER = /^(?:about|around|roughly|approximately|approx\.|nearly|almost|exactly|just over|just under|over|under|more than|less than|fewer than|upwards of|up to|at least|c\.|ca\.|~)\s*/i;
/** Units that convert, so "200 m" and "2 km" (or "45 days" and "10 years") still sort by size. */
const UNITS: Record<string, [string, number]> = {
  mm: ['m', 0.001], millimeter: ['m', 0.001], millimetre: ['m', 0.001], cm: ['m', 0.01], centimeter: ['m', 0.01], centimetre: ['m', 0.01],
  m: ['m', 1], meter: ['m', 1], metre: ['m', 1], km: ['m', 1000], kilometer: ['m', 1000], kilometre: ['m', 1000],
  second: ['s', 1], minute: ['s', 60], hour: ['s', 3600], day: ['s', 86400], week: ['s', 604800], month: ['s', 2629800], year: ['s', 31557600],
  cent: ['$', 0.01],
};
const SCALE: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };

/**
 * A label that is just a number or quantity, as a value and its unit, or
 * null for anything else: "1,000" is 1000; "45%" is 45 "%"; "82 BCE" is -82
 * (years BCE count down, so they sort in time); "3.3 million years" and
 * "About 2 km" convert to seconds and meters, so mixed units still compare.
 */
export function quantityOf(label: string): { value: number; unit: string } | null {
  const t = label.trim().replace(QUALIFIER, '');
  const m = /^([-−]?)([$£€]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(.*)$/.exec(t);
  if (!m) return null;
  let value = Number(m[3]!.replace(/,/g, '') + (m[4] ?? ''));
  if (m[1]) value = -value;
  let rest = m[5]!.trim();
  const scaled = /^(thousand|million|billion|trillion)\b\s*(.*)$/i.exec(rest);
  if (scaled) {
    value *= SCALE[scaled[1]!.toLowerCase()]!;
    rest = scaled[2]!;
  }
  const era = /^(BCE|BC|CE|AD)\b\.?\s*(.*)$/i.exec(rest);
  if (era) {
    if (/^bc/i.test(era[1]!)) value = -value;
    rest = era[2]!;
  }
  // What's left is at most a short unit: "m", "years", "km/h", "%", "°C".
  if (!/^(?:[A-Za-z%°²³/.'’-]+\s*){0,3}$/.test(rest)) return null;
  const unit = (m[2] ?? '') + rest.toLowerCase().replace(/\s+/g, ' ').trim().replace(/(.)s$/, '$1');
  const known = UNITS[unit];
  return known ? { value: value * known[1], unit: known[0] } : { value, unit };
}

/** The letter shown beside the option at `index` of the shuffled order (A, B, C, ...). */
export const optionLetter = (index: number) => String.fromCharCode(65 + index);
