/**
 * Builds the map's relief layer: hill shading on land and depth shading at sea, as black-and-white images with
 * transparency that lie over whatever colours the map is drawn in (assets/map/, listed in src/ui/map/reliefTiles.ts).
 *
 * Elevation comes from the Terrain Tiles on AWS Open Data (Mapzen "terrarium" encoding; at these zooms the data
 * is ETOPO1, GMTED2010 and SRTM, all public domain). Tiles are cached in scripts/data/terrain-cache (git-ignored).
 * Land and sea are told apart with the map's own coastline (src/content/map.json), so the shading never spills
 * over a coast. Run after `npm run map:build`:  npm run relief:build
 *
 * Relief for the play window in two parts, land (hill shading) and sea (depth), each carried a few pixels past the
 * coast so the renderer can cut the land part to the real coastline (crisp at any zoom); each at one pixel per
 * map unit, in one piece (tiles shaded or drawn separately leave faint lines where they meet), and soft at a
 * quarter of that for zoomed-out views. A fine grain tile is drawn at a fixed size on screen, so it stays sharp. Past
 * the window, and over the wastes and the waters no fleet sails, the map is blank parchment, so nothing is shaded
 * there; instead the known world casts a soft shadow onto the parchment (two versions: before and after the New
 * World is found). Also the water lines along the coasts, for the styles that draw them, and a land-colour image
 * from NASA's Blue Marble (public domain: natural colour, cloud-free) that the Atlas style lays over the country
 * colours, so each country takes on the greens, tans and greys of its land and the texture of its fields and hills.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const run = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, 'scripts/data/terrain-cache');
const OUT = path.join(ROOT, 'assets/map');
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/map.json'), 'utf8'));
const W: number = map.width;
const H: number = map.height;
const { west, east, north } = map.projection;

// ---------------------------------------------------------------- projection (same as build-map)
const RAD = Math.PI / 180;
const scale = W / ((east - west) * RAD); // map units per radian
const top = -Math.log(Math.tan(Math.PI / 4 + (north * RAD) / 2));
const lonOf = (x: number) => west + x / scale / RAD;
const latOf = (y: number) => (2 * Math.atan(Math.exp(-(y / scale + top))) - Math.PI / 2) / RAD;
const unitsPerDegree = W / (east - west);

// ---------------------------------------------------------------- elevation tiles
const TILE = 256;
const tiles = new Map<string, Float32Array | null>();
const tileKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`;

async function fetchTile(z: number, x: number, y: number): Promise<void> {
  const key = tileKey(z, x, y);
  if (tiles.has(key)) return;
  const file = path.join(CACHE, `${z}`, `${x}`, `${y}.png`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    // curl, not fetch: it goes through the environment's proxy settings.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await run('curl', ['-sf', '--max-time', '60', '-o', file, url]);
        break;
      } catch {
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  if (!fs.existsSync(file)) {
    tiles.set(key, null);
    return;
  }
  const png = PNG.sync.read(fs.readFileSync(file));
  const e = new Float32Array(TILE * TILE);
  for (let i = 0; i < TILE * TILE; i++) e[i] = png.data[i * 4] * 256 + png.data[i * 4 + 1] + png.data[i * 4 + 2] / 256 - 32768;
  tiles.set(key, e);
}

/** Web-Mercator pixel of a lon/lat at zoom z. */
function tilePixel(z: number, lon: number, lat: number): [number, number] {
  const n = TILE * 2 ** z;
  const la = Math.max(-85.05, Math.min(85.05, lat)) * RAD;
  return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n];
}

function rawElevation(z: number, px: number, py: number): number {
  const n = 2 ** z;
  const tx = ((Math.floor(px / TILE) % n) + n) % n;
  const ty = Math.max(0, Math.min(n - 1, Math.floor(py / TILE)));
  const t = tiles.get(tileKey(z, tx, ty));
  if (!t) return 0;
  const ix = Math.max(0, Math.min(TILE - 1, Math.floor(px) - Math.floor(px / TILE) * TILE));
  const iy = Math.max(0, Math.min(TILE - 1, Math.floor(py) - ty * TILE));
  return t[iy * TILE + ix];
}

