/**
 * Color identity primitives.
 *
 * Color identity is the set of colored mana symbols in a card's mana cost AND
 * its rules text (including color indicators), used by Commander to constrain
 * which cards a deck may contain (Comprehensive Rules 903.4). This module is
 * deterministic and side-effect free; the exact per-card symbol data must come
 * from the ingested Oracle records, never from model memory.
 */

/** The five colors of Magic, in canonical WUBRG order. */
export const WUBRG = ["W", "U", "B", "R", "G"] as const;
export type Color = (typeof WUBRG)[number];

const COLOR_SET = new Set<string>(WUBRG);

/**
 * Normalize an arbitrary list of color symbols into a canonical, de-duplicated,
 * WUBRG-ordered array. Unknown symbols are rejected to avoid silently accepting
 * malformed data (blueprint principle: never silently guess).
 *
 * @param symbols - color letters such as ["G", "U", "u"]
 * @returns canonical colors, e.g. ["U", "G"]
 * @throws if any symbol is not one of W/U/B/R/G (case-insensitive)
 */
export function normalizeColors(symbols: readonly string[]): Color[] {
  const seen = new Set<Color>();
  for (const raw of symbols) {
    const c = raw.toUpperCase();
    if (!COLOR_SET.has(c)) {
      throw new Error(`Invalid color symbol: ${JSON.stringify(raw)}`);
    }
    seen.add(c as Color);
  }
  return WUBRG.filter((c) => seen.has(c));
}

/**
 * Determine whether a card's color identity fits within a commander's color
 * identity — the core Commander legality relation (CR 903.4).
 *
 * @returns true when every color of `cardIdentity` is present in `commanderIdentity`
 */
export function isWithinColorIdentity(
  cardIdentity: readonly Color[],
  commanderIdentity: readonly Color[],
): boolean {
  const allowed = new Set(commanderIdentity);
  return cardIdentity.every((c) => allowed.has(c));
}

/** Canonical guild/shard label helper is intentionally omitted until needed. */
