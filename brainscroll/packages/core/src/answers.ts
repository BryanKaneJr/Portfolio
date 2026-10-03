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

/**
 * The labels to present, jumbled: match's right-hand column, or the items to
 * order. Stable per question (it doesn't reshuffle on every render), and
 * never already in the right order.
 */
export function shuffledLabels(questionId: string, labels: readonly string[], expected: readonly string[] = labels): string[] {
  const out = [...labels];
  let seed = hash(questionId);
  for (let i = out.length - 1; i > 0; i--) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // Already solved by chance (or every label is the same): rotate once.
  if (out.every((l, i) => l === expected[i]) && new Set(out).size > 1) out.push(out.shift()!);
  return out;
}
