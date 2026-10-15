/**
 * Where a landmark's picture stands on the map: its size on screen and its spot near the region's town, inside its
 * own region and clear of what else is drawn there (landmarks.tsx draws it). Plain TypeScript, so the tests can check
 * every landmark.
 */
import { LANDMARKS, LANDMARK_AT, MAP, MAP_REGION, REGION } from '../../sim/content';
import type { RegionId } from '../../sim/types';
import { MIN_NAME_RADIUS, armyBox, armyParts, grow, nameSize } from './anchors';
import { inRegion, regionBounds } from './geometry';
import { LANDMARK_ART } from './landmarkArt';

/**
 * A painting's size on screen at play zoom, growing with the zoom like the towns: the side (points) of a square of
 * the same area, so each keeps its own proportions and none outweighs the others (the Pyramids wide and low, the
 * Giralda tall and slim). About a village's picture (19-22 points): a landmark stands beside its town, never bigger
 * than a city (28-30), at the owner's request.
 */
export const MARK_PT = 19;
/** A tall one is never taller than this times MARK_PT (the Giralda would tower over its town), a wide one never wider
 * than MARK_WIDE times it. */
const MARK_TALL = 1.3;
const MARK_WIDE = 1.25;
/** Its longer side is never under this (points), however small the region. */
export const MARK_MIN = 12;
/** In a small region the picture is capped to about the region's size: its longer side at most this times its label
 * radius on screen. */
const MARK_FIT = 2.2;
/** Where no spot is good at its full size (a tiny region with an army in it: Constantinople), it is tried at these
 * shares of it, then at MARK_MIN: a painting shrinks only as far as it must. */
const MARK_SHRINK = [0.9, 0.8, 0.7, 0.6];
/** How much better (score, below) a spot at a smaller size must be to win over one at a bigger size. */
const SHRINK_GAIN = 0.02;
/** A spot is good when at least this share of the picture's lower part stands in its own region. */
const GOOD_FIT = 0.9;
/** Never with less than this share of it there (a speck of an islet off its coast). */
const LEAST_FIT = 0.5;
/** Where the picture's mass is, as fractions of its box: sampled to see how much of it stands in its region. */
const SAMPLE_X = [0.15, 0.32, 0.5, 0.68, 0.85];
const SAMPLE_Y = [0.45, 0.6, 0.75, 0.88, 0.97];
/** Its middle and its foot (shares of its height from the top, on its centre line): always inside its region. */
export const MIDDLE_Y = 0.6;
export const FOOT_Y = 0.9;
/**
 * What a spot costs, as a share of the picture standing out of its region. Standing where the region's own army stands
 * costs the whole picture and more (ARMY_COST, plus twice the share of it on the figure), so any spot clear of it wins.
 * A neighbour's name (NAME_COST, more the more of the mark its letters cover), near a landmark placed before it
 * (MARK_COST), a neighbour's town (NEAR_COST) or, a little, a neighbour's army (NEAR_ARMY_COST) make the mark read as
 * the neighbour's or hide it. Unless it stands right beside its town (within BESIDE points), a foot not clearly nearer
 * its own town than any neighbour's (nearer it by less than ASTRAY_MARGIN, in squared distance) costs ASTRAY_COST: it
 * would read as that town's landmark (the Giralda by Granada, St Stephen's by Styria); one nearer the neighbour's is
 * not good at all, so the picture would rather shrink and stand by its own. Each step of its size farther from the
 * town than the nearest spots costs FAR_COST, so it stands by its town when it can.
 */
const ARMY_COST = 1.5;
const NAME_COST = 0.6;
const MARK_COST = 0.5;
const NEAR_COST = 0.3;
const NEAR_ARMY_COST = 0.1;
const ASTRAY_COST = 1;
const ASTRAY_MARGIN = 1.3; // squared distances: about 1.14 times as far
/** Within this (points) of its own town's point, a picture stands beside it, whatever else is near. */
export const BESIDE = 20;
const FAR_COST = 0.04;
/** Margins (points) round a neighbour's name and round its town; a landmark keeps its own size from another's where
 * it can (MARK_GAP times its longer side), and never stands on another's picture. */
const NAME_GAP = 3;
const TOWN_GAP = 4;
const MARK_GAP = 1;
/** Beyond the nearest eight, spots on a grid round the town a third of the mark apart, out to this many times the
 * mark's (or town's) size, and at most GRID_N steps each way. */