/** Bilinear elevation at a lon/lat (metres; negative at sea). */
function elevation(z: number, lon: number, lat: number): number {
  const [px, py] = tilePixel(z, lon, lat);
  const x0 = Math.floor(px - 0.5);
  const y0 = Math.floor(py - 0.5);
  const fx = px - 0.5 - x0;
  const fy = py - 0.5 - y0;
  const a = rawElevation(z, x0, y0);
  const b = rawElevation(z, x0 + 1, y0);
  const c = rawElevation(z, x0, y0 + 1);
  const d = rawElevation(z, x0 + 1, y0 + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

async function fetchArea(z: number, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  const [ax, ay] = tilePixel(z, lonOf(x0), latOf(y0));
  const [bx, by] = tilePixel(z, lonOf(x1), latOf(y1));
  const n = 2 ** z;
  const jobs: [number, number][] = [];
  for (let ty = Math.max(0, Math.floor(ay / TILE)); ty <= Math.min(n - 1, Math.floor(by / TILE)); ty++)
    for (let tx = Math.floor(ax / TILE); tx <= Math.floor(bx / TILE); tx++) jobs.push([((tx % n) + n) % n, ty]);
  let done = 0;
  const worker = async () => {
    for (let j = jobs.pop(); j; j = jobs.pop()) {
      await fetchTile(z, j[0], j[1]);
      if (++done % 50 === 0) process.stdout.write(`  ${done} tiles\r`);
    }
  };
  await Promise.all(Array.from({ length: 12 }, worker));
  console.log(`zoom ${z}: ${done} tiles`);
}

// ---------------------------------------------------------------- natural colour (NASA Blue Marble, public domain)
const BM_Z = 6;
const bmTiles = new Map<string, Uint8Array | null>();

async function fetchBlueMarble(z: number, x: number, y: number): Promise<void> {
  const key = tileKey(z, x, y);
  if (bmTiles.has(key)) return;
  const file = path.join(CACHE, 'bluemarble', `${z}`, `${x}`, `${y}.jpg`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await run('curl', ['-sf', '--max-time', '60', '-o', file, url]);
        break;
      } catch {
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  if (!fs.existsSync(file)) {
    bmTiles.set(key, null);
    return;
  }
  bmTiles.set(key, jpeg.decode(fs.readFileSync(file), { useTArray: true, formatAsRGBA: true }).data);
}

async function fetchBlueMarbleArea(z: number, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  const [ax, ay] = tilePixel(z, lonOf(x0), latOf(y0));
  const [bx, by] = tilePixel(z, lonOf(x1), latOf(y1));
  const jobs: [number, number][] = [];
  for (let ty = Math.floor(ay / TILE); ty <= Math.floor(by / TILE); ty++) for (let tx = Math.floor(ax / TILE); tx <= Math.floor(bx / TILE); tx++) jobs.push([tx, ty]);
  const total = jobs.length;
  await Promise.all(
    Array.from({ length: 12 }, async () => {
      for (let j = jobs.pop(); j; j = jobs.pop()) await fetchBlueMarble(z, j[0], j[1]);
    }),
  );
  console.log(`blue marble zoom ${z}: ${total} tiles`);
}

/** Bilinear natural colour (0..1 each) at a lon/lat. */
function natural(z: number, lon: number, lat: number): [number, number, number] {
  const [px, py] = tilePixel(z, lon, lat);
  const at = (x: number, y: number): [number, number, number] => {
    const t = bmTiles.get(tileKey(z, Math.floor(x / TILE), Math.floor(y / TILE)));
    if (!t) return [0.2, 0.22, 0.15];
    const i = ((Math.floor(y) % TILE) * TILE + (Math.floor(x) % TILE)) * 4;
    return [t[i] / 255, t[i + 1] / 255, t[i + 2] / 255];
  };
  const x0 = Math.floor(px - 0.5);
  const y0 = Math.floor(py - 0.5);
  const fx = px - 0.5 - x0;
  const fy = py - 0.5 - y0;
  const a = at(x0, y0);
  const b = at(x0 + 1, y0);
  const c = at(x0, y0 + 1);
  const d = at(x0 + 1, y0 + 1);
  return [0, 1, 2].map(k => (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy) as [number, number, number];
}

const TINT_MID = 0.56; // the land colour's average brightness
const TINT_CONTRAST = 1.9; // how much brighter and darker than average the land gets (fields, forest, rock)
const TINT_SAT = 1.5; // and how much more colourful than the photograph

/**
 * The land-colour image: Blue Marble evened out (the photograph is dark, so it is lifted to a middle brightness with
 * its light and dark patches kept, and made a little more colourful), carried a few pixels past the coast (the
 * renderer cuts it to the coastline); the rest of the water is a plain average, which costs nothing to store.
 */
function landColour(cols: number, rows: number, f: number): Uint8Array {
  const land = landMask(0, 0, cols, rows, f);
  const raw = new Float32Array(cols * rows * 3);
  const lum: number[] = [];
  for (let r = 0; r < rows; r++) {
    const lat = latOf((r + 0.5) / f);
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!land[i]) continue;
      const [R, G, B] = natural(BM_Z, lonOf((c + 0.5) / f), lat);
      raw[i * 3] = R;
      raw[i * 3 + 1] = G;
      raw[i * 3 + 2] = B;
      if (i % 7 === 0) lum.push(0.3 * R + 0.59 * G + 0.11 * B);
    }
  }
  lum.sort((a, b) => a - b);
  const median = lum[Math.floor(lum.length / 2)] ?? 0.2;
  const out = new Uint8Array(cols * rows * 4);
  for (let i = 0; i < cols * rows; i++) {
    out[i * 4 + 3] = 255;
    if (!land[i]) continue;
    const R = raw[i * 3];
    const G = raw[i * 3 + 1];
    const B = raw[i * 3 + 2];
    const L = 0.3 * R + 0.59 * G + 0.11 * B;
    const L2 = Math.max(0.22, Math.min(0.9, TINT_MID + (L - median) * TINT_CONTRAST));
    for (const [k, v] of [R, G, B].entries()) out[i * 4 + k] = Math.round(Math.max(0, Math.min(1, L2 + (v - L) * TINT_SAT)) * 255);
  }
  const has = spread(out, land, cols, rows, 6, 4);
  const avg = [0, 1, 2].map(k => {
    let t = 0;
    let n = 0;
    for (let i = 0; i < cols * rows; i += 13)
      if (land[i]) {
        t += out[i * 4 + k];
        n++;
      }
    return n ? Math.round(t / n) : 128;
  });
  for (let i = 0; i < cols * rows; i++) if (!has[i]) for (let k = 0; k < 3; k++) out[i * 4 + k] = avg[k];
  return out;
}

function writeJPEG(file: string, cols: number, rows: number, rgba: Uint8Array): number {
  const buf = jpeg.encode({ data: rgba, width: cols, height: rows }, 84).data;
  fs.writeFileSync(file, buf);
  return buf.length;
}

/** Average an RGBA image down by a whole factor. */
function shrink(rgba: Uint8Array, cols: number, rows: number, by: number): { rgba: Uint8Array; cols: number; rows: number } {
  const c2 = Math.floor(cols / by);
  const r2 = Math.floor(rows / by);
  const out = new Uint8Array(c2 * r2 * 4);
  for (let r = 0; r < r2; r++)
    for (let c = 0; c < c2; c++)
      for (let k = 0; k < 4; k++) {
        let t = 0;
        for (let dy = 0; dy < by; dy++) for (let dx = 0; dx < by; dx++) t += rgba[((r * by + dy) * cols + c * by + dx) * 4 + k];
        out[(r * c2 + c) * 4 + k] = Math.round(t / (by * by));
      }
  return { rgba: out, cols: c2, rows: r2 };
}

// ---------------------------------------------------------------- land mask from the map's own coastline
function parseRings(d: string): number[][] {
  const rings: number[][] = [];
  let cur: number[] = [];
  for (const m of d.matchAll(/([MLZ])([^MLZ]*)/g)) {
    if (m[1] === 'Z') {
      if (cur.length) rings.push(cur);
      cur = [];
      continue;
    }
    if (m[1] === 'M' && cur.length) {
      rings.push(cur);
      cur = [];
    }
    const nums = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    cur.push(...nums);
  }
  if (cur.length) rings.push(cur);
  return rings;
}
const landRings: number[][] = [];
for (const r of map.regions) landRings.push(...parseRings(r.path));
for (const w of map.wastelands) landRings.push(...parseRings(w.path));
for (const f of map.far) landRings.push(...parseRings(f.path));

/** Even-odd scanline fill of rings (every land ring by default) onto a grid: x = ox + (col + 0.5) / f. */
function landMask(ox: number, oy: number, cols: number, rows: number, f: number, rings: number[][] = landRings): Uint8Array {
  const mask = new Uint8Array(cols * rows);
  const xs: number[][] = Array.from({ length: rows }, () => []);
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      const ra = Math.ceil((Math.min(yi, yj) - oy) * f - 0.5);
      const rb = Math.floor((Math.max(yi, yj) - oy) * f - 0.5);
      for (let row = Math.max(0, ra); row <= Math.min(rows - 1, rb); row++) {
        const y = oy + (row + 0.5) / f;
        if (yi > y !== yj > y) xs[row].push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
    }
  }
  for (let row = 0; row < rows; row++) {
    const list = xs[row].sort((a, b) => a - b);
    for (let k = 0; k + 1 < list.length; k += 2) {
      const a = Math.max(0, Math.ceil((list[k] - ox) * f - 0.5));
      const b = Math.min(cols - 1, Math.floor((list[k + 1] - ox) * f - 0.5));
      for (let col = a; col <= b; col++) mask[row * cols + col] ^= 1;
    }
  }
  return mask;
}

// ---------------------------------------------------------------- shading
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const ZENITH = 45 * RAD;

const SEA_DEPTH = 0.3; // how dark the deepest water gets
const LIGHTS: [number, number][] = [
  [315, 0.55], // the classic north-west light...
  [270, 0.25], // ...softened from the west and north so ridges facing any way still read
  [0, 0.2],
];

/** Box blur, in place, `passes` times (three passes is close to a Gaussian). */
function blur(a: Float32Array, cols: number, rows: number, r: number, passes = 3): Float32Array {
  if (r < 1) return a;
  const tmp = new Float32Array(a.length);
  for (let p = 0; p < passes; p++) {
    for (let row = 0; row < rows; row++) {
      let acc = 0;
      for (let c = -r; c <= r; c++) acc += a[row * cols + Math.max(0, Math.min(cols - 1, c))];
      for (let col = 0; col < cols; col++) {
        tmp[row * cols + col] = acc / (2 * r + 1);
        acc += a[row * cols + Math.min(cols - 1, col + r + 1)] - a[row * cols + Math.max(0, col - r)];
      }
    }
    for (let col = 0; col < cols; col++) {
      let acc = 0;
      for (let rr = -r; rr <= r; rr++) acc += tmp[Math.max(0, Math.min(rows - 1, rr)) * cols + col];
      for (let row = 0; row < rows; row++) {
        a[row * cols + col] = acc / (2 * r + 1);
        acc += tmp[Math.min(rows - 1, row + r + 1) * cols + col] - tmp[Math.max(0, row - r) * cols + col];
      }
    }
  }
  return a;
}

/** Shade a grid (origin ox, oy in map units, f pixels per unit): darkening (+) or lightening (-), and the land mask. */
function shade(ox: number, oy: number, cols: number, rows: number, f: number, z: number, exaggeration: number, soften: number, seaBlur: number): { net: Float32Array; land: Uint8Array } {
  const raw = new Float32Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    const lat = latOf(oy + (row + 0.5) / f);
    for (let col = 0; col < cols; col++) raw[row * cols + col] = elevation(z, lonOf(ox + (col + 0.5) / f), lat);
  }
  // Softened hills read as painted rather than noisy; the sea floor is smoothed much more, so deep water is an even
  // gradient instead of a chart of survey tracks.
  const elev = blur(Float32Array.from(raw), cols, rows, soften);
  const depthField = blur(Float32Array.from(raw, v => Math.max(0, -v)), cols, rows, seaBlur);
  const land = landMask(ox, oy, cols, rows, f);
  const out = new Float32Array(cols * rows);
  const flat = Math.cos(ZENITH);
  const at = (c: number, r: number) => {
    const cc = Math.max(0, Math.min(cols - 1, c));
    const rr = Math.max(0, Math.min(rows - 1, r));
    return land[rr * cols + cc] ? Math.max(0, elev[rr * cols + cc]) : 0;
  };
  for (let row = 0; row < rows; row++) {
    const lat = latOf(oy + (row + 0.5) / f);
    const ground = (111320 * Math.cos(lat * RAD)) / (unitsPerDegree * f); // metres per pixel (Mercator is conformal)
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      let dark = 0;
      let light = 0;
      if (land[i]) {
        const dzdx = ((at(col + 1, row) - at(col - 1, row)) / (2 * ground)) * exaggeration;
        const dzdy = ((at(col, row + 1) - at(col, row - 1)) / (2 * ground)) * exaggeration;
        const slope = Math.atan(Math.hypot(dzdx, dzdy));
        const aspect = Math.atan2(dzdy, -dzdx);
        let hs = 0;
        for (const [az, w] of LIGHTS) {
          const azimuth = ((360 - az + 90) % 360) * RAD;
          hs += w * (Math.cos(ZENITH) * Math.cos(slope) + Math.sin(ZENITH) * Math.sin(slope) * Math.cos(azimuth - aspect));
        }
        const delta = hs - flat;
        dark = Math.max(0, -delta) * 1.5 + 0.07 * smooth(1200, 4200, elev[i]); // high ground a touch greyer
        light = Math.max(0, delta) * 1.1;
        dark = Math.min(0.62, dark);
        light = Math.min(0.32, light);
      } else {
        const depth = depthField[i];
        const t = Math.log10(1 + depth / 50) / Math.log10(1 + 5000 / 50);
        dark = SEA_DEPTH * Math.pow(Math.min(1, t), 1.25);
        light = 0.17 * (1 - smooth(0, 140, depth)); // shallows glow
      }
      out[i] = dark - light;
    }
  }
  return { net: out, land };
}

