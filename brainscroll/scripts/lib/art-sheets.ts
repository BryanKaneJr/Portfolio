/**
 * Level art travels in sheets of four images (2 × 2), not a file per image: an
 * instant update (EAS Update) may carry at most 1,000 files, and the level art
 * alone passed 750. The app shows one cell of a sheet (LevelArt).
 *
 * Placement is sticky, so adding art adds sheets without changing the ones
 * phones already have: an image keeps its sheet and cell from one run to the
 * next, a removed image leaves a gap the next new one fills, and the rest of
 * the new ones go on new sheets at the end.
 */
import { createHash } from 'node:crypto';

/** Each cell is a 512 px image plus a 4 px copy of its own edge, so scaling never blends in a neighbour. */
export const SHEET = { COLS: 2, ROWS: 2, CELL: 512, EDGE: 4, QUALITY: 90 } as const;
export const PER_SHEET = SHEET.COLS * SHEET.ROWS;

/** A sheet's images, cell by cell (null for an empty cell), and a hash of them and their files. */
export interface Sheet {
  ids: (string | null)[];
  hash: string;
}
export interface SheetLayout {
  sheets: Sheet[];
}

/**
 * Where every image in `ids` goes, keeping each one `previous` placed where it
 * was. New images go in `order` (by first use), then by name. `fileHash` is a
 * hash of an image's file, so a sheet's hash changes when any of its images do.
 */
export function planSheets(previous: SheetLayout | null, ids: string[], order: string[], fileHash: (id: string) => string): SheetLayout {
  const have = new Set(ids);
  const cells = (previous?.sheets ?? []).map((s) => Array.from({ length: PER_SHEET }, (_, i) => (s.ids[i] && have.has(s.ids[i]!) ? s.ids[i]! : null)));
  const placed = new Set(cells.flat());
  const rank = new Map<string, number>();
  order.forEach((id, i) => rank.has(id) || rank.set(id, i));
  const fresh = ids
    .filter((id) => !placed.has(id))
    .sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity) || a.localeCompare(b));
  for (const sheet of cells) for (let i = 0; i < PER_SHEET && fresh.length; i++) sheet[i] ??= fresh.shift()!;
  while (fresh.length) cells.push(Array.from({ length: PER_SHEET }, () => fresh.shift() ?? null));
  return {
    sheets: cells
      .filter((s) => s.some(Boolean))
      .map((s) => ({
        ids: s,
        hash: createHash('sha256')
          .update(JSON.stringify(SHEET))
          .update(s.map((id) => (id ? `${id}:${fileHash(id)}` : '-')).join('|'))
          .digest('hex')
          .slice(0, 16),
      })),
  };
}
