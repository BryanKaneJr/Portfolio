/**
 * Where armies stand on the map, and the sizes that decide it (names, tokens, zoom). Plain TypeScript with no
 * React, so it can be tested; MapView draws with it and tap.ts hit-tests with it.
 */
import { MAP_REGION } from '../../sim/content';
import { regionAt, regionPoint } from './geometry';

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
 * banner beside the name; above the name; on the region's town; on the name itself. Else on its centre. (An army at
 * sea is on its fleet's route.)
 */
export function armyAnchor(id: string, k: number): [number, number] {
  const [x, y] = regionPoint(id);
  const r = MAP_REGION[id];
  if (!r || k < REGION_NAMES_K || r.labelRadius * k < MIN_NAME_RADIUS) return [x, y];
  const key = `${id}:${k.toFixed(3)}`;
  const known = anchors.get(key);
  if (known) return known;
  const fs = nameSize(r.labelRadius, k);
  const below = fs * 0.55 + 3; // the name's descenders and a small gap
  const ts = tokenScale(k);
  const feet = (FEET_Y * ts) / k;
  const spots: [number, number][] = [
    [x, y + (below + TOKEN_TOP * ts) / k],
    [x, y + (below + FIGURE_TOP * ts) / k],
    [x, y - (fs * 0.45 + 3) / k - feet],
    [r.town[0], r.town[1] - feet],
  ];
  const at = spots.find(([px, py]) => regionAt(px, py + feet) === id) ?? [x, y];
  if (anchors.size > 4000) anchors.clear();
  anchors.set(key, at);
  return at;
}
const anchors = new Map<string, [number, number]>();

/** Roughly what a region's first army covers where it stands (map units: x0, y0, x1, y1): the figure and its banner
 * above the point, its count badge below and to the right. A landmark's mark keeps clear of it. */
export function armyBox(id: string, k: number): number[] {
  const [x, y] = armyAnchor(id, k);
  const u = tokenScale(k) / k;
  return [x - 16 * u, y - TOKEN_TOP * u, x + 30 * u, y + 16 * u];
}