/** Grey+alpha bytes for shading values: black to darken, white to lighten; transparent where `keep` is 0. */
function toGA(net: Float32Array, keep: Uint8Array): Buffer {
  const out = Buffer.alloc(net.length * 2);
  for (let i = 0; i < net.length; i++) {
    if (!keep[i]) continue;
    out[i * 2] = net[i] > 0 ? 0 : 255;
    out[i * 2 + 1] = Math.round(Math.min(1, Math.abs(net[i])) * 255);
  }
  return out;
}

/**
 * Carry values a few pixels past the edge of the area that has them (each pass: a pixel without a value takes the
 * average of its neighbours that have one). Returns which pixels now have values. `values` holds `channels` per pixel.
 */
function spread(values: Float32Array | Uint8Array, has: Uint8Array, cols: number, rows: number, passes: number, channels = 1): Uint8Array {
  let cur = Uint8Array.from(has);
  for (let p = 0; p < passes; p++) {
    const next = Uint8Array.from(cur);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (cur[i]) continue;
        const sum = new Array(channels).fill(0);
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const rr = r + dy;
            const cc = c + dx;
            if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
            const j = rr * cols + cc;
            if (!cur[j]) continue;
            for (let k = 0; k < channels; k++) sum[k] += values[j * channels + k];
            n++;
          }
        if (!n) continue;
        for (let k = 0; k < channels; k++) values[i * channels + k] = sum[k] / n;
        next[i] = 1;
      }
    cur = next;
  }
  return cur;
}

