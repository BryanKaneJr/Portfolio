/** A small static map (1444 borders) for the title screen and nation picker, in the chosen map style. */
import { memo } from 'react';
import Svg, { Image as SvgImage, Path, Rect } from 'react-native-svg';
import { MAP, NATION, REGION, hops } from '../../sim/content';
import { store } from '../../state/store';
import { nationColor } from './colors';
import { RELIEF_WORLD } from './reliefTiles';
import { MAP_STYLES } from './styles';

const FAR = MAP.far.map(f => f.path).join('');

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
  const st = MAP_STYLES[store.mapStyle];
  const R = RELIEF_WORLD;
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
      <Rect x={R.x} y={R.y} width={R.w} height={R.h} fill={st.sea} />
      <Path d={FAR} fill={st.far.fill} />
      {MAP.wastelands.map(w => (
        <Path key={w.id} d={w.path} fill={st.waste.fill} />
      ))}
      {MAP.regions.map(r => {
        const o = own(r.id);
        const faded = focus && o !== focus;
        return <Path key={r.id} d={r.path} fill={o ? st.land(nationColor(o)) : st.wild} opacity={faded ? 0.55 : 1} stroke={focus && o === focus ? st.nationBorder.color : st.provinceBorder.color} strokeWidth={focus && o === focus ? 1.2 : 0.5} />;
      })}
      {st.relief > 0 ? <SvgImage x={R.x} y={R.y} width={R.w} height={R.h} href={R.src} preserveAspectRatio="none" opacity={st.relief} /> : null}
      <Path d={FAR} fill={st.far.fill} opacity={st.far.veil} />
      <Path d={MAP.coast} fill="none" stroke={st.coast.color} strokeWidth={0.6} />
      {dim > 0 ? <Rect x={-500} y={-500} width={MAP.width + 1000} height={MAP.height + 1000} fill="#120c06" opacity={dim} /> : null}
    </Svg>
  );
});
