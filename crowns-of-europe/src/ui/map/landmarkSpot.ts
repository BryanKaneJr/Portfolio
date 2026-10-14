/**
 * Where a landmark's mark stands on the map: its size on screen and its spot near the region's town, inside its own
 * region and clear of what else is drawn there (landmarks.tsx draws it). Plain TypeScript, so the tests can check
 * every landmark.
 */
import { LANDMARKS, MAP, MAP_REGION, REGION } from '../../sim/content';
import type { RegionId } from '../../sim/types';
import { MIN_NAME_RADIUS, armyBox, armyParts, grow, nameSize } from './anchors';
import { inRegion, regionBounds } from './geometry';

/** The pictogram's size on screen (points) at play zoom, growing with the zoom like the towns (13 read as a speck). */
const MARK_PT = 20;
/** Never smaller than this (points), however small the region. */
export const MARK_MIN = 12;
/** In a small region the mark is capped to about the region's size: this times its label radius on screen. */
const MARK_FIT = 2.2;
/** Where no spot is good at its full size (a tiny region with an army in it: Constantinople), it is tried at this
 * share of it, then at MARK_MIN. */
const MARK_SHRINK = 0.8;
/** A spot is good when at least this share of the picture's lower part stands in its own region. */
const GOOD_FIT = 0.9;
/** Where the picture's mass is, as fractions of its box: sampled to see how much of it stands in its region. */
const SAMPLE_X = [0.15, 0.32, 0.5, 0.68, 0.85];
const SAMPLE_Y = [0.45, 0.6, 0.75, 0.9];
/**
 * What a spot costs, as a share of the picture standing out of its region. Standing where the region's own army stands
 * costs the whole picture and more (ARMY_COST, plus the share of it the troops hide), so any spot clear of it wins (the
 * owner would see only a gold sliver under the troops). A neighbour's name (NAME_COST, more the more of the mark its
 * letters cover), a landmark placed before it (MARK_COST), a neighbour's town (NEAR_COST) or, a little, a neighbour's
 * army (NEAR_ARMY_COST) make the mark read as the neighbour's or hide it. Each step of its size farther from the town
 * than the nearest spots costs FAR_COST, so it stands by its town when it can.
 */
const ARMY_COST = 1;
const NAME_COST = 0.6;
const MARK_COST = 0.5;
const NEAR_COST = 0.3;
const NEAR_ARMY_COST = 0.1;
const FAR_COST = 0.04;
/** Margins (points) round a neighbour's name and round its town; a landmark keeps its own size from another's. */
const NAME_GAP = 3;
const TOWN_GAP = 4;
const MARK_GAP = 1;
/** Beyond the nearest eight, spots on a grid round the town a third of the mark apart, out to this many times the
 * mark's (or town's) size, and at most GRID_N steps each way. */
const GRID_REACH = 4;
const GRID_N = 18;

/** A landmark's mark on screen (points): like a town, it grows past play zoom but is capped in a small region. */
export const markSize = (labelRadius: number, k: number) =>
  Math.min(MARK_PT * grow(k), Math.max(MARK_MIN, labelRadius * k * MARK_FIT));

/**
 * The nearest spots round the town, in order: upper right, upper left, right above, lower right, lower left, right
 * below, then level with the town on its right and its left. Each gives the mark's top-left corner from the town's
 * point, `t` the town's size and `m` the mark's (map units); `clear`: which way it steps round the region's name.
 */
const SPOTS: {
  x: (t: number, m: number) => number;
  y: (t: number, m: number) => number;
  clear: 'up' | 'down' | 'skip';
}[] = [
  { x: t => 0.25 * t, y: (t, m) => -0.55 * t - m, clear: 'up' },
  { x: (t, m) => -0.25 * t - m, y: (t, m) => -0.55 * t - m, clear: 'up' },
  { x: (t, m) => -0.5 * m, y: (t, m) => -0.55 * t - m, clear: 'up' },
  { x: t => 0.25 * t, y: t => 0.3 * t, clear: 'down' },
  { x: (t, m) => -0.25 * t - m, y: t => 0.3 * t, clear: 'down' },
  { x: (t, m) => -0.5 * m, y: t => 0.3 * t, clear: 'down' },
  { x: t => 0.55 * t, y: (t, m) => -0.7 * m, clear: 'skip' },
  { x: (t, m) => -0.55 * t - m, y: (t, m) => -0.7 * m, clear: 'skip' },
];

/** A mark's place: its top-left corner and its size (map units). */
export type MarkPlace = [x: number, y: number, size: number];

/** A region's town picture's size (map units) at this zoom; null where it has none. */
export type TownSize = (id: RegionId) => number | null;