/** Land shading carried past the coast, and sea shading carried under the land: the two relief layers. */
function splitRelief(net: Float32Array, land: Uint8Array, cols: number, rows: number, passes: number): { land: Buffer; sea: Buffer } {
  const landNet = Float32Array.from(net);
  const landHas = spread(landNet, land, cols, rows, passes);
  const seaNet = Float32Array.from(net);
  const sea = Uint8Array.from(land, v => (v ? 0 : 1));
  const seaHas = spread(seaNet, sea, cols, rows, passes);
  return { land: toGA(landNet, landHas), sea: toGA(seaNet, seaHas) };
}

const GRAIN_TILE = 256; // pixels; drawn at a fixed size on screen (MapView), so it is sharp at any zoom
const GRAIN = 0.075; // strength of the grain (as shading)

/** A seamless tile of fine grain, a few sizes over each other, so flat colours read as brushed paper. */
function grainTile(): Buffer {
  const periodic = (x: number, y: number, period: number, seed: number) => {
    const hash = (i: number, j: number) => {
      let h = (((i % period) + period) % period) * 374761393 + (((j % period) + period) % period) * 668265263 + seed * 2246822519;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    };
    const i = Math.floor(x);
    const j = Math.floor(y);
    const u = (x - i) * (x - i) * (3 - 2 * (x - i));
    const v = (y - j) * (y - j) * (3 - 2 * (y - j));
    const a = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * u;
    const b = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * u;
    return (a + (b - a) * v) * 2 - 1;
  };
  const net = new Float32Array(GRAIN_TILE * GRAIN_TILE);
  const octaves: [number, number][] = [
    [8, 0.35], // cells across the tile, weight
    [24, 0.3],
    [64, 0.35],
  ];
  for (let y = 0; y < GRAIN_TILE; y++)
    for (let x = 0; x < GRAIN_TILE; x++) {
      let n = 0;
      for (const [cells, w] of octaves) n += w * periodic((x * cells) / GRAIN_TILE, (y * cells) / GRAIN_TILE, cells, cells);
      net[y * GRAIN_TILE + x] = n * GRAIN;
    }
  return toGA(net, new Uint8Array(net.length).fill(1));
}

