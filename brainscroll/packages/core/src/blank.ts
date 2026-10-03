import type { Question } from './content-schema';

/**
 * Fill in the blank (owner, 2026-10-03): a multiple-choice question whose
 * prompt is a sentence with one gap, written as a run of three or more
 * underscores ("The third planet from the Sun is _____."). The options are
 * the words that could fill it; the chosen one drops into the gap. Graded
 * exactly like any other multiple choice, so the server never needs to know.
 */
const BLANK = /_{3,}/g;

/** The text either side of the gap, or null when the prompt isn't a fill-in-the-blank. */
export function blankParts(prompt: string): { before: string; after: string } | null {
  const gaps = [...prompt.matchAll(BLANK)];
  if (gaps.length !== 1) return null;
  const at = gaps[0]!.index!;
  return { before: prompt.slice(0, at), after: prompt.slice(at + gaps[0]![0].length) };
}

/** How many gaps a prompt has (the validator allows one). */
export const blankCount = (prompt: string) => [...prompt.matchAll(BLANK)].length;

export const isFillBlank = (q: Question) => q.kind === 'mcq' && blankParts(q.prompt) !== null;
