/**
 * Where a landmark's mark stands on the map: its size on screen and its spot beside the region's town, inside its own
 * region (landmarks.tsx draws it). Plain TypeScript, so the tests can check every landmark.
 */
import { MAP_REGION, REGION } from '../../sim/content';
import type { RegionId } from '../../sim/types';
import { MIN_NAME_RADIUS, grow, nameSize } from './anchors';
import { regionAt } from './geometry';

/** The pictogram's size on screen (points) at play zoom, growing with the zoom like the towns. */
const MARK_PT = 13;
/** Never smaller than this (points), however small the region. */
const MARK_MIN = 9;
/** In a small region the mark is capped to about the region's size: this times its label radius on screen. */
const MARK_FIT = 1.6;
/** A landmark's mark on screen (points): like a town, it grows past play zoom but is capped in a small region. */
export const markSize = (labelRadius: number, k: number) =>
  Math.min(MARK_PT * grow(k), Math.max(MARK_MIN, labelRadius * k * MARK_FIT));

/**
 * Where a mark may stand around its town, in order: upper right, upper left, right above, lower right, lower left,
 * right below, then level with the town on its right and its left. Each gives the mark's top-left corner from the
 * town's point, `t` the town's size and `m` the mark's (map units); `clear`: which way it steps round the region's name.
 */
const SPOTS: { x: (t: number, m: number) => number; y: (t: number, m: number) => number; clear: 'up' | 'down' | 'skip' }[] = [
  { x: t => 0.25 * t, y: (t, m) => -0.55 * t - m, clear: 'up' },
  { x: (t, m) => -0.25 * t - m, y: (t, m) => -0.55 * t - m, clear: 'up' },
  { x: (t, m) => -0.5 * m, y: (t, m) => -0.55 * t - m, clear: 'up' },
  { x: t => 0.25 * t, y: t => 0.3 * t, clear: 'down' },
  { x: (t, m) => -0.25 * t - m, y: t => 0.3 * t, clear: 'down' },
  { x: (t, m) => -0.5 * m, y: t => 0.3 * t, clear: 'down' },
  { x: t => 0.55 * t, y: (t, m) => -0.7 * m, clear: 'skip' },
  { x: (t, m) => -0.55 * t - m, y: (t, m) => -0.7 * m, clear: 'skip' },
];

/**
 * Where a landmark's mark stands (its top-left corner, map units): the first spot around its town where it is drawn
 * inside its own region (its middle and its foot) and clear of the region's name, so it never reads as a
 * neighbour's or stands in the sea; failing all, on the region's label point (above the name when one is written).
 * `size`: the mark's size, `t`: the town's (map units).
 */
export function markSpot(id: RegionId, k: number, px: (n: number) => number, size: number, t: number): [number, number] {
  const r = MAP_REGION[id];
  const name = nameBox(id, k, px);
  const [tx, ty] = r.town;
  const inRegion = (x: number, y: number) =>
    regionAt(x + size / 2, y + size * 0.6) === id && regionAt(x + size / 2, y + size * 0.85) === id;
  const onName = (x: number, y: number) => !!name && x < name[2] && x + size > name[0] && y < name[3] && y + size > name[1];
  for (const sp of SPOTS) {
    const x = tx + sp.x(t, size);
    let y = ty + sp.y(t, size);
    // Clear of the region's name where the town stands by it (Cairo): above it, or below it.
    if (onName(x, y)) {
      if (sp.clear === 'skip') continue;
      y = sp.clear === 'up' ? name![1] - size : name![3];
    }
    if (inRegion(x, y)) return [x, y];
  }
  const x = r.label[0] - size / 2;
  return name && inRegion(x, name[1] - size) ? [x, name[1] - size] : [x, r.label[1] - size / 2];
}

/** Roughly where a region's name is written (map units: x0, y0, x1, y1), or null when it is not (too small). */
function nameBox(id: RegionId, k: number, px: (n: number) => number): number[] | null {
  const r = MAP_REGION[id];
  if (r.labelRadius * k < MIN_NAME_RADIUS) return null;
  const fs = nameSize(r.labelRadius, k);
  const half = px(REGION[id].name.length * fs * 0.38);
  return [r.label[0] - half, r.label[1] - px(fs * 0.5), r.label[0] + half, r.label[1] + px(fs * 0.45)];
}
