/**
 * Card-name normalization for exact/fuzzy matching. Deterministic and reversible
 * only in the sense that the same input always yields the same key; it is NOT a
 * substitute for confirming ambiguous names with the user (blueprint §3.1).
 */

/**
 * Produce a lookup key for a card name: lowercased, accent-folded, punctuation
 * collapsed, whitespace normalized. Used for building/querying the name index.
 *
 * Examples:
 *   "Jötun Grunt"        -> "jotun grunt"
 *   "Ach! Hans, Run!"    -> "ach hans run"
 *   "Asmoranomardicadaistinaculdacar" (unchanged)
 */
export function normalizeCardName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Split a double-faced/split "Front // Back" name into its component names. */
export function splitMultipartName(name: string): string[] {
  return name
    .split("//")
    .map((s) => s.trim())
    .filter(Boolean);
}
