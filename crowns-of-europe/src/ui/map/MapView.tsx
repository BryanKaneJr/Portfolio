/**
 * The map: pan with one finger, pinch to zoom, tap to select. While a gesture runs, the last rendered
 * picture is moved with a native transform; when it ends, the SVG re-renders at the new zoom so it stays
 * sharp. Units are plain views on top of the SVG.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, G, Line, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { MAP, MAP_REGION, MAP_SEA, NATION, REGION, SEA, WASTELANDS } from '../../sim/content';
import { REBELS, armyRegs, armyMen } from '../../sim/queries';
import type { Army, GameState } from '../../sim/types';
import { store, useStore, type MapMode, type Selection } from '../../state/store';
import { C, kmen, sans, serif } from '../theme';
import { nationColor, regionFills } from './colors';
import { MAP_H, MAP_W, nationLabels, regionAt, regionPoint, seaAt } from './geometry';
import { onMapTap } from './tap';

export interface Camera {
  cx: number;
  cy: number;
  k: number; // points per map unit
}
const OVER = 1.6; // render this much beyond the screen so short pans never show an empty edge
const K_MAX = 7;

export function MapView() {
  const st = useStore();
  const s = st.state!;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Camera | null>(null);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);
  const startT = useSharedValue({ x: 0, y: 0, s: 1, fx: 0, fy: 0 });

  const kMin = size.w ? Math.min(size.w / MAP_W, size.h / MAP_H) * 0.95 : 0.3;
  const clampCam = useCallback(
    (c: Camera): Camera => {
      const k = Math.max(kMin, Math.min(K_MAX, c.k));
      // Keep the screen over the map: when zoomed in, the edges of the map stop the pan.
      const halfW = size.w / 2 / k;
      const halfH = size.h / 2 / k;
      const cx = halfW * 2 >= MAP_W ? MAP_W / 2 : Math.max(halfW, Math.min(MAP_W - halfW, c.cx));
      const cy = halfH * 2 >= MAP_H ? MAP_H / 2 : Math.max(halfH, Math.min(MAP_H - halfH, c.cy));
      return { k, cx, cy };
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

  // Focus requests from elsewhere in the UI ("go to army").
  const focusSeq = useRef(0);
  useEffect(() => {
    const f = st.focus;
    if (f && f.seq !== focusSeq.current && cam) {
      focusSeq.current = f.seq;
      setCam(clampCam({ cx: f.x, cy: f.y, k: f.zoom ? size.w / f.zoom : Math.max(cam.k, size.w / 420) }));
    }
  });

  const commit = useCallback(
    (t0x: number, t0y: number, s0: number) => {
      setCam(prev => (prev ? clampCam({ cx: prev.cx - t0x / (s0 * prev.k), cy: prev.cy - t0y / (s0 * prev.k), k: prev.k * s0 }) : prev));
    },
    [clampCam],
  );
  // After the re-render at the new camera, drop the temporary transform.
  useLayoutEffect(() => {
    tx.value = 0;
    ty.value = 0;
    sc.value = 1;
  }, [cam]);

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
  const pan = Gesture.Pan()
    .minDistance(6)
    .averageTouches(true)
    .onStart(() => {
      startT.value = { x: tx.value, y: ty.value, s: sc.value, fx: 0, fy: 0 };
    })
    .onUpdate(e => {
      tx.value = startT.value.x + e.translationX;
      ty.value = startT.value.y + e.translationY;
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, sc.value);
    });
  const pinch = Gesture.Pinch()
    .onStart(e => {
      startT.value = { x: tx.value, y: ty.value, s: sc.value, fx: e.focalX - half.w, fy: e.focalY - half.h };
    })
    .onUpdate(e => {
      const g = e.scale;
      const fx = e.focalX - half.w;
      const fy = e.focalY - half.h;
      sc.value = startT.value.s * g;
      tx.value = fx - g * (startT.value.fx - startT.value.x);
      ty.value = fy - g * (startT.value.fy - startT.value.y);
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, sc.value);
    });
  const tap = Gesture.Tap()
    .maxDuration(300)
    .maxDistance(10)
    .onEnd((e, ok) => {
      if (ok) runOnJS(handleTap)(e.x, e.y);
    });
  const gesture = Gesture.Race(Gesture.Simultaneous(pan, pinch), tap);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }],
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
    <View ref={wrapRef} style={styles.wrap} onLayout={onLayout} testID="map">
      {ready ? (
        <GestureDetector gesture={gesture}>
          <View style={StyleSheet.absoluteFill} collapsable={false}>
            <Animated.View style={[{ position: 'absolute', left: (size.w - W) / 2, top: (size.h - H) / 2, width: W, height: H }, animStyle]}>
              <StaticLayer cam={cam!} w={W} h={H} mapVersion={st.mapVersion} mode={st.mapMode} selection={st.selection} />
              <UnitLayer cam={cam!} w={W} h={H} s={s} selection={st.selection} version={st.version} />
            </Animated.View>
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- static layer (land, borders, labels)

const StaticLayer = memo(function StaticLayer({ cam, w, h, mapVersion, mode, selection }: { cam: Camera; w: number; h: number; mapVersion: number; mode: MapMode; selection: Selection }) {
  const s = store.state!;
  const { k } = cam;
  const vx = cam.cx - w / 2 / k;
  const vy = cam.cy - h / 2 / k;
  const vw = w / k;
  const vh = h / k;
  const visible = (b: number[]) => b[2] >= vx && b[0] <= vx + vw && b[3] >= vy && b[1] <= vy + vh;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fills = useMemo(() => regionFills(s, mode), [mapVersion, mode]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const labels = useMemo(() => nationLabels(s), [mapVersion]);
  const px = (n: number) => n / k; // screen points → map units
  const showRegionNames = k >= 1.15;
  const selRegion = selection?.kind === 'region' ? selection.id : null;
  const selSea = selection?.kind === 'sea' ? selection.id : null;
  const selNation = selection?.kind === 'nation' ? selection.id : null;
  const occupiers = [...new Set(Object.values(s.regions).filter(r => r.controller !== r.owner).map(r => r.controller))];
  const stripe = px(7);

  return (
    <Svg width={w} height={h} viewBox={`${vx} ${vy} ${vw} ${vh}`} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="waste" patternUnits="userSpaceOnUse" width={px(6)} height={px(6)}>
          <Rect width={px(6)} height={px(6)} fill={C.waste} />
          <Line x1={0} y1={px(6)} x2={px(6)} y2={0} stroke="#a89c7c" strokeWidth={px(0.8)} />
        </Pattern>
        {occupiers.map(o => (
          <Pattern key={o} id={`occ_${o}`} patternUnits="userSpaceOnUse" width={stripe} height={stripe}>
            <Path d={`M0 ${stripe} L${stripe} 0 M${-stripe / 2} ${stripe / 2} L${stripe / 2} ${-stripe / 2} M${stripe / 2} ${stripe * 1.5} L${stripe * 1.5} ${stripe / 2}`} stroke={o === REBELS ? '#222' : nationColor(o)} strokeWidth={stripe * 0.32} />
          </Pattern>
        ))}
      </Defs>
      <Rect x={vx} y={vy} width={vw} height={vh} fill={C.sea} />
      {MAP.seas.map(sea =>
        visible(sea.bbox) ? (
          <Path key={sea.id} d={sea.path} fill={sea.id === selSea ? 'rgba(255,255,255,0.22)' : 'none'} stroke="rgba(255,255,255,0.45)" strokeWidth={px(1)} strokeDasharray={`${px(4)} ${px(4)}`} />
        ) : null,
      )}
      {MAP.wastelands.map(wl => (
        <Path key={wl.id} d={wl.path} fill="url(#waste)" stroke="#9c8f6f" strokeWidth={px(0.6)} />
      ))}
      {MAP.regions.map(r =>
        visible(r.bbox) ? <Path key={r.id} d={r.path} fill={fills[r.id]} stroke="rgba(42,33,24,0.38)" strokeWidth={px(0.7)} strokeLinejoin="round" /> : null,
      )}
      {mode === 'political' || mode === 'diplomatic'
        ? MAP.regions.map(r => {
            const reg = s.regions[r.id];
            return reg.controller !== reg.owner && visible(r.bbox) ? <Path key={`o${r.id}`} d={r.path} fill={`url(#occ_${reg.controller})`} /> : null;
          })
        : null}
      {MAP.borders.map(b => {
        const oa = s.regions[b.a].owner;
        const ob = s.regions[b.b].owner;
        return oa !== ob ? <Path key={`${b.a}|${b.b}`} d={b.path} fill="none" stroke="rgba(30,22,14,0.85)" strokeWidth={px(1.5)} strokeLinecap="round" strokeLinejoin="round" /> : null;
      })}
      <Path d={MAP.coast} fill="none" stroke={C.coast} strokeWidth={px(0.9)} strokeLinejoin="round" />
      {selNation
        ? MAP.regions.map(r => (s.regions[r.id].owner === selNation ? <Path key={`n${r.id}`} d={r.path} fill="rgba(255,255,255,0.18)" stroke={C.gold} strokeWidth={px(1.6)} /> : null))
        : null}
      {selRegion ? <Path d={MAP_REGION[selRegion].path} fill="rgba(255,255,255,0.25)" stroke="#fff6d8" strokeWidth={px(2.6)} strokeLinejoin="round" /> : null}
      {selRegion ? <Path d={MAP_REGION[selRegion].path} fill="none" stroke={C.goldDark} strokeWidth={px(1.2)} strokeLinejoin="round" /> : null}
      {WASTELANDS.map(wl => {
        const m = MAP.wastelands.find(x => x.id === wl.id);
        if (!m || !visible([m.label[0], m.label[1], m.label[0], m.label[1]])) return null;
        return (
          <SvgText key={`wl${wl.id}`} x={m.label[0]} y={m.label[1]} fontSize={px(11)} fontStyle="italic" fontFamily={serif} fill="#6f6448" textAnchor="middle">
            {wl.name}
          </SvgText>
        );
      })}
      {k >= 0.9
        ? MAP.seas.map(sea =>
            visible(sea.bbox) ? (
              <SvgText key={`sl${sea.id}`} x={MAP_SEA[sea.id].label[0]} y={MAP_SEA[sea.id].label[1] + px(16)} fontSize={px(10)} fontStyle="italic" fontFamily={serif} fill="#4d6f80" textAnchor="middle" opacity={0.85}>
                {SEA[sea.id].name}
              </SvgText>
            ) : null,
          )
        : null}
      {showRegionNames
        ? MAP.regions.map(r => {
            if (!visible(r.bbox)) return null;
            const screen = r.labelRadius * k;
            if (screen < 13) return null;
            const fs = Math.max(9, Math.min(14, screen * 0.42));
            const name = REGION[r.id].name;
            return (
              <G key={`l${r.id}`}>
                <SvgText x={r.label[0]} y={r.label[1] + px(fs * 0.35)} fontSize={px(fs)} fontFamily={serif} textAnchor="middle" stroke="rgba(243,234,211,0.85)" strokeWidth={px(2.4)} fill="none">
                  {name}
                </SvgText>
                <SvgText x={r.label[0]} y={r.label[1] + px(fs * 0.35)} fontSize={px(fs)} fontFamily={serif} textAnchor="middle" fill="#2a2118">
                  {name}
                </SvgText>
              </G>
            );
          })
        : placeLabels(labels, k).map(l => {
            const def = NATION[l.nation];
            if (!def) return null;
            const fs = l.fs;
            if (!visible([l.x, l.y, l.x, l.y])) return null;
            const text = def.name.toUpperCase();
            return (
              <G key={`nl${l.nation}`}>
                <SvgText x={l.x} y={l.y} fontSize={px(fs)} fontFamily={serif} fontWeight="700" letterSpacing={px(fs * 0.12)} textAnchor="middle" stroke="rgba(243,234,211,0.75)" strokeWidth={px(2.6)} fill="none">
                  {text}
                </SvgText>
                <SvgText x={l.x} y={l.y} fontSize={px(fs)} fontFamily={serif} fontWeight="700" letterSpacing={px(fs * 0.12)} textAnchor="middle" fill="#2a2118">
                  {text}
                </SvgText>
              </G>
            );
          })}
    </Svg>
  );
});

/** Biggest nations first; skip a name that would overlap one already placed. */
function placeLabels(labels: ReturnType<typeof nationLabels>, k: number) {
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const out: ((typeof labels)[number] & { fs: number })[] = [];
  for (const l of [...labels].sort((a, b) => b.area - a.area)) {
    const def = NATION[l.nation];
    if (!def) continue;
    const fs = Math.max(8, Math.min(18, l.size * k * 0.8));
    if (l.size * k < 7) continue;
    const w = (def.name.length * fs * 0.78 + 6) / k;
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

/** Where each army/fleet/battle marker sits (map units). Shared with tap hit-testing. */
export function unitPositions(s: GameState, k: number): ChipPos[] {
  const out: ChipPos[] = [];
  const stacks = new Map<string, number>();
  const step = 26 / k;
  for (const b of Object.values(s.battles)) {
    const [x, y] = regionPoint(b.node);
    out.push({ kind: 'battle', id: b.id, x, y: y - step * 0.9 });
  }
  for (const a of Object.values(s.armies)) {
    if (a.battle) continue;
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
  const chips = unitPositions(s, k);
  const selArmy = selection?.kind === 'army' ? s.armies[selection.id] : undefined;
  const selFleet = selection?.kind === 'fleet' ? s.fleets[selection.id] : undefined;
  const pathPts = (start: string, path: string[]) => [start, ...path].map(regionPoint).map(([x, y]) => `${toX(x)},${toY(y)}`).join(' ');
  const inView = (x: number, y: number) => x > -40 && y > -40 && x < w + 40 && y < h + 40;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Sieges */}
      {Object.values(s.regions).map(r => {
        if (!r.siege) return null;
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
