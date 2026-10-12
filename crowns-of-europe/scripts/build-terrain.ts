/**
 * Builds the map's drawn terrain from real data, as on a hand-drawn map: the mountain ranges washed, their slopes lit
 * and shaded, their ridgelines inked; the uplands lightly lit and shaded; trees where the real forests are
 * (broadleaf, or conifers in the north and up high), dunes in the deserts and reeds in the marshes. Elevation and how
 * rugged the land around is come from the Terrain Tiles on AWS Open Data, the colour of the land from space from
 * NASA's Blue Marble, the marshes from the regions' own terrain. Everything random is hashed from a fixed seed, so a
 * rebuild gives the same map.
 *
 * Mountains: the mountainous land, grown a little way over the rugged land joined to it, is gathered into ranges and
 * traced round (the wash); within them, the ground the sun lights and the ground in shadow (lit from the upper left,
 * the relief steepened so it shows) and the snow are traced too. The ridgelines are where river basins meet: rain is
 * run downhill over all the land to the sea, and where the basins of two valleys meet inside a range, and the ground
 * stands up above what is round it, there is a ridge (the great ones between great valleys, drawn from further out).
 *
 * Output: src/ui/map/terrainSymbols.ts, base64 both:
 *  - TERRAIN_SYMBOLS, the small marks: four 16-bit numbers each (x and y in tenths of a map unit, kind, size in
 *    tenths), from the top of the map down;
 *  - TERRAIN_SHAPES, the traced shapes and lines: per shape its layer, flags and point count, then the points.
 * The renderer (ui/map/terrain.ts) draws them as paths, so they stay sharp at any zoom. Run after
 * `npm run relief:build` (it shares its cache):  npm run terrain:build
 */
import fs from 'node:fs';
import path from 'node:path';
import { BM_Z, H, RAD, ROOT, W, elevation, fetchArea, fetchBlueMarbleArea, landMask, latOf, lonOf, map, natural, parseRings, unitsPerDegree } from './lib/geo';

const OUT = path.join(ROOT, 'src/ui/map/terrainSymbols.ts');
const REGIONS: { id: string; terrain: string }[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/regions.json'), 'utf8'));
const TERRAIN = new Map(REGIONS.map(r => [r.id, r.terrain]));

/** Mark kinds, as the renderer knows them. */
export const KIND = { broadleaf: 2, conifer: 3, dune: 4, marsh: 5 } as const;

// ---------------------------------------------------------------- grids: which region, elevation, ruggedness
const F = 1; // grid cells per map unit
const cols = Math.ceil(W * F);
const rows = Math.ceil(H * F);
const N = cols * rows;
const cellOf = (x: number, y: number) => Math.min(rows - 1, Math.max(0, Math.floor(y * F))) * cols + Math.min(cols - 1, Math.max(0, Math.floor(x * F)));

/** Each grid cell's region (index into map.regions), or -1 off the regions (sea, wastes, the lands beyond). */
function regionGrid(): Int16Array {
  const grid = new Int16Array(N).fill(-1);
  map.regions.forEach((r: { path: string; bbox: number[] }, i: number) => {
    const [x0, y0, x1, y1] = r.bbox;
    const c0 = Math.max(0, Math.floor(x0 * F));
    const r0 = Math.max(0, Math.floor(y0 * F));
    const cw = Math.min(cols, Math.ceil(x1 * F) + 1) - c0;
    const rh = Math.min(rows, Math.ceil(y1 * F) + 1) - r0;
    const mask = landMask(c0 / F, r0 / F, cw, rh, F, parseRings(r.path));
    for (let rr = 0; rr < rh; rr++) for (let cc = 0; cc < cw; cc++) if (mask[rr * cw + cc]) grid[(r0 + rr) * cols + c0 + cc] = i;
  });
  return grid;
}

function elevationGrid(): Float32Array {
  const e = new Float32Array(N);
  for (let r = 0; r < rows; r++) {
    const lat = latOf((r + 0.5) / F);
    for (let c = 0; c < cols; c++) e[r * cols + c] = elevation(5, lonOf((c + 0.5) / F), lat);
  }
  return e;
}

/** The highest (or lowest) value within `radius` cells, a square around each. */
function extreme(src: Float32Array, radius: number, pick: (a: number, b: number) => number): Float32Array {
  const pass = (from: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(N);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        let v = from[r * cols + c];
        for (let d = -radius; d <= radius; d++) {
          const cc = horizontal ? c + d : c;
          const rw = horizontal ? r : r + d;
          if (cc < 0 || rw < 0 || cc >= cols || rw >= rows) continue;
          v = pick(v, from[rw * cols + cc]);
        }
        out[r * cols + c] = v;
      }
    return out;
  };
  return pass(pass(src, true), false);
}

