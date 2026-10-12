/**
 * The map: pan with one finger, pinch to zoom, tap to select. While a gesture runs, the last rendered
 * picture is moved with a native transform; when it ends, the SVG re-renders at the new zoom so it stays
 * sharp. Pulling past the edge of the known world (or past the zoom limits) meets resistance and slides back
 * when let go. Units are plain views on top of the SVG.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop, Text as SvgText, TextPath } from 'react-native-svg';
import { MAP, MAP_REGION, MAP_SEA, NATION, NW_WASTELANDS, REGION, RIVERS, SEA_NAMES, WASTELANDS, isNewWorld } from '../../sim/content';
import { REBELS, allied, armyRegs, armyMen, warBetween } from '../../sim/queries';
import type { Army, GameState } from '../../sim/types';
import { store, useStore, type MapMode, type Selection } from '../../state/store';
import { C, kmen, sans } from '../theme';
import { freeBand } from '../layout';
import { WILD, mix, nationColor, regionFills } from './colors';
import { K_MAX, clampCentre, clampView, rubber, rubberZoom } from './camera';
import { COAST_CELLS, FAR_COAST_CELLS, MAP_H, MAP_W, WASTE_BBOX, nationArcs, nationLabels, regionAt, regionPoint, seaAt, type NationArc } from './geometry';
import { GRAIN, LAND_COLOUR, RELIEF, SHADOWS, WATER_LINES } from './reliefTiles';
import { MAP_STYLES, type Ink, type MapStyle, type MapStyleId } from './styles';
import { onMapTap } from './tap';
import { PAINTING } from './paintingTiles';
import { terrainCache, terrainStats } from './terrainCache';
import { decodedBytes, neighbours, pickLevel, tilesToDraw, webZoom } from './terrainLayer';
import { TERRAIN_LEVELS, TERRAIN_REGION } from './terrainTiles';
import { TERRAIN_LAKES, TERRAIN_RIVERS } from './terrainVectors';
import { mountainsIn, terrainPaths } from './terrain';

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
      const k = Math.max(width / 420, PLAY_K); // close enough for region names with armies under them
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
    setCam(clampCam({ cx: focus.x, cy: focus.y, k: focus.zoom ? size.w / focus.zoom : Math.max(cam.k, size.w / 420, PLAY_K) }));
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

  // Keep what you select in sight: if its sheet would cover it (or it sits under the top bar), glide the map until
  // it is in the middle of the clear space, so the land around an army stays free to tap.
  const insets = useSafeAreaInsets();
  const selection = st.selection;
  const selKey = selection ? `${selection.kind}:${selection.id}` : '';
  const shownSel = useRef('');
  useEffect(() => {
    if (selKey === shownSel.current) return;
    shownSel.current = selKey;
    if (!cam || !selection || selection.kind === 'nation' || live.get().pan || live.get().pinch) return;
    const pt = selectionPoint(s, selection, cam.k);
    if (!pt) return;
    const band = freeBand(size.h, insets, selection.kind === 'army' || selection.kind === 'fleet' ? 'compact' : 'half');
    const sx = size.w / 2 + (pt[0] - cam.cx) * cam.k;
    const sy = size.h / 2 + (pt[1] - cam.cy) * cam.k;
    // Fine anywhere but the band's lower quarter, where the land beyond it (the next march) is under the sheet.
    const xOk = sx > 40 && sx < size.w - 92; // clear of the side rail
    if (xOk && sy > band.top + 50 && sy < band.bottom - Math.max(80, (band.bottom - band.top) / 4)) return;
    const want = clampCam({ k: cam.k, cx: xOk ? cam.cx : pt[0], cy: pt[1] - ((band.top + band.bottom) / 2 - size.h / 2) / cam.k });
    const dx = (cam.cx - want.cx) * cam.k;
    const dy = (cam.cy - want.cy) * cam.k;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    ty.set(withTiming(dy, SETTLE));
    tx.set(
      withTiming(dx, SETTLE, done => {
        if (done) runOnJS(commit)(dx, dy, 1);
      }),
    );
  }, [selKey, selection, cam, s, size, insets, clampCam, commit, live, tx, ty]);

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
    // Never further than the picture rendered past the screen's edge (OVER), so a pull shows no empty strip.
    tx.set(bx + rubber(x1 - bx, (lim.w * (OVER - 1)) / 2));
    ty.set(by + rubber(y1 - by, (lim.h * (OVER - 1)) / 2));
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
    <View ref={wrapRef} style={[styles.wrap, { backgroundColor: style.unknown.fill }]} onLayout={onLayout} testID="map">
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

/** The grain tile's size on screen (points; stepped by powers of two in map units). */
const GRAIN_SCREEN = 150;

