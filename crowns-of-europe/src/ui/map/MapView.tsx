/**
 * The map: pan with one finger, pinch to zoom, tap to select. While a gesture runs, the last rendered
 * picture is moved with a native transform; when it ends, the SVG re-renders at the new zoom so it stays
 * sharp. Pulling past the edge of the known world (or past the zoom limits) meets resistance and slides back
 * when let go. Units are plain views on top of the SVG.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop, Text as SvgText, TextPath } from 'react-native-svg';
import { MAP, MAP_REGION, MAP_SEA, NATION, NW_WASTELANDS, REGION, RIVERS, SEA_NAMES, WASTELANDS, isNewWorld, nationName } from '../../sim/content';
import { REBELS, armyRegs, armyMen, seesUnit } from '../../sim/queries';
import type { Army, GameState, Region } from '../../sim/types';
import { store, useStore, type MapMode, type Selection } from '../../state/store';
import { C, kmen, sans } from '../theme';
import { WILD, nationColor, regionFills } from './colors';
import { K_MAX, clampCentre, clampView, rubber, rubberZoom } from './camera';
import { COAST_CELLS, FAR_COAST_CELLS, MAP_H, MAP_W, WASTE_BBOX, nationArcs, nationLabels, regionAt, regionPoint, seaAt, type NationArc } from './geometry';
import { BANNER_RISE, FEET_Y, MIN_NAME_RADIUS, PLAY_K, REGION_NAMES_K, TROOP_H, UNITS_K, ZOOM_GROW, armyAnchor, grow, nameSize, tokenScale } from './anchors';
import { GRAIN, LAND_COLOUR, RELIEF, SHADOWS, WATER_LINES } from './reliefTiles';
import { MAP_STYLES, type Ink, type MapStyle, type MapStyleId } from './styles';
import { onMapTap } from './tap';
import { PAINTING } from './paintingTiles';
import { terrainCache, terrainStats } from './terrainCache';
import { SHIP_ART, TROOP_ART, type ShipArt, type TroopArt } from './unitArt';
import { flagBody } from '../components/Flag';
import { decodedBytes, famousMountains, neighbours, pickLevel, tilesToDraw, webZoom } from './terrainLayer';
import { TERRAIN_LEVELS, TERRAIN_REGION, TERRAIN_SEA_SHADE } from './terrainTiles';
import { TERRAIN_LAKES, TERRAIN_RIVERS } from './terrainVectors';
import { mountainsIn, terrainPaths } from './terrain';

export interface Camera {
  cx: number;
  cy: number;
  k: number; // points per map unit
}
const OVER = 1.6; // render this much beyond the screen so short pans never show an empty edge
const SETTLE = { duration: 320, easing: Easing.out(Easing.cubic) };
// A TERRAIN_RIVERS width (points) from which a river is one of the great ones (Danube, Rhine, Po, Vistula...): darker
// ink at every zoom. The same line as SMOOTH_FROM in scripts/terrain/vectors.py.
const GREAT_RIVER = 1;

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

  // A foreign unit you had selected drops out of sight (a war ends, it leaves your land): let go of it, so it isn't
  // drawn or followed any more.
  useEffect(() => {
    const sel = st.selection;
    if (!sel || (sel.kind !== 'army' && sel.kind !== 'fleet')) return;
    const army = sel.kind === 'army' ? s.armies[sel.id] : undefined;
    const fleet = sel.kind === 'fleet' ? s.fleets[sel.id] : undefined;
    const seen = army ? seesUnit(s, s.player, army.owner, army.node, army.rebelOf) : fleet ? seesUnit(s, s.player, fleet.owner, fleet.sea) : true;
    if (!seen) store.select(null);
  }, [st.version, st.selection, s]);
  // Selecting a region, an army or a fleet never moves the map: only your fingers do (or "Show on map").

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
            <Animated.View style={[{ position: 'absolute', left: (size.w - W) / 2, top: (size.h - H) / 2, width: W, height: H }, WEB_LAYER, animStyle]}>
              <StaticLayer cam={cam!} w={W} h={H} mapVersion={st.mapVersion} mode={st.mapMode} selection={st.selection} styleId={st.mapStyle} towns={townKey(s)} />
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

/** On the web, the moving map gets its own compositor layer, so a pan or pinch only moves the picture already drawn
 * instead of repainting the whole SVG every frame (on a phone the native view transform already works that way). */