/** A box blur of `radius` cells. */
function blur(src: Float32Array, radius: number): Float32Array {
  const pass = (from: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(N);
    const len = horizontal ? cols : rows;
    for (let line = 0; line < (horizontal ? rows : cols); line++) {
      const at = (k: number) => (horizontal ? line * cols + k : k * cols + line);
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += from[at(Math.max(0, Math.min(len - 1, k)))];
      for (let k = 0; k < len; k++) {
        out[at(k)] = sum / (2 * radius + 1);
        sum += from[at(Math.min(len - 1, k + radius + 1))] - from[at(Math.max(0, k - radius))];
      }
    }
    return out;
  };
  return pass(pass(src, true), false);
}

// ---------------------------------------------------------------- randomness
/** A repeatable hash of a grid cell, 0..1. */
function hash(i: number, j: number, seed: number): number {
  let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---------------------------------------------------------------- mountain ranges
// Measured at known places: real ranges are rugged (over ~1,150 m between high and low ground within 8 map units,
// or very high, or high and fairly rugged, as in Norway); uplands (Massif Central, Black Forest, Ardennes, the
// Appalachians) are hills; high flat plateaus (the Meseta, central Anatolia) are only lightly hilly.
const isMountain = (e: number, rug: number) => e >= 1900 || (e >= 700 && rug >= 1150) || (e >= 1400 && rug >= 900);
const isHill = (e: number, rug: number) => !isMountain(e, rug) && e >= 200 && rug >= 350;

const MIN_RANGE = 60; // square map units: smaller patches of mountain are left out

/** Rugged enough to carry a range on from its heart (the Bavarian Alps, the eastern Carpathians), not to start one. */
const isFoothill = (e: number, rug: number) => e >= 600 && rug >= 800;
const GROW = 10; // map units a range may grow out over its foothills

/**
 * The mountainous land, gathered into ranges: the mountains, grown out over the rugged land joined to them; small gaps
 * closed, specks and small patches dropped. Returned as a field, positive inside, with a soft edge to trace round.
 */
function rangeField(region: Int16Array, elev: Float32Array, rugged: Float32Array): Float32Array {
  let m: Float32Array = new Float32Array(N);
  let grow: number[] = [];
  for (let i = 0; i < N; i++)
    if (region[i] >= 0 && isMountain(elev[i], rugged[i])) {
      m[i] = 1;
      grow.push(i);
    }
  // Out over the foothills, but not far: on a high plateau (Spain's) that would run on and on.
  for (let step = 0; step < GROW * F && grow.length; step++) {
    const next: number[] = [];
    for (const i of grow)
      for (const j of [i - cols, i + cols, i - 1, i + 1])
        if (j >= 0 && j < N && !m[j] && region[j] >= 0 && isFoothill(elev[j], rugged[j])) {
          m[j] = 1;
          next.push(j);
        }
    grow = next;
  }
  m = extreme(extreme(m, 2, Math.max), 2, Math.min); // close
  m = extreme(extreme(m, 1, Math.min), 1, Math.max); // open
  m = blur(blur(m, 2), 2);
  const mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (m[i] >= 0.5 && region[i] >= 0) mask[i] = 1;
  // Pieces: drop the small ones; fill small holes.
  const pieces = (want: 0 | 1, visit: (cells: number[], touchesEdge: boolean) => void) => {
    const seen = new Uint8Array(N);
    const stack: number[] = [];
    for (let s = 0; s < N; s++) {
      if (seen[s] || mask[s] !== want) continue;
      const cells: number[] = [];
      let edge = false;
      seen[s] = 1;
      stack.push(s);
      while (stack.length) {
        const i = stack.pop()!;
        cells.push(i);
        const r = (i / cols) | 0;
        const c = i - r * cols;
        if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) edge = true;
        for (const j of [r > 0 ? i - cols : -1, r < rows - 1 ? i + cols : -1, c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1])
          if (j >= 0 && !seen[j] && mask[j] === want) {
            seen[j] = 1;
            stack.push(j);
          }
      }
      visit(cells, edge);
    }
  };
  pieces(1, cells => {
    if (cells.length < MIN_RANGE * F * F) for (const i of cells) mask[i] = 0;
  });
  pieces(0, (cells, edge) => {
    if (!edge && cells.length < 300 * F * F) for (const i of cells) mask[i] = 1;
  });
  const field = blur(Float32Array.from(mask), 1);
  for (let i = 0; i < N; i++) field[i] -= 0.5;
  return field;
}

