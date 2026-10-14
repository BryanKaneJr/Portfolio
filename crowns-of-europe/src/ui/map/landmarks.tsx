/**
 * The landmarks on the map: the owner's painting of each (`landmarkArt.ts`, baked from art/landmarks), shown as it is
 * painted, standing near its region's town inside the region, clear of the region's army and the neighbours' names
 * where it can be (`landmarkSpot.ts`). Drawn from the zoom where region names show, over the towns and under the
 * names; never a tap target. A landmark never moves, so it needs no redraw key of its own.
 */
import type { ReactElement } from 'react';
import { Image as SvgImage } from 'react-native-svg';
import { LANDMARKS, MAP_REGION } from '../../sim/content';
import type { RegionId } from '../../sim/types';
import { LANDMARK_ART } from './landmarkArt';
import { markPlace } from './landmarkSpot';

/**
 * Every landmark on screen. `px`: screen points to map units; `visible`: is this box on screen; `hidden`: a region
 * still blank parchment (the uncharted New World); `townSize`: the size of a region's town picture in map units
 * (null when it has none), so the picture stands beside it and clear of the neighbours'.
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
    const art = LANDMARK_ART[lm.id];
    if (!MAP_REGION[lm.region] || !art || hidden(lm.region)) continue;
    const [x, y, w, h] = markPlace(lm.region, k, px, townSize);
    if (!visible([x, y, x + w, y + h])) continue;
    out.push(<SvgImage key={`lm${lm.id}`} x={x} y={y} width={w} height={h} href={art.src} preserveAspectRatio="xMidYMid meet" />);
  }
  return out;
}
