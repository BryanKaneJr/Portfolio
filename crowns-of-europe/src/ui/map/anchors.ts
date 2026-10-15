/**
 * Where armies stand on the map, and the sizes that decide it (names, tokens, zoom). Plain TypeScript with no
 * React, so it can be tested; MapView draws with it and tap.ts hit-tests with it.
 */
import { MAP, MAP_REGION, REGION } from '../../sim/content';
import { inRegion, regionAt, regionPoint } from './geometry';

/** Region names replace the nation names from this zoom on; a region's name is written if it is at least this many
 * points across (its label radius). */
export const REGION_NAMES_K = 1.15;
export const MIN_NAME_RADIUS = 13;
/** Units show from the zoom at which region names do. Further out the map is for the realms and their names, and only
 * a unit you have selected (or a battle) stays on it, so names and tokens never fight. Only the units you would know
 * about are drawn at all (`seesUnit`): yours, your friends', your enemies', and anyone's in your land. */
export const UNITS_K = REGION_NAMES_K;
/** The zoom the game opens at and "show on map" goes to: regions are big enough here for a name with an army under it. */
export const PLAY_K = 1.7;
/**
 * Names, towns and units keep their size on screen up to play zoom; closer in they grow, though more slowly than the
 * map (about 1.6x at the closest zoom), so they stay easy to read and to find without crowding the land.
 */
export const ZOOM_GROW = 0.45;
export const grow = (k: number) => Math.pow(Math.max(1, k / PLAY_K), ZOOM_GROW);
/** A token's scale: a little smaller between UNITS_K and PLAY_K, where regions are close together; growing past it. */
export const tokenScale = (k: number) =>
  Math.max(0.82, Math.min(1, 0.82 + ((k - UNITS_K) / (PLAY_K - UNITS_K)) * 0.18)) * grow(k);
/**
 * Troops standing in a small region are drawn smaller, as its town and landmark are, so they stand in it rather than over
 * its neighbours' names and towns (the Pope's army over Umbria, Siena's over Florence): their height is at most
 * TROOP_FIT times the region's label radius on screen, never under TROOP_MIN_FIT of their size. Measured from play zoom
 * (further out every token is a little smaller anyway: tokenScale), so a region's troops never shrink as you zoom out,
 * and reach their full size as you zoom in. Italy, the small islands and Constantinople, Calais or Zealand at play zoom.
 */
export const TROOP_FIT = 1.8;
export const TROOP_MIN_FIT = 0.7;
export function troopFit(id: string, k: number): number {
  const r = MAP_REGION[id];
  if (!r) return 1;
  return Math.max(TROOP_MIN_FIT, Math.min(1, (r.labelRadius * Math.max(k, PLAY_K) * TROOP_FIT) / TROOP_H));
}
/** The scale of an army's token standing in this region (tokenScale, smaller in a small region: troopFit). */
export const armyScale = (id: string, k: number) => tokenScale(k) * troopFit(id, k);
/** A region name's size on screen (points), as StaticLayer writes it. */
export const nameSize = (labelRadius: number, k: number) => Math.max(9, Math.min(14 * grow(k), labelRadius * k * 0.42));

/** How tall a soldier on a token is at play zoom (points). */
export const TROOP_H = 36;
/** Where a figure stands, below the token's point (points). */
export const FEET_Y = 7;
/** How far the banner's pole tops the figure (points). */
export const BANNER_RISE = 7;
/** From the token's point up to the top of the banner (points). */
const TOKEN_TOP = TROOP_H - FEET_Y + BANNER_RISE + 3;
/** From the token's point up to the top of the figure, with a little room (points). */
const FIGURE_TOP = TROOP_H - FEET_Y + 3;