// ---------------------------------------------------------------- the light on the land
const EXAGGERATE = 8; // the relief is drawn steeper than it is, or at this scale it would hardly show
const SUN = 45 * RAD; // above the horizon, from the upper left (north-west), as maps are lit

/** How much sunlight each cell's ground catches (0..1; flat ground ~0.71). */
function sunlight(e: Float32Array): Float32Array {
  const out = new Float32Array(N).fill(Math.sin(SUN));
  const lx = -Math.cos(SUN) / Math.SQRT2;
  const ly = -Math.cos(SUN) / Math.SQRT2;
  const lz = Math.sin(SUN);
  for (let r = 1; r < rows - 1; r++) {
    const metres = (111320 * Math.cos(latOf((r + 0.5) / F) * RAD)) / unitsPerDegree / F; // one cell, east to west
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      const gx = ((e[i + 1] - e[i - 1]) / (2 * metres)) * EXAGGERATE;
      const gy = ((e[i + cols] - e[i - cols]) / (2 * metres)) * EXAGGERATE;
      out[i] = Math.max(0, (-gx * lx - gy * ly + lz) / Math.hypot(gx, gy, 1));
    }
  }
  return out;
}

// ---------------------------------------------------------------- tracing shapes
type Pt = [number, number];

/**
 * The outlines of where `field` is positive (marching squares, the crossings placed between cell centres by the
 * values), as closed rings in map units, all wound the same way round what they enclose, so a hole winds the other
 * way. Rings enclosing less than `minArea` square map units are dropped, and every ring is simplified to `tol`.
 */