function writeGA(file: string, cols: number, rows: number, ga: Buffer): number {
  const png = new PNG({ width: cols, height: rows, colorType: 4 });
  for (let i = 0; i < cols * rows; i++) {
    png.data[i * 4] = png.data[i * 4 + 1] = png.data[i * 4 + 2] = ga[i * 2];
    png.data[i * 4 + 3] = ga[i * 2 + 1];
  }
  const buf = PNG.sync.write(png, { colorType: 4 });
  fs.writeFileSync(file, buf);
  return buf.length;
}

// ---------------------------------------------------------------- water lines
/** Squared distance transform along one line (Felzenszwalb and Huttenlocher): f in, d out. */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let sx = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (sx <= z[k]) {
      k--;
      sx = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = sx;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Distance (in pixels) from every pixel to the nearest land pixel. */
function distanceToLand(land: Uint8Array, cols: number, rows: number): Float32Array {
  const BIG = 1e12;
  const n = Math.max(cols, rows);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  const g = new Float64Array(cols * rows);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) f[r] = land[r * cols + c] ? 0 : BIG;
    edt1d(f, rows, d, v, z);
    for (let r = 0; r < rows; r++) g[r * cols + c] = d[r];
  }
  const out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) f[c] = g[r * cols + c];
    edt1d(f, cols, d, v, z);
    for (let c = 0; c < cols; c++) out[r * cols + c] = Math.sqrt(d[c]);
  }
  return out;
}

