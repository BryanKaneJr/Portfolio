/** A small static map (1444 borders) for the title screen and nation picker. */
import { memo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { MAP, NATION, REGION, hops } from '../../sim/content';
import { C } from '../theme';
import { WILD, nationColor } from './colors';

/** The Old World's frame: the title screen shows Europe, not the middle of the Atlantic. */
const OLD_WORLD = (() => {
  const boxes = MAP.regions.filter(r => !REGION[r.id].nw).map(r => r.bbox);
  const x0 = Math.min(...boxes.map(b => b[0])) - 30;
  const y0 = Math.min(...boxes.map(b => b[1])) - 30;
  const x1 = Math.max(...boxes.map(b => b[2])) + 30;
  const y1 = Math.max(...boxes.map(b => b[3])) + 30;
  return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
})();

export const MiniMap = memo(function MiniMap({
  width,
  height,
  focus,
  dim = 0,
  owners,
}: {
  width: number;
  height: number;
  focus?: string; // nation to frame and highlight
  dim?: number; // 0..1 darkening for backgrounds
  owners?: Record<string, string>;
}) {
  const own = (id: string) => owners?.[id] ?? REGION[id].owner;
  let vb = OLD_WORLD;
  if (focus) {
    // Frame the land around the capital (not far-flung islands like the Azores).
    const capital = NATION[focus]?.capital;
    const owned = MAP.regions.filter(r => own(r.id) === focus);
    const home = owned.filter(r => !capital || hops(capital, r.id) < 99);
    const boxes = (home.length ? home : owned).map(r => r.bbox);
    if (boxes.length) {
      let x0 = Math.min(...boxes.map(b => b[0]));
      let y0 = Math.min(...boxes.map(b => b[1]));
      let x1 = Math.max(...boxes.map(b => b[2]));
      let y1 = Math.max(...boxes.map(b => b[3]));
      const pad = Math.max(60, (x1 - x0) * 0.6, (y1 - y0) * 0.6);
      x0 -= pad;
      y0 -= pad;
      x1 += pad;
      y1 += pad;
      // Match the view's aspect ratio.
      const aspect = width / height;
      let w = x1 - x0;
      let h = y1 - y0;
      if (w / h > aspect) {
        const nh = w / aspect;
        y0 -= (nh - h) / 2;
        h = nh;
      } else {
        const nw = h * aspect;
        x0 -= (nw - w) / 2;
        w = nw;
      }
      vb = `${x0} ${y0} ${w} ${h}`;
    }
  }
  return (
    <Svg width={width} height={height} viewBox={vb} preserveAspectRatio="xMidYMid slice">
      <Rect x={-500} y={-500} width={MAP.width + 1000} height={MAP.height + 1000} fill={C.sea} />
      {MAP.wastelands.map(w => (
        <Path key={w.id} d={w.path} fill={C.waste} />
      ))}
      {MAP.regions.map(r => {
        const o = own(r.id);
        const faded = focus && o !== focus;
        return <Path key={r.id} d={r.path} fill={o ? nationColor(o) : WILD} opacity={faded ? 0.55 : 1} stroke={focus && o === focus ? '#2a2118' : 'rgba(42,33,24,0.35)'} strokeWidth={focus && o === focus ? 1.2 : 0.5} />;
      })}
      <Path d={MAP.coast} fill="none" stroke={C.coast} strokeWidth={0.6} />
      {dim > 0 ? <Rect x={-500} y={-500} width={MAP.width + 1000} height={MAP.height + 1000} fill="#120c06" opacity={dim} /> : null}
    </Svg>
  );
});