function contours(field: Float32Array, minArea: number, tol: number): Pt[][] {
  const v = (r: number, c: number) => (r < 0 || c < 0 || r >= rows || c >= cols ? -1 : field[r * cols + c]);
  const points = new Map<number, Pt>();
  const next = new Map<number, number>();
  // Edge ids: the edge from cell (r, c) to its right neighbour is 2·id, to the one below 2·id + 1 (id = r·(cols+2) + c, shifted by one to allow −1).
  const H = (r: number, c: number) => ((r + 1) * (cols + 2) + (c + 1)) * 2;
  const V = (r: number, c: number) => ((r + 1) * (cols + 2) + (c + 1)) * 2 + 1;
  const cross = (id: number, ra: number, ca: number, rb: number, cb: number) => {
    if (!points.has(id)) {
      const a = v(ra, ca);
      const b = v(rb, cb);
      const t = a / (a - b);
      points.set(id, [(ca + 0.5 + (cb - ca) * t) / F, (ra + 0.5 + (rb - ra) * t) / F]);
    }
    return id;
  };
  for (let r = -1; r < rows; r++)
    for (let c = -1; c < cols; c++) {
      const tl = v(r, c) > 0 ? 1 : 0;
      const tr = v(r, c + 1) > 0 ? 1 : 0;
      const br = v(r + 1, c + 1) > 0 ? 1 : 0;
      const bl = v(r + 1, c) > 0 ? 1 : 0;
      const code = tl * 8 + tr * 4 + br * 2 + bl;
      if (code === 0 || code === 15) continue;
      const T = () => cross(H(r, c), r, c, r, c + 1);
      const B = () => cross(H(r + 1, c), r + 1, c, r + 1, c + 1);
      const L = () => cross(V(r, c), r, c, r + 1, c);
      const R = () => cross(V(r, c + 1), r, c + 1, r + 1, c + 1);
      // Each piece of outline runs with the inside on its left (as seen on the map, y down).
      const seg = (a: number, b: number) => next.set(a, b);
      const centre = (v(r, c) + v(r, c + 1) + v(r + 1, c + 1) + v(r + 1, c)) / 4 > 0;
      switch (code) {
        case 1: seg(B(), L()); break;
        case 2: seg(R(), B()); break;
        case 3: seg(R(), L()); break;
        case 4: seg(T(), R()); break;
        case 5: if (centre) { seg(T(), L()); seg(B(), R()); } else { seg(T(), R()); seg(B(), L()); } break;
        case 6: seg(T(), B()); break;
        case 7: seg(T(), L()); break;
        case 8: seg(L(), T()); break;
        case 9: seg(B(), T()); break;
        case 10: if (centre) { seg(L(), B()); seg(R(), T()); } else { seg(L(), T()); seg(R(), B()); } break;
        case 11: seg(R(), T()); break;
        case 12: seg(L(), R()); break;
        case 13: seg(B(), R()); break;
        case 14: seg(L(), B()); break;
      }
    }
  const rings: Pt[][] = [];
  const done = new Set<number>();
  for (const start of next.keys()) {
    if (done.has(start)) continue;
    const ring: Pt[] = [];
    for (let id = start; !done.has(id); id = next.get(id)!) {
      done.add(id);
      ring.push(points.get(id)!);
      if (!next.has(id)) break;
    }
    if (Math.abs(area(ring)) < minArea) continue;
    const simple = simplify(ring, tol);
    if (simple.length >= 3) rings.push(simple);
  }
  return rings;
}

const area = (ring: Pt[]) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
};

/** Douglas–Peucker: drop the points that stray less than `tol` from the line through their neighbours kept. */
function simplify(pts: Pt[], tol: number, closed = true): Pt[] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  const run = (a: number, b: number) => {
    let far = -1;
    let best = tol;
    const [ax, ay] = pts[a];
    const dx = pts[b][0] - ax;
    const dy = pts[b][1] - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > best) {
        best = d;
        far = i;
      }
    }
    if (far < 0) return;
    keep[far] = 1;
    run(a, far);
    run(far, b);
  };
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  if (closed) {
    // Split the ring at the point farthest from its first.
    let far = 1;
    for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i;
    keep[far] = 1;
    run(0, far);
    run(far, pts.length - 1);
  } else run(0, pts.length - 1);
  return pts.filter((_, i) => keep[i]);
}

// ---------------------------------------------------------------- ridges
const STREAM_MAJOR = 900; // cells draining into a stream for its valley to count among a range's great ones
const STREAM_MINOR = 90; // ... among the lesser ones (whose ridges are drawn close up)
const COAST_STRETCH = 30; // cells of coast whose little streams count as one basin (six times as many, for the great ridges)
const CREST = 30; // metres a ridge must stand above the ground round it (the mean within a few map units)

/** A min-heap of cells keyed by height. */
class Heap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, key: number) {
    let i = this.ids.length;
    this.ids.push(id);
    this.keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.keys[p] <= key) break;
      this.ids[i] = this.ids[p];
      this.keys[i] = this.keys[p];
      i = p;
    }
    this.ids[i] = id;
    this.keys[i] = key;
  }
  pop(): number {
    const top = this.ids[0];
    const id = this.ids.pop()!;
    const key = this.keys.pop()!;
    if (this.ids.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= this.ids.length) break;
        if (c + 1 < this.ids.length && this.keys[c + 1] < this.keys[c]) c++;
        if (this.keys[c] >= key) break;
        this.ids[i] = this.ids[c];
        this.keys[i] = this.keys[c];
        i = c;
      }
      this.ids[i] = id;
      this.keys[i] = key;
    }
    return top;
  }
}

const STEPS = [-cols - 1, -cols, -cols + 1, -1, 1, cols - 1, cols, cols + 1];