const WEB_LAYER = Platform.OS === 'web' ? ({ willChange: 'transform' } as object) : null;

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

const StaticLayer = memo(function StaticLayer({ cam, w, h, mapVersion, mode, selection, styleId }: { cam: Camera; w: number; h: number; mapVersion: number; mode: MapMode; selection: Selection; styleId: MapStyleId; towns: string }) {
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
  // Illustrated draws strong borders for close up; zoomed out (many small realms in view) they ease off a little, so
  // they don't become a dark web.
  const easeIn = Math.max(0, Math.min(1, (k - 0.55) / 0.65));
  const borderEase = st.terrain ? 0.72 + 0.28 * easeIn : 1;
  const casingEase = st.terrain ? 0.15 + 0.85 * easeIn : 1;
  // The shore band too: far out only a thin, even line of darker water (no wide band to ring every small island).
  const shoreEase = 0.45 + 0.55 * Math.max(0, Math.min(1, (k - 0.4) / 0.8));
  const shoreWide = Math.max(0, Math.min(1, (k - 0.8) / 0.4));
  // Far out the minor rivers fade, so they never read as a second set of borders; the great ones only a little, so the
  // Danube, Rhine and Vistula still show over the whole of Europe.
  const riverEase = Math.max(0, Math.min(1, (k - 0.5) / 0.7));
  const riverFade = 0.6 + 0.4 * riverEase;
  const greatFade = 0.85 + 0.15 * riverEase;
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
  // Illustrated: the owner's mountain drawings, only over the famous ranges and small (terrainLayer.famousMountains);
  // the lesser ones give way to the region names written at this zoom.
  const peakNames: { x0: number; y0: number; x1: number; y1: number }[] = [];
  if (terrainOn && showRegionNames) {
    for (const r of MAP.regions) {
      if (!visible(r.bbox) || hidden(r.id) || r.labelRadius * k < MIN_NAME_RADIUS) continue;
      const fs = nameSize(r.labelRadius, k);
      const half = (REGION[r.id].name.length * fs * NAME_EM * 0.5 + 3) / k;
      peakNames.push({ x0: r.label[0] - half, y0: r.label[1] - (fs * 0.45 + 3) / k, x1: r.label[0] + half, y1: r.label[1] + (fs * 0.45 + 3) / k });
    }
  }
  const terrainPeaks = terrainOn ? famousMountains(k, { x0: vx, y0: vy, x1: vx + vw, y1: vy + vh }, peakNames) : [];
  // Neighbouring tiles overlap by a hair (0.6 points) so no seam of the layer below shows between them.
  const seam = px(0.6);
  const riverPaths = new Map<string, { wd: number; great: boolean; d: string }>();
  const lakePaths: string[] = [];
  if (terrainOn) {
    const z = webZoom(k, MAP_W / (MAP.projection.east - MAP.projection.west));
    // Rivers thicken a little as you zoom in, up to about play zoom; closer in they stay put so they don't crowd. The
    // great rivers are capped by zoom, so far out and at play zoom they never outweigh the borders between realms (they
    // reach their full width only close up). Their ink comes from their rank, not their capped width, so far out they
    // stay the darker line and the minor ones the lighter.
    const widen = 0.75 + 0.14 * Math.max(0, Math.min(2, z - 4));
    const cap = k <= 1.7 ? 0.9 + 0.25 * Math.max(0, (k - 0.45) / 1.25) : Math.min(1.6, 1.15 + 0.45 * ((k - 1.7) / 1.5));
    for (const r of TERRAIN_RIVERS) {
      if (r.z > z + 0.7 || !visible(r.b)) continue;
      const wd = Math.round(Math.min(r.w, cap) * widen * 100) / 100;
      const great = r.w >= GREAT_RIVER;
      const key = `${great ? 'g' : 'm'}${wd}`;
      const run = riverPaths.get(key);
      if (run) run.d += r.d;
      else riverPaths.set(key, { wd, great, d: r.d });
    }
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
        {(pt || tr) && landD ? (
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
      {/* (Illustrated darkens deep water only, the same shading its tiles are painted with: no seam where they end) */}
      {st.relief > 0 ? <SvgImage x={0} y={0} width={MAP_W} height={MAP_H} href={tr ? TERRAIN_SEA_SHADE[res] : RELIEF.sea[res].src} preserveAspectRatio="none" opacity={st.relief} /> : null}
      {linesAlpha > 0 ? <SvgImage x={0} y={0} width={MAP_W} height={MAP_H} href={WATER_LINES[st.waterLines!.image].src} preserveAspectRatio="none" opacity={linesAlpha} /> : null}
      {/* The illustrated terrain's tiles: coarse ones under the whole drawn area, finer ones over the screen */}
      {terrainTiles.map(t => (
        <SvgImage key={t.key} x={t.x} y={t.y} width={t.w + seam} height={t.h + seam} href={t.src} preserveAspectRatio="none" opacity={t.opacity < 1 ? t.opacity : undefined} />
      ))}
      {/* Illustrated: the water darkens a little along every coast, so the shore stands out from pale land */}
      {tr && coast && landD ? (
        <G clipPath="url(#water)">
          {tr.shore.map((sh, i) =>
            i === 0 && shoreWide <= 0 ? null : (
              <Path key={sh.width} d={coast} fill="none" stroke={sh.color} strokeWidth={px(sh.width * shoreEase)} strokeLinecap="round" strokeLinejoin="round" opacity={i === 0 ? shoreWide : 1} />
            ),
          )}
        </G>
      ) : null}
      {/* Sea zones (where the land is see-through, Painted and Illustrated, cut to the water: they run on under the coast) */}
      <G clipPath={(pt || tr) && landD ? 'url(#water)' : undefined}>
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
      {landD && terrainPeaks.length ? (
        <G clipPath="url(#land)">
          {terrainPeaks.map(p =>
            p.flip ? (
              <G key={`pk${p.key}`} transform={`translate(${2 * p.x + p.w} 0) scale(-1 1)`} opacity={p.opacity}>
                <SvgImage x={p.x} y={p.y} width={p.w} height={p.h} href={p.src} preserveAspectRatio="none" />
              </G>
            ) : (
              <SvgImage key={`pk${p.key}`} x={p.x} y={p.y} width={p.w} height={p.h} href={p.src} preserveAspectRatio="none" opacity={p.opacity} />
            ),
          )}
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
      {lakePaths.length ? <Path d={lakePaths.join('')} fill={tr!.lakeFill} fillRule="evenodd" stroke={tr!.lake} strokeWidth={px(0.55)} strokeLinejoin="round" /> : null}
      {[...riverPaths].map(([key, { wd, great, d }]) => (
        <Path key={`rv${key}`} d={d} fill="none" stroke={great ? tr!.river : tr!.riverMinor} strokeWidth={px(wd)} strokeLinecap="round" strokeLinejoin="round" opacity={great ? greatFade : riverFade} />
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
      {provinceAlpha > 0 && lines.province && st.provinceBorder.halo ? <Path d={lines.province} fill="none" stroke={st.provinceBorder.halo} strokeWidth={px(st.provinceBorder.haloWidth ?? 0)} strokeLinecap="round" strokeLinejoin="round" opacity={provinceAlpha} /> : null}
      {provinceAlpha > 0 && lines.province ? <Path d={lines.province} fill="none" stroke={st.provinceBorder.color} strokeWidth={px(st.provinceBorder.width)} strokeDasharray={dash(st.provinceBorder.dash)} strokeLinecap="round" strokeLinejoin="round" opacity={provinceAlpha} /> : null}
      {/* The rivers armies cross (along borders); where the illustrated terrain draws the real rivers, those stand in for them */}
      {lines.river && st.river.width > 0 && !allTerrain ? (
        <Path d={lines.river} fill="none" stroke={st.river.color} strokeWidth={px(st.river.width)} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} clipPath={terrainOn ? 'url(#tOut)' : undefined} />
      ) : null}
      {st.nationBorder.halo && lines.nation ? <Path d={lines.nation} fill="none" stroke={st.nationBorder.halo} strokeWidth={px(st.nationBorder.haloWidth * borderEase)} strokeLinecap="round" strokeLinejoin="round" opacity={casingEase} /> : null}
      {lines.nation ? <Path d={lines.nation} fill="none" stroke={st.nationBorder.color} strokeWidth={px(st.nationBorder.width * borderEase)} strokeLinecap="round" strokeLinejoin="round" /> : null}
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
      {/* Towns: each region's chief town where it really stands (a village, town or city, walled where there is a
          fort), in every owned region once region names show, even where the region is too small for its name;
          over the land and borders, under the names and the units. */}
      {showRegionNames
        ? MAP.regions.map(r => {
            if (hidden(r.id)) return null;
            const art = townArt(s.regions[r.id]);
            if (!art) return null;
            const pic = TOWN_ART[art];
            const size = px(townSize(pic.size, r.labelRadius, k));
            const x = r.town[0] - (size * pic.ground[0]) / TOWN_PX;
            const y = r.town[1] - (size * pic.ground[1]) / TOWN_PX;
            if (!visible([x, y, x + size, y + size])) return null;
            return <SvgImage key={`t${r.id}`} x={x} y={y} width={size} height={size} href={pic.src} />;
          })
        : null}
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
              <SvgText key={`wl${wl.id}`} x={m.label[0]} y={m.label[1]} fontSize={px(11 * grow(k))} fontFamily={st.font.italic} fill={st.unknown.wasteLabel} textAnchor="middle" letterSpacing={px(0.6)}>
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
              <SvgText key={`sl${sea.id}`} x={MAP_SEA[sea.id].label[0]} y={MAP_SEA[sea.id].label[1] + px(16 * grow(k))} fontSize={px(11 * grow(k))} fontFamily={st.font.italic} fill={st.seaLabel} textAnchor="middle" letterSpacing={px(1)}>
                {SEA_NAMES[sea.id]}
              </SvgText>
            ) : null,
          )
        : null}
      {k >= 1.0 && charted
        ? MAP.lakes.map(l =>
            visible([l.label[0], l.label[1], l.label[0], l.label[1]]) ? (
              <SvgText key={`lk${l.name}`} x={l.label[0]} y={l.label[1] + px(3 * grow(k))} fontSize={px(8.5 * grow(k))} fontFamily={st.font.italic} fill={st.seaLabel} textAnchor="middle">
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
                  {nationName(l.nation).toUpperCase()}
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
    const text = nationName(a.nation).toUpperCase();
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
    const w = (nationName(l.nation).length * fs * (st.nationLabel.em + st.nationLabel.spacing) + 6) / k;
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

export { REGION_NAMES_K, UNITS_K, PLAY_K, ZOOM_GROW, grow, tokenScale, nameSize, armyAnchor };
/** Where a fleet sits in a sea: just above the sea's name. */
const fleetAnchor = (id: string, k: number): [number, number] => {
  const [x, y] = regionPoint(id);
  return [x, y - (16 * tokenScale(k)) / k];
};

/** Where each army/fleet/battle marker sits (map units). Shared with tap hit-testing, so hidden units can't be tapped. */
export function unitPositions(s: GameState, k: number, selected?: string): ChipPos[] {
  const out: ChipPos[] = [];
  const stacks = new Map<string, number>();
  const step = (26 * tokenScale(k)) / k;
  const hidden = (id: string) => k < UNITS_K && id !== selected; // zoomed out: names only
  const sees = (owner: string, where: string, rebelOf?: string) => seesUnit(s, s.player, owner, where, rebelOf);
  for (const b of Object.values(s.battles)) {
    if (hidden(b.id)) continue;
    if (!b.sides.some(side => side.armies.some(id => s.armies[id] && sees(s.armies[id].owner, b.node, s.armies[id].rebelOf)))) continue;
    const [x, y] = regionPoint(b.node);
    out.push({ kind: 'battle', id: b.id, x, y: y - step * 0.9 });
  }
  for (const a of Object.values(s.armies)) {
    if (a.battle || (!s.discovery && isNewWorld(a.node)) || hidden(a.id)) continue;
    if (!sees(a.owner, a.node, a.rebelOf)) continue;
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
    if (!sees(f.owner, f.sea)) continue;
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
        if (!r.siege || k < UNITS_K || !seesUnit(s, s.player, r.siege.by, r.id)) return null;
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
      {/* Armies and fleets: soldiers or a ship under the realm's banner, with the count beside it. (The towns are
          drawn with the map, under the names: StaticLayer.) */}
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <UnitDefs />
        {chips.map(c => {
          if (c.kind === 'battle') return null;
          const X = toX(c.x);
          const Y = toY(c.y);
          if (!inView(X, Y)) return null;
          if (c.kind === 'fleet') {
            const f = s.fleets[c.id];
            if (!f) return null;
            const ships = f.ships.galley + f.ships.warship + f.ships.transport;
            return <Token key={c.id} x={X} y={Y} figure={shipArt(ships)} nation={f.owner} n={ships} mine={f.owner === s.player} sel={selFleet?.id === f.id} moving={f.path.length > 0} scale={ts} />;
          }
          const a = s.armies[c.id] as Army | undefined;
          if (!a) return null;
          const regs = armyRegs(a);
          return <Token key={c.id} x={X} y={Y} figure={troopArt(a.id, regs)} nation={a.owner} n={regs} mine={a.owner === s.player} sel={selArmy?.id === a.id} moving={a.path.length > 0} faded={a.retreating} scale={ts} />;
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
 * What stands on each token: one of the owner's drawings (art/troops, art/ships, made ready by scripts/build-units.ts).
 * An army is a lone soldier when small (one of two, by the army), four men from SQUAD regiments, five from HOST, all
 * TROOP_H points tall at play zoom, standing on the base; a fleet is a lone ship, or several from FLEET ships
 * (SHIP_H points tall), riding a little low on its base.
 */
const SQUAD = 4;
const HOST = 10;
const FLEET = 5;
const SHIP_H: Record<ShipArt, number> = { ship: 34, fleet: 31 };
export const shipArt = (ships: number): ShipArt => (ships >= FLEET ? 'fleet' : 'ship');
export function troopArt(id: string, regs: number): TroopArt {
  if (regs >= HOST) return 'squad-5';
  if (regs >= SQUAD) return 'squad-4';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h & 1 ? 'soldier-b' : 'soldier-a';
}
/**
 * The settlement standing at each region's chief town (MAP_REGION[id].town), rendered by scripts/build-models.mjs: a
 * village, a town or a city by the region's prosperity, inside walls where the region has a fort. `ground`: where the
 * middle of the settlement stands in its 192 px picture (the build prints it), so the place stands on its town's
 * point; `size`: points across at play zoom. A city is drawn bigger than a village, though less than their pictures'
 * own scales would make it, so a city doesn't crowd its neighbours.
 */
const TOWN_ART = {
  village: { src: require('../../../assets/units/town-village.png'), ground: [87.4, 124.5], size: 19 },
  'village-walled': { src: require('../../../assets/units/town-village-walled.png'), ground: [96.3, 139.8], size: 22 },
  town: { src: require('../../../assets/units/town-town.png'), ground: [93.6, 140.5], size: 23 },
  'town-walled': { src: require('../../../assets/units/town-town-walled.png'), ground: [96.2, 140.1], size: 26 },
  city: { src: require('../../../assets/units/town-city.png'), ground: [82.6, 146.9], size: 28 },
  'city-walled': { src: require('../../../assets/units/town-city-walled.png'), ground: [94.6, 137.2], size: 30 },
} as const;
const TOWN_PX = 192; // the pictures' size
/** A town's size on screen (points): its picture's size, growing with the zoom like the names, but no bigger than
 * about the region itself (TOWN_FIT times its label radius), so a small island (the Azores, Madeira, Cyprus) or a
 * narrow coast (Genoa, Constantinople) gets a small mark that leaves its land showing; never under TOWN_MIN. */
const TOWN_FIT = 2.2;
const TOWN_MIN = 10;
export const townSize = (picSize: number, labelRadius: number, k: number) => Math.min(picSize * grow(k), Math.max(TOWN_MIN, labelRadius * k * TOWN_FIT));
/** The prosperity from which a region's chief town is drawn as a town, and as a city (in 1444: about 30% villages,
 * 40% towns and 30% cities among the regions someone owns). */
const TOWN_DEV = 4;
const CITY_DEV = 6;
/** Which settlement a region's town is drawn as; none on land nobody owns. */
export function townArt(r: Region | undefined): keyof typeof TOWN_ART | null {
  if (!r?.owner) return null;
  const size = r.dev >= CITY_DEV ? 'city' : r.dev >= TOWN_DEV ? 'town' : 'village';
  return r.fort >= 1 ? `${size}-walled` : size;
}
/** Every region's settlement in one string: the map's towns are redrawn only when one of them changes. */
const townKey = (s: GameState) => `${s.discovery ? 1 : 0}${MAP.regions.map(r => townArt(s.regions[r.id]) ?? '').join(',')}`;
/** A region name's letters' width, as a share of its size (Cinzel capitals, slightly spaced). */
const NAME_EM = 0.68;
const BADGE_X = 8; // the count badge's left end, right of the token's point (points)
/** The realm's banner over each unit: its flag (as in the headers) on a pole that tops the figure by BANNER_RISE, the
 * cloth BANNER_W wide, waving and cut in a shallow swallowtail, inked like the drawings and a little faded. */
const BANNER_W = 15;
const INK = '#2a1d12';
const BANNER_D = 'M0 0.5C6 -1.2 11 2.2 17 0.6S26 -0.6 30 0.8L26.5 10.4L30 20C25 18.6 21 21.6 15 20.2S5 19 0 20.5Z'; // in the flag's 30 x 20 box
/** Where a token looks to be, above its point (the middle of the figure): taps are measured from here (points). */
export const TOKEN_MIDDLE = 12;

/** The banner's cloth and folds, and the soft shadow and the selection's glow at a figure's feet, defined once in the
 * units' drawing. */
function UnitDefs() {
  return (
    <Defs>
      <RadialGradient id="unitFoot" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#1a1008" stopOpacity={0.5} />
        <Stop offset="0.55" stopColor="#1a1008" stopOpacity={0.24} />
        <Stop offset="1" stopColor="#1a1008" stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id="unitSel" cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#ffe9a8" stopOpacity={0.85} />
        <Stop offset="0.6" stopColor="#ecd08f" stopOpacity={0.45} />
        <Stop offset="1" stopColor="#ecd08f" stopOpacity={0} />
      </RadialGradient>
      <ClipPath id="unitBanner">
        <Path d={BANNER_D} />
      </ClipPath>
      <LinearGradient id="unitBannerFold" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#ffffff" stopOpacity={0.24} />
        <Stop offset="0.3" stopColor="#000000" stopOpacity={0.2} />
        <Stop offset="0.55" stopColor="#ffffff" stopOpacity={0.16} />
        <Stop offset="0.8" stopColor="#000000" stopOpacity={0.24} />
        <Stop offset="1" stopColor="#ffffff" stopOpacity={0.08} />
      </LinearGradient>
    </Defs>
  );
}

/**
 * One army or fleet on the map: the figure under its realm's banner, standing in its own shadow (a soft one at its
 * feet and the one it casts behind it, baked with the figure), the count on a badge at its right (beside it rather
 * than under it, so a token takes no more room than a name). (x, y) is the token's point (screen points). Your own
 * units' badges have a bright gold rim; the selected one stands in a gold glow; a gold dot on its badge means it is on
 * the move.
 */
function Token({ x, y, figure, nation, n, mine, sel, moving, faded, scale }: { x: number; y: number; figure: TroopArt | ShipArt; nation: string; n: number; mine: boolean; sel: boolean; moving: boolean; faded?: boolean; scale: number }) {
  const label = `${n}`;
  const pw = 10 + 6.4 * label.length;
  let fig: { src: number; x: number; y: number; w: number; h: number };
  let shadow: { src: number; x: number; y: number; w: number; h: number };
  let poleX: number;
  let poleFoot: number;
  if (figure === 'ship' || figure === 'fleet') {
    // A ship rides a little low; the banner flies from the tallest mast's top.
    const art = SHIP_ART[figure];
    const h = SHIP_H[figure];
    const w = (h * art.w) / art.h;
    fig = { src: art.src, x: -w / 2, y: FEET_Y + 2 - h, w, h };
    shadow = art.shadow;
    poleX = fig.x + art.mast * w;
    poleFoot = fig.y + 4;
  } else {
    const art = TROOP_ART[figure];
    const w = (TROOP_H * art.w) / art.h;
    fig = { src: art.src, x: -w / 2, y: FEET_Y - TROOP_H, w, h: TROOP_H };
    shadow = art.shadow;
    poleX = Math.max(3.5, w * 0.28);
    poleFoot = FEET_Y - 2;
  }
  const px = fig.h / (figure === 'ship' || figure === 'fleet' ? SHIP_ART[figure].h : TROOP_ART[figure].h); // points per picture pixel
  const poleTop = fig.y - BANNER_RISE;
  const footW = Math.max(18, fig.w * 0.9);
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})${sel ? ' scale(1.12)' : ''}`} opacity={faded ? 0.55 : 1}>
      {sel ? <Ellipse cx={0} cy={fig.y + fig.h} rx={footW * 0.5 + 8} ry={8} fill="url(#unitSel)" /> : null}
      {/* Its shadows: the one it casts behind it, then a soft one where it stands. */}
      <SvgImage x={fig.x + shadow.x * px} y={fig.y + shadow.y * px} width={shadow.w * px} height={shadow.h * px} href={shadow.src} preserveAspectRatio="none" />
      <Ellipse cx={1.5} cy={fig.y + fig.h - 0.5} rx={footW * 0.5} ry={3.6} fill="url(#unitFoot)" />
      {/* The banner's pole, behind the figure, with its spearhead. */}
      <Path d={`M${poleX} ${poleFoot}V${poleTop}`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <Path d={`M${poleX} ${poleFoot - 0.6}V${poleTop + 0.4}`} stroke="#8b6a43" strokeWidth={1.1} strokeLinecap="round" />
      <Path d={`M${poleX} ${poleTop - 3.6}l1.5 2.6l-1.5 1.3l-1.5-1.3Z`} fill="#c9b27a" stroke={INK} strokeWidth={0.7} strokeLinejoin="round" />
      <SvgImage x={fig.x} y={fig.y} width={fig.w} height={fig.h} href={fig.src} preserveAspectRatio="none" />
      {/* The cloth, flying to the right from the pole's top. */}
      <G transform={`translate(${poleX} ${poleTop + 0.6}) scale(${BANNER_W / 30})`}>
        <G clipPath="url(#unitBanner)">
          {flagBody(nation)}
          <Rect width={30} height={21} fill="#7a5530" opacity={0.14} />
          <Rect width={30} height={21} fill="url(#unitBannerFold)" />
        </G>
        <Path d={BANNER_D} fill="none" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      </G>
      <Rect x={BADGE_X} y={FEET_Y - 5} width={pw} height={15} rx={7.5} fill="rgba(13,16,21,0.92)" stroke={mine ? '#ecd08f' : 'rgba(214,178,110,0.55)'} strokeWidth={mine ? 1.5 : 1} />
      <SvgText x={BADGE_X + pw / 2} y={FEET_Y + 6.2} textAnchor="middle" fontSize={11} fontWeight="800" fill="#fffaf0" fontFamily={sans}>
        {label}
      </SvgText>
      {moving ? <Circle cx={BADGE_X} cy={FEET_Y - 5} r={3.6} fill="#ecd08f" stroke="rgba(13,16,21,0.9)" strokeWidth={1.2} /> : null}
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
    // The styles themselves, so a measurement script can switch one layer off and compare (screens-terrain.mjs).
    hook.styles = MAP_STYLES;
  }
}
