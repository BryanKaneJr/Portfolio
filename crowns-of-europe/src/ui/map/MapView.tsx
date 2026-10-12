/**
 * The map: pan with one finger, pinch to zoom, tap to select. While a gesture runs, the last rendered
 * picture is moved with a native transform; when it ends, the SVG re-renders at the new zoom so it stays
 * sharp. Pulling past the edge of the known world (or past the zoom limits) meets resistance and slides back
 * when let go. Units are plain views on top of the SVG.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, G, Image as SvgImage, Line, Path, Pattern, RadialGradient, Rect, Stop, Text as SvgText, TextPath } from 'react-native-svg';
import { MAP, MAP_REGION, MAP_SEA, NATION, NW_WASTELANDS, REGION, RIVERS, SEA, WASTELANDS, isNewWorld } from '../../sim/content';
import { REBELS, allied, armyRegs, armyMen, warBetween } from '../../sim/queries';
import type { Army, GameState } from '../../sim/types';
import { store, useStore, type MapMode, type Selection } from '../../state/store';
import { C, kmen, sans } from '../theme';
import { WILD, mix, nationColor, regionFills } from './colors';
import { K_MAX, clampCentre, clampView, rubber, rubberZoom } from './camera';
import { COAST_CELLS, FAR_COAST_CELLS, MAP_H, MAP_W, WASTE_BBOX, nationArcs, nationLabels, regionAt, regionPoint, seaAt, type NationArc } from './geometry';
import { RELIEF_BANDS, RELIEF_SHARP, RELIEF_WORLD, WATER_LINES } from './reliefTiles';
import { MAP_STYLES, type MapStyle, type MapStyleId } from './styles';
import { onMapTap } from './tap';

export interface Camera {
  cx: number;
  cy: number;
  k: number; // points per map unit
}
const OVER = 1.6; // render this much beyond the screen so short pans never show an empty edge
const SETTLE = { duration: 320, easing: Easing.out(Easing.cubic) };

export function MapView() {
  const st = useStore();
  const s = st.state!;
  const style = MAP_STYLES[st.mapStyle];
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Camera | null>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);
  const startT = useSharedValue({ x: 0, y: 0, s: 1, fx: 0, fy: 0 });
  const live = useSharedValue({ pan: false, pinch: false, rebase: false }); // which gestures are under way

  const kMin = size.w ? Math.min(size.w / MAP_W, size.h / MAP_H) * 0.95 : 0.3;
  const clampCam = useCallback(
    (c: Camera): Camera => {
      const [cx, cy, k] = clampView(c.cx, c.cy, c.k, size.w, size.h, kMin);
      return { cx, cy, k };
    },
    [kMin, size],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    if (!cam) {
      const [x, y] = regionPoint(s.nations[s.player].capital);
      const k = width / 420;
      const halfW = width / 2 / k;
      const halfH = height / 2 / k;
      setCam({ k, cx: Math.max(halfW, Math.min(MAP_W - halfW, x)), cy: Math.max(halfH, Math.min(MAP_H - halfH, y)) });
    }
  };

  // Focus requests ("go to army") move the camera once per request.
  const focus = st.focus;
  const [focusSeen, setFocusSeen] = useState(0);
  if (focus && focus.seq !== focusSeen && cam) {
    setFocusSeen(focus.seq);
    setCam(clampCam({ cx: focus.x, cy: focus.y, k: focus.zoom ? size.w / focus.zoom : Math.max(cam.k, size.w / 420) }));
  }

  const commit = useCallback(
    (t0x: number, t0y: number, s0: number) => {
      setCam(prev => (prev ? clampCam({ cx: prev.cx - t0x / (s0 * prev.k), cy: prev.cy - t0y / (s0 * prev.k), k: prev.k * s0 }) : prev));
    },
    [clampCam],
  );
  // After the re-render at the new camera, drop the temporary transform.
  useLayoutEffect(() => {
    tx.set(0);
    ty.set(0);
    sc.set(1);
    store.camera = cam;
  }, [cam, tx, ty, sc]);

  const handleTap = useCallback(
    (x: number, y: number) => {
      if (!cam) return;
      const mx = cam.cx + (x - size.w / 2) / cam.k;
      const my = cam.cy + (y - size.h / 2) / cam.k;
      onMapTap(mx, my, cam.k);
    },
    [cam, size],
  );

  const half = { w: size.w / 2, h: size.h / 2 };
  const c0 = cam ?? { cx: 0, cy: 0, k: 1 };
  const lim = { w: size.w, h: size.h, kMin };
  /** Show the transform a gesture asks for, with resistance wherever it goes past the limits. (fx, fy): the point
   * that stays put while zooming, from the screen centre. */
  const show = (rx: number, ry: number, rs: number, fx: number, fy: number) => {
    'worklet';
    const k1 = c0.k * rs;
    const kr = rubberZoom(k1, lim.kMin);
    const g = kr / k1;
    const x1 = fx - (fx - rx) * g;
    const y1 = fy - (fy - ry) * g;
    const [ccx, ccy] = clampCentre(c0.cx - x1 / kr, c0.cy - y1 / kr, kr, lim.w, lim.h);
    const bx = (c0.cx - ccx) * kr;
    const by = (c0.cy - ccy) * kr;
    sc.set(kr / c0.k);
    tx.set(bx + rubber(x1 - bx, lim.w));
    ty.set(by + rubber(y1 - by, lim.h));
  };
  /** When the last finger lifts: slide back inside the limits, then re-render there. */
  const settle = () => {
    'worklet';
    const s1 = sc.get();
    const [cx2, cy2, k2] = clampView(c0.cx - tx.get() / (c0.k * s1), c0.cy - ty.get() / (c0.k * s1), c0.k * s1, lim.w, lim.h, lim.kMin);
    const s2 = k2 / c0.k;
    const x2 = (c0.cx - cx2) * k2;
    const y2 = (c0.cy - cy2) * k2;
    if (Math.abs(x2 - tx.get()) < 0.5 && Math.abs(y2 - ty.get()) < 0.5 && Math.abs(s2 - s1) < 0.001) {
      runOnJS(commit)(x2, y2, s2);
      return;
    }
    sc.set(withTiming(s2, SETTLE));
    ty.set(withTiming(y2, SETTLE));
    tx.set(
      withTiming(x2, SETTLE, done => {
        if (done) runOnJS(commit)(x2, y2, s2);
      }),
    );
  };
  const pan = Gesture.Pan()
    .minDistance(6)
    .averageTouches(true)
    .onStart(() => {
      live.set({ ...live.get(), pan: true });
      startT.set({ x: tx.get(), y: ty.get(), s: sc.get(), fx: 0, fy: 0 });
    })
    .onUpdate(e => {
      const l = live.get();
      if (l.pinch) return; // the pinch moves the map too, from its focal point
      if (l.rebase) {
        // A pinch just ended with a finger still down: carry on panning from where it left the map.
        live.set({ ...l, rebase: false });
        startT.set({ x: tx.get() - e.translationX, y: ty.get() - e.translationY, s: sc.get(), fx: 0, fy: 0 });
      }
      show(startT.get().x + e.translationX, startT.get().y + e.translationY, sc.get(), 0, 0);
    })
    .onFinalize(() => {
      const l = live.get();
      if (!l.pan) return;
      live.set({ ...l, pan: false });
      if (!l.pinch) settle();
    });
  const pinch = Gesture.Pinch()
    .onStart(e => {
      live.set({ ...live.get(), pinch: true });
      startT.set({ x: tx.get(), y: ty.get(), s: sc.get(), fx: e.focalX - half.w, fy: e.focalY - half.h });
    })
    .onUpdate(e => {
      const g = e.scale;
      const fx = e.focalX - half.w;
      const fy = e.focalY - half.h;
      const st0 = startT.get();
      show(fx - g * (st0.fx - st0.x), fy - g * (st0.fy - st0.y), st0.s * g, fx, fy);
    })
    .onFinalize(() => {
      const l = live.get();
      if (!l.pinch) return;
      live.set({ ...l, pinch: false, rebase: l.pan });
      if (!l.pan) settle();
    });
  const tap = Gesture.Tap()
    .maxDuration(300)
    .maxDistance(10)
    .onEnd((e, ok) => {
      if (ok) runOnJS(handleTap)(e.x, e.y);
    });
  const gesture = Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: sc.get() }],
  }));

  // Mouse wheel zoom on the web build.
  const wrapRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !wrapRef.current) return;
    const el = wrapRef.current as unknown as HTMLElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const f = Math.exp(-e.deltaY * 0.0015);
      const px = e.clientX - rect.left - rect.width / 2;
      const py = e.clientY - rect.top - rect.height / 2;
      setCam(prev => {
        if (!prev) return prev;
        const mx = prev.cx + px / prev.k;
        const my = prev.cy + py / prev.k;
        const k = Math.max(kMin, Math.min(K_MAX, prev.k * f));
        return clampCam({ k, cx: mx - px / k, cy: my - py / k });
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [kMin, clampCam]);

  const ready = cam && size.w > 0;
  const W = size.w * OVER;
  const H = size.h * OVER;
  return (
    <View ref={wrapRef} style={[styles.wrap, { backgroundColor: deepSea(style) }]} onLayout={onLayout} testID="map">
      {ready ? (
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill} collapsable={false}>
            <Animated.View style={[{ position: 'absolute', left: (size.w - W) / 2, top: (size.h - H) / 2, width: W, height: H }, animStyle]}>
              <StaticLayer cam={cam!} w={W} h={H} mapVersion={st.mapVersion} mode={st.mapMode} selection={st.selection} styleId={st.mapStyle} />
              <UnitLayer cam={cam!} w={W} h={H} s={s} selection={st.selection} version={st.version} />
            </Animated.View>
          </View>
        </GestureDetector>
      ) : null}
      {ready && style.vignette ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="vignette" cx="50%" cy="50%" r="72%">
              <Stop offset="0.55" stopColor={style.vignette} stopOpacity={0} />
              <Stop offset="1" stopColor={style.vignette} stopOpacity={1} />
            </RadialGradient>
          </Defs>
          <Rect width={size.w} height={size.h} fill="url(#vignette)" />
        </Svg>
      ) : null}
    </View>
  );
}