const RINGS: [number, number][] = [
  [3.5, 1], // distance from the coast (map units), strength
  [7, 0.75],
  [11.5, 0.5],
];
const GLOW = 10; // the shallows glow fades out over this many map units
const EDGE_FADE = 48; // water lines fade out towards the edges of the play window (map units)

/**
 * Lines in the water following every coast at set distances, and a soft glow just off the shore, the way
 * hand-drawn maps and strategy-map textures show the shallows. Drawn once here rather than as strokes on the
 * phone (stroking every coastline several times over on each redraw is slow). Worked out at twice the
 * resolution and averaged down, so the lines are smooth. Two versions: light lines (and the glow) for dark seas,
 * dark lines for pale ones.
 */
function waterLines(): { light: Buffer; dark: Buffer; cols: number; rows: number } {
  const SS = 2;
  const M = 16; // margin, so land just outside the window still counts
  const cols2 = (W + 2 * M) * SS;
  const rows2 = (H + 2 * M) * SS;
  const land = landMask(-M, -M, cols2, rows2, SS);
  const dist = distanceToLand(land, cols2, rows2);
  const cols = W;
  const rows = H;
  const light = Buffer.alloc(cols * rows * 2);
  const dark = Buffer.alloc(cols * rows * 2);
  const hw = 0.6; // half a line's width (map units)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let ring = 0;
      let glow = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((r + M) * SS + sy) * cols2 + (c + M) * SS + sx;
          if (land[i]) continue;
          const dd = dist[i] / SS - 0.5 / SS; // to the shore, not to the middle of the nearest land pixel
          let a = 0;
          for (const [at, w] of RINGS) a = Math.max(a, w * Math.max(0, 1 - Math.abs(dd - at) / hw));
          ring += a;
          glow += 0.7 * (1 - smooth(0, GLOW, dd));
        }
      }
      const edge = smooth(0, EDGE_FADE, Math.min(c + 0.5, r + 0.5, W - c - 0.5, H - r - 0.5));
      ring = (ring / (SS * SS)) * edge;
      glow = (glow / (SS * SS)) * edge;
      const i = r * cols + c;
      light[i * 2] = 255;
      light[i * 2 + 1] = Math.round((1 - (1 - ring) * (1 - glow)) * 255);
      dark[i * 2] = 0;
      dark[i * 2 + 1] = Math.round(ring * 255);
    }
  }
  return { light, dark, cols, rows };
}

