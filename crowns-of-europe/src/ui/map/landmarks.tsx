/**
 * The landmarks on the map: a gold pictogram on a soft dark halo, standing beside its region's town, at its upper right
 * where that is inside the region (Hagia Sophia by Constantinople, the Kremlin by Moscow; `landmarkSpot.ts`). Drawn
 * from the zoom where region names show, over the towns and under the names; never a tap target. A landmark never
 * moves, so it needs no redraw key of its own.
 */
import type { ReactElement } from 'react';
import { G, Path } from 'react-native-svg';
import { LANDMARKS, MAP_REGION } from '../../sim/content';
import type { RegionId } from '../../sim/types';
import { LANDMARK_ART, type LandmarkPath } from '../components/landmarkArt';
import { markSize, markSpot } from './landmarkSpot';

/** Its ink: the gilt the interface marks things with, edged dark so it reads on any land colour. */
export const LANDMARK_FILL = '#e3bf5c';
export const LANDMARK_EDGE = 'rgba(40,28,8,0.85)';
/** A soft dark halo under the gold on the map, so it lifts off the painting (drawn solid, then faded as a whole). */
const HALO = '#1e1406';
const HALO_OPACITY = 0.35;
const HALO_PT = 2.6;

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
    const [x, y] = markSpot(lm.region, k, px, size, t);
    if (!visible([x, y, x + size, y + size])) continue;
    const scale = size / 24;
    out.push(
      <G key={`lm${lm.id}`} transform={`translate(${x} ${y}) scale(${scale})`}>
        <G opacity={HALO_OPACITY}>{landmarkPaths(art, px(HALO_PT) / scale, HALO, HALO)}</G>
        {landmarkPaths(art, px(0.8) / scale)}
      </G>,
    );
  }
  return out;
}