const GRID_REACH = 4;
const GRID_N = 18;

/** A landmark's picture's width and height at play zoom before any cap (points), by its proportions. */
function baseSize(id: string): [number, number] {
  const art = LANDMARK_ART[id];
  const a = art ? art.w / art.h : 1;
  const w = MARK_PT * Math.sqrt(a);
  const h = MARK_PT / Math.sqrt(a);
  const f = Math.min(1, (MARK_TALL * MARK_PT) / h, (MARK_WIDE * MARK_PT) / w);
  return [w * f, h * f];
}

/** A landmark's picture on screen (points, width and height): like a town, it grows past play zoom but is capped
 * in a small region (its longer side), and never under MARK_MIN. */
export function markSize(id: string, labelRadius: number, k: number): [number, number] {
  const [w, h] = baseSize(id);
  const long = Math.max(w, h);
  const f = Math.min(grow(k), Math.max(MARK_MIN, labelRadius * k * MARK_FIT) / long);
  return [w * f, h * f];
}

/**
 * The nearest spots round the town, in order: beside it on its right and on its left, standing on the same ground,
 * then upper right, upper left, right above, lower right, lower left, right below. Each gives the picture's top-left
 * corner from the town's point, `t` the town's size and `w`, `h` the picture's (map units); `clear`: which way it
 * steps round the region's name.
 */
const SPOTS: {
  x: (t: number, w: number) => number;
  y: (t: number, h: number) => number;
  clear: 'up' | 'down' | 'skip';
}[] = [
  { x: t => 0.3 * t, y: (t, h) => 0.12 * t - h, clear: 'skip' },
  { x: (t, w) => -0.3 * t - w, y: (t, h) => 0.12 * t - h, clear: 'skip' },
  { x: t => 0.25 * t, y: (t, h) => -0.55 * t - h, clear: 'up' },
  { x: (t, w) => -0.25 * t - w, y: (t, h) => -0.55 * t - h, clear: 'up' },
  { x: (t, w) => -0.5 * w, y: (t, h) => -0.55 * t - h, clear: 'up' },
  { x: t => 0.25 * t, y: t => 0.3 * t, clear: 'down' },
  { x: (t, w) => -0.25 * t - w, y: t => 0.3 * t, clear: 'down' },
  { x: (t, w) => -0.5 * w, y: t => 0.3 * t, clear: 'down' },
];

/** A picture's place: its top-left corner, width and height (map units). */
export type MarkPlace = [x: number, y: number, w: number, h: number];

/** A region's town picture's size (map units) at this zoom; null where it has none. */
export type TownSize = (id: RegionId) => number | null;

/**
 * Where a landmark's picture stands and how big it is (map units). It stands inside its own region (its middle and its
 * foot always, nine-tenths of its lower part where it can), never on the region's name or its town, and as clear as it
 * can be of where the region's army stands, of the neighbours' names, armies and towns and of the landmarks placed
 * before it (in LANDMARKS' order), so it never hides under the troops or reads as a neighbour's; near its town where
 * that is clear, farther out where not. Where no spot is good at its full size, it shrinks (down to MARK_MIN).
 */
export function markPlace(id: RegionId, k: number, px: (n: number) => number, town: TownSize): MarkPlace {
  const [fw, fh] = markSize(LANDMARK_AT[id]?.id ?? '', MAP_REGION[id].labelRadius, k).map(px);
  const long = Math.max(fw, fh);
  const t = town(id) ?? long;
  // The landmarks before it decide where it may stand, so their towns' sizes are in the key too.
  let key = `${id}:${k.toFixed(3)}:${t.toFixed(3)}`;
  for (const lm of LANDMARKS) {
    if (lm.region === id) break;
    key += `:${town(lm.region)?.toFixed(3)}`;
  }
  const known = places.get(key);
  if (known) return known;
  if (places.size > 600) places.clear();
  // Shares of its full size to try: all of it, MARK_SHRINK of it, and its smallest (longer side MARK_MIN).
  const least = px(MARK_MIN) / long;
  const shares = [1, ...MARK_SHRINK.map(f => Math.max(least, f)), least].filter((f, i, a) => i === 0 || f < a[i - 1] - 1e-6);
  const around = surroundings(id, k, px, long, t, town);
  let best: Spot | null = null;
  for (const f of shares) {
    const found = findSpot(id, k, px, fw * f, fh * f, t, around);
    // A smaller size wins only by doing better, not by a hair (it shrinks only as far as it must).
    if (found && (!best || found.score > best.score + SHRINK_GAIN)) best = found;
    if (best && best.fits) break;
  }
  const [lx, ly] = MAP_REGION[id].label;
  const place = best?.place ?? [lx - fw / 2, ly - fh * MIDDLE_Y, fw, fh];
  places.set(key, place);
  return place;
}
const places = new Map<string, MarkPlace>();