// ---------------------------------------------------------------- the known world's shadow on the parchment
const SHADOW = 20; // the shadow fades out over this many map units
const EDGE = 40; // and right at the window's edges, where the renderer fades everything into parchment (MapView)
const SHADOW_F = 0.5; // pixels per map unit
const ringsOf = (paths: string[]) => paths.flatMap(parseRings);
const wasteRings = ringsOf(map.wastelands.map((w: { path: string }) => w.path));
const closedRings = ringsOf([map.unknownWater]);
const unchartedRings = ringsOf([map.uncharted]);

/** A soft shadow on the unknown, just outside the known world: dark, with transparency (style sets strength). */
function shadow(unknown: number[][]): { ga: Buffer; cols: number; rows: number } {
  const cols = Math.round(W * SHADOW_F);
  const rows = Math.round(H * SHADOW_F);
  const mask = landMask(0, 0, cols, rows, SHADOW_F, unknown); // the shapes never overlap, so even-odd is right
  const known = new Uint8Array(cols * rows);
  for (let i = 0; i < known.length; i++) known[i] = mask[i] ? 0 : 1;
  const dist = distanceToLand(known, cols, rows);
  const ga = Buffer.alloc(cols * rows * 2);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!mask[i]) continue;
      const d = dist[i] / SHADOW_F;
      const x = (c + 0.5) / SHADOW_F;
      const y = (r + 0.5) / SHADOW_F;
      const edge = smooth(0, EDGE, Math.min(x, y, W - x, H - y));
      ga[i * 2 + 1] = Math.round((1 - smooth(0, SHADOW, d)) * edge * 255);
    }
  return { ga, cols, rows };
}

