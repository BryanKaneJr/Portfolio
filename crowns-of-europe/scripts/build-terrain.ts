/**
 * Builds the map's drawn terrain from real data: the mountain ranges, drawn with the owner's ink drawings
 * (art/mountains); trees where the real forests are (broadleaf, or conifers in the north and up high), dunes in the
 * deserts and reeds in the marshes. Elevation and how rugged the land around is come from the Terrain Tiles on AWS
 * Open Data, the colour of the land from space from NASA's Blue Marble, the marshes from the regions' own terrain.
 * Everything random is hashed from a fixed seed, so a rebuild gives the same map.
 *
 * Mountains: the mountainous land, grown a little way over the rugged land joined to it, is gathered into ranges;
 * the drawings are laid over them, widest stretch first, each picked to run the way the range runs there (mirrored if
 * need be) and sized to how wide it is. The drawings are made ready for the map in assets/map/mountains: cut to what
 * is drawn, made smaller, the ink made to darken the land under it so the country's colour shows through.
 *
 * Output: src/ui/map/terrainSymbols.ts (the drawings and where they go; the small marks, base64) and
 * assets/map/mountains. The renderer is ui/map/terrain.ts. Run after `npm run relief:build` (it shares its cache):
 * npm run terrain:build
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { BM_Z, H, ROOT, W, elevation, fetchArea, fetchBlueMarbleArea, landMask, latOf, lonOf, map, natural, parseRings } from './lib/geo';

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

// ---------------------------------------------------------------- the mountains: the owner's ink drawings
/**
 * The drawings (art/mountains), each a stretch of range in ink, drawn from above and to the south, lit from the upper
 * left; every one runs from upper left to lower right (`slope`, degrees below level), so a range running the other
 * way gets one mirrored. `size`: how wide it is drawn, in half-widths of the range where it stands; `along`/`across`:
 * how much of the range it stands for, as fractions of its width.
 */
const ART = [
  { name: 'ridge', slope: 30, size: 2.6, along: 0.65, across: 0.5 },
  { name: 'range', slope: 22, size: 2.6, along: 0.65, across: 0.52 },
  { name: 'steep', slope: 55, size: 2.2, along: 0.7, across: 0.5 },
  { name: 'great', slope: 50, size: 2.6, along: 0.6, across: 0.58 },
  { name: 'massif', slope: 35, size: 2.4, along: 0.6, across: 0.58 },
  { name: 'scattered', slope: 30, size: 3.5, along: 0.65, across: 0.52 },
] as const;
type ArtName = (typeof ART)[number]['name'];
const ART_DIR = path.join(ROOT, 'art/mountains');
const ART_OUT = path.join(ROOT, 'assets/map/mountains');
const ART_MAX = 768; // pixels, the longer side
const MIN_ART = 10; // map units, the narrowest a drawing is drawn
const MAX_ART = 40; // ... the widest: a great range is drawn as many drawings, not a few huge ones
const INK: [number, number, number] = [28, 20, 12];
const PAPER_LIGHT: [number, number, number] = [255, 250, 236];
const LIGHT = 0.18; // how strongly the drawing's lit faces lighten the land

/**
 * A drawing made ready for the map: cut to what is drawn, made smaller, and turned from ink on paper into ink that
 * darkens the land under it and a faint light where the paper showed, so the country's colour shows through.
 */