/** A spot found: the picture's place, its score (below), and whether it fits: its lower part in its region, off its
 * army and the neighbours' names. */
interface Spot {
  place: MarkPlace;
  score: number;
  fits: boolean;
}

/** Something near a picture's town that it should keep off (a box, map units) and what standing on it costs; `name`:
 * a neighbour's name, which the picture would rather shrink than cover. */
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
/** How far round its town (in steps of the picture's longer side or the town's size, whichever is bigger) it may
 * stand. */
const reachOf = (long: number, t: number) => Math.max(long, t);

/**
 * What a picture costs to stand on near its town, besides its own region's army: the neighbours' names, armies and
 * towns, and the pictures of the landmarks before it, each a box (map units) and its cost (`blocks`); the neighbours'
 * town points (`towns`), and the boxes of the landmarks before it (`marks`, never stood on). `long`: the picture's
 * longer side at full size.
 */
function surroundings(id: RegionId, k: number, px: (n: number) => number, long: number, t: number, town: TownSize) {
  const [tx, ty] = MAP_REGION[id].town;
  const near = (GRID_REACH + 1) * reachOf(long, t) + long;
  const close = (p: number[]) => Math.abs(p[0] - tx) < near && Math.abs(p[1] - ty) < near;
  const blocks: Block[] = [];
  const towns: number[][] = [];
  const marks: number[][] = [];
  for (const o of MAP.regions) {
    if (o.id === id || !(close(o.label) || close(o.town))) continue;
    const b = nameBox(o.id, k, px);
    if (b) blocks.push({ b: inflate(b, px(NAME_GAP)), cost: NAME_COST, name: true });
    blocks.push({ b: armyBox(o.id, k), cost: NEAR_ARMY_COST });
    blocks.push({ b: inflate(townBox(o.town[0], o.town[1], t), px(TOWN_GAP)), cost: NEAR_COST });
    towns.push(o.town);
  }
  for (const lm of LANDMARKS) {
    if (lm.region === id) break;
    if (!MAP_REGION[lm.region] || !close(MAP_REGION[lm.region].town)) continue;
    const [x, y, w, h] = markPlace(lm.region, k, px, town);
    marks.push([x, y, x + w, y + h]);
    blocks.push({ b: inflate([x, y, x + w, y + h], Math.max(w, h) * MARK_GAP), cost: MARK_COST });
  }
  return { blocks, towns, marks };
}
type Surroundings = ReturnType<typeof surroundings>;

/**
 * The best spot for a picture of this size (w x h) and its score (share of its lower part in its region, less the
 * costs), or null where none has its middle and foot inside. `around`: its surroundings (above).
 */