// ---------------------------------------------------------------- build
const HI = 1; // pixels per map unit in the play window
const LO = 0.25; // pixels per map unit for the whole drawn world
const PAD = 32; // the sharp image is shaded with this margin (map units) so its blur near the edges sees real data

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await fetchArea(5, 0, 0, W, H);
  await fetchArea(4, 0, 0, W, H);
  await fetchBlueMarbleArea(BM_Z, 0, 0, W, H);
  let bytes = 0;
  // The play window, soft (zoomed out): land and sea.
  const lcols = Math.round(W * LO);
  const lrows = Math.round(H * LO);
  const softShade = shade(0, 0, lcols, lrows, LO, 4, 22, 0, 3);
  const softParts = splitRelief(softShade.net, softShade.land, lcols, lrows, 2);
  bytes += writeGA(path.join(OUT, 'relief-land-soft.png'), lcols, lrows, softParts.land);
  bytes += writeGA(path.join(OUT, 'relief-sea-soft.png'), lcols, lrows, softParts.sea);
  // The play window, sharp, in one piece (shaded with a margin, then cropped).
  const pc = Math.round((W + 2 * PAD) * HI);
  const pr = Math.round((H + 2 * PAD) * HI);
  const padded = shade(-PAD, -PAD, pc, pr, HI, 5, 13, 0, 8);
  const sc = Math.round(W * HI);
  const sr = Math.round(H * HI);
  const p0 = Math.round(PAD * HI);
  const net = new Float32Array(sc * sr);
  const landPx = new Uint8Array(sc * sr);
  for (let r = 0; r < sr; r++) {
    net.set(padded.net.subarray((p0 + r) * pc + p0, (p0 + r) * pc + p0 + sc), r * sc);
    landPx.set(padded.land.subarray((p0 + r) * pc + p0, (p0 + r) * pc + p0 + sc), r * sc);
  }
  const parts = splitRelief(net, landPx, sc, sr, 4);
  bytes += writeGA(path.join(OUT, 'relief-land.png'), sc, sr, parts.land);
  bytes += writeGA(path.join(OUT, 'relief-sea.png'), sc, sr, parts.sea);
  // A tile of fine grain.
  bytes += writeGA(path.join(OUT, 'grain.png'), GRAIN_TILE, GRAIN_TILE, grainTile());
  // Water lines along the coasts of the play window.
  const wl = waterLines();
  bytes += writeGA(path.join(OUT, 'water-lines-light.png'), wl.cols, wl.rows, wl.light);
  bytes += writeGA(path.join(OUT, 'water-lines-dark.png'), wl.cols, wl.rows, wl.dark);
  // The land's natural colour, sharp and soft.
  const tint = landColour(W, H, 1);
  bytes += writeJPEG(path.join(OUT, 'land-colour.jpg'), W, H, tint);
  const soft = shrink(tint, W, H, 4);
  bytes += writeJPEG(path.join(OUT, 'land-colour-soft.jpg'), soft.cols, soft.rows, soft.rgba);
  // The known world's shadow on the parchment, before and after the New World is found.
  for (const [name, rings] of [
    ['charted', [...wasteRings, ...closedRings]],
    ['uncharted', [...wasteRings, ...closedRings, ...unchartedRings]],
  ] as [string, number[][]][]) {
    const sh = shadow(rings);
    bytes += writeGA(path.join(OUT, `shadow-${name}.png`), sh.cols, sh.rows, sh.ga);
  }
  const ts = `/** Generated by scripts/build-relief.ts: the map's relief layer (do not edit). */
import type { ImageSourcePropType } from 'react-native';

export interface ReliefTile {
  src: ImageSourcePropType;
  x: number; // map units
  y: number;
  w: number;
  h: number;
}

/**
 * Relief for the play window: land (hill shading, carried a few pixels past the coast: cut it to the coastline) and
 * sea (depth, carried under the land: draw it under the land), sharp and soft (zoomed out).
 */
export const RELIEF: Record<'land' | 'sea', Record<'sharp' | 'soft', ReliefTile>> = {
  land: {
    sharp: { src: require('../../../assets/map/relief-land.png'), x: 0, y: 0, w: ${W}, h: ${H} },
    soft: { src: require('../../../assets/map/relief-land-soft.png'), x: 0, y: 0, w: ${W}, h: ${H} },
  },
  sea: {
    sharp: { src: require('../../../assets/map/relief-sea.png'), x: 0, y: 0, w: ${W}, h: ${H} },
    soft: { src: require('../../../assets/map/relief-sea-soft.png'), x: 0, y: 0, w: ${W}, h: ${H} },
  },
};

/** A seamless tile of fine grain (${GRAIN_TILE} px), to be drawn at a fixed size on screen. */
export const GRAIN = { src: require('../../../assets/map/grain.png') as ImageSourcePropType, px: ${GRAIN_TILE} };

/** Lines in the water along the play window's coasts (light ones with a glow off the shore, or dark ones). */
export const WATER_LINES: Record<'light' | 'dark', ReliefTile> = {
  light: { src: require('../../../assets/map/water-lines-light.png'), x: 0, y: 0, w: ${W}, h: ${H} },
  dark: { src: require('../../../assets/map/water-lines-dark.png'), x: 0, y: 0, w: ${W}, h: ${H} },
};

/** The land's natural colour (Blue Marble, evened out; carried a few pixels past the coast: cut it to the coastline). */
export const LAND_COLOUR: Record<'sharp' | 'soft', ReliefTile> = {
  sharp: { src: require('../../../assets/map/land-colour.jpg'), x: 0, y: 0, w: ${W}, h: ${H} },
  soft: { src: require('../../../assets/map/land-colour-soft.jpg'), x: 0, y: 0, w: ${W}, h: ${H} },
};

/** The known world's soft shadow on the parchment around it, before and after the New World is found. */
export const SHADOWS: Record<'charted' | 'uncharted', ReliefTile> = {
  charted: { src: require('../../../assets/map/shadow-charted.png'), x: 0, y: 0, w: ${W}, h: ${H} },
  uncharted: { src: require('../../../assets/map/shadow-uncharted.png'), x: 0, y: 0, w: ${W}, h: ${H} },
};
`;
  fs.writeFileSync(path.join(ROOT, 'src/ui/map/reliefTiles.ts'), ts);
  console.log(`relief: land + sea (sharp, soft), land colour, grain, water lines, shadows: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
