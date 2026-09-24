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