function findSpot(
  id: RegionId,
  k: number,
  px: (n: number) => number,
  w: number,
  h: number,
  t: number,
  { blocks, towns, marks }: Surroundings,
): Spot | null {
  const r = MAP_REGION[id];
  const [tx, ty] = r.town;
  const name = nameBox(id, k, px);
  const ownName = name && inflate(name, px(1));
  const ownTown = townBox(tx, ty, t);
  const army = armyBox(id, k);
  const troops = armyParts(id, k);
  const long = Math.max(w, h);
  const reach = reachOf(long, t);
  const step = long / 3;
  const n = Math.min(GRID_N, Math.ceil((GRID_REACH * reach) / step));
  const bounds = regionBounds(id)!;
  const area = w * h;
  const beside = px(BESIDE);
  let best: Spot | null = null;
  const tryAt = (x: number, y: number, far: number) => {
    const mx = x + w / 2;
    if (mx < bounds[0] || mx > bounds[2] || y + h * MIDDLE_Y < bounds[1] || y + h * FOOT_Y > bounds[3]) return;
    const box = [x, y, x + w, y + h];
    if (overlaps(ownName, box) || overlaps(ownTown, box)) return;
    // Never on another landmark, nor on its troops' banner or count (it is drawn in front of them: markInFront).
    if (overlaps(troops[1], box) || overlaps(troops[2], box)) return;
    for (const m of marks) if (overlaps(m, box)) return;
    let f = 1 - far;
    let onArmy = false;
    if (overlaps(army, box)) {
      // At its own troops' feet (drawn in front of them: markInFront): the whole picture, and more the more of the
      // figure it covers.
      onArmy = true;
      f -= ARMY_COST * (1 + (2 * overlapArea(troops[0], box)) / area);
    }
    let clear = !onArmy;
    // Its foot not clearly nearer its own town than a neighbour's: it would read as the neighbour's. (Right beside its
    // town, or at its own troops' feet, it reads as theirs.)
    const footY = y + h * FOOT_Y;
    const own = (mx - tx) ** 2 + (footY - ty) ** 2;
    const gap = Math.hypot(Math.max(0, x - tx, tx - x - w), Math.max(0, y - ty, ty - y - h));
    if (!onArmy && gap > beside) {
      let near = Infinity;
      for (const [ox, oy] of towns) near = Math.min(near, (mx - ox) ** 2 + (footY - oy) ** 2);
      if (near < own * ASTRAY_MARGIN) f -= ASTRAY_COST;
      if (near < own) clear = false;
    }
    for (const { b, cost, name: onName } of blocks)
      if (overlaps(b, box)) {
        // A name costs more the more of the picture it runs over (its letters are drawn over it; twice as much in front
        // of its troops, where it is drawn over the letters).
        f -= onName ? cost * (onArmy ? 2 : 1) * (0.5 + overlapArea(b, box) / area) : cost;
        if (onName) clear = false;
      }
    if (best && f <= best.score) return;
    if (!inRegion(id, mx, y + h * MIDDLE_Y) || !inRegion(id, mx, y + h * FOOT_Y)) return;
    let m = 0;
    for (const fx of SAMPLE_X) for (const fy of SAMPLE_Y) if (inRegion(id, x + w * fx, y + h * fy)) m++;
    const share = m / (SAMPLE_X.length * SAMPLE_Y.length);
    // Mostly out of its region it stands somewhere else.
    if (share < LEAST_FIT) return;
    // Below nine-tenths in its region it reads as standing on the border: that costs three times over.
    f -= 1 - share + 2 * Math.max(0, GOOD_FIT - share);

    if (!best || f > best.score) best = { place: [x, y, w, h], score: f, fits: clear && share >= GOOD_FIT };
  };
  // Standing farther from the town than the nearest spots costs a little.
  const far = (dx: number, dy: number) => FAR_COST * Math.max(0, Math.hypot(dx, dy) / reach - 1.2);
  // The nearest eight first; then a grid round the town, nearest first, until no spot farther out can win.
  for (const sp of SPOTS) {
    const x = tx + sp.x(t, w);
    let y = ty + sp.y(t, h);
    // Clear of the region's name where the town stands by it (Cairo): above it, or below it.
    if (name && overlaps(name, [x, y, x + w, y + h])) {
      if (sp.clear === 'skip') continue;
      y = sp.clear === 'up' ? name[1] - h : name[3];
    }
    tryAt(x, y, far(x + w / 2 - tx, y + h * MIDDLE_Y - ty));
  }
  for (const [i, j] of gridSteps()) {
    if (Math.abs(i) > n || Math.abs(j) > n) continue;
    const cost = far(i * step, j * step);
    if (best && (best as Spot).score >= 1 - cost) break;
    tryAt(tx + i * step - w / 2, ty + j * step - h * MIDDLE_Y, cost);
  }
  return best;
}

/** Does a landmark's picture (its place, from markPlace) stand on its region's army, so it is drawn in front of the troops
 * (with the units) rather than under them? Only where the region is too small for both (Constantinople, zoomed out):
 * it then stands at their feet, clear of their banner and count. */
export function markInFront(id: RegionId, k: number, [x, y, w, h]: MarkPlace): boolean {
  return overlaps(armyBox(id, k), [x, y, x + w, y + h]);
}

/** Roughly where a region's name is written (map units: x0, y0, x1, y1), or null when it is not (too small). */
export function nameBox(id: RegionId, k: number, px: (n: number) => number): number[] | null {
  const r = MAP_REGION[id];
  if (r.labelRadius * k < MIN_NAME_RADIUS) return null;
  const fs = nameSize(r.labelRadius, k);
  const half = px(REGION[id].name.length * fs * 0.38);
  return [r.label[0] - half, r.label[1] - px(fs * 0.5), r.label[0] + half, r.label[1] + px(fs * 0.45)];
}
