/**
 * The map's drawn terrain (scripts/build-terrain.ts): mountains, hills, trees, dunes and reeds, placed from real
 * elevation and land colour. The marks are decoded once and bucketed by cell; each cell's marks become one path per
 * layer the first time they are in view (cached), so a redraw only joins the strings of the cells in view. All in
 * map units: the marks grow as you zoom in, and stay sharp.
 */
import { TERRAIN_SYMBOLS } from './terrainSymbols';

/** Drawing order: under the lines go the fills. */
export const LAYERS = ['peak', 'peakShade', 'snow', 'hillShade', 'tree', 'peakLine', 'hatch', 'hillLine', 'treeLine', 'dune', 'reed'] as const;
export type Layer = (typeof LAYERS)[number];
type Paths = Record<Layer, string>;

const CELL = 128; // map units
const COLS = 64; // cells across (the map is 2575 units wide, with room to spare)

let marks: Int16Array | null = null;
let buckets: Map<number, number[]> | null = null;
const built = new Map<number, Paths>();

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decode(s: string): Int16Array {
  const lut = new Uint8Array(128);
  for (let i = 0; i < 64; i++) lut[B64.charCodeAt(i)] = i;
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((s.length / 4) * 3 - pad);
  for (let i = 0, o = 0; i < s.length; i += 4) {
    const n = (lut[s.charCodeAt(i)] << 18) | (lut[s.charCodeAt(i + 1)] << 12) | (lut[s.charCodeAt(i + 2)] << 6) | lut[s.charCodeAt(i + 3)];
    if (o < bytes.length) bytes[o++] = n >> 16;
    if (o < bytes.length) bytes[o++] = (n >> 8) & 255;
    if (o < bytes.length) bytes[o++] = n & 255;
  }
  const view = new DataView(bytes.buffer);
  const out = new Int16Array(bytes.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true); // written little-endian
  return out;
}

function load() {
  if (marks) return;
  marks = decode(TERRAIN_SYMBOLS);
  buckets = new Map();
  for (let i = 0; i < marks.length; i += 4) {
    const key = Math.floor(marks[i + 1] / 10 / CELL) * COLS + Math.floor(marks[i] / 10 / CELL);
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }
}

const n = (v: number) => Math.round(v * 10) / 10;
/** A repeatable 0..1 for a mark, so peaks and woods vary without storing it. */
const vary = (x: number, y: number, salt: number) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