/**
 * Where a landmark's mark stands and how big it is (map units). It stands inside its own region (its middle and its
 * foot always, nine-tenths of its lower part where it can), never on the region's name or its town, and as clear as it
 * can be of where the region's army stands, of the neighbours' names, armies and towns and of the landmarks placed
 * before it (in LANDMARKS' order), so it never hides under the troops or reads as a neighbour's; near its town where
 * that is clear, farther out where not. Where no spot is good at its full size, it shrinks (down to MARK_MIN).
 */
export function markPlace(id: RegionId, k: number, px: (n: number) => number, town: TownSize): MarkPlace {
  const full = px(markSize(MAP_REGION[id].labelRadius, k));
  const t = town(id) ?? full;
  // The landmarks before it decide where it may stand, so their towns' sizes are in the key too.
  let key = `${id}:${k.toFixed(3)}:${t.toFixed(3)}`;
  for (const lm of LANDMARKS) {
    if (lm.region === id) break;
    key += `:${town(lm.region)?.toFixed(3)}`;
  }
  const known = places.get(key);
  if (known) return known;
  if (places.size > 600) places.clear();
  const sizes = [full, Math.max(px(MARK_MIN), full * MARK_SHRINK), px(MARK_MIN)].filter(
    (s, i, a) => i === 0 || s < a[i - 1] - 1e-6,
  );
  const around = surroundings(id, k, px, full, t, town);
  let best: Spot | null = null;
  for (const size of sizes) {
    const found = findSpot(id, k, px, size, t, around);
    if (found && (!best || found.score > best.score)) best = found;
    if (best && best.fits) break;
  }
  const place = best?.place ?? [MAP_REGION[id].label[0] - full / 2, MAP_REGION[id].label[1] - full / 2, full];
  places.set(key, place);
  return place;
}
const places = new Map<string, MarkPlace>();

/** A spot found: the mark's place, its score (below), and whether it fits: its lower part in its region, off its army
 * and the neighbours' names. */
interface Spot {
  place: MarkPlace;
  score: number;
  fits: boolean;
}

/** Something near a mark's town that it should keep off (a box, map units) and what standing on it costs; `name`: a
 * neighbour's name, which the mark would rather shrink than cover. */
interface Block {
  b: number[];
  cost: number;
  name?: boolean;
}

/** Box overlap (x0, y0, x1, y1). */
const overlapArea = (a: number[], b: number[]) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
const overlaps = (a: number[] | null, b: number[]) => !!a && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const inflate = (b: number[], g: number) => [b[0] - g, b[1] - g, b[2] + g, b[3] + g];
/** Roughly where a town's picture has its settlement (map units), `t` its size: its point is on the ground. */
const townBox = (x: number, y: number, t: number) => [x - 0.25 * t, y - 0.5 * t, x + 0.25 * t, y + 0.15 * t];

/** Grid steps (i, j) out to GRID_N each way, nearest first: the spots tried beyond the nearest eight. */
let grid: [number, number][] | null = null;
function gridSteps(): [number, number][] {
  if (!grid) {
    grid = [];
    for (let i = -GRID_N; i <= GRID_N; i++) for (let j = -GRID_N; j <= GRID_N; j++) grid.push([i, j]);
    grid.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  }
  return grid;
}
/** How far round its town (in steps of the mark's or town's size, whichever is bigger) a mark may stand. */
const reachOf = (size: number, t: number) => Math.max(size, t);

/**
 * What a mark costs to stand on near its town, besides its own region's army: the neighbours' names, armies and
 * towns, and the marks of the landmarks before it, each a box (map units) and its cost. `size`: the mark's full size.
 */
function surroundings(id: RegionId, k: number, px: (n: number) => number, size: number, t: number, town: TownSize) {
  const [tx, ty] = MAP_REGION[id].town;
  const near = (GRID_REACH + 1) * reachOf(size, t) + size;
  const close = (p: number[]) => Math.abs(p[0] - tx) < near && Math.abs(p[1] - ty) < near;
  const blocks: Block[] = [];
  for (const o of MAP.regions) {
    if (o.id === id || !(close(o.label) || close(o.town))) continue;
    const b = nameBox(o.id, k, px);
    if (b) blocks.push({ b: inflate(b, px(NAME_GAP)), cost: NAME_COST, name: true });
    blocks.push({ b: armyBox(o.id, k), cost: NEAR_ARMY_COST });
    blocks.push({ b: inflate(townBox(o.town[0], o.town[1], t), px(TOWN_GAP)), cost: NEAR_COST });
  }
  for (const lm of LANDMARKS) {
    if (lm.region === id) break;
    if (!MAP_REGION[lm.region] || !close(MAP_REGION[lm.region].town)) continue;
    const [x, y, s] = markPlace(lm.region, k, px, town);
    blocks.push({ b: inflate([x, y, x + s, y + s], s * MARK_GAP), cost: MARK_COST });
  }
  return blocks;
}