function bake(name: string): { w: number; h: number } {
  const src = PNG.sync.read(fs.readFileSync(path.join(ART_DIR, `${name}.png`)));
  // What is drawn: the bounds of everything not transparent.
  let x0 = src.width, y0 = src.height, x1 = 0, y1 = 0;
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++)
      if (src.data[(y * src.width + x) * 4 + 3] > 8) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
  const cw = x1 - x0;
  const ch = y1 - y0;
  // The paper's own brightness: the bright end of what is drawn solid.
  const lum: number[] = [];
  for (let i = 0; i < src.width * src.height; i++)
    if (src.data[i * 4 + 3] > 200) lum.push(0.3 * src.data[i * 4] + 0.59 * src.data[i * 4 + 1] + 0.11 * src.data[i * 4 + 2]);
  lum.sort((a, b) => a - b);
  const paper = lum[Math.floor(lum.length * 0.85)];
  // Area-average down to size, in premultiplied colour.
  const scale = Math.min(1, ART_MAX / Math.max(cw, ch));
  const ow = Math.round(cw * scale);
  const oh = Math.round(ch * scale);
  const acc = new Float64Array(ow * oh * 5); // r, g, b (premultiplied), alpha, weight
  for (let y = 0; y < ch; y++) {
    const oy0 = (y * oh) / ch;
    const oy1 = ((y + 1) * oh) / ch;
    for (let x = 0; x < cw; x++) {
      const ox0 = (x * ow) / cw;
      const ox1 = ((x + 1) * ow) / cw;
      const i = ((y0 + y) * src.width + x0 + x) * 4;
      const a = src.data[i + 3] / 255;
      for (let oy = Math.floor(oy0); oy < Math.min(oh, Math.ceil(oy1)); oy++) {
        const wy = Math.min(oy1, oy + 1) - Math.max(oy0, oy);
        for (let ox = Math.floor(ox0); ox < Math.min(ow, Math.ceil(ox1)); ox++) {
          const wgt = wy * (Math.min(ox1, ox + 1) - Math.max(ox0, ox));
          if (wgt <= 0) continue;
          const o = (oy * ow + ox) * 5;
          acc[o] += src.data[i] * a * wgt;
          acc[o + 1] += src.data[i + 1] * a * wgt;
          acc[o + 2] += src.data[i + 2] * a * wgt;
          acc[o + 3] += a * wgt;
          acc[o + 4] += wgt;
        }
      }
    }
  }
  const out = new PNG({ width: ow, height: oh });
  for (let p = 0; p < ow * oh; p++) {
    const o = p * 5;
    const a = acc[o + 3] / acc[o + 4];
    if (a <= 0) continue;
    const l = (0.3 * acc[o] + 0.59 * acc[o + 1] + 0.11 * acc[o + 2]) / acc[o + 3];
    const dark = clamp01(1 - l / paper);
    const ad = a * Math.min(1, dark * 1.15);
    const al = a * LIGHT * clamp01(1 - dark / 0.12);
    const at = Math.min(1, ad + al);
    if (at <= 0) continue;
    for (let k = 0; k < 3; k++) out.data[p * 4 + k] = Math.round((INK[k] * ad + PAPER_LIGHT[k] * al) / (ad + al));
    out.data[p * 4 + 3] = Math.round(at * 255);
  }
  fs.mkdirSync(ART_OUT, { recursive: true });
  fs.writeFileSync(path.join(ART_OUT, `${name}.png`), PNG.sync.write(out, { colorType: 6 }));
  return { w: ow, h: oh };
}

/** How far each cell inside the mask is from its edge (map units; chamfer distance). */
function insideDistance(mask: Uint8Array): Float32Array {
  const d = new Float32Array(N);
  for (let i = 0; i < N; i++) d[i] = mask[i] ? 1e6 : 0;
  const D = Math.SQRT2;
  for (let r = 1; r < rows; r++)
    for (let c = 1; c < cols - 1; c++) {
      const i = r * cols + c;
      if (d[i]) d[i] = Math.min(d[i], d[i - 1] + 1, d[i - cols] + 1, d[i - cols - 1] + D, d[i - cols + 1] + D);
    }
  for (let r = rows - 2; r >= 0; r--)
    for (let c = cols - 2; c > 0; c--) {
      const i = r * cols + c;
      if (d[i]) d[i] = Math.min(d[i], d[i + 1] + 1, d[i + cols] + 1, d[i + cols + 1] + D, d[i + cols - 1] + D);
    }
  for (let i = 0; i < N; i++) d[i] /= F;
  return d;
}

interface Stamp {
  x: number; // its middle, map units
  y: number;
  w: number; // drawn this wide (map units)
  h: number;
  art: number; // index into ART
  flip: boolean; // mirrored, for a range running from lower left to upper right
}

/**
 * Lay the drawings over the ranges: start where a range is widest; see which way the range runs there and how drawn
 * out it is; pick a drawing that runs that way (mirrored if need be), as big as the range is wide; count the stretch
 * of range it stands for as done; then the widest stretch left, and so on, down to the narrowest. Returns the
 * drawings from the top of the map down (so lower, nearer ones are drawn over), and the land they cover.
 */
