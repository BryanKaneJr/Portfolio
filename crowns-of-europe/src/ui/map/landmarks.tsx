/**
 * The landmarks on the map: a small gold pictogram standing at the upper right of its region's town (Hagia Sophia's
 * dome by Constantinople, the Kremlin by Moscow). Drawn from the zoom where region names show, over the towns and
 * under the names; never a tap target. A landmark never moves, so it needs no redraw key of its own.
 */
import type { ReactElement } from 'react';
import { G, Path } from 'react-native-svg';
import { LANDMARKS, MAP_REGION, REGION } from '../../sim/content';
import type { RegionId } from '../../sim/types';
import { LANDMARK_ART, type LandmarkPath } from '../components/landmarkArt';
import { MIN_NAME_RADIUS, grow, nameSize } from './anchors';

/** The pictogram's size on screen (points) at play zoom, growing with the zoom like the towns. */
const MARK_PT = 13;
/** Never smaller than this (points), however small the region. */
const MARK_MIN = 9;
/** In a small region the mark is capped to about the region's size: this times its label radius on screen. */
const MARK_FIT = 1.6;
/** Its ink: the gilt the interface marks things with, edged dark so it reads on any land colour. */
export const LANDMARK_FILL = '#e3bf5c';
export const LANDMARK_EDGE = 'rgba(40,28,8,0.85)';

/** A landmark's mark on screen (points): like a town, it grows past play zoom but is capped in a small region. */
export const markSize = (labelRadius: number, k: number) =>
  Math.min(MARK_PT * grow(k), Math.max(MARK_MIN, labelRadius * k * MARK_FIT));

/** One pictogram in its 24 x 24 box, each piece filled and edged on its own (`edge`: the stroke in box units). */
export function landmarkPaths(
  paths: LandmarkPath[],
  edge: number,
  fill = LANDMARK_FILL,
  ink = LANDMARK_EDGE,
): ReactElement[] {
  return paths.map((p, i) => (
    <Path
      key={i}
      d={p.d}
      fill={fill}
      fillRule={p.evenOdd ? 'evenodd' : 'nonzero'}
      stroke={ink}
      strokeWidth={edge}
      strokeLinejoin="round"
    />
  ));
}

/** Roughly where a region's name is written (map units: x0, y0, x1, y1), or null when it is not (too small). */
function nameBox(id: RegionId, k: number, px: (n: number) => number): number[] | null {
  const r = MAP_REGION[id];
  if (r.labelRadius * k < MIN_NAME_RADIUS) return null;
  const fs = nameSize(r.labelRadius, k);
  const half = px(REGION[id].name.length * fs * 0.38);
  return [r.label[0] - half, r.label[1] - px(fs * 0.5), r.label[0] + half, r.label[1] + px(fs * 0.45)];
}

/**
 * Every landmark on screen. `px`: screen points to map units; `visible`: is this box on screen; `hidden`: a region
 * still blank parchment (the uncharted New World); `townSize`: the size of a region's town picture in map units
 * (null when it has none), so the mark stands beside it.
 */
export function landmarkMarks(
  k: number,
  px: (n: number) => number,
  visible: (b: number[]) => boolean,
  hidden: (id: RegionId) => boolean,
  townSize: (id: RegionId) => number | null,
): ReactElement[] {
  const out: ReactElement[] = [];
  for (const lm of LANDMARKS) {
    const r = MAP_REGION[lm.region];
    const art = LANDMARK_ART[lm.kind];
    if (!r || !art || hidden(lm.region)) continue;
    const size = px(markSize(r.labelRadius, k));
    const t = townSize(lm.region) ?? size;
    // Its bottom-left corner a quarter of the town's width right of the town, a little over half its height up;
    // lifted clear of the region's name where the town stands by it (Cairo).
    const x = r.town[0] + 0.25 * t;
    let y = r.town[1] - 0.55 * t - size;
    const name = nameBox(lm.region, k, px);
    if (name && x < name[2] && x + size > name[0] && y < name[3] && y + size > name[1]) y = name[1] - size;
    if (!visible([x, y, x + size, y + size])) continue;
    const scale = size / 24;
    out.push(
      <G key={`lm${lm.id}`} transform={`translate(${x} ${y}) scale(${scale})`}>
        {landmarkPaths(art, px(0.8) / scale)}
      </G>,
    );
  }
  return out;
}