/**
 * Where a region's armies stand (map units) when its name is written at this zoom: the first of these whose feet are
 * inside the region (on a southern coast "under the name" is often the sea): under the name; under it with the
 * banner beside the name; above the name; on the region's town; on the name itself. Else (or where no name is written)
 * on its centre. (An army at
 * sea is on its fleet's route.) In a region too small for its troops (troopFit under 1: Italy's), where they would
 * rise over the neighbours' names and towns (the Pope's over Umbria, Ferrara's over the Veneto) they stand on or
 * beside their own town instead if that hides clearly less (`hides`).
 */
export function armyAnchor(id: string, k: number): [number, number] {
  const [x, y] = regionPoint(id);
  const r = MAP_REGION[id];
  if (!r || k < REGION_NAMES_K) return [x, y];
  const named = r.labelRadius * k >= MIN_NAME_RADIUS;
  if (!named && troopFit(id, k) >= 1) return [x, y];
  const key = `${id}:${k.toFixed(3)}`;
  const known = anchors.get(key);
  if (known) return known;
  const fs = nameSize(r.labelRadius, k);
  const below = fs * 0.55 + 3; // the name's descenders and a small gap
  const ts = armyScale(id, k);
  const feet = (FEET_Y * ts) / k;
  const town: [number, number] = [r.town[0], r.town[1] - feet];
  const spots: [number, number][] = named
    ? [[x, y + (below + TOKEN_TOP * ts) / k], [x, y + (below + FIGURE_TOP * ts) / k], [x, y - (fs * 0.45 + 3) / k - feet], town]
    : [];
  let at = spots.find(([px, py]) => regionAt(px, py + feet) === id) ?? [x, y];
  if (troopFit(id, k) < 1) {
    // On its town or beside it, on either side, as well; standing where it hides clearly less wins.
    const u = ts / k;
    const more: [number, number][] = [...spots, ...(named ? [] : [town]), [town[0] - TOWN_SIDE * u, town[1]], [town[0] + TOWN_SIDE * u, town[1]]];
    let least = hides(id, k, at) - HIDE_GAIN;
    for (const p of more) {
      if (!inRegion(id, p[0], p[1] + feet)) continue;
      const h = hides(id, k, p);
      if (h < least) [least, at] = [h, p];
    }
  }
  if (anchors.size > 4000) anchors.clear();
  anchors.set(key, at);
  return at;
}
const anchors = new Map<string, [number, number]>();

/** How far beside its town (points, at token scale) an army may stand instead of on it. */
const TOWN_SIDE = 14;
/** How much less (`hides`) a spot must hide than the usual one to win over it. */
const HIDE_GAIN = 0.3;
/** What it costs (`hides`) for an army to cover a share of: a neighbour's name or town (each), its own name, its
 * figure standing out of its region. */
const HIDE_NEIGHBOUR = 1;
const HIDE_OWN_NAME = 1;
const HIDE_OUT = 0.5;
/** Where a figure's mass is, as shares of its box: sampled to see how much of it stands in its region. */
const FIG_X = [1 / 6, 1 / 2, 5 / 6];
const FIG_Y = [1 / 8, 3 / 8, 5 / 8, 7 / 8];

/** The regions whose name or town stands near this one's name (within NEAR map units), worked out once. */
const NEAR = 50;
const nearBy = new Map<string, string[]>();
function nearOf(id: string): string[] {
  let near = nearBy.get(id);
  if (!near) {
    const [lx, ly] = MAP_REGION[id].label;
    const close = (p: readonly number[]) => Math.hypot(p[0] - lx, p[1] - ly) < NEAR;
    near = MAP.regions.filter(o => o.id !== id && (close(o.label) || close(o.town))).map(o => o.id);
    nearBy.set(id, near);
  }
  return near;
}

/** Box overlap area (x0, y0, x1, y1). */
const overlapArea = (a: number[], b: number[]) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
/** Roughly where a region's town picture has its settlement (map units), as a walled town of 1444 would be drawn. */
function townBox(id: string, k: number): number[] {
  const r = MAP_REGION[id];
  const t = townSize(TOWN_ROUGH, r.labelRadius, k) / k;
  return [r.town[0] - 0.25 * t, r.town[1] - 0.5 * t, r.town[0] + 0.25 * t, r.town[1] + 0.15 * t];
}
const TOWN_ROUGH = 26;

