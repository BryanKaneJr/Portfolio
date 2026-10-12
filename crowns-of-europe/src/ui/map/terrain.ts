/**
 * The map's drawn terrain (scripts/build-terrain.ts): mountain ranges as shapes traced from the real ground (each
 * range's wash, its snow, its lit and shaded slopes, its ridges), and hills, trees, dunes and reeds as small marks.
 * Decoded once; each shape's path is made the first time it is in view, and the marks' a cell at a time (cached),
 * so a redraw only joins the strings of what is in view. All in map units: the drawing grows as you zoom in, and
 * stays sharp.
 */
import { TERRAIN_SHAPES, TERRAIN_SYMBOLS } from './terrainSymbols';

/** Drawing order: under the lines go the fills. */
export const LAYERS = ['upLight', 'upShade', 'wash', 'snow', 'light', 'shade', 'tree', 'ridgeMinor', 'ridge', 'treeLine', 'dune', 'reed'] as const;
export type Layer = (typeof LAYERS)[number];
type Paths = Record<Layer, string>;

/** The shapes' layers, in the order build-terrain numbers them. */
const SHAPE_LAYERS: Layer[] = ['wash', 'snow', 'light', 'shade', 'ridge', 'ridgeMinor', 'upLight', 'upShade'];

/** From this zoom (screen points per map unit) in, the lesser ridges are drawn too. */
export const DETAIL_K = 2.6;

const CELL = 128; // map units
const COLS = 64; // cells across (the map is 2575 units wide, with room to spare)
const REACH = 8; // how far a mark's drawing can reach from where it stands (map units)

interface Shape {
  layer: Layer;
  detail: boolean; // only drawn close up
  closed: boolean;
  at: number; // byte offset of its first point
  count: number;
  box: [number, number, number, number];
  d?: string;
}

let marks: Int16Array | null = null;
let bytes: Uint8Array | null = null;
let shapes: Shape[] | null = null;
let buckets: Map<number, number[]> | null = null;
const built = new Map<number, Paths>();

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decode(s: string): Uint8Array {
  const lut = new Uint8Array(128);
  for (let i = 0; i < 64; i++) lut[B64.charCodeAt(i)] = i;
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  for (let i = 0, o = 0; i < s.length; i += 4) {
    const v = (lut[s.charCodeAt(i)] << 18) | (lut[s.charCodeAt(i + 1)] << 12) | (lut[s.charCodeAt(i + 2)] << 6) | lut[s.charCodeAt(i + 3)];
    if (o < out.length) out[o++] = v >> 16;
    if (o < out.length) out[o++] = (v >> 8) & 255;
    if (o < out.length) out[o++] = v & 255;
  }
  return out;
}
/** A 16-bit number written little-endian. */
const i16 = (b: Uint8Array, o: number) => ((b[o] | (b[o + 1] << 8)) << 16) >> 16;

function load() {
  if (buckets) return;
  const mb = decode(TERRAIN_SYMBOLS);
  marks = new Int16Array(mb.length / 2);
  for (let i = 0; i < marks.length; i++) marks[i] = i16(mb, i * 2);
  buckets = new Map();
  for (let i = 0; i < marks.length; i += 4) {
    const key = Math.floor(marks[i + 1] / 10 / CELL) * COLS + Math.floor(marks[i] / 10 / CELL);
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }
  bytes = decode(TERRAIN_SHAPES);
  shapes = [];
  for (let o = 0; o < bytes.length; ) {
    const count = bytes[o + 2] | (bytes[o + 3] << 8);
    const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let k = 0, q = o + 4; k < count; k++, q += 4) {
      const x = i16(bytes, q) / 10;
      const y = i16(bytes, q + 2) / 10;
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
    shapes.push({ layer: SHAPE_LAYERS[bytes[o]], detail: (bytes[o + 1] & 1) !== 0, closed: (bytes[o + 1] & 2) !== 0, at: o + 4, count, box });
    o += 4 + count * 4;
  }
}

