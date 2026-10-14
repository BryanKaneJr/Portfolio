/**
 * Where a landmark's mark stands on the map: its size on screen and its spot beside the region's town, inside its own
 * region (landmarks.tsx draws it). Plain TypeScript, so the tests can check every landmark.
 */
import { MAP, MAP_REGION, REGION } from '../../sim/content';
import type { RegionId } from '../../sim/types';
import { MIN_NAME_RADIUS, armyBox, grow, nameSize } from './anchors';
import { inRegion } from './geometry';

/** The pictogram's size on screen (points) at play zoom, growing with the zoom like the towns (13 read as a speck). */
const MARK_PT = 20;
/** Never smaller than this (points), however small the region. */
const MARK_MIN = 12;
/** In a small region the mark is capped to about the region's size: this times its label radius on screen. */
const MARK_FIT = 2.2;
/** A spot is good when this share of the picture's lower part stands in its own region; otherwise the best spot. */
const GOOD_FIT = 0.9;
/** Where the picture's mass is, as fractions of its box: sampled to see how much of it stands in its region. */
const SAMPLE_X = [0.15, 0.32, 0.5, 0.68, 0.85];
const SAMPLE_Y = [0.45, 0.6, 0.75, 0.9];
/** Standing where the region's army stands, or on a neighbour's name, counts as this much of the picture out of its
 * region (the army is only sometimes there, a name is only grazed; the border always is). */
const ARMY_COST = 0.35;
const NAME_COST = 0.15;
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
 * inside its own region (its middle and its foot, and nine-tenths of its lower part), clear of the region's name, of
 * its neighbours' names and of where its army stands, so it never reads as a neighbour's, stands in the sea or hides
 * under the troops; then the region's label point (above the name when one is written). Where none is that good (a
 * narrow region), the spot with most of the picture inside it, off the army and the names where that costs little. `size`: the mark's size, `t`: the town's (map units).
 */
export function markSpot(id: RegionId, k: number, px: (n: number) => number, size: number, t: number): [number, number] {
  const key = `${id}:${k.toFixed(3)}:${size.toFixed(3)}:${t.toFixed(3)}`;
  const known = spots.get(key);
  if (known) return known;
  if (spots.size > 600) spots.clear();
  const spot = findSpot(id, k, px, size, t);
  spots.set(key, spot);
  return spot;
}
const spots = new Map<string, [number, number]>();

function findSpot(id: RegionId, k: number, px: (n: number) => number, size: number, t: number): [number, number] {
  const r = MAP_REGION[id];
  const name = nameBox(id, k, px);
  const [tx, ty] = r.town;
  const inside = (x: number, y: number) =>
    inRegion(id, x + size / 2, y + size * 0.6) && inRegion(id, x + size / 2, y + size * 0.85);
  const share = (x: number, y: number) => {
    let n = 0;
    for (const fx of SAMPLE_X) for (const fy of SAMPLE_Y) if (inRegion(id, x + size * fx, y + size * fy)) n++;
    return n / (SAMPLE_X.length * SAMPLE_Y.length);
  };
  const over = (b: number[] | null, x: number, y: number) => !!b && x < b[2] && x + size > b[0] && y < b[3] && y + size > b[1];
  const onName = (x: number, y: number) => over(name, x, y);
  const army = armyBox(id, k);
  const near = 5 * Math.max(size, t);
  const names = MAP.regions
    .filter(o => o.id !== id && Math.abs(o.label[0] - tx) < near && Math.abs(o.label[1] - ty) < near)
    .map(o => nameBox(o.id, k, px));
  const clash = (x: number, y: number) =>
    (over(army, x, y) ? ARMY_COST : 0) + (names.some(b => over(b, x, y)) ? NAME_COST : 0);
  const tries: [number, number][] = [];
  for (const sp of SPOTS) {
    const x = tx + sp.x(t, size);
    let y = ty + sp.y(t, size);
    // Clear of the region's name where the town stands by it (Cairo): above it, or below it.
    if (onName(x, y)) {
      if (sp.clear === 'skip') continue;
      y = sp.clear === 'up' ? name![1] - size : name![3];
    }
    tries.push([x, y]);
  }
  const x = r.label[0] - size / 2;
  const onLabel: [number, number] = name ? [x, name[1] - size] : [x, r.label[1] - size / 2];
  tries.push(onLabel);
  let best: [number, number] | null = null;
  let bestShare = -1;
  for (const [x, y] of tries) {
    if (!inside(x, y)) continue;
    const f = share(x, y) - clash(x, y);
    if (f >= GOOD_FIT) return [x, y];
    if (f > bestShare) [best, bestShare] = [[x, y], f];
  }
  return best ?? [x, r.label[1] - size / 2];
}

/** Roughly where a region's name is written (map units: x0, y0, x1, y1), or null when it is not (too small). */
function nameBox(id: RegionId, k: number, px: (n: number) => number): number[] | null {
  const r = MAP_REGION[id];
  if (r.labelRadius * k < MIN_NAME_RADIUS) return null;
  const fs = nameSize(r.labelRadius, k);
  const half = px(REGION[id].name.length * fs * 0.38);
  return [r.label[0] - half, r.label[1] - px(fs * 0.5), r.label[0] + half, r.label[1] + px(fs * 0.45)];
}