/**
 * What an army standing at `at` in region `id` hides (lower is better): the share of each neighbour's name and town
 * that its figure, banner and count cover; the share of its own name its figure and banner cover; and the share of its
 * figure out of its region.
 */
function hides(id: string, k: number, [x, y]: [number, number]): number {
  const u = armyScale(id, k) / k;
  const px = (n: number) => n / k;
  const parts = ARMY_PARTS.map(b => [x + b[0] * u, y + b[1] * u, x + b[2] * u, y + b[3] * u]);
  const cover = (b: number[], ps = parts) => Math.min(1, ps.reduce((t, p) => t + overlapArea(p, b), 0) / ((b[2] - b[0]) * (b[3] - b[1])));
  let cost = 0;
  for (const o of nearOf(id)) {
    const name = nameBox(o, k, px);
    cost += HIDE_NEIGHBOUR * ((name ? cover(name) : 0) + cover(townBox(o, k)));
  }
  const own = nameBox(id, k, px);
  if (own) cost += HIDE_OWN_NAME * cover(own, parts.slice(0, 2));
  const [fx0, fy0, fx1, fy1] = parts[0];
  let out = 0;
  for (const fx of FIG_X) for (const fy of FIG_Y) if (!inRegion(id, fx0 + (fx1 - fx0) * fx, fy0 + (fy1 - fy0) * fy)) out++;
  return cost + (HIDE_OUT * out) / (FIG_X.length * FIG_Y.length);
}

/** Roughly where a region's name is written (map units: x0, y0, x1, y1), or null when it is not (too small). */
export function nameBox(id: string, k: number, px: (n: number) => number): number[] | null {
  const r = MAP_REGION[id];
  if (r.labelRadius * k < MIN_NAME_RADIUS) return null;
  const fs = nameSize(r.labelRadius, k);
  const half = px(REGION[id].name.length * fs * 0.38);
  return [r.label[0] - half, r.label[1] - px(fs * 0.5), r.label[0] + half, r.label[1] + px(fs * 0.45)];
}

/** A town's size on screen (points): its picture's size, growing with the zoom like the names, but no bigger than
 * about the region itself (TOWN_FIT times its label radius), so a small island (the Azores, Madeira, Cyprus) or a
 * narrow coast (Genoa, Constantinople) gets a small mark that leaves its land showing; never under TOWN_MIN. */
const TOWN_FIT = 2.2;
const TOWN_MIN = 10;
export const townSize = (picSize: number, labelRadius: number, k: number) => Math.min(picSize * grow(k), Math.max(TOWN_MIN, labelRadius * k * TOWN_FIT));

/**
 * What a region's first army covers where it stands (map units: x0, y0, x1, y1 each, from its point): the figure (up to
 * five men abreast, with their shadow at the feet), the banner flying right from its pole above it, and the count badge
 * at its right below. A landmark's mark keeps clear of them.
 */
export function armyParts(id: string, k: number): number[][] {
  const [x, y] = armyAnchor(id, k);
  const u = armyScale(id, k) / k;
  return ARMY_PARTS.map(b => [x + b[0] * u, y + b[1] * u, x + b[2] * u, y + b[3] * u]);
}
/** In points at play zoom, from the token's point (MapView's unitToken). */
const ARMY_PARTS = [
  [-15, FEET_Y - TROOP_H - 1, 15, FEET_Y + 2],
  [2, -TOKEN_TOP, 24, FEET_Y - TROOP_H + 4],
  [7, FEET_Y - 6, 31, FEET_Y + 11],
];
/** The box round all of a region's army (map units: x0, y0, x1, y1). */
export function armyBox(id: string, k: number): number[] {
  const p = armyParts(id, k);
  return [
    Math.min(...p.map(b => b[0])),
    Math.min(...p.map(b => b[1])),
    Math.max(...p.map(b => b[2])),
    Math.max(...p.map(b => b[3])),
  ];
}