/** One mark, added to the layers' path strings. (x, y) is where it stands; s its size (map units). */
function draw(p: Paths, kind: number, x: number, y: number, s: number) {
  switch (kind) {
    case 0: // a mountain: light face, shaded and hatched right flank, ridge line; snow on the highest
    case 6: {
      const h = s * (0.88 + vary(x, y, 1) * 0.24);
      const w = s * (0.54 + vary(x, y, 2) * 0.14);
      const ax = n(x + s * (vary(x, y, 3) - 0.5) * 0.16);
      const ay = n(y - h);
      const l = `${n(x - w)} ${n(y)}`;
      const lp = `${n(x - s * 0.08)} ${n(y - h * 0.92)}`;
      const rp = `${n(x + s * 0.13)} ${n(y - h * 0.9)}`;
      const r = `${n(x + w * 1.05)} ${n(y)}`;
      const m1 = `${n(x + s * 0.02)} ${n(y - h * 0.72)}`;
      const m2 = `${n(x + s * 0.12)} ${n(y - h * 0.42)}`;
      p.peak += `M${l}L${lp}L${ax} ${ay}L${rp}L${r}Z`;
      p.peakShade += `M${ax} ${ay}L${rp}L${r}L${n(x + s * 0.2)} ${n(y)}L${m2}L${m1}Z`;
      p.peakLine += `M${l}L${lp}L${ax} ${ay}L${rp}L${r}M${ax} ${ay}L${m1}L${m2}`;
      // Hatching down the shaded flank.
      for (const f of [0.3, 0.52, 0.74]) {
        const sx = x + s * (0.03 + 0.09 * f);
        const sy = y - h * (1 - f * 0.9);
        p.hatch += `M${n(sx)} ${n(sy)}l${n(w * 0.42 * (1 - f * 0.4))} ${n(h * 0.24)}`;
      }
      if (kind === 6) p.snow += `M${n(x - s * 0.17)} ${n(y - h * 0.7)}L${lp}L${ax} ${ay}L${rp}L${n(x + s * 0.2)} ${n(y - h * 0.76)}L${n(x + s * 0.06)} ${n(y - h * 0.68)}L${n(x - s * 0.04)} ${n(y - h * 0.78)}Z`;
      break;
    }
    case 1: {
      // a hill: a rounded hump, shaded on the right
      const w = s * 0.55;
      const h = s * 0.32;
      p.hillShade += `M${n(x)} ${n(y - h)}Q${n(x + w * 0.55)} ${n(y - h)} ${n(x + w)} ${n(y)}L${n(x + w * 0.3)} ${n(y)}Q${n(x + w * 0.25)} ${n(y - h * 0.55)} ${n(x)} ${n(y - h)}Z`;
      p.hillLine += `M${n(x - w)} ${n(y)}Q${n(x)} ${n(y - h * 2)} ${n(x + w)} ${n(y)}`;
      break;
    }
    case 2: {
      // broadleaf trees: a little clump of round crowns on short trunks, the front one lower
      const r = s * 0.2;
      for (const [dx, dy] of [
        [-0.24, -0.14],
        [0.22, -0.18],
        [0, 0.04],
      ]) {
        if (vary(x, y, dx * 10) < 0.18) continue; // now and then one is missing
        const tx = x + dx * s;
        const ty = y + dy * s;
        const cy = ty - s * 0.36;
        const crown = `M${n(tx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0`;
        p.tree += crown;
        p.treeLine += `${crown}M${n(tx)} ${n(cy + r)}V${n(ty)}`;
      }
      break;
    }
    case 3: {
      // conifers: two or three narrow cones on short trunks
      for (const [dx, dy, k] of [
        [-0.2, -0.1, 0.85],
        [0.2, -0.06, 0.95],
        [0, 0.08, 1],
      ]) {
        if (k < 0.9 && vary(x, y, dx * 10) < 0.3) continue;
        const tx = x + dx * s;
        const ty = y + dy * s;
        const hh = s * 0.72 * k;
        const cone = `M${n(tx)} ${n(ty - hh)}L${n(tx + s * 0.15)} ${n(ty - s * 0.12)}L${n(tx - s * 0.15)} ${n(ty - s * 0.12)}Z`;
        p.tree += cone;
        p.treeLine += `${cone}M${n(tx)} ${n(ty - s * 0.12)}V${n(ty)}`;
      }
      break;
    }
    case 4: {
      // dunes: two swept ridges
      const w = s * 0.6;
      p.dune += `M${n(x - w)} ${n(y)}Q${n(x - w * 0.15)} ${n(y - w * 0.36)} ${n(x + w * 0.35)} ${n(y - w * 0.1)}M${n(x - w * 0.15)} ${n(y + w * 0.38)}Q${n(x + w * 0.4)} ${n(y + w * 0.1)} ${n(x + w)} ${n(y + w * 0.32)}`;
      break;
    }
    case 5: {
      // reeds over still water
      p.reed += `M${n(x - s * 0.45)} ${n(y)}h${n(s * 0.32)}M${n(x + s * 0.05)} ${n(y)}h${n(s * 0.4)}M${n(x - s * 0.25)} ${n(y + s * 0.22)}h${n(s * 0.5)}M${n(x - s * 0.1)} ${n(y - s * 0.04)}l${n(-s * 0.07)} ${n(-s * 0.34)}M${n(x)} ${n(y - s * 0.04)}v${n(-s * 0.42)}M${n(x + s * 0.1)} ${n(y - s * 0.04)}l${n(s * 0.07)} ${n(-s * 0.34)}`;
      break;
    }
  }
}

function cellPaths(key: number): Paths {
  const hit = built.get(key);
  if (hit) return hit;
  const p = Object.fromEntries(LAYERS.map(l => [l, ''])) as Paths;
  for (const i of buckets!.get(key) ?? []) draw(p, marks![i + 2], marks![i] / 10, marks![i + 1] / 10, marks![i + 3] / 10);
  built.set(key, p);
  return p;
}

/** Every layer's path for the marks in a rectangle of the map (whole cells, so a little more). */
export function terrainPaths(x0: number, y0: number, x1: number, y1: number): Paths {
  load();
  const out = Object.fromEntries(LAYERS.map(l => [l, ''])) as Paths;
  const c0 = Math.max(0, Math.floor(x0 / CELL));
  const c1 = Math.min(COLS - 1, Math.floor(x1 / CELL));
  const r0 = Math.max(0, Math.floor(y0 / CELL));
  const r1 = Math.floor(y1 / CELL);
  // Rows in order, so marks lower on the map are drawn after (over) those above.
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const p = cellPaths(r * COLS + c);
      for (const l of LAYERS) if (p[l]) out[l] += p[l];
    }
  return out;
}
