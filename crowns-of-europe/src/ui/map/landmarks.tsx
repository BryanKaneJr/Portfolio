/**
 * The landmarks on the map: the owner's painting of each (`landmarkArt.ts`, baked from art/landmarks), shown as it is
 * painted, standing near its region's town inside the region, clear of the region's army and the neighbours' names
 * where it can be (`landmarkSpot.ts`). Drawn from the zoom where region names show, over the towns and under the
 * names; never a tap target. A landmark never moves, so it needs no redraw key of its own. Where its region is too
 * small for both (Constantinople, zoomed out) it stands at the troops' feet and is drawn in front of them, with the
 * units (`markInFront`), so the troops never hide it.
 */
import type { ReactElement } from 'react';
import { Image as SvgImage } from 'react-native-svg';
import { LANDMARKS, MAP_REGION } from '../../sim/content';
import type { RegionId } from '../../sim/types';
import { LANDMARK_ART } from './landmarkArt';
import { markInFront, markPlace } from './landmarkSpot';

/**
 * The landmarks on screen, those in front of the troops (`front`) or the others. `px`: screen points to map units;
 * `visible`: is this box (map units) on screen; `hidden`: a region still blank parchment (the uncharted New World);
 * `townSize`: the size of a region's town picture in map units (null when it has none), so the picture stands beside
 * it and clear of the neighbours'; `at`: where a map point is drawn (the map's own units unless given: the units' layer
 * draws in screen points).
 */
export function landmarkMarks(
  k: number,
  px: (n: number) => number,
  visible: (b: number[]) => boolean,
  hidden: (id: RegionId) => boolean,
  townSize: (id: RegionId) => number | null,
  front = false,
  at: (x: number, y: number) => [number, number] = (x, y) => [x, y],
): ReactElement[] {
  const out: ReactElement[] = [];
  for (const lm of LANDMARKS) {
    const art = LANDMARK_ART[lm.id];
    if (!MAP_REGION[lm.region] || !art || hidden(lm.region)) continue;
    const place = markPlace(lm.region, k, px, townSize);
    if (markInFront(lm.region, k, place) !== front) continue;
    const [x, y, w, h] = place;
    if (!visible([x, y, x + w, y + h])) continue;
    const [x0, y0] = at(x, y);
    const [x1, y1] = at(x + w, y + h);
    out.push(<SvgImage key={`lm${lm.id}`} x={x0} y={y0} width={x1 - x0} height={y1 - y0} href={art.src} preserveAspectRatio="xMidYMid meet" />);
  }
  return out;
}