/** The open ocean far from any coast: the sea colour under the deepest shading, for whatever lies past the edges. */
const deepSea = (st: MapStyle) => mix(st.sea, '#000000', st.relief * 0.4);

// ---------------------------------------------------------------- static layer (land, borders, labels)

/** The lines that only change when land changes hands: one path each, so they cost one draw call apiece. */
function borderLines(s: GameState) {
  const charted = !!s.discovery;
  let nation = '';
  let province = '';
  let river = '';
  for (const b of MAP.borders) {
    if (!charted && (isNewWorld(b.a) || isNewWorld(b.b))) continue;
    if (RIVERS.has(`${b.a}|${b.b}`)) river += b.path;
    if (s.regions[b.a].owner !== s.regions[b.b].owner) nation += b.path;
    else province += b.path;
  }
  return { nation, province, river };
}

const StaticLayer = memo(function StaticLayer({ cam, w, h, mapVersion, mode, selection, styleId }: { cam: Camera; w: number; h: number; mapVersion: number; mode: MapMode; selection: Selection; styleId: MapStyleId }) {
  const s = store.state!;
  const st = MAP_STYLES[styleId];
  const { k } = cam;
  const vx = cam.cx - w / 2 / k;
  const vy = cam.cy - h / 2 / k;
  const vw = w / k;
  const vh = h / k;
  const visible = (b: number[]) => b[2] >= vx && b[0] <= vx + vw && b[3] >= vy && b[1] <= vy + vh;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fills = useMemo(() => regionFills(s, mode), [mapVersion, mode]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const arcs = useMemo(() => nationArcs(s), [mapVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => nationLabels(s), [mapVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lines = useMemo(() => borderLines(s), [mapVersion]);
  const px = (n: number) => n / k; // screen points → map units
  const showRegionNames = k >= 1.15;
  const selRegion = selection?.kind === 'region' ? selection.id : null;
  const selSea = selection?.kind === 'sea' ? selection.id : null;
  const selNation = selection?.kind === 'nation' ? selection.id : null;
  const charted = !!s.discovery;
  // Before the New World is found it is drawn like the lands beyond the map: no borders, names or units.
  const hidden = (id: string) => !charted && isNewWorld(id);
  const striped = [
    ...new Set([
      ...Object.values(s.regions)
        .filter(r => r.controller !== r.owner && r.controller)
        .map(r => r.controller!),
      ...Object.values(s.regions)
        .filter(r => r.colony)
        .map(r => r.colony!.by),
    ]),
  ];
  const stripe = px(7);

  // Land in one path per colour (a nation's regions share one), faded land (beyond the map or not yet found) in one.
  const paint = new Map<string, string>();
  const byFill = new Map<string, string>();
  let faded = '';
  for (const r of MAP.regions) {
    if (!visible(r.bbox)) continue;
    if (hidden(r.id)) {
      faded += r.path;
      continue;
    }
    const f = fills[r.id];
    if (!paint.has(f)) paint.set(f, f === WILD ? st.wild : st.land(f));
    const c = paint.get(f)!;
    byFill.set(c, (byFill.get(c) ?? '') + r.path);
  }
  let waste = '';
  for (const wl of MAP.wastelands) {
    if (WASTE_BBOX[wl.id] && !visible(WASTE_BBOX[wl.id])) continue;
    if (!charted && NW_WASTELANDS.has(wl.id)) faded += wl.path;
    else waste += wl.path;
  }
  for (const f of MAP.far) if (visible(f.bbox)) faded += f.path;
  // Only the coasts in view.
  const coast = COAST_CELLS.filter(c => visible(c.bbox))
    .map(c => c.d)
    .join('');
  const farCoast = FAR_COAST_CELLS.filter(c => visible(c.bbox))
    .map(c => c.d)
    .join('');

  // Relief: one soft picture of the whole world when far out; the sharp one (and the soft margins) closer in.
  const relief = st.relief > 0 ? (k < 0.35 ? [RELIEF_WORLD] : [RELIEF_SHARP, ...RELIEF_BANDS]).filter(t => visible([t.x, t.y, t.x + t.w, t.y + t.h])) : [];
  const RW = RELIEF_WORLD;
  // Past the relief picture the ocean is simply deep.
  const beyond = `M${vx} ${vy}h${vw}v${vh}h${-vw}Z M${RW.x} ${RW.y}v${RW.h}h${RW.w}v${-RW.h}Z`;
  // Fine province lines fade out as you zoom out, leaving the bold borders between crowns.
  const provinceAlpha = Math.max(0, Math.min(1, (k - 0.32) / 0.45));
  // Water lines fade in as you zoom in (further out they would crowd into a blur).
  const linesAlpha = st.waterLines ? st.waterLines.opacity * Math.max(0, Math.min(1, (k - 0.35) / 0.25)) : 0;
  const names = showRegionNames ? [] : st.nationLabel.curved ? placeNames(arcs, k, st, charted, visible) : [];
  const dash = (d: number[] | null) => (d ? d.map(px).join(' ') : undefined);

  return (
    <Svg width={w} height={h} viewBox={`${vx} ${vy} ${vw} ${vh}`} style={StyleSheet.absoluteFill}>
      <Defs>
        {st.waste.hatch ? <Hatch id="waste" step={px(6)} color={st.waste.hatch} width={px(0.8)} /> : null}
        {st.far.hatch ? <Hatch id="far" step={px(8)} color={st.far.hatch} width={px(0.7)} /> : null}
        {striped.map(o => (
          <Pattern key={o} id={`occ_${o}`} patternUnits="userSpaceOnUse" width={stripe} height={stripe}>
            <Path d={`M0 ${stripe} L${stripe} 0 M${-stripe / 2} ${stripe / 2} L${stripe / 2} ${-stripe / 2} M${stripe / 2} ${stripe * 1.5} L${stripe * 1.5} ${stripe / 2}`} stroke={o === REBELS ? '#222' : nationColor(o)} strokeWidth={stripe * 0.32} />
          </Pattern>
        ))}
        {names.map(n => (
          <Path key={n.nation} id={`nm_${n.nation}`} d={n.d} />
        ))}
      </Defs>
      {/* Water: deeper past the edges of the relief, with lines along the coasts (scripts/build-relief.ts) */}
      <Rect x={vx} y={vy} width={vw} height={vh} fill={st.sea} />
      <Path d={beyond} fill={deepSea(st)} fillRule="evenodd" />
      {linesAlpha > 0 ? <SvgImage x={0} y={0} width={MAP_W} height={MAP_H} href={WATER_LINES[st.waterLines!.image].src} preserveAspectRatio="none" opacity={linesAlpha} /> : null}
      {/* Sea zones (waters no fleet can sail are left plain, like the ocean beyond the map) */}
      {MAP.seas.map(sea =>
        !visible(sea.bbox) || sea.closed || hidden(sea.id) ? null : (
          <Path key={sea.id} d={sea.path} fill={sea.id === selSea ? 'rgba(255,255,255,0.22)' : 'none'} stroke={st.seaZone.color} strokeWidth={px(0.8)} strokeDasharray={dash(st.seaZone.dash)} />
        ),
      )}
      {/* Land */}
      {faded ? <Path d={faded} fill={st.far.fill} /> : null}
      {faded && st.far.hatch ? <Path d={faded} fill="url(#far)" /> : null}
      {waste ? <Path d={waste} fill={st.waste.fill} stroke={st.waste.line} strokeWidth={px(0.6)} /> : null}
      {waste && st.waste.hatch ? <Path d={waste} fill="url(#waste)" /> : null}
      {[...byFill].map(([fill, d]) => (
        <Path key={fill} d={d} fill={fill} />
      ))}
      {mode === 'political' || mode === 'diplomatic'
        ? MAP.regions.map(r => {
            const reg = s.regions[r.id];
            if (!visible(r.bbox) || hidden(r.id)) return null;
            if (reg.controller !== reg.owner && reg.controller) return <Path key={`o${r.id}`} d={r.path} fill={`url(#occ_${reg.controller})`} />;
            if (reg.colony) return <Path key={`o${r.id}`} d={r.path} fill={`url(#occ_${reg.colony.by})`} opacity={0.75} />;
            return null;
          })
        : null}
      {/* Hills and sea depths over everything painted so far */}
      {relief.length ? (
        <G opacity={st.relief}>
          {relief.map(t => (
            <SvgImage key={`${t.x},${t.y},${t.w}`} x={t.x} y={t.y} width={t.w} height={t.h} href={t.src} preserveAspectRatio="none" />
          ))}
        </G>
      ) : null}
      {faded && st.far.veil > 0 ? <Path d={faded} fill={st.far.fill} opacity={st.far.veil} /> : null}
      {/* Lines */}
      {provinceAlpha > 0 && lines.province ? <Path d={lines.province} fill="none" stroke={st.provinceBorder.color} strokeWidth={px(st.provinceBorder.width)} strokeDasharray={dash(st.provinceBorder.dash)} strokeLinecap="round" strokeLinejoin="round" opacity={provinceAlpha} /> : null}
      {lines.river ? <Path d={lines.river} fill="none" stroke={st.river.color} strokeWidth={px(st.river.width)} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} /> : null}
      {st.nationBorder.halo && lines.nation ? <Path d={lines.nation} fill="none" stroke={st.nationBorder.halo} strokeWidth={px(st.nationBorder.haloWidth)} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {lines.nation ? <Path d={lines.nation} fill="none" stroke={st.nationBorder.color} strokeWidth={px(st.nationBorder.width)} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {coast ? <Path d={coast} fill="none" stroke={st.coast.color} strokeWidth={px(st.coast.width)} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {farCoast ? <Path d={farCoast} fill="none" stroke={st.far.coast} strokeWidth={px(st.coast.width * 0.85)} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {selNation ? (
        <Path
          d={MAP.regions
            .filter(r => s.regions[r.id].owner === selNation)
            .map(r => r.path)
            .join('')}
          fill="rgba(255,255,255,0.18)"
          stroke={C.gold}
          strokeWidth={px(1.6)}
        />
      ) : null}
      {selRegion ? <Path d={MAP_REGION[selRegion].path} fill="rgba(255,255,255,0.25)" stroke="#fff6d8" strokeWidth={px(2.6)} strokeLinejoin="round" /> : null}
      {selRegion ? <Path d={MAP_REGION[selRegion].path} fill="none" stroke={C.goldDark} strokeWidth={px(1.2)} strokeLinejoin="round" /> : null}
      {/* Names */}
      {MAP.farLabels.map(l =>
        visible([l.x, l.y, l.x, l.y]) ? (
          <SvgText key={`far${l.name}`} x={l.x} y={l.y} fontSize={px(l.sea ? 12 : 13)} fontFamily={st.font.italic} fill={l.sea ? st.far.seaLabel : st.far.label} textAnchor="middle" letterSpacing={px(l.sea ? 1.5 : 3)}>
            {l.sea ? l.name : l.name.toUpperCase()}
          </SvgText>
        ) : null,
      )}
      {k >= 0.3
        ? WASTELANDS.map(wl => {
            const m = MAP.wastelands.find(x => x.id === wl.id);
            if (!m || !visible([m.label[0], m.label[1], m.label[0], m.label[1]]) || (!charted && NW_WASTELANDS.has(wl.id))) return null;
            return (
              <SvgText key={`wl${wl.id}`} x={m.label[0]} y={m.label[1]} fontSize={px(11)} fontFamily={st.font.italic} fill={st.waste.label} textAnchor="middle" letterSpacing={px(0.6)}>
                {wl.name}
              </SvgText>
            );
          })
        : null}
      {k >= 0.9
        ? MAP.seas.map(sea =>
            visible(sea.bbox) && !hidden(sea.id) && SEA[sea.id] ? (
              <SvgText key={`sl${sea.id}`} x={MAP_SEA[sea.id].label[0]} y={MAP_SEA[sea.id].label[1] + px(16)} fontSize={px(11)} fontFamily={st.font.italic} fill={st.seaLabel} textAnchor="middle" letterSpacing={px(1)}>
                {SEA[sea.id].name}
              </SvgText>
            ) : null,
          )
        : null}
      {k >= 1.0 && charted
        ? MAP.lakes.map(l =>
            visible([l.label[0], l.label[1], l.label[0], l.label[1]]) ? (
              <SvgText key={`lk${l.name}`} x={l.label[0]} y={l.label[1] + px(3)} fontSize={px(8.5)} fontFamily={st.font.italic} fill={st.seaLabel} textAnchor="middle">
                {l.name}
              </SvgText>
            ) : null,
          )
        : null}
      {!charted
        ? UNCHARTED_LABELS.map(([x, y], i) =>
            visible([x, y, x, y]) ? (
              <SvgText key={`un${i}`} x={x} y={y} fontSize={px(15)} fontFamily={st.font.italic} fill={st.far.label} textAnchor="middle" letterSpacing={px(2)}>
                Uncharted lands
              </SvgText>
            ) : null,
          )
        : null}
      {showRegionNames
        ? MAP.regions.map(r => {
            if (!visible(r.bbox) || hidden(r.id)) return null;
            const screen = r.labelRadius * k;
            if (screen < 13) return null;
            const fs = Math.max(9, Math.min(14, screen * 0.42));
            const name = REGION[r.id].name;
            const common = { x: r.label[0], y: r.label[1] + px(fs * 0.35), fontSize: px(fs), fontFamily: st.font.region, fontWeight: st.font.regionWeight, textAnchor: 'middle' as const, letterSpacing: px(fs * 0.04) };
            return (
              <G key={`l${r.id}`}>
                <SvgText {...common} stroke={st.regionLabel.halo} strokeWidth={px(2.4)} strokeLinejoin="round" fill="none">
                  {name}
                </SvgText>
                <SvgText {...common} fill={st.regionLabel.fill}>
                  {name}
                </SvgText>
              </G>
            );
          })
        : st.nationLabel.curved
          ? names.map(n => {
              const common = { fontSize: n.fs, fontFamily: st.font.nation, fontWeight: st.font.nationWeight, letterSpacing: n.fs * st.nationLabel.spacing, textAnchor: 'middle' as const };
              return (
                <G key={`nl${n.nation}`}>
                  <SvgText {...common} stroke={st.nationLabel.halo} strokeWidth={Math.max(px(2.2), n.fs * 0.12)} strokeLinejoin="round" fill="none">
                    <TextPath href={`#nm_${n.nation}`} startOffset="50%">
                      {n.text}
                    </TextPath>
                  </SvgText>
                  <SvgText {...common} fill={st.nationLabel.fill}>
                    <TextPath href={`#nm_${n.nation}`} startOffset="50%">
                      {n.text}
                    </TextPath>
                  </SvgText>
                </G>
              );
            })
          : placeLabels(labels, k, st).map(l => {
              const def = NATION[l.nation];
              if (!def || (def.native && !charted)) return null;
              if (!visible([l.x, l.y, l.x, l.y])) return null;
              const text = def.name.toUpperCase();
              const common = { x: l.x, y: l.y, fontSize: px(l.fs), fontFamily: st.font.nation, fontWeight: st.font.nationWeight, letterSpacing: px(l.fs * st.nationLabel.spacing), textAnchor: 'middle' as const };
              return (
                <G key={`nl${l.nation}`}>
                  <SvgText {...common} stroke={st.nationLabel.halo} strokeWidth={px(2.6)} strokeLinejoin="round" fill="none">
                    {text}
                  </SvgText>
                  <SvgText {...common} fill={st.nationLabel.fill}>
                    {text}
                  </SvgText>
                </G>
              );
            })}
    </Svg>
  );
});

/** Fine diagonal hatching, for wastes and the lands beyond the map. */
function Hatch({ id, step, color, width }: { id: string; step: number; color: string; width: number }) {
  return (
    <Pattern id={id} patternUnits="userSpaceOnUse" width={step} height={step}>
      <Line x1={0} y1={step} x2={step} y2={0} stroke={color} strokeWidth={width} />
    </Pattern>
  );
}

/** Where "Uncharted lands" is written across the Americas before they are found. */
const UNCHARTED_LABELS: [number, number][] = ['ohio', 'maranhao', 'cuba'].map(id => MAP_REGION[id].label as [number, number]);

interface PlacedName {
  nation: string;
  text: string;
  fs: number; // map units
  d: string; // the path the name is written along
}

/**
 * Curved nation names. Each is as big as its land allows (along the spine, and no taller than the land is wide),
 * up to a limit on screen; biggest nations first, and a name that would run into one already placed is left out.
 */
function placeNames(arcs: NationArc[], k: number, st: MapStyle, charted: boolean, visible: (b: number[]) => boolean): PlacedName[] {
  const placed: { x: number; y: number; r: number }[] = [];
  const out: PlacedName[] = [];
  for (const a of [...arcs].sort((p, q) => q.area - p.area)) {
    const def = NATION[a.nation];
    if (!def || (def.native && !charted)) continue;
    const text = def.name.toUpperCase();
    const ems = text.length * (st.nationLabel.em + st.nationLabel.spacing); // the name's width in font sizes
    const fs = Math.min(a.thickness * 0.6, (a.length * 0.95) / ems, 30 / k);
    if (fs * k < 8) continue;
    const [A, Cc, B] = a.curve;
    const at = (q: number): [number, number] => [(1 - q) * (1 - q) * A[0] + 2 * (1 - q) * q * Cc[0] + q * q * B[0], (1 - q) * (1 - q) * A[1] + 2 * (1 - q) * q * Cc[1] + q * q * B[1]];
    // Discs along the stretch of the curve the letters cover.
    const half = Math.min(0.5, (fs * ems) / a.length / 2);
    const steps = Math.max(2, Math.ceil((fs * ems) / (fs * 0.8)));
    const discs: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const [x, y] = at(0.5 - half + (2 * half * i) / steps);
      discs.push({ x, y, r: fs * 0.45 });
    }
    if (!discs.some(c => visible([c.x, c.y, c.x, c.y]))) continue;
    if (discs.some(c => placed.some(p => (c.x - p.x) ** 2 + (c.y - p.y) ** 2 < (c.r + p.r) ** 2))) continue;
    placed.push(...discs);
    // Lengthen the curve a little at both ends (so no letter falls off it) and lower it so the capitals sit
    // centred on the spine rather than standing on it.
    const blossom = (u: number, v: number): [number, number] => [
      (1 - u) * (1 - v) * A[0] + ((1 - u) * v + u * (1 - v)) * Cc[0] + u * v * B[0],
      (1 - u) * (1 - v) * A[1] + ((1 - u) * v + u * (1 - v)) * Cc[1] + u * v * B[1],
    ];
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    const drop = fs * 0.36;
    const nx = (-(B[1] - A[1]) / len) * drop;
    const ny = ((B[0] - A[0]) / len) * drop;
    const r1 = (v: number) => Math.round(v * 10) / 10;
    const [p0, p1, p2] = [blossom(-0.3, -0.3), blossom(-0.3, 1.3), blossom(1.3, 1.3)].map(([x, y]) => `${r1(x + nx)} ${r1(y + ny)}`);
    out.push({ nation: a.nation, text, fs, d: `M${p0}Q${p1} ${p2}` });
  }
  return out;
}

/** Straight names (the Flat style): biggest nations first; skip a name that would overlap one already placed. */
function placeLabels(labels: ReturnType<typeof nationLabels>, k: number, st: MapStyle) {
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const out: ((typeof labels)[number] & { fs: number })[] = [];
  for (const l of [...labels].sort((a, b) => b.area - a.area)) {
    const def = NATION[l.nation];
    if (!def) continue;
    const fs = Math.max(8, Math.min(18, l.size * k * 0.8));
    if (l.size * k < 7) continue;
    const w = (def.name.length * fs * (st.nationLabel.em + st.nationLabel.spacing) + 6) / k;
    const h = (fs * 1.2) / k;
    const box = { x0: l.x - w / 2, y0: l.y - h, x1: l.x + w / 2, y1: l.y + h * 0.2 };
    if (placed.some(p => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
    placed.push(box);
    out.push({ ...l, fs });
  }
  return out;
}

// ---------------------------------------------------------------- units (armies, fleets, battles, sieges)

export interface ChipPos {
  kind: 'army' | 'fleet' | 'battle';
  id: string;
  x: number; // map units
  y: number;
}

/** From this zoom on every unit is drawn; further out, only the ones that matter to you (see `matters`). */
export const ALL_UNITS_K = 1.4;

/** Units the player should always see: their own, friends', enemies', and anyone standing in their land. */
export function matters(s: GameState, owner: string, where: string, rebelOf?: string): boolean {
  const p = s.player;
  if (owner === p) return true;
  if (s.regions[where]?.owner === p) return true;
  if (owner === REBELS) return rebelOf === p;
  return allied(s, p, owner) || !!warBetween(s, p, owner) || s.nations[owner]?.overlord === p || s.nations[p].overlord === owner;
}

/** Where each army/fleet/battle marker sits (map units). Shared with tap hit-testing, so hidden units can't be tapped. */
export function unitPositions(s: GameState, k: number, selected?: string): ChipPos[] {
  const out: ChipPos[] = [];
  const stacks = new Map<string, number>();
  const step = 26 / k;
  const all = k >= ALL_UNITS_K;
  for (const b of Object.values(s.battles)) {
    if (!all && !b.sides.some(side => side.armies.some(id => s.armies[id] && matters(s, s.armies[id].owner, b.node, s.armies[id].rebelOf)))) continue;
    const [x, y] = regionPoint(b.node);
    out.push({ kind: 'battle', id: b.id, x, y: y - step * 0.9 });
  }
  for (const a of Object.values(s.armies)) {
    if (a.battle || (!s.discovery && isNewWorld(a.node))) continue;
    if (!all && a.id !== selected && !matters(s, a.owner, a.node, a.rebelOf)) continue;
    let [x, y] = regionPoint(a.node);
    if (a.path.length && a.edgeDays > 0) {
      const [nx, ny] = regionPoint(a.path[0]);
      const t = Math.min(1, a.progress / a.edgeDays);
      x += (nx - x) * t;
      y += (ny - y) * t;
    } else {
      const n = stacks.get(a.node) ?? 0;
      stacks.set(a.node, n + 1);
      x += (n % 2 === 0 ? 1 : -1) * Math.ceil(n / 2) * step * 1.2;
      y += step * 0.15;
    }
    out.push({ kind: 'army', id: a.id, x, y });
  }
  const fleetStacks = new Map<string, number>();
  for (const f of Object.values(s.fleets)) {
    if (!all && f.id !== selected && !matters(s, f.owner, f.sea)) continue;
    let [x, y] = regionPoint(f.sea);
    if (f.path.length && f.edgeDays > 0) {
      const [nx, ny] = regionPoint(f.path[0]);
      const t = Math.min(1, f.progress / f.edgeDays);
      x += (nx - x) * t;
      y += (ny - y) * t;
    } else {
      const n = fleetStacks.get(f.sea) ?? 0;
      fleetStacks.set(f.sea, n + 1);
      x += n * step * 1.4;
    }
    out.push({ kind: 'fleet', id: f.id, x, y: y - step * 0.6 });
  }
  return out;
}

const UnitLayer = memo(function UnitLayer({ cam, w, h, s, selection }: { cam: Camera; w: number; h: number; s: GameState; selection: Selection; version: number }) {
  const { k } = cam;
  const toX = (x: number) => (x - cam.cx) * k + w / 2;
  const toY = (y: number) => (y - cam.cy) * k + h / 2;
  const chips = unitPositions(s, k, selection?.kind === 'army' || selection?.kind === 'fleet' ? selection.id : undefined);
  const selArmy = selection?.kind === 'army' ? s.armies[selection.id] : undefined;
  const selFleet = selection?.kind === 'fleet' ? s.fleets[selection.id] : undefined;
  const pathPts = (start: string, path: string[]) => [start, ...path].map(regionPoint).map(([x, y]) => `${toX(x)},${toY(y)}`).join(' ');
  const inView = (x: number, y: number) => x > -40 && y > -40 && x < w + 40 && y < h + 40;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Sieges */}
      {Object.values(s.regions).map(r => {
        if (!r.siege || (k < ALL_UNITS_K && !matters(s, r.siege.by, r.id))) return null;
        const [x, y] = regionPoint(r.id);
        const X = toX(x);
        const Y = toY(y) + 18;
        if (!inView(X, Y)) return null;
        return (
          <View key={`sg${r.id}`} style={[styles.siege, { left: X - 22, top: Y }]}>
            <View style={[styles.siegeFill, { width: `${Math.min(100, r.siege.progress * 100)}%`, backgroundColor: r.siege.by === REBELS ? '#333' : nationColor(r.siege.by) }]} />
          </View>
        );
      })}
      {(selArmy?.path.length || selFleet?.path.length) ? (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path d={`M${pathPts(selArmy ? selArmy.node : selFleet!.sea, selArmy ? selArmy.path : selFleet!.path).replace(/ /g, ' L')}`} stroke="#fff6d8" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
          <Path d={`M${pathPts(selArmy ? selArmy.node : selFleet!.sea, selArmy ? selArmy.path : selFleet!.path).replace(/ /g, ' L')}`} stroke={C.red} strokeWidth={2} strokeDasharray="6 5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
      {chips.map(c => {
        const X = toX(c.x);
        const Y = toY(c.y);
        if (!inView(X, Y)) return null;
        if (c.kind === 'battle') {
          const b = s.battles[c.id];
          if (!b) return null;
          const men = b.sides.map(side => side.armies.reduce((t, id) => t + (s.armies[id] ? armyMen(s.armies[id]) : 0), 0));
          return (
            <View key={c.id} style={[styles.battle, { left: X - 44, top: Y - 13 }]}>
              <Text style={styles.battleText}>⚔ {kmen(men[0])} : {kmen(men[1])}</Text>
            </View>
          );
        }
        if (c.kind === 'fleet') {
          const f = s.fleets[c.id];
          if (!f) return null;
          const n = f.ships.galley + f.ships.warship + f.ships.transport;
          const sel = selFleet?.id === f.id;
          return (
            <View key={c.id} style={[styles.chip, styles.fleet, { left: X - 20, top: Y - 11, borderColor: sel ? C.gold : '#1d2a33', backgroundColor: nationColor(f.owner) }, sel && styles.chipSel]}>
              <Text style={styles.chipText}>⛵{n}</Text>
            </View>
          );
        }
        const a = s.armies[c.id] as Army | undefined;
        if (!a) return null;
        const sel = selArmy?.id === a.id;
        const mine = a.owner === s.player;
        const regs = armyRegs(a);
        const color = a.owner === REBELS ? '#2b2b2b' : nationColor(a.owner);
        return (
          <View key={c.id} style={[styles.chip, { left: X - 16, top: Y - 11, backgroundColor: color, borderColor: sel ? C.gold : mine ? '#fff7dc' : '#2a2118' }, sel && styles.chipSel, a.retreating && { opacity: 0.6 }]}>
            <Text style={[styles.chipText, { color: textOn(color) }]}>{regs}</Text>
            {a.path.length ? <View style={[styles.moveDot, { backgroundColor: textOn(color) }]} /> : null}
          </View>
        );
      })}
    </View>
  );
});

function textOn(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  const l = ((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114;
  return l > 150 ? '#1d150d' : '#fffaf0';
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.sea, overflow: 'hidden' },
  chip: {
    position: 'absolute',
    minWidth: 32,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  chipSel: { borderWidth: 3, transform: [{ scale: 1.12 }] },
  chipText: { fontFamily: sans, fontSize: 12, fontWeight: '800', color: '#fff' },
  moveDot: { position: 'absolute', right: 2, top: 2, width: 5, height: 5, borderRadius: 3 },
  fleet: { minWidth: 40, height: 22, borderRadius: 11 },
  battle: { position: 'absolute', width: 88, height: 26, borderRadius: 13, backgroundColor: '#7a1f15', borderWidth: 2, borderColor: '#f3d9a4', alignItems: 'center', justifyContent: 'center' },
  battleText: { color: '#fff4dc', fontFamily: sans, fontSize: 12, fontWeight: '800' },
  siege: { position: 'absolute', width: 44, height: 6, borderRadius: 3, backgroundColor: 'rgba(30,20,10,0.55)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,245,220,0.8)' },
  siegeFill: { height: '100%' },
});

export { regionAt, seaAt };