/**
 * The ridges, from the real ground, as the lines between river basins: rain is run downhill over the ranges (hollows
 * filled, so it always finds a way out), the valleys it gathers into are found, and each valley joining a greater
 * one is given its own basin. Where two basins meet runs a ridge: the main crest between the great valleys, the
 * spurs between their side valleys, which come down to where the valleys join.
 */
function ridgeLines(e: Float32Array, range: Float32Array): { pts: Pt[]; major: boolean }[] {
  // All the land, so each range's waters run to their real seas: the Pyrenees' crest is where the Garonne's basin
  // meets the Ebro's. (The map's edge counts as sea.)
  const land = landMask(0, 0, cols, rows, F);
  for (let c = 0; c < cols; c++) land[c] = land[(rows - 1) * cols + c] = 0;
  for (let r = 0; r < rows; r++) land[r * cols] = land[r * cols + cols - 1] = 0;
  // Fill and route: from the coasts inward, lowest first; each cell drains to the one it was reached from.
  const heap = new Heap();
  const down = new Int32Array(N).fill(-1);
  const state = new Uint8Array(N);
  const fill = new Float32Array(N);
  const coast: number[] = [];
  for (let i = cols; i < N - cols; i++) {
    if (!land[i] || !STEPS.some(d => !land[i + d])) continue;
    state[i] = 2; // a mouth
    fill[i] = e[i];
    heap.push(i, e[i]);
    coast.push(i);
  }
  const order: number[] = [];
  while (heap.size) {
    const c = heap.pop();
    order.push(c);
    for (const d of STEPS) {
      const j = c + d;
      if (state[j] || !land[j]) continue;
      state[j] = 1;
      fill[j] = Math.max(e[j], fill[c] + 0.01);
      down[j] = c;
      heap.push(j, fill[j]);
    }
  }
  // Off the flats, rain takes the steepest way down (the fill only routes it across hollows and level ground).
  for (const c of order) {
    if (state[c] === 2) continue;
    let best = 0;
    for (let k = 0; k < 8; k++) {
      const j = c + STEPS[k];
      if (!state[j]) continue;
      const drop = (fill[c] - fill[j]) / (k === 0 || k === 2 || k === 5 || k === 7 ? Math.SQRT2 : 1);
      if (drop > best) {
        best = drop;
        down[c] = j;
      }
    }
  }
  // The coast in stretches: the little streams reaching the sea along one stretch count as one basin.
  const stretch = new Int32Array(N);
  let stretches = 0;
  for (const s of coast) {
    if (stretch[s]) continue;
    let id = ++stretches;
    let n = 0;
    const queue = [s];
    stretch[s] = id;
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q];
      if (++n % COAST_STRETCH === 0) id = ++stretches;
      stretch[c] = id;
      for (const d of STEPS)
        if (state[c + d] === 2 && !stretch[c + d]) {
          stretch[c + d] = id;
          queue.push(c + d);
        }
    }
  }
  const acc = new Float32Array(N);
  for (let k = order.length - 1; k >= 0; k--) {
    const c = order[k];
    acc[c] += 1;
    if (down[c] >= 0) acc[down[c]] += acc[c];
  }
  // Each cell's greatest inflow: a stream carries on up it; any other stream joining there has a basin of its own.
  const main = new Int32Array(N).fill(-1);
  for (const c of order) {
    const d = down[c];
    if (d >= 0 && (main[d] < 0 || acc[c] > acc[main[d]])) main[d] = c;
  }
  const basins = (stream: number, coastal: number) => {
    const basin = new Int32Array(N).fill(-1);
    let next = stretches + 1;
    for (const c of order) {
      const d = down[c];
      if (d < 0) basin[c] = acc[c] >= stream ? next++ : 1 + Math.floor(stretch[c] / coastal);
      else if (acc[c] >= stream && main[d] !== c) basin[c] = next++;
      else basin[c] = basin[d];
    }
    return basin;
  };
  const great = basins(STREAM_MAJOR, 6);
  const lesser = basins(STREAM_MINOR, 1);
  // Only where the ground stands up above what is round it: where it is level the line is no ridge, only where the
  // rain happens to part.
  const around = blur(blur(e, 3), 3);
  const crest = (i: number) => e[i] - around[i] > CREST;
  return [
    ...boundaryLines(great, range, null, crest).map(pts => ({ pts, major: true })),
    ...boundaryLines(lesser, range, great, crest).map(pts => ({ pts, major: false })),
  ];
}