function placeMountains(range: Float32Array, sizes: { w: number; h: number }[]): { stamps: Stamp[]; covered: Uint8Array } {
  const mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (range[i] > 0) mask[i] = 1;
  const inside = insideDistance(mask);
  const seeds: number[] = [];
  for (let i = 0; i < N; i++) if (mask[i] && inside[i] >= 2) seeds.push(i);
  seeds.sort((a, b) => inside[b] - inside[a] || a - b);
  const covered = new Uint8Array(N);
  const stamps: Stamp[] = [];
  const pick = (name: ArtName) => ART.findIndex(a => a.name === name);
  for (const s of seeds) {
    if (covered[s]) continue;
    const x = ((s % cols) + 0.5) / F;
    const y = (Math.floor(s / cols) + 0.5) / F;
    const d = inside[s];
    // Which way the range runs here, and how drawn out it is: the spread of the range round about.
    const R = Math.min(40, Math.max(8, 3 * d));
    let n = 0, mx = 0, my = 0, sxx = 0, syy = 0, sxy = 0;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R || !mask[cellOf(x + dx, y + dy)]) continue;
        n++;
        mx += dx;
        my += dy;
        sxx += dx * dx;
        syy += dy * dy;
        sxy += dx * dy;
      }
    mx /= n;
    my /= n;
    const cxx = sxx / n - mx * mx;
    const cyy = syy / n - my * my;
    const cxy = sxy / n - mx * my;
    const half = Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy);
    const l1 = (cxx + cyy) / 2 + half;
    const l2 = Math.max(1e-6, (cxx + cyy) / 2 - half);
    let ux = Math.cos(0.5 * Math.atan2(2 * cxy, cxx - cyy));
    let uy = Math.sin(0.5 * Math.atan2(2 * cxy, cxx - cyy));
    if (ux < 0) {
      ux = -ux;
      uy = -uy;
    }
    const drawnOut = Math.sqrt(l1 / l2);
    const slope = (Math.atan2(uy, ux) * 180) / Math.PI; // below level, down to the right
    const coin = hash(s, 1, 31);
    let art: number;
    let flip = slope < 0;
    if (d < 3) art = pick('scattered');
    else if (drawnOut < 1.5) art = pick(d > 9 ? 'great' : 'massif');
    else if (Math.abs(slope) < 15) {
      art = pick(coin < 0.5 ? 'range' : 'massif');
      flip = hash(s, 2, 31) < 0.5;
    } else if (Math.abs(slope) < 42) art = pick(coin < 0.5 ? 'ridge' : 'range');
    else art = pick(d > 9 && coin < 0.5 ? 'great' : 'steep');
    const a = ART[art];
    const w = Math.max(MIN_ART, Math.min(MAX_ART, a.size * d));
    const h = (w * sizes[art].h) / sizes[art].w;
    stamps.push({ x, y, w, h, art, flip });
    // The stretch it stands for.
    const al = a.along * Math.max(w, h);
    const ac = Math.max(3, a.across * w, drawnOut < 1.5 ? al * 0.8 : 0);
    const reach = Math.ceil(Math.max(al, ac));
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const along = dx * ux + dy * uy;
        const across = -dx * uy + dy * ux;
        if ((along / al) ** 2 + (across / ac) ** 2 <= 1) covered[cellOf(x + dx, y + dy)] = 1;
      }
  }
  stamps.sort((p, q) => p.y + p.h / 2 - (q.y + q.h / 2));
  return { stamps, covered };
}

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
  const range = rangeField(region, elev, rugged);
  const sizes = ART.map(a => bake(a.name));
  const { stamps, covered } = placeMountains(range, sizes);

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
        if (ri < 0 || range[cell] > -0.45 || covered[cell] || covered[cellOf(x, y + 3)] || nearName(x, y, ri)) continue;
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
  const r1 = (v: number) => Math.round(v * 10) / 10;
  fs.writeFileSync(
    OUT,
    `/**
 * The map's drawn terrain. Generated by scripts/build-terrain.ts (npm run terrain:build): do not edit by hand.
 *
 * MOUNTAIN_ART: the mountain drawings (art/mountains, made ready in assets/map/mountains) and their size in pixels.
 * MOUNTAINS: ${stamps.length} of them laid over the ranges, five numbers each: the middle's x and y, the width (map units), which
 * drawing, and 1 if mirrored; from the top of the map down, so nearer ones are drawn over.
 * TERRAIN_SYMBOLS: ${n} marks (${Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ')}), each four 16-bit numbers: x and y in tenths of a map unit, kind
 * (2 broadleaf tree, 3 conifer, 4 dune, 5 reeds) and size in tenths, from the top of the map down.
 */
export const MOUNTAIN_ART = [
${ART.map((a, i) => `  { src: require('../../../assets/map/mountains/${a.name}.png'), w: ${sizes[i].w}, h: ${sizes[i].h} },`).join('\n')}
];
export const MOUNTAINS = [${stamps.map(t => `${r1(t.x)},${r1(t.y)},${r1(t.w)},${t.art},${t.flip ? 1 : 0}`).join(',')}];
export const TERRAIN_SYMBOLS = '${marks}';
`,
  );
  const kinds = ART.map((a, i) => `${stamps.filter(t => t.art === i).length} ${a.name}`).join(', ');
  console.log(`${stamps.length} mountain drawings (${kinds}); ${n} marks, ${JSON.stringify(counts)} → ${path.relative(ROOT, OUT)} (${Math.round(marks.length / 1024)} KB)`);
}

main();