function shapePath(sh: Shape): string {
  if (sh.d !== undefined) return sh.d;
  const b = bytes!;
  let d = '';
  for (let k = 0, q = sh.at; k < sh.count; k++, q += 4) d += `${k ? 'L' : 'M'}${i16(b, q) / 10} ${i16(b, q + 2) / 10}`;
  return (sh.d = sh.closed ? `${d}Z` : d);
}

const n = (v: number) => Math.round(v * 10) / 10;
const pt = (x: number, y: number) => `${n(x)} ${n(y)}`;
/** A repeatable 0..1 for a mark, so woods vary without storing it. */
const vary = (x: number, y: number, salt: number) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

/** One mark, added to the layers' path strings. (x, y) is where it stands; s its size (map units). */
function drawMark(p: Paths, kind: number, x: number, y: number, s: number) {
  switch (kind) {
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
        const crown = `M${pt(tx - r, cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0`;
        p.tree += crown;
        p.treeLine += `${crown}M${pt(tx, cy + r)}V${n(ty)}`;
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
        const cone = `M${pt(tx, ty - hh)}L${pt(tx + s * 0.15, ty - s * 0.12)}L${pt(tx - s * 0.15, ty - s * 0.12)}Z`;
        p.tree += cone;
        p.treeLine += `${cone}M${pt(tx, ty - s * 0.12)}V${n(ty)}`;
      }
      break;
    }
    case 4: {
      // dunes: two swept ridges
      const w = s * 0.6;
      p.dune += `M${pt(x - w, y)}Q${pt(x - w * 0.15, y - w * 0.36)} ${pt(x + w * 0.35, y - w * 0.1)}M${pt(x - w * 0.15, y + w * 0.38)}Q${pt(x + w * 0.4, y + w * 0.1)} ${pt(x + w, y + w * 0.32)}`;
      break;
    }
    case 5: {
      // reeds over still water
      p.reed += `M${pt(x - s * 0.45, y)}h${n(s * 0.32)}M${pt(x + s * 0.05, y)}h${n(s * 0.4)}M${pt(x - s * 0.25, y + s * 0.22)}h${n(s * 0.5)}M${pt(x - s * 0.1, y - s * 0.04)}l${pt(-s * 0.07, -s * 0.34)}M${pt(x, y - s * 0.04)}v${n(-s * 0.42)}M${pt(x + s * 0.1, y - s * 0.04)}l${pt(s * 0.07, -s * 0.34)}`;
      break;
    }
  }
}

function cellPaths(key: number): Paths {
  const hit = built.get(key);
  if (hit) return hit;
  const p = Object.fromEntries(LAYERS.map(l => [l, ''])) as Paths;
  for (const i of buckets!.get(key) ?? []) drawMark(p, marks![i + 2], marks![i] / 10, marks![i + 1] / 10, marks![i + 3] / 10);
  built.set(key, p);
  return p;
}

/** Every layer's path for the drawing in a rectangle of the map (a little more), at zoom k. */
export function terrainPaths(x0: number, y0: number, x1: number, y1: number, k: number): Paths {
  load();
  const out = Object.fromEntries(LAYERS.map(l => [l, ''])) as Paths;
  for (const sh of shapes!) {
    if (sh.box[0] > x1 || sh.box[2] < x0 || sh.box[1] > y1 || sh.box[3] < y0 || (sh.detail && k < DETAIL_K)) continue;
    out[sh.layer] += shapePath(sh);
  }
  const c0 = Math.max(0, Math.floor((x0 - REACH) / CELL));
  const c1 = Math.min(COLS - 1, Math.floor((x1 + REACH) / CELL));
  const r0 = Math.max(0, Math.floor((y0 - REACH) / CELL));
  const r1 = Math.floor((y1 + REACH) / CELL);
  // Rows in order, so marks lower on the map are drawn after (over) those above.
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const p = cellPaths(r * COLS + c);
      for (const l of LAYERS) if (p[l]) out[l] += p[l];
    }
  return out;
}