/**
 * The lines between basins inside the ranges, along the cells' edges, joined up and smoothed. With `apart`, not where
 * those basins differ too (there a greater ridge runs).
 */
function boundaryLines(basin: Int32Array, range: Float32Array, apart: Int32Array | null, crest: (i: number) => boolean): Pt[][] {
  const V = cols + 1; // corners across
  const adj = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    for (const [p, q] of [
      [a, b],
      [b, a],
    ]) {
      const l = adj.get(p);
      if (l) l.push(q);
      else adj.set(p, [q]);
    }
  };
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      if (range[i] <= 0) continue;
      const pairs: [number, number, number][] = [
        [i + 1, r * V + c + 1, (r + 1) * V + c + 1],
        [i + cols, (r + 1) * V + c, (r + 1) * V + c + 1],
      ];
      for (const [j, va, vb] of pairs) {
        if (range[j] <= 0 || basin[i] === basin[j] || basin[i] <= 0 || basin[j] <= 0) continue;
        if ((apart && apart[i] !== apart[j]) || !(crest(i) || crest(j))) continue;
        link(va, vb);
      }
    }
  const used = new Set<number>();
  const key = (a: number, b: number) => Math.min(a, b) * V * (rows + 1) + Math.max(a, b);
  const chains: number[][] = [];
  const walk = (from: number, to: number) => {
    const chain = [from, to];
    used.add(key(from, to));
    let prev = from;
    let cur = to;
    while (adj.get(cur)!.length === 2) {
      const nx = adj.get(cur)!.find(q => q !== prev)!;
      if (used.has(key(cur, nx))) break;
      used.add(key(cur, nx));
      chain.push(nx);
      prev = cur;
      cur = nx;
    }
    chains.push(chain);
  };
  for (const [v, ns] of adj) if (ns.length !== 2) for (const w of ns) if (!used.has(key(v, w))) walk(v, w);
  for (const [v, ns] of adj) if (!used.has(key(v, ns[0]))) walk(v, ns[0]); // loops
  return chains
    .filter(ch => ch.length >= 4 || (adj.get(ch[0])!.length >= 3 && adj.get(ch[ch.length - 1])!.length >= 3))
    .map(ch => {
      const raw: Pt[] = ch.map(v => [(v % V) / F, Math.floor(v / V) / F]);
      const sm = raw.map((p, k): Pt => {
        const w = Math.min(3, k, raw.length - 1 - k);
        let sx = 0;
        let sy = 0;
        for (let d = -w; d <= w; d++) {
          sx += raw[k + d][0];
          sy += raw[k + d][1];
        }
        return [sx / (2 * w + 1), sy / (2 * w + 1)];
      });
      return simplify(sm, 0.12, false);
    });
}

// ---------------------------------------------------------------- packing shapes
/** Shape layers, as the renderer (ui/map/terrain.ts SHAPE_LAYERS) knows them. */
const SHAPE_LAYERS = ['wash', 'snow', 'light', 'shade', 'ridge', 'ridgeMinor', 'upLight', 'upShade'] as const;
const DETAIL = 1; // a shape only drawn close up
const CLOSED = 2;

class Shapes {
  bytes: number[] = [];
  count: Record<string, number> = {};
  add(layer: (typeof SHAPE_LAYERS)[number], pts: Pt[], flags: number) {
    // Long lines go in pieces of up to 200 points (each piece is kept or skipped whole by where it lies).
    if (!(flags & CLOSED) && pts.length > 200) {
      for (let a = 0; a < pts.length - 1; a += 199) this.add(layer, pts.slice(a, a + 200), flags);
      return;
    }
    const i16 = (v: number) => {
      const u = Math.round(v) & 0xffff;
      this.bytes.push(u & 255, u >> 8);
    };
    this.bytes.push(SHAPE_LAYERS.indexOf(layer), flags);
    i16(pts.length);
    for (const [x, y] of pts) {
      i16(x * 10);
      i16(y * 10);
    }
    this.count[layer] = (this.count[layer] ?? 0) + 1;
  }
}

