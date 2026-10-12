/**
 * Builds the map's drawn terrain: little peaks along the real mountain ranges, rounded hills, trees where the real
 * forests are (broadleaf, or conifers in the north and up high), dunes in the deserts and reeds in the marshes, as
 * on a hand-drawn map. Where each goes comes from real data, loosely: elevation and how rugged the land around is
 * (Terrain Tiles on AWS Open Data) for mountains and hills, the colour of the land from space (NASA's Blue Marble) for
 * forest and desert, and the regions' own terrain for marshes. Placement is jittered on a grid with a fixed seed,
 * so a rebuild gives the same map.
 *
 * Output: src/ui/map/terrainSymbols.ts, every symbol as four 16-bit numbers (x and y in tenths of a map unit, kind,
 * size in tenths), base64. The renderer turns them into one path per kind for the part of the map in view (vector,
 * so sharp at any zoom). Run after `npm run relief:build` (it shares its cache):  npm run terrain:build
 */
import fs from 'node:fs';
import path from 'node:path';
import { BM_Z, H, ROOT, W, elevation, fetchArea, fetchBlueMarbleArea, landMask, latOf, lonOf, map, natural, parseRings } from './lib/geo';

const OUT = path.join(ROOT, 'src/ui/map/terrainSymbols.ts');
const REGIONS: { id: string; terrain: string }[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/regions.json'), 'utf8'));
const TERRAIN = new Map(REGIONS.map(r => [r.id, r.terrain]));

/** Symbol kinds, as the renderer (MapView) knows them. */
export const KIND = { mountain: 0, hill: 1, broadleaf: 2, conifer: 3, dune: 4, marsh: 5, snowy: 6 } as const;

// ---------------------------------------------------------------- grids: which region, elevation, ruggedness
const F = 0.5; // grid cells per map unit
const cols = Math.ceil(W * F);
const rows = Math.ceil(H * F);
const cellOf = (x: number, y: number) => Math.min(rows - 1, Math.max(0, Math.floor(y * F))) * cols + Math.min(cols - 1, Math.max(0, Math.floor(x * F)));

/** Each grid cell's region (index into map.regions), or -1 off the regions (sea, wastes, the lands beyond). */
function regionGrid(): Int16Array {
  const grid = new Int16Array(cols * rows).fill(-1);
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
  const e = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const lat = latOf((r + 0.5) / F);
    for (let c = 0; c < cols; c++) e[r * cols + c] = elevation(5, lonOf((c + 0.5) / F), lat);
  }
  return e;
}

/** Highest minus lowest ground within `radius` map units: how rugged the land around is (metres). */
function ruggedness(e: Float32Array, radius: number): Float32Array {
  const rr = Math.round(radius * F);
  const pass = (src: Float32Array, horizontal: boolean, pick: (a: number, b: number) => number) => {
    const out = new Float32Array(src.length);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        let v = src[r * cols + c];
        for (let d = -rr; d <= rr; d++) {
          const cc = horizontal ? c + d : c;
          const rw = horizontal ? r : r + d;
          if (cc < 0 || rw < 0 || cc >= cols || rw >= rows) continue;
          v = pick(v, src[rw * cols + cc]);
        }
        out[r * cols + c] = v;
      }
    return out;
  };
  const hi = pass(pass(e, true, Math.max), false, Math.max);
  const lo = pass(pass(e, true, Math.min), false, Math.min);
  return hi.map((v, i) => v - lo[i]);
}

// ---------------------------------------------------------------- placement
/** A repeatable hash of a grid cell, 0..1. */
function hash(i: number, j: number, seed: number): number {
  let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

async function main() {
  await fetchArea(5, 0, 0, W, H);
  await fetchBlueMarbleArea(BM_Z, 0, 0, W, H);
  console.log('grids...');
  const region = regionGrid();
  const elev = elevationGrid();
  const rugged = ruggedness(elev, 8);
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
  /** Walk a jittered grid of the given spacing, calling `place` at each point on a region. */
  const scatter = (spacing: number, seed: number, place: (x: number, y: number, ri: number, e: number, rug: number, u: number) => void) => {
    for (let j = 0; j * spacing < H; j++)
      for (let i = 0; i * spacing < W; i++) {
        const x = (i + 0.15 + 0.7 * hash(i, j, seed)) * spacing;
        const y = (j + 0.15 + 0.7 * hash(j, i, seed + 7)) * spacing;
        if (x >= W || y >= H) continue;
        const cell = cellOf(x, y);
        const ri = region[cell];
        if (ri < 0 || nearName(x, y, ri)) continue;
        place(x, y, ri, elev[cell], rugged[cell], hash(i, j, seed + 13));
      }
  };
  // Measured at known places: real ranges are rugged (over ~1,150 m between high and low ground within 8 map units,
  // or very high, or high and fairly rugged, as in Norway); uplands (Massif Central, Black Forest, Ardennes, the
  // Appalachians) are hills; high flat plateaus (the Meseta, central Anatolia) are only lightly hilly.
  const isMountain = (e: number, rug: number) => e >= 1900 || (e >= 700 && rug >= 1150) || (e >= 1400 && rug >= 900);
  const isHill = (e: number, rug: number) => !isMountain(e, rug) && e >= 200 && rug >= 350;

  // Mountains, bigger the higher; snow on the highest.
  scatter(7, 1, (x, y, _ri, e, rug, u) => {
    if (!isMountain(e, rug) || u > 0.92) return;
    add(x, y, e >= 2500 ? 'snowy' : 'mountain', 6 + clamp01((e - 700) / 2400) * 5);
  });
  // Hills.
  scatter(8, 2, (x, y, _ri, e, rug, u) => {
    if (!isHill(e, rug) || u > 0.35 + 0.55 * clamp01((rug - 350) / 600)) return; // the more rugged, the more hills
    add(x, y, 'hill', 5 + u * 1.2);
  });
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
  const b64 = Buffer.from(packed.buffer).toString('base64');
  fs.writeFileSync(
    OUT,
    `/**
 * The map's drawn terrain: ${n} marks (${Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ')}). Each is four 16-bit numbers: x and y in tenths of a map unit, kind (0 mountain, 1 hill,
 * 2 broadleaf tree, 3 conifer, 4 dune, 5 reeds, 6 snowy mountain) and size in tenths, from the top of the map down.
 * Generated by scripts/build-terrain.ts (npm run terrain:build): do not edit by hand.
 */
export const TERRAIN_SYMBOLS = '${b64}';
`,
  );
  console.log(`${n} marks, ${JSON.stringify(counts)} → ${path.relative(ROOT, OUT)} (${Math.round(b64.length / 1024)} KB)`);
}

main();