/** Near the window's edges the known world fades into the parchment instead of stopping at a ruled line. */
const EDGE = 80; // map units
const EDGE_STOPS: [number, number][] = [
  [0, 1],
  [0.3, 0.62],
  [0.65, 0.2],
  [1, 0],
];

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
  const showRegionNames = k >= REGION_NAMES_K;
  const selRegion = selection?.kind === 'region' ? selection.id : null;
  const selSea = selection?.kind === 'sea' ? selection.id : null;
  const selNation = selection?.kind === 'nation' ? selection.id : null;
  const charted = !!s.discovery;
  // Before the New World is found it is blank parchment like the rest of the unknown: no borders, names or units.
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

  // Known land in one path per colour (a nation's regions share one).
  const paint = new Map<string, string>();
  const byFill = new Map<string, string>();
  for (const r of MAP.regions) {
    if (!visible(r.bbox) || hidden(r.id)) continue;
    const f = fills[r.id];
    if (!paint.has(f)) paint.set(f, f === WILD ? st.wild : st.land(f));
    const c = paint.get(f)!;
    byFill.set(c, (byFill.get(c) ?? '') + r.path);
  }
  // The unknown: everything past the window, the wastes, the waters no fleet sails, and the New World until found.
  let wastes = '';
  for (const wl of MAP.wastelands) if (!WASTE_BBOX[wl.id] || visible(WASTE_BBOX[wl.id])) wastes += wl.path;
  const unknown = MAP.unknownWater + (charted ? '' : MAP.uncharted) + wastes;
  // (The hole is two screen points smaller than the window so the two parchments overlap: no hairline where they
  // meet. The known world has already faded into parchment there.)
  const lap = Math.max(1, px(2));
  const beyond = `M${vx} ${vy}h${vw}v${vh}h${-vw}Z M${lap} ${lap}v${MAP_H - 2 * lap}h${MAP_W - 2 * lap}v${-(MAP_H - 2 * lap)}Z`;
  const edgeNear = vx < EDGE || vy < EDGE || vx + vw > MAP_W - EDGE || vy + vh > MAP_H - EDGE;
  // Only the coasts in view (known or not, all in one ink so a coast running off the map carries on unbroken).
  const coast =
    COAST_CELLS.filter(c => visible(c.bbox))
      .map(c => c.d)
      .join('') +
    FAR_COAST_CELLS.filter(c => visible(c.bbox))
      .map(c => c.d)
      .join('');

  // Pictures of the land are cut to its real coastline (they reach a few pixels past it), so coasts stay crisp at
  // any zoom. Soft pictures when far out; sharp ones closer in, except the land's colour, which goes soft again
  // close up (enlarged, its fine detail would only smear). The grain is drawn the same size on screen at any zoom
  // (its tile size steps in powers of two so it rarely changes).
  const landD = [...byFill.values()].join('');
  const res = k < 0.35 ? 'soft' : 'sharp';
  const colourRes = k < 0.35 || k >= 2.2 ? 'soft' : 'sharp';
  const grainSize = 2 ** Math.round(Math.log2(GRAIN_SCREEN / k));
  // The drawn terrain (mountains, hills, trees, dunes, reeds) fades in as you zoom in, and the hill shading, which
  // would only smear enlarged, gives way to it.
  const dt = st.drawn;
  const drawnAlpha = dt ? Math.max(0, Math.min(1, (k - 0.75) / 0.45)) : 0;
  const reliefLand = st.relief * (dt ? 1 - Math.max(0, Math.min(1, (k - 1) / 0.7)) * (1 - dt.reliefClose) : 1);
  const drawn = drawnAlpha > 0 ? terrainPaths(vx, vy, vx + vw, vy + vh) : null;
  // The mountains come in a little sooner: they are what most shapes the land.
  const mountainAlpha = dt ? Math.max(0, Math.min(1, (k - 0.6) / 0.4)) : 0;
  const peaks = mountainAlpha > 0 ? mountainsIn(vx, vy, vx + vw, vy + vh) : [];
  // Fine province lines fade out as you zoom out, leaving the borders between crowns.
  const provinceAlpha = Math.max(0, Math.min(1, (k - 0.32) / 0.45));
  // Water lines fade in as you zoom in (further out they would crowd into a blur).
  const linesAlpha = st.waterLines ? st.waterLines.opacity * Math.max(0, Math.min(1, (k - 0.35) / 0.25)) : 0;
  // The painting: the coarsest tiles under everything (they reach furthest past the edges), the finest that the zoom
  // needs over them.
  const pt = st.painting;
  const fine = k >= 0.55 ? 0 : k >= 0.28 ? 1 : 2;
  const tiles = pt ? [...(fine < 2 ? [2, fine] : [2])].flatMap(l => PAINTING[l].tiles.filter(t => visible([t.x, t.y, t.x + t.w, t.y + t.h])).map(t => ({ ...t, key: `${l}-${t.x}-${t.y}` }))) : [];
  // The illustrated terrain (scripts/terrain → terrainTiles.ts): its tiles where they exist, the realms' colours over
  // them at the style's opacity, rivers and lake shores on top; around the region the style is drawn as usual.
  const tr = st.terrain;
  const TR = TERRAIN_REGION;
  const terrainOn = !!tr && TR.x1 > vx && TR.x0 < vx + vw && TR.y1 > vy && TR.y0 < vy + vh;
  const allTerrain = terrainOn && vx >= TR.x0 && vy >= TR.y0 && vx + vw <= TR.x1 && vy + vh <= TR.y1;
  const halfW = w / OVER / 2 / k;
  const halfH = h / OVER / 2 / k;
  const screen = { x0: cam.cx - halfW, y0: cam.cy - halfH, x1: cam.cx + halfW, y1: cam.cy + halfH };
  const dpr = PixelRatio.get();
  const terrainTiles = terrainOn ? tilesToDraw(TERRAIN_LEVELS, k, dpr, screen, { x0: vx, y0: vy, x1: vx + vw, y1: vy + vh }) : [];
  // Neighbouring tiles overlap by a hair (0.6 points) so no seam of the layer below shows between them.
  const seam = px(0.6);
  const riverPaths = new Map<number, string>();
  const lakePaths: string[] = [];
  if (terrainOn) {
    const z = webZoom(k, MAP_W / (MAP.projection.east - MAP.projection.west));
    const widen = 0.75 + 0.14 * Math.max(0, Math.min(3, z - 4));
    for (const r of TERRAIN_RIVERS) if (r.z <= z + 0.7 && visible(r.b)) riverPaths.set(r.w * widen, (riverPaths.get(r.w * widen) ?? '') + r.d);
    for (const l of TERRAIN_LAKES) if (l.z <= z + 1.2 && visible(l.b)) lakePaths.push(l.d);
  }
  // Keep the tiles drawn and the ones a pan or zoom step would want next warm (terrainCache.ts); note what was drawn.
  useEffect(() => {
    if (!terrainOn) return;
    const pick = pickLevel(TERRAIN_LEVELS, k, dpr);
    const evicted = terrainCache.use([...terrainTiles.map(t => t.key), ...neighbours(TERRAIN_LEVELS, k, dpr, screen).map(t => t.key)]);
    Object.assign(terrainStats, { tiles: terrainTiles.length, decodedBytes: decodedBytes(TERRAIN_LEVELS, terrainTiles), level: pick.fine, alpha: pick.alpha, cached: terrainCache.size, evicted: terrainStats.evicted + evicted.length });
  });
  const names = showRegionNames ? [] : st.nationLabel.curved ? placeNames(arcs, k, st, charted, visible) : [];
  const dash = (d: number[] | null) => (d ? d.map(px).join(' ') : undefined);
  const nl = st.nationLabel;

  return (
    <Svg width={w} height={h} viewBox={`${vx} ${vy} ${vw} ${vh}`} style={StyleSheet.absoluteFill}>
      <Defs>
        {striped.map(o => (
          <Pattern key={o} id={`occ_${o}`} patternUnits="userSpaceOnUse" width={stripe} height={stripe}>
            <Path d={`M0 ${stripe} L${stripe} 0 M${-stripe / 2} ${stripe / 2} L${stripe / 2} ${-stripe / 2} M${stripe / 2} ${stripe * 1.5} L${stripe * 1.5} ${stripe / 2}`} stroke={o === REBELS ? '#222' : nationColor(o)} strokeWidth={stripe * 0.32} />
          </Pattern>
        ))}
        {landD ? (
          <ClipPath id="land">
            <Path d={landD} />
          </ClipPath>
        ) : null}
        {terrainOn ? (
          <ClipPath id="tIn">
            <Rect x={TR.x0} y={TR.y0} width={TR.x1 - TR.x0} height={TR.y1 - TR.y0} />
          </ClipPath>
        ) : null}
        {terrainOn ? (
          <ClipPath id="tOut">
            <Path d={`M${vx} ${vy}h${vw}v${vh}h${-vw}Z M${TR.x0} ${TR.y0}h${TR.x1 - TR.x0}v${TR.y1 - TR.y0}h${TR.x0 - TR.x1}Z`} clipRule="evenodd" />
          </ClipPath>
        ) : null}
        {pt && landD ? (
          <ClipPath id="water">
            <Path d={`M${vx} ${vy}h${vw}v${vh}h${-vw}Z${landD}${wastes}`} clipRule="evenodd" />
          </ClipPath>
        ) : null}
        {st.grain > 0 ? (
          <Pattern id="grain" patternUnits="userSpaceOnUse" width={grainSize} height={grainSize}>
            <SvgImage x={0} y={0} width={grainSize} height={grainSize} href={GRAIN.src} preserveAspectRatio="none" />
          </Pattern>
        ) : null}
        {names.map(n => (
          <G key={n.nation}>
            <Path id={`nm_${n.nation}`} d={n.d} />
            {nl.shadow ? <Path id={`ns_${n.nation}`} d={n.dShadow} /> : null}
          </G>
        ))}
        {edgeNear
          ? (
              [
                ['fadeL', 0, 0, EDGE, 0],
                ['fadeR', MAP_W, 0, MAP_W - EDGE, 0],
                ['fadeT', 0, 0, 0, EDGE],
                ['fadeB', 0, MAP_H, 0, MAP_H - EDGE],
              ] as [string, number, number, number, number][]
            ).map(([id, x1, y1, x2, y2]) => (
              <LinearGradient key={id} id={id} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
                {EDGE_STOPS.map(([o, a]) => (
                  <Stop key={o} offset={o} stopColor={st.unknown.fill} stopOpacity={a * (st.painting ? st.painting.veil : 1)} />
                ))}
              </LinearGradient>
            ))
          : null}
      </Defs>
      {/* Water (or the painting of the whole world) */}
      <Rect x={vx} y={vy} width={vw} height={vh} fill={st.sea} />
      {tiles.map(t => (
        <SvgImage key={t.key} x={t.x} y={t.y} width={t.w} height={t.h} href={t.src} preserveAspectRatio="none" />
      ))}
      {st.relief > 0 ? <SvgImage x={0} y={0} width={MAP_W} height={MAP_H} href={RELIEF.sea[res].src} preserveAspectRatio="none" opacity={st.relief} /> : null}
      {linesAlpha > 0 ? <SvgImage x={0} y={0} width={MAP_W} height={MAP_H} href={WATER_LINES[st.waterLines!.image].src} preserveAspectRatio="none" opacity={linesAlpha} /> : null}
      {/* The illustrated terrain's tiles: coarse ones under the whole drawn area, finer ones over the screen */}
      {terrainTiles.map(t => (
        <SvgImage key={t.key} x={t.x} y={t.y} width={t.w + seam} height={t.h + seam} href={t.src} preserveAspectRatio="none" opacity={t.opacity < 1 ? t.opacity : undefined} />
      ))}
      {/* Sea zones (with the painting showing through the land, cut to the water: they run on under the coast) */}
      <G clipPath={pt && landD ? 'url(#water)' : undefined}>
        {MAP.seas.map(sea =>
          !visible(sea.bbox) || sea.closed || hidden(sea.id) ? null : (
            <Path key={sea.id} d={sea.path} fill={sea.id === selSea ? 'rgba(255,255,255,0.22)' : 'none'} stroke={st.seaZone.color} strokeWidth={px(0.8)} strokeDasharray={dash(st.seaZone.dash)} />
          ),
        )}
      </G>
      {/* Known land */}
      {/* (Illustrated: a plain land under the colours, where there are no terrain tiles) */}
      {tr && landD && !allTerrain ? <Path d={landD} fill={tr.base} clipPath={terrainOn ? 'url(#tOut)' : undefined} /> : null}
      {[...byFill].map(([fill, d]) => (
        <Path key={fill} d={d} fill={fill} opacity={tr ? tr.fill : pt ? pt.land : 1} />
      ))}
      {/* Over the land, cut to the coastline: its own colours (fields, forest, rock, sand) showing through the
          country colours, the hills, and a fine grain (scripts/build-relief.ts) */}
      {landD && !allTerrain ? (
        <G clipPath="url(#land)">
          <G clipPath={terrainOn ? 'url(#tOut)' : undefined}>
          {st.landColour > 0 ? <SvgImage x={0} y={0} width={MAP_W} height={MAP_H} href={LAND_COLOUR[colourRes].src} preserveAspectRatio="none" opacity={st.landColour} /> : null}
          {reliefLand > 0 ? <SvgImage x={0} y={0} width={MAP_W} height={MAP_H} href={RELIEF.land[res].src} preserveAspectRatio="none" opacity={reliefLand} /> : null}
          {st.grain > 0 ? <Rect x={vx} y={vy} width={vw} height={vh} fill="url(#grain)" opacity={st.grain} /> : null}
          </G>
        </G>
      ) : null}
      {/* The drawn terrain (ui/map/terrain.ts), cut to the coastline: the mountain drawings (dark ink and a faint
          light, so the country's colour shows through), then the marks. */}
      {landD && peaks.length && !allTerrain ? (
        <G clipPath="url(#land)" opacity={mountainAlpha}>
          <G clipPath={terrainOn ? 'url(#tOut)' : undefined}>
          {peaks.map(m =>
            m.flip ? (
              <G key={m.key} transform={`translate(${2 * m.x + m.w} 0) scale(-1 1)`}>
                <SvgImage x={m.x} y={m.y} width={m.w} height={m.h} href={m.src} preserveAspectRatio="none" />
              </G>
            ) : (
              <SvgImage key={m.key} x={m.x} y={m.y} width={m.w} height={m.h} href={m.src} preserveAspectRatio="none" />
            ),
          )}
          </G>
        </G>
      ) : null}
      {landD && drawn && dt && !allTerrain ? (
        <G clipPath="url(#land)" opacity={drawnAlpha}>
          <G clipPath={terrainOn ? 'url(#tOut)' : undefined}>
          {drawn.tree ? <Path d={drawn.tree} fill={dt.tree} /> : null}
          {drawn.treeLine ? <Path d={drawn.treeLine} fill="none" stroke={dt.ink} strokeWidth={px(0.55)} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {drawn.dune ? <Path d={drawn.dune} fill="none" stroke={dt.ink} strokeWidth={px(0.8)} strokeLinecap="round" /> : null}
          {drawn.reed ? <Path d={drawn.reed} fill="none" stroke={dt.ink} strokeWidth={px(0.7)} strokeLinecap="round" /> : null}
          </G>
        </G>
      ) : null}
      {mode === 'political' || mode === 'diplomatic'
        ? MAP.regions.map(r => {
            const reg = s.regions[r.id];
            if (!visible(r.bbox) || hidden(r.id)) return null;
            if (reg.controller !== reg.owner && reg.controller) return <Path key={`o${r.id}`} d={r.path} fill={`url(#occ_${reg.controller})`} />;
            if (reg.colony) return <Path key={`o${r.id}`} d={r.path} fill={`url(#occ_${reg.colony.by})`} opacity={0.75} />;
            return null;
          })
        : null}
      {/* Rivers and lake shores over the illustrated terrain (scripts/terrain/vectors.py), crisp at any zoom */}
      {lakePaths.length ? <Path d={lakePaths.join('')} fill="none" stroke={tr!.lake} strokeWidth={px(0.55)} strokeLinejoin="round" /> : null}
      {[...riverPaths].map(([wd, d]) => (
        <Path key={`rv${wd}`} d={d} fill="none" stroke={tr!.river} strokeWidth={px(wd)} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* The unknown, as blank parchment, with the known world's shadow falling on it */}
      {pt ? (
        <G>
          <Path d={beyond} fill={st.unknown.fill} fillRule="evenodd" opacity={pt.veil} />
          <Path d={MAP.unknownWater + wastes} fill={st.unknown.fill} opacity={pt.veil} />
          {charted ? null : <Path d={MAP.uncharted} fill={st.unknown.fill} opacity={pt.uncharted} />}
        </G>
      ) : (
        <G>
          <Path d={beyond} fill={st.unknown.fill} fillRule="evenodd" />
          <Path d={unknown} fill={st.unknown.fill} />
        </G>
      )}
      {st.unknown.shadow > 0 ? <SvgImage x={0} y={0} width={MAP_W} height={MAP_H} href={SHADOWS[charted ? 'charted' : 'uncharted'].src} preserveAspectRatio="none" opacity={st.unknown.shadow} /> : null}
      {/* Borders */}
      {provinceAlpha > 0 && lines.province ? <Path d={lines.province} fill="none" stroke={st.provinceBorder.color} strokeWidth={px(st.provinceBorder.width)} strokeDasharray={dash(st.provinceBorder.dash)} strokeLinecap="round" strokeLinejoin="round" opacity={provinceAlpha} /> : null}
      {lines.river && st.river.width > 0 ? <Path d={lines.river} fill="none" stroke={st.river.color} strokeWidth={px(st.river.width)} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} /> : null}
      {st.nationBorder.halo && lines.nation ? <Path d={lines.nation} fill="none" stroke={st.nationBorder.halo} strokeWidth={px(st.nationBorder.haloWidth)} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {lines.nation ? <Path d={lines.nation} fill="none" stroke={st.nationBorder.color} strokeWidth={px(st.nationBorder.width)} strokeLinecap="round" strokeLinejoin="round" /> : null}
      {/* The known world fading into the parchment at the window's edges */}
      {edgeNear ? (
        <G>
          <Rect x={0} y={0} width={EDGE} height={MAP_H} fill="url(#fadeL)" />
          <Rect x={MAP_W - EDGE} y={0} width={EDGE} height={MAP_H} fill="url(#fadeR)" />
          <Rect x={0} y={0} width={MAP_W} height={EDGE} fill="url(#fadeT)" />
          <Rect x={0} y={MAP_H - EDGE} width={MAP_W} height={EDGE} fill="url(#fadeB)" />
        </G>
      ) : null}
      {/* Coasts, known and unknown alike: the outline of the whole world */}
      {coast ? <Path d={coast} fill="none" stroke={st.coast.color} strokeWidth={px(st.coast.width)} strokeLinecap="round" strokeLinejoin="round" /> : null}
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
      {/* Names in the unknown */}
      {MAP.farLabels.map(l => {
        if (!visible([l.x, l.y, l.x, l.y])) return null;
        const fs = px(l.sea ? 11 : 13);
        return l.sea ? (
          <SvgText key={`far${l.name}`} x={l.x} y={l.y} fontSize={fs} fontFamily={st.font.italic} fill={st.unknown.wasteLabel} textAnchor="middle" letterSpacing={px(1.5)}>
            {l.name}
          </SvgText>
        ) : (
          <Inked key={`far${l.name}`} ink={st.unknown.label} x={l.x} y={l.y} fs={fs} family={st.font.region} weight={st.font.regionWeight} spacing={fs * 0.3} outline={px(1.6)}>
            {l.name.toUpperCase()}
          </Inked>
        );
      })}
      {k >= 0.3
        ? WASTELANDS.map(wl => {
            const m = MAP.wastelands.find(x => x.id === wl.id);
            if (!m || !visible([m.label[0], m.label[1], m.label[0], m.label[1]]) || (!charted && NW_WASTELANDS.has(wl.id))) return null;
            return (
              <SvgText key={`wl${wl.id}`} x={m.label[0]} y={m.label[1]} fontSize={px(11)} fontFamily={st.font.italic} fill={st.unknown.wasteLabel} textAnchor="middle" letterSpacing={px(0.6)}>
                {wl.name}
              </SvgText>
            );
          })
        : null}
      {!charted
        ? UNCHARTED_LABELS.map(([x, y], i) =>
            visible([x, y, x, y]) ? (
              <SvgText key={`un${i}`} x={x} y={y} fontSize={px(15)} fontFamily={st.font.italic} fill={st.unknown.wasteLabel} textAnchor="middle" letterSpacing={px(2)}>
                Uncharted lands
              </SvgText>
            ) : null,
          )
        : null}
      {/* Names in the known world */}
      {k >= 0.9
        ? MAP.seas.map(sea =>
            visible(sea.bbox) && !hidden(sea.id) && (!sea.closed || sea.charted) ? (
              <SvgText key={`sl${sea.id}`} x={MAP_SEA[sea.id].label[0]} y={MAP_SEA[sea.id].label[1] + px(16)} fontSize={px(11)} fontFamily={st.font.italic} fill={st.seaLabel} textAnchor="middle" letterSpacing={px(1)}>
                {SEA_NAMES[sea.id]}
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
      {showRegionNames
        ? MAP.regions.map(r => {
            if (!visible(r.bbox) || hidden(r.id)) return null;
            const screen = r.labelRadius * k;
            if (screen < MIN_NAME_RADIUS) return null;
            const fs = nameSize(r.labelRadius, k);
            return (
              <Inked key={`l${r.id}`} ink={st.regionLabel} x={r.label[0]} y={r.label[1] + px(fs * 0.35)} fs={px(fs)} family={st.font.region} weight={st.font.regionWeight} spacing={px(fs * 0.04)} outline={px(2.2)}>
                {REGION[r.id].name}
              </Inked>
            );
          })
        : nl.curved
          ? names.map(n => {
              const common = { fontSize: n.fs, fontFamily: st.font.nation, fontWeight: st.font.nationWeight, letterSpacing: n.fs * n.spacing, textAnchor: 'middle' as const };
              const along = (id: string) => (
                <TextPath href={`#${id}`} startOffset="50%">
                  {n.text}
                </TextPath>
              );
              return (
                <G key={`nl${n.nation}`}>
                  {nl.shadow ? (
                    <SvgText {...common} fill={nl.shadow}>
                      {along(`ns_${n.nation}`)}
                    </SvgText>
                  ) : null}
                  <SvgText {...common} stroke={nl.halo} strokeWidth={Math.max(px(nl.shadow ? 1.4 : 2.2), n.fs * (nl.shadow ? 0.07 : 0.12))} strokeLinejoin="round" fill="none">
                    {along(`nm_${n.nation}`)}
                  </SvgText>
                  <SvgText {...common} fill={nl.fill}>
                    {along(`nm_${n.nation}`)}
                  </SvgText>
                </G>
              );
            })
          : placeLabels(labels, k, st).map(l => {
              const def = NATION[l.nation];
              if (!def || (def.native && !charted)) return null;
              if (!visible([l.x, l.y, l.x, l.y])) return null;
              return (
                <Inked key={`nl${l.nation}`} ink={nl} x={l.x} y={l.y} fs={px(l.fs)} family={st.font.nation} weight={st.font.nationWeight} spacing={px(l.fs * nl.spacing)} outline={px(2.6)}>
                  {def.name.toUpperCase()}
                </Inked>
              );
            })}
    </Svg>
  );
});

/** A straight name, inked per the style: drop shadow (if any), outline, fill. Sizes in map units. */
function Inked({ ink, x, y, fs, family, weight, spacing, outline, children }: { ink: Ink; x: number; y: number; fs: number; family: string; weight: '400' | '600' | '700'; spacing: number; outline: number; children: string }) {
  const common = { fontSize: fs, fontFamily: family, fontWeight: weight, letterSpacing: spacing, textAnchor: 'middle' as const };
  return (
    <G>
      {ink.shadow ? (
        <SvgText {...common} x={x + fs * 0.05} y={y + fs * 0.08} fill={ink.shadow}>
          {children}
        </SvgText>
      ) : null}
      <SvgText {...common} x={x} y={y} stroke={ink.halo} strokeWidth={outline} strokeLinejoin="round" fill="none">
        {children}
      </SvgText>
      <SvgText {...common} x={x} y={y} fill={ink.fill}>
        {children}
      </SvgText>
    </G>
  );
}

/** Where "Uncharted lands" is written across the Americas before they are found. */
const UNCHARTED_LABELS: [number, number][] = ['ohio', 'maranhao', 'cuba'].map(id => MAP_REGION[id].label as [number, number]);

interface PlacedName {
  nation: string;
  text: string;
  fs: number; // map units
  spacing: number; // letter spacing, in font sizes
  d: string; // the path the name is written along
  dShadow: string; // the same, nudged down and right for the drop shadow
}

/**
 * Curved nation names. Each is as big as its land allows (along the spine, and no taller than the land is wide),
 * up to a limit on screen; a short name on a long thin country is spaced out to run its length. Biggest nations
 * first, and a name that would run into one already placed is left out.
 */
function placeNames(arcs: NationArc[], k: number, st: MapStyle, charted: boolean, visible: (b: number[]) => boolean): PlacedName[] {
  const placed: { x: number; y: number; r: number }[] = [];
  const out: PlacedName[] = [];
  const { em, spacing: baseSpacing, spread } = st.nationLabel;
  for (const a of [...arcs].sort((p, q) => q.area - p.area)) {
    const def = NATION[a.nation];
    if (!def || (def.native && !charted)) continue;
    const text = def.name.toUpperCase();
    const fs = Math.min(a.thickness * 0.6, (a.length * 0.95) / (text.length * (em + baseSpacing)), 30 / k);
    if (fs * k < 8) continue;
    // Spread a short name along a long country (at most a letter's width between letters).
    const spacing = spread && text.length > 2 ? Math.max(baseSpacing, Math.min(1, (a.length * 0.85) / (text.length * fs) - em)) : baseSpacing;
    const ems = text.length * (em + spacing); // the name's width in font sizes
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
    const ends = [blossom(-0.3, -0.3), blossom(-0.3, 1.3), blossom(1.3, 1.3)];
    const pathAt = (dx: number, dy: number) => {
      const [p0, p1, p2] = ends.map(([x, y]) => `${r1(x + nx + dx)} ${r1(y + ny + dy)}`);
      return `M${p0}Q${p1} ${p2}`;
    };
    out.push({ nation: a.nation, text, fs, spacing, d: pathAt(0, 0), dShadow: pathAt(fs * 0.05, fs * 0.08) });
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

/** Region names replace the nation names from this zoom on; a region's name is written if it is at least this many
 * points across (its label radius). */
export const REGION_NAMES_K = 1.15;
const MIN_NAME_RADIUS = 13;
/** Units show from the zoom at which region names do. Further out the map is for the realms and their names, and only
 * a unit you have selected (or a battle) stays on it, so names and tokens never fight. */
export const UNITS_K = REGION_NAMES_K;
/** From this zoom on every unit is drawn; between UNITS_K and here, only the ones that matter to you (see `matters`). */
export const ALL_UNITS_K = 1.4;
/** The zoom the game opens at and "show on map" goes to: regions are big enough here for a name with an army under it. */
export const PLAY_K = 1.7;
/** Tokens are drawn smaller between UNITS_K and PLAY_K, where regions are close together. */
export const tokenScale = (k: number) => Math.max(0.82, Math.min(1, 0.82 + ((k - UNITS_K) / (PLAY_K - UNITS_K)) * 0.18));
/** A region name's size on screen (points), as StaticLayer writes it. */
const nameSize = (labelRadius: number, k: number) => Math.max(9, Math.min(14, labelRadius * k * 0.42));

/** Where a region's armies stand (map units): just under its name when the name is written at this zoom (the name's
 * descenders, a small gap, then the token's top), else on its centre. (An army at sea is on its fleet's route.) */
export function armyAnchor(id: string, k: number): [number, number] {
  const [x, y] = regionPoint(id);
  const r = MAP_REGION[id];
  if (!r || k < REGION_NAMES_K || r.labelRadius * k < MIN_NAME_RADIUS) return [x, y];
  const below = nameSize(r.labelRadius, k) * 0.55 + 3 + TOKEN_TOP * tokenScale(k);
  return [x, y + below / k];
}
/** Where a fleet sits in a sea: just above the sea's name. */
const fleetAnchor = (id: string, k: number): [number, number] => {
  const [x, y] = regionPoint(id);
  return [x, y - (16 * tokenScale(k)) / k];
};

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
  const step = (26 * tokenScale(k)) / k;
  const all = k >= ALL_UNITS_K;
  const hidden = (id: string) => k < UNITS_K && id !== selected; // zoomed out: names only
  for (const b of Object.values(s.battles)) {
    if (hidden(b.id)) continue;
    if (!all && !b.sides.some(side => side.armies.some(id => s.armies[id] && matters(s, s.armies[id].owner, b.node, s.armies[id].rebelOf)))) continue;
    const [x, y] = regionPoint(b.node);
    out.push({ kind: 'battle', id: b.id, x, y: y - step * 0.9 });
  }
  for (const a of Object.values(s.armies)) {
    if (a.battle || (!s.discovery && isNewWorld(a.node)) || hidden(a.id)) continue;
    if (!all && a.id !== selected && !matters(s, a.owner, a.node, a.rebelOf)) continue;
    let [x, y] = armyAnchor(a.node, k);
    if (a.path.length && a.edgeDays > 0) {
      const [nx, ny] = armyAnchor(a.path[0], k);
      const t = Math.min(1, a.progress / a.edgeDays);
      x += (nx - x) * t;
      y += (ny - y) * t;
    } else {
      // Side by side under the name, the first in the middle.
      const n = stacks.get(a.node) ?? 0;
      stacks.set(a.node, n + 1);
      x += (n % 2 === 0 ? 1 : -1) * Math.ceil(n / 2) * step * 1.6; // room for each one's count badge
    }
    out.push({ kind: 'army', id: a.id, x, y });
  }
  const fleetStacks = new Map<string, number>();
  for (const f of Object.values(s.fleets)) {
    if (hidden(f.id)) continue;
    if (!all && f.id !== selected && !matters(s, f.owner, f.sea)) continue;
    let [x, y] = fleetAnchor(f.sea, k);
    if (f.path.length && f.edgeDays > 0) {
      const [nx, ny] = fleetAnchor(f.path[0], k);
      const t = Math.min(1, f.progress / f.edgeDays);
      x += (nx - x) * t;
      y += (ny - y) * t;
    } else {
      const n = fleetStacks.get(f.sea) ?? 0;
      fleetStacks.set(f.sea, n + 1);
      x += n * step * 1.9;
    }
    out.push({ kind: 'fleet', id: f.id, x, y });
  }
  return out;
}

/** Where a selection sits on the map (map units): a unit's marker, a battle, a region or sea's label. */
function selectionPoint(s: GameState, sel: NonNullable<Selection>, k: number): [number, number] | null {
  if (sel.kind === 'army' || sel.kind === 'fleet') {
    const c = unitPositions(s, k, sel.id).find(u => u.id === sel.id);
    return c ? [c.x, c.y] : null;
  }
  if (sel.kind === 'battle') return s.battles[sel.id] ? regionPoint(s.battles[sel.id].node) : null;
  if (sel.kind === 'region' || sel.kind === 'sea') return regionPoint(sel.id);
  return null;
}

const UnitLayer = memo(function UnitLayer({ cam, w, h, s, selection }: { cam: Camera; w: number; h: number; s: GameState; selection: Selection; version: number }) {
  const { k } = cam;
  const toX = (x: number) => (x - cam.cx) * k + w / 2;
  const toY = (y: number) => (y - cam.cy) * k + h / 2;
  const chips = unitPositions(s, k, selection?.kind === 'army' || selection?.kind === 'fleet' || selection?.kind === 'battle' ? selection.id : undefined);
  const selArmy = selection?.kind === 'army' ? s.armies[selection.id] : undefined;
  const selFleet = selection?.kind === 'fleet' ? s.fleets[selection.id] : undefined;
  // The route runs between the points the token stands on (under the names), not through the names.
  const pathPts = (start: string, path: string[], at: (id: string, k: number) => [number, number]) =>
    [start, ...path]
      .map(id => at(id, k))
      .map(([x, y]) => `${toX(x)},${toY(y)}`)
      .join(' ');
  const inView = (x: number, y: number) => x > -40 && y > -40 && x < w + 40 && y < h + 40;
  const ts = tokenScale(k);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Sieges: a bar under the besiegers' tokens. */}
      {Object.values(s.regions).map(r => {
        if (!r.siege || k < UNITS_K || (k < ALL_UNITS_K && !matters(s, r.siege.by, r.id))) return null;
        const [x, y] = armyAnchor(r.id, k);
        const X = toX(x);
        const Y = toY(y) + 18 * ts;
        if (!inView(X, Y)) return null;
        return (
          <View key={`sg${r.id}`} style={[styles.siege, { left: X - 22, top: Y }]}>
            <View style={[styles.siegeFill, { width: `${Math.min(100, r.siege.progress * 100)}%`, backgroundColor: r.siege.by === REBELS ? '#333' : nationColor(r.siege.by) }]} />
          </View>
        );
      })}
      {(selArmy?.path.length || selFleet?.path.length) ? (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path d={`M${pathPts(selArmy ? selArmy.node : selFleet!.sea, selArmy ? selArmy.path : selFleet!.path, selArmy ? armyAnchor : fleetAnchor).replace(/ /g, ' L')}`} stroke="#fff6d8" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
          <Path d={`M${pathPts(selArmy ? selArmy.node : selFleet!.sea, selArmy ? selArmy.path : selFleet!.path, selArmy ? armyAnchor : fleetAnchor).replace(/ /g, ' L')}`} stroke={C.red} strokeWidth={2} strokeDasharray="6 5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : null}
      {/* Forts: a tower or a castle just before the region's name; then armies and fleets, a pike block or a ship on
          a base in the owner's colour with the count beside it. */}
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        {k >= UNITS_K
          ? MAP.regions.map(r => {
              const level = s.regions[r.id]?.fort ?? 0;
              if (!level || r.labelRadius * k < MIN_NAME_RADIUS || (!s.discovery && isNewWorld(r.id))) return null;
              const fs = nameSize(r.labelRadius, k);
              const pic = level >= 2 ? FORT.castle : FORT.tower;
              const X = toX(r.label[0]) - REGION[r.id].name.length * fs * NAME_EM * 0.5 - pic.size * pic.wide * 0.5 - 2;
              const Y = toY(r.label[1]) + fs * 0.35; // the name's baseline
              if (!inView(X, Y)) return null;
              return <SvgImage key={`f${r.id}`} x={X - pic.size / 2} y={Y - pic.size * pic.feet} width={pic.size} height={pic.size} href={pic.src} />;
            })
          : null}
        {chips.map(c => {
          if (c.kind === 'battle') return null;
          const X = toX(c.x);
          const Y = toY(c.y);
          if (!inView(X, Y)) return null;
          if (c.kind === 'fleet') {
            const f = s.fleets[c.id];
            if (!f) return null;
            return <Token key={c.id} x={X} y={Y} figure="ship" n={f.ships.galley + f.ships.warship + f.ships.transport} color={nationColor(f.owner)} mine={f.owner === s.player} sel={selFleet?.id === f.id} moving={f.path.length > 0} scale={ts} />;
          }
          const a = s.armies[c.id] as Army | undefined;
          if (!a) return null;
          return <Token key={c.id} x={X} y={Y} figure="troop" n={armyRegs(a)} color={a.owner === REBELS ? '#2b2b2b' : nationColor(a.owner)} mine={a.owner === s.player} sel={selArmy?.id === a.id} moving={a.path.length > 0} faded={a.retreating} scale={ts} />;
        })}
      </Svg>
      {chips.map(c => {
        if (c.kind !== 'battle') return null;
        const X = toX(c.x);
        const Y = toY(c.y);
        if (!inView(X, Y)) return null;
        const b = s.battles[c.id];
        if (!b) return null;
        const men = b.sides.map(side => side.armies.reduce((t, id) => t + (s.armies[id] ? armyMen(s.armies[id]) : 0), 0));
        return (
          <View key={c.id} style={[styles.battle, { left: X - 44, top: Y - 13 }]}>
            <Text style={styles.battleText}>⚔ {kmen(men[0])} : {kmen(men[1])}</Text>
          </View>
        );
      })}
    </View>
  );
});

/**
 * What stands on each token: a pike block for an army, a ship for a fleet, rendered from free 3D models
 * (scripts/build-models.mjs, credits in assets/units/CREDITS.md). `feet`: where the figure stands in its picture
 * (a fraction of its height); `size`: how big it is drawn, in points.
 */
const FIGURE = {
  troop: { src: require('../../../assets/units/troop.png'), feet: 182 / 192, size: 36 },
  ship: { src: require('../../../assets/units/ship.png'), feet: 178 / 192, size: 40 },
};
/** A region's fort, beside its name: a lone tower at level 1, a castle from level 2. `wide`: how much of its picture's
 * width the building takes. */
const FORT = {
  tower: { src: require('../../../assets/units/castle-small.png'), feet: 186 / 192, wide: 100 / 192, size: 24 },
  castle: { src: require('../../../assets/units/castle.png'), feet: 181 / 192, wide: 104 / 192, size: 28 },
};
/** A region name's letters' width, as a share of its size (Cinzel capitals, slightly spaced). */
const NAME_EM = 0.68;
const BASE_Y = 6; // the base's centre, below the token's point (points)
const BASE_RX = 14;
const BASE_RY = 5;
/** From the token's point up to the top of the figure (points). */
const TOKEN_TOP = 27;
/** Where a token looks to be, above its point: taps are measured from here (points). */
export const TOKEN_MIDDLE = 8;

/**
 * One army or fleet on the map: the figure standing on a base in its owner's colour, the count on a badge at the
 * base's right (beside it rather than under it, so a token takes no more room than a name). (x, y) is the token's
 * point (screen points). Your own units' bases have a light rim, the selected one a gold one and a glow; a
 * gold dot means it is on the move.
 */
function Token({ x, y, figure, n, color, mine, sel, moving, faded, scale }: { x: number; y: number; figure: keyof typeof FIGURE; n: number; color: string; mine: boolean; sel: boolean; moving: boolean; faded?: boolean; scale: number }) {
  const f = FIGURE[figure];
  const label = `${n}`;
  const pw = 10 + 6.4 * label.length;
  const top = BASE_Y + 1 - f.size * f.feet;
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})${sel ? ' scale(1.12)' : ''}`} opacity={faded ? 0.55 : 1}>
      {sel ? <Ellipse cx={0} cy={BASE_Y + 1} rx={BASE_RX + 7} ry={BASE_RY + 4} fill="rgba(236,208,143,0.35)" stroke="#ecd08f" strokeWidth={1} /> : null}
      {/* The base: a shadow, its side in a darker shade, its top in the owner's colour. */}
      <Ellipse cx={0} cy={BASE_Y + 3.2} rx={BASE_RX + 1} ry={BASE_RY + 1} fill="rgba(0,0,0,0.38)" />
      <Ellipse cx={0} cy={BASE_Y + 2} rx={BASE_RX} ry={BASE_RY} fill={mix(color, '#000000', 0.38)} stroke="rgba(13,16,21,0.85)" strokeWidth={1} />
      <Ellipse cx={0} cy={BASE_Y} rx={BASE_RX} ry={BASE_RY} fill={color} stroke={sel ? '#ecd08f' : mine ? '#fff3d6' : 'rgba(13,16,21,0.85)'} strokeWidth={sel ? 2 : 1.3} />
      <SvgImage x={-f.size / 2} y={top} width={f.size} height={f.size} href={f.src} />
      {moving ? <Circle cx={BASE_RX - 2} cy={-TOKEN_TOP + 8} r={4} fill="#ecd08f" stroke="rgba(13,16,21,0.9)" strokeWidth={1.2} /> : null}
      <Rect x={BASE_RX - 6} y={BASE_Y - 4} width={pw} height={15} rx={7.5} fill="rgba(13,16,21,0.92)" stroke="rgba(214,178,110,0.75)" strokeWidth={1} />
      <SvgText x={BASE_RX - 6 + pw / 2} y={BASE_Y + 7.2} textAnchor="middle" fontSize={11} fontWeight="800" fill="#fffaf0" fontFamily={sans}>
        {label}
      </SvgText>
    </G>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.sea, overflow: 'hidden' },
  battle: { position: 'absolute', width: 88, height: 26, borderRadius: 13, backgroundColor: 'rgba(120,28,20,0.92)', borderWidth: 1.5, borderColor: '#d6b26e', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  battleText: { color: '#fff4dc', fontFamily: sans, fontSize: 12, fontWeight: '800' },
  siege: { position: 'absolute', width: 44, height: 6, borderRadius: 3, backgroundColor: 'rgba(13,16,21,0.7)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(214,178,110,0.8)' },
  siegeFill: { height: '100%' },
});

export { regionAt, seaAt };

// Play-testing hook for the walkthroughs (scripts/screens*.mjs): where a unit's token stands now, in map units.
if (typeof window !== 'undefined') {
  const hook = (window as unknown as { __coe?: Record<string, unknown> }).__coe;
  if (hook) {
    hook.unitPoint = (id: string) => {
      const s = store.state;
      const cam = store.camera;
      if (!s || !cam) return null;
      const c = unitPositions(s, cam.k, store.selection?.id).find(u => u.id === id);
      return c ? [c.x, c.y] : null;
    };
    hook.terrain = () => ({ ...terrainStats });
  }
}