/** The mountains: each range's outline, its snow, the lit and shaded ground in it, its ridges. */
function mountains(region: Int16Array, elev: Float32Array, rugged: Float32Array): { shapes: Shapes; range: Float32Array } {
  const range = rangeField(region, elev, rugged);
  const smooth = blur(blur(elev, 1), 1);
  const sun = blur(sunlight(smooth), 1);
  const out = new Shapes();
  for (const ring of contours(range, 4, 0.25)) out.add('wash', ring, CLOSED);
  const within = (f: (i: number) => number) => {
    const g = new Float32Array(N);
    for (let i = 0; i < N; i++) g[i] = Math.min(range[i] * 2, f(i));
    return g;
  };
  for (const ring of contours(within(i => (smooth[i] - SNOW_LINE) / 400), 2, 0.2)) out.add('snow', ring, CLOSED);
  for (const ring of contours(within(i => (sun[i] - LIT) * 4), 1.5, 0.2)) out.add('light', ring, CLOSED);
  for (const ring of contours(within(i => (SHADE - sun[i]) * 4), 1.5, 0.2)) out.add('shade', ring, CLOSED);
  for (const l of ridgeLines(smooth, range)) out.add(l.major ? 'ridge' : 'ridgeMinor', l.pts, l.major ? 0 : DETAIL);
  // The uplands, rugged but no mountains (the Massif Central, the hills round Bohemia): their light and shade only.
  let up: Float32Array = new Float32Array(N);
  for (let i = 0; i < N; i++) if (region[i] >= 0 && range[i] <= 0 && isHill(elev[i], rugged[i])) up[i] = 1;
  up = blur(blur(up, 2), 2);
  const upland = (f: (i: number) => number) => {
    const g = new Float32Array(N);
    for (let i = 0; i < N; i++) g[i] = Math.min((up[i] - 0.35) * 2, -range[i] * 2, f(i));
    return g;
  };
  for (const ring of contours(upland(i => (sun[i] - LIT) * 4), 2, 0.25)) out.add('upLight', ring, CLOSED);
  for (const ring of contours(upland(i => (SHADE - sun[i]) * 4), 2, 0.25)) out.add('upShade', ring, CLOSED);
  return { shapes: out, range };
}
const SNOW_LINE = 2300; // metres (the ground smoothed a little)
const LIT = 0.84; // sunlight above which ground is drawn lit
const SHADE = 0.52; // ... below which, shaded

