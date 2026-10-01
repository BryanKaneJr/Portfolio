/**
 * The pictures floating beside the skill map's road (owner, 2026-10-01: the
 * same lungs and bones kept coming back on Human Body; no repeats within
 * about three chapters).
 *
 * Each chapter shows two, beside its 3rd and 7th levels. Several levels share
 * an image, so the map picks: for each spot, the first of these not yet used
 * anywhere on the tree (else not used in the last `window` spots):
 *
 *   1. that level's own image, then its cards' pictures (content/card-art.json);
 *   2. the same for the chapter's other levels, nearest first.
 *
 * A spot with nothing left stays empty rather than repeat. Presentation only:
 * no level changes.
 */

/** Levels of each chapter that have a picture beside them (1-based, within the chapter). */
export const SCENERY_LEVELS_IN_CHAPTER = [3, 7] as const;
/** No picture repeats within this many spots: two per chapter, so three chapters. */
export const SCENERY_WINDOW = SCENERY_LEVELS_IN_CHAPTER.length * 3;

/** Picks one image per slot from its candidates (in preference order). */
export function pickScenery(slots: readonly (readonly string[])[], window = SCENERY_WINDOW): (string | undefined)[] {
  const picked: (string | undefined)[] = [];
  const used = new Set<string>();
  slots.forEach((candidates, i) => {
    const recent = new Set(picked.slice(Math.max(0, i - window + 1), i));
    const pick = candidates.find((c) => !used.has(c)) ?? candidates.find((c) => !recent.has(c));
    picked.push(pick);
    if (pick) used.add(pick);
  });
  return picked;
}

/**
 * The map's picture for each scenery level of a skill (level number → image).
 * `levels` are the skill's levels with their images; `cardArt(n)` lists the
 * pictures of level n's cards.
 */
export function skillScenery(levels: readonly { number: number; art?: string }[], cardArt: (n: number) => readonly string[], chapterSize = 10): Map<number, string> {
  const artOf = new Map(levels.map((l) => [l.number, l.art]));
  const pictures = (n: number) => [...(artOf.get(n) ? [artOf.get(n)!] : []), ...cardArt(n)];
  const last = Math.max(0, ...levels.map((l) => l.number));
  const spots: number[] = [];
  for (let start = 1; start <= last; start += chapterSize) for (const k of SCENERY_LEVELS_IN_CHAPTER) if (start + k - 1 <= last) spots.push(start + k - 1);
  const slots = spots.map((n) => {
    const start = n - ((n - 1) % chapterSize);
    const others = Array.from({ length: chapterSize }, (_, i) => start + i)
      .filter((m) => m !== n && artOf.has(m))
      .sort((a, b) => Math.abs(a - n) - Math.abs(b - n) || a - b);
    return [...new Set([...pictures(n), ...others.flatMap(pictures)])];
  });
  const picks = pickScenery(slots);
  return new Map(spots.flatMap((n, i) => (picks[i] ? [[n, picks[i]!] as const] : [])));
}