/**
 * The best spot for a mark of this size and its score (share of its lower part in its region, less the costs), or
 * null where none has its middle and foot inside. `blocks`: its surroundings (above).
 */
function findSpot(
  id: RegionId,
  k: number,
  px: (n: number) => number,
  size: number,
  t: number,
  blocks: Block[],
): Spot | null {
  const r = MAP_REGION[id];
  const [tx, ty] = r.town;
  const name = nameBox(id, k, px);
  const ownName = name && inflate(name, px(1));
  const ownTown = townBox(tx, ty, t);
  const army = armyBox(id, k);
  const troops = armyParts(id, k);
  const reach = reachOf(size, t);
  const step = size / 3;
  const n = Math.min(GRID_N, Math.ceil((GRID_REACH * reach) / step));
  const bounds = regionBounds(id)!;
  let best: Spot | null = null;
  const tryAt = (x: number, y: number, far: number) => {
    const mx = x + size / 2;
    if (mx < bounds[0] || mx > bounds[2] || y + size * 0.6 < bounds[1] || y + size * 0.85 > bounds[3]) return;
    const box = [x, y, x + size, y + size];
    if (overlaps(ownName, box) || overlaps(ownTown, box)) return;
    let f = 1 - far;
    let onArmy = false;
    if (overlaps(army, box)) {
      // Under its own troops: the whole picture, and more the more of it they cover.
      onArmy = true;
      let hid = 0;
      for (const p of troops) hid += overlapArea(p, box);
      f -= ARMY_COST * (1 + hid / (size * size));
    }
    let clear = !onArmy;
    for (const { b, cost, name: onName } of blocks)
      if (overlaps(b, box)) {
        // A name costs more the more of the mark it runs over (its letters are drawn over the mark).
        f -= onName ? cost * (0.5 + overlapArea(b, box) / (size * size)) : cost;
        if (onName) clear = false;
      }
    if (best && f <= best.score) return;
    if (!inRegion(id, x + size / 2, y + size * 0.6) || !inRegion(id, x + size / 2, y + size * 0.85)) return;
    let m = 0;
    for (const fx of SAMPLE_X) for (const fy of SAMPLE_Y) if (inRegion(id, x + size * fx, y + size * fy)) m++;
    const share = m / (SAMPLE_X.length * SAMPLE_Y.length);
    // Below nine-tenths in its region it reads as standing on the border: that costs three times over.
    f -= 1 - share + 2 * Math.max(0, GOOD_FIT - share);

    if (!best || f > best.score) best = { place: [x, y, size], score: f, fits: clear && share >= GOOD_FIT };
  };
  // Standing farther from the town than the nearest spots costs a little.
  const far = (dx: number, dy: number) => FAR_COST * Math.max(0, Math.hypot(dx, dy) / reach - 1.2);
  // The nearest eight first; then a grid round the town, nearest first, until no spot farther out can win.
  for (const sp of SPOTS) {
    const x = tx + sp.x(t, size);
    let y = ty + sp.y(t, size);
    // Clear of the region's name where the town stands by it (Cairo): above it, or below it.
    if (name && overlaps(name, [x, y, x + size, y + size])) {
      if (sp.clear === 'skip') continue;
      y = sp.clear === 'up' ? name[1] - size : name[3];
    }
    tryAt(x, y, far(x + size / 2 - tx, y + size * 0.6 - ty));
  }
  for (const [i, j] of gridSteps()) {
    if (Math.abs(i) > n || Math.abs(j) > n) continue;
    const cost = far(i * step, j * step);
    if (best && (best as Spot).score >= 1 - cost) break;
    tryAt(tx + i * step - size / 2, ty + j * step - size * 0.6, cost);
  }
  return best;
}

/** Roughly where a region's name is written (map units: x0, y0, x1, y1), or null when it is not (too small). */
export function nameBox(id: RegionId, k: number, px: (n: number) => number): number[] | null {
  const r = MAP_REGION[id];
  if (r.labelRadius * k < MIN_NAME_RADIUS) return null;
  const fs = nameSize(r.labelRadius, k);
  const half = px(REGION[id].name.length * fs * 0.38);
  return [r.label[0] - half, r.label[1] - px(fs * 0.5), r.label[0] + half, r.label[1] + px(fs * 0.45)];
}