// ---------------------------------------------------------------- the build
async function main() {
  await fetchArea(5, 0, 0, W, H);
  await fetchBlueMarbleArea(BM_Z, 0, 0, W, H);
  console.log('grids...');
  const region = regionGrid();
  const elev = elevationGrid();
  const rugged = (() => {
    const hi = extreme(elev, 8, Math.max);
    const lo = extreme(elev, 8, Math.min);
    return hi.map((v, i) => v - lo[i]);
  })();

  console.log('mountains...');
  const { shapes, range } = mountains(region, elev, rugged);

  console.log('marks...');
  const out: number[] = [];
  const counts: Record<string, number> = {};
  const add = (x: number, y: number, kind: keyof typeof KIND, size: number) => {
    out.push(Math.round(x * 10), Math.round(y * 10), KIND[kind], Math.round(size * 10));
    counts[kind] = (counts[kind] ?? 0) + 1;
  };
  // Keep each region's name clear: nothing right where it is written.
  const nearName = (x: number, y: number, ri: number) => {
    const r = map.regions[ri];
    const dx = (x - r.label[0]) / Math.max(10, r.labelRadius * 0.9);
    const dy = (y - r.label[1]) / 6;
    return dx * dx + dy * dy < 1;
  };
  /** Walk a jittered grid of the given spacing, calling `place` at each point on a region and off the ranges. */
  const scatter = (spacing: number, seed: number, place: (x: number, y: number, ri: number, e: number, rug: number, u: number) => void) => {
    for (let j = 0; j * spacing < H; j++)
      for (let i = 0; i * spacing < W; i++) {
        const x = (i + 0.15 + 0.7 * hash(i, j, seed)) * spacing;
        const y = (j + 0.15 + 0.7 * hash(j, i, seed + 7)) * spacing;
        if (x >= W || y >= H) continue;
        const cell = cellOf(x, y);
        const ri = region[cell];
        if (ri < 0 || range[cell] > -0.45 || range[cellOf(x, y + 3)] > -0.45 || nearName(x, y, ri)) continue;
        place(x, y, ri, elev[cell], rugged[cell], hash(i, j, seed + 13));
      }
  };

  // Forests: dark green land from space; conifers in the north and up high.
  scatter(5.5, 3, (x, y, ri, e, rug, u) => {
    if (isMountain(e, rug) || TERRAIN.get(map.regions[ri].id) === 'marsh') return;
    const lat = latOf(y);
    const [r, g, b] = natural(BM_Z, lonOf(x), lat);
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    const green = g - r;
    let p = clamp01((0.17 - lum) / 0.05) * clamp01((green - 0.018) / 0.02);
    if (lat < 14) p = lum < 0.34 && green > 0.03 ? 0.8 : 0; // the rainforest of the Guinea coast
    if (isHill(e, rug)) p *= 0.5; // woods thin out on the hills, which have their own marks
    if (u > p) return;
    add(x, y, lat >= 55 || e >= 900 ? 'conifer' : 'broadleaf', 4.6 + hash(Math.round(x), Math.round(y), 5) * 1.0);
  });
  // Deserts: pale tan land from space, in the south.
  scatter(10, 4, (x, y, _ri, e, rug, u) => {
    if (isMountain(e, rug) || e > 1200) return;
    const lat = latOf(y);
    if (lat >= 36) return;
    const [r, g, b] = natural(BM_Z, lonOf(x), lat);
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    if (lum < 0.5 || g - r > -0.06 || u > 0.75) return;
    add(x, y, 'dune', 6 + u * 1.5);
  });
  // Marshes: the regions whose terrain is marsh.
  scatter(6, 5, (x, y, ri, e, rug, u) => {
    if (TERRAIN.get(map.regions[ri].id) !== 'marsh' || isMountain(e, rug) || u > 0.55) return;
    add(x, y, 'marsh', 4 + u);
  });

  // Draw from the top of the map down, so nearer (lower) marks are drawn over farther ones.
  const n = out.length / 4;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => out[a * 4 + 1] - out[b * 4 + 1]);
  const packed = new Int16Array(n * 4);
  order.forEach((src, i) => packed.set(out.slice(src * 4, src * 4 + 4), i * 4));
  const marks = Buffer.from(packed.buffer).toString('base64');
  const shapeB64 = Buffer.from(Uint8Array.from(shapes.bytes)).toString('base64');
  const shapeCounts = Object.entries(shapes.count)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');
  fs.writeFileSync(
    OUT,
    `/**
 * The map's drawn terrain. Generated by scripts/build-terrain.ts (npm run terrain:build): do not edit by hand.
 *
 * TERRAIN_SYMBOLS: ${n} marks (${Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ')}), each four 16-bit numbers: x and y in tenths of a map unit, kind
 * (2 broadleaf tree, 3 conifer, 4 dune, 5 reeds) and size in tenths, from the top of the map down.
 * TERRAIN_SHAPES: the mountains (${shapeCounts}). Per shape: its layer (${SHAPE_LAYERS.map((l, i) => `${i} ${l}`).join(', ')}),
 * flags (1 drawn only close up, 2 closed), the number of points (16-bit), then each point's x and y (16-bit, tenths).
 */
export const TERRAIN_SYMBOLS = '${marks}';
export const TERRAIN_SHAPES = '${shapeB64}';
`,
  );
  console.log(`${n} marks, ${JSON.stringify(counts)}; shapes ${shapeCounts} → ${path.relative(ROOT, OUT)} (${Math.round((marks.length + shapeB64.length) / 1024)} KB)`);
}

main();
