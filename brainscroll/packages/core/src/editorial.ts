/**
 * Editorial rules that apply to every piece of BrainScroll-authored text
 * (docs/content-guide.md "Editorial rules").
 *
 * HARD RULE: no em dashes (U+2014) in BrainScroll-authored text. Rewrite the
 * sentence with a comma, colon, semicolon, parentheses, a period or a
 * conjunction instead. Never swap in a hyphen mechanically.
 *
 * Exempt, because they must stay faithful to the source:
 *   - verbatim quotations (`supportingQuote` in the verification ledger)
 *   - source metadata (a source's title, publisher and URL)
 */
export const EM_DASH = '\u2014';

/** Keys whose values are verbatim source text or source metadata. */
export const VERBATIM_KEYS: ReadonlySet<string> = new Set(['supportingQuote']);
export const SOURCE_METADATA_KEYS: ReadonlySet<string> = new Set(['title', 'publisher', 'url']);

/** Paths (e.g. `cards[2].body`) of string values containing an em dash, skipping exempt keys. */
export function emDashPaths(value: unknown, exempt: ReadonlySet<string> = VERBATIM_KEYS, path = ''): string[] {
  if (typeof value === 'string') return value.includes(EM_DASH) ? [path || '(value)'] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => emDashPaths(v, exempt, `${path}[${i}]`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => (exempt.has(k) ? [] : emDashPaths(v, exempt, path ? `${path}.${k}` : k)));
  return [];
}

export const EM_DASH_MESSAGE =
  'uses an em dash (U+2014). BrainScroll-authored text never does: rewrite the sentence with a comma, colon, semicolon, parentheses, a period or a conjunction';

/**
 * Questions never point at the app's own structure (owner, 2026-10-03: a tester
 * was confused by "this level", "the card says", "Level 13's raid"). A
 * question also comes back in reviews, mixed with other levels, where such
 * callbacks make no sense: name the topic instead. Cards may still say
 * "Chapter 8 complete"; this applies to everything a question shows.
 */
export const APP_STRUCTURE_REF =
  /\b(?:this|that|these|those|earlier|previous|next|last) (?:level|levels|card|cards|chapter|chapters|lesson|lessons)\b|\bthe (?:level|card|cards|chapter|lesson)\b(?! (?:of|network|networks|reader|number|game|catalog))|\b(?:Level|Levels|Chapter) \d+|^[A-Z][^:]{0,40} (?:recap|milestone|checkpoint|mastery)( [a-z ]+)?:/i;

/** The text a learner sees for a question, by path, for the app-structure check. */
export function questionTexts(q: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = [];
  const add = (path: string, v: unknown) => typeof v === 'string' && out.push([path, v]);
  for (const k of ['prompt', 'explanation', 'first', 'last']) add(k, q[k]);
  (q.options as { label?: string; rationale?: string }[] | undefined)?.forEach((o, i) => {
    add(`options[${i}].label`, o.label);
    add(`options[${i}].rationale`, o.rationale);
  });
  (q.items as string[] | undefined)?.forEach((s, i) => add(`items[${i}]`, s));
  (q.pairs as { left: string; right: string }[] | undefined)?.forEach((p, i) => {
    add(`pairs[${i}].left`, p.left);
    add(`pairs[${i}].right`, p.right);
  });
  return out;
}

export const APP_STRUCTURE_MESSAGE =
  'refers to the app\'s structure ("this level", "the card", "Level 13", "Chapter 2", "X recap:"). Questions come back in reviews mixed with other levels: name the topic instead';
