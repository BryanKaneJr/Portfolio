/**
 * Builds the map's relief layer: hill shading on land and depth shading at sea, as black-and-white images with
 * transparency that lie over whatever colours the map is drawn in (assets/map/, listed in src/ui/map/reliefTiles.ts).
 *
 * Elevation comes from the Terrain Tiles on AWS Open Data (Mapzen "terrarium" encoding; at these zooms the data
 * is ETOPO1, GMTED2010 and SRTM, all public domain). Tiles are cached in scripts/data/terrain-cache (git-ignored).
 * Land and sea are told apart with the map's own coastline (src/content/map.json), so the shading never spills
 * over a coast. Run after `npm run map:build`:  npm run relief:build
 *
 * Two layers: the play window at one pixel per map unit, in one piece (tiles shaded or drawn separately leave
 * faint lines where they meet), and the whole drawn world (far lands included) at a quarter of that, for
 * zoomed-out views and the margins.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { PNG } from 'pngjs';

const run = promisify(execFile);
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, 'scripts/data/terrain-cache');
const OUT = path.join(ROOT, 'assets/map');
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/map.json'), 'utf8'));
const W: number = map.width;
const H: number = map.height;
const [MX, MY]: [number, number] = map.margin;
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

/** Even-odd scanline fill of every land ring onto a grid: x = ox + (col + 0.5) / f. */
function landMask(ox: number, oy: number, cols: number, rows: number, f: number): Uint8Array {
  const mask = new Uint8Array(cols * rows);
  const xs: number[][] = Array.from({ length: rows }, () => []);
  for (const r of landRings) {
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

/** Shade a grid (origin ox, oy in map units, f pixels per unit) into grey+alpha bytes. */
function shade(ox: number, oy: number, cols: number, rows: number, f: number, z: number, exaggeration: number, soften: number, seaBlur: number): Buffer {
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
  const out = Buffer.alloc(cols * rows * 2);
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
        dark = 0.42 * Math.pow(Math.min(1, t), 1.25);
        light = 0.17 * (1 - smooth(0, 140, depth)); // shallows glow
      }
      const net = dark - light;
      out[i * 2] = net > 0 ? 0 : 255;
      out[i * 2 + 1] = Math.round(Math.min(1, Math.abs(net)) * 255);
    }
  }
  return out;
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

// ---------------------------------------------------------------- build
const HI = 1; // pixels per map unit in the play window
const LO = 0.25; // pixels per map unit for the whole drawn world
const PAD = 32; // the sharp image is shaded with this margin (map units) so its blur near the edges sees real data

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await fetchArea(5, 0, 0, W, H);
  await fetchArea(4, -MX, -MY, W + MX, H + MY);
  let bytes = 0;
  // The whole drawn world, soft.
  const lx = -MX, ly = -MY;
  const lcols = Math.round((W + 2 * MX) * LO);
  const lrows = Math.round((H + 2 * MY) * LO);
  const world = shade(lx, ly, lcols, lrows, LO, 4, 22, 0, 3);
  bytes += writeGA(path.join(OUT, 'relief-world.png'), lcols, lrows, world);
  // The same soft image cut into four bands around the play window, drawn with the sharp image when zoomed in
  // (so the window is never shaded twice).
  const bandLines: string[] = [];
  const bands: [string, number, number, number, number][] = [
    ['top', -MX, -MY, W + 2 * MX, MY],
    ['bottom', -MX, H, W + 2 * MX, MY],
    ['left', -MX, 0, MX, H],
    ['right', W, 0, MX, H],
  ];
  for (const [name, bx, by, bw, bh] of bands) {
    const c0 = Math.round((bx - lx) * LO);
    const r0 = Math.round((by - ly) * LO);
    const cw = Math.round(bw * LO);
    const ch = Math.round(bh * LO);
    const part = Buffer.alloc(cw * ch * 2);
    for (let r = 0; r < ch; r++) world.copy(part, r * cw * 2, ((r0 + r) * lcols + c0) * 2, ((r0 + r) * lcols + c0 + cw) * 2);
    bytes += writeGA(path.join(OUT, `relief-band-${name}.png`), cw, ch, part);
    bandLines.push(`  { src: require('../../../assets/map/relief-band-${name}.png'), x: ${bx}, y: ${by}, w: ${bw}, h: ${bh} },`);
  }
  // The play window, sharp, in one piece.
  const pc = Math.round((W + 2 * PAD) * HI);
  const pr = Math.round((H + 2 * PAD) * HI);
  const padded = shade(-PAD, -PAD, pc, pr, HI, 5, 10, 1, 8);
  const sc = Math.round(W * HI);
  const sr = Math.round(H * HI);
  const sharp = Buffer.alloc(sc * sr * 2);
  const p0 = Math.round(PAD * HI);
  for (let r = 0; r < sr; r++) padded.copy(sharp, r * sc * 2, ((p0 + r) * pc + p0) * 2, ((p0 + r) * pc + p0 + sc) * 2);
  bytes += writeGA(path.join(OUT, 'relief-window.png'), sc, sr, sharp);
  // Water lines along the coasts of the play window.
  const wl = waterLines();
  bytes += writeGA(path.join(OUT, 'water-lines-light.png'), wl.cols, wl.rows, wl.light);
  bytes += writeGA(path.join(OUT, 'water-lines-dark.png'), wl.cols, wl.rows, wl.dark);
  const ts = `/** Generated by scripts/build-relief.ts: the map's relief layer (do not edit). */
import type { ImageSourcePropType } from 'react-native';

export interface ReliefTile {
  src: ImageSourcePropType;
  x: number; // map units
  y: number;
  w: number;
  h: number;
}

/** The whole drawn world (far lands included), soft: for zoomed-out views and the margins. */
export const RELIEF_WORLD: ReliefTile = { src: require('../../../assets/map/relief-world.png'), x: ${lx}, y: ${ly}, w: ${W + 2 * MX}, h: ${H + 2 * MY} };

/** The soft image around the play window only, drawn with the sharp one. */
export const RELIEF_BANDS: ReliefTile[] = [
${bandLines.join('\n')}
];

/** The play window, sharp. */
export const RELIEF_SHARP: ReliefTile = { src: require('../../../assets/map/relief-window.png'), x: 0, y: 0, w: ${W}, h: ${H} };

/** Lines in the water along the play window's coasts (light ones with a glow off the shore, or dark ones). */
export const WATER_LINES: Record<'light' | 'dark', ReliefTile> = {
  light: { src: require('../../../assets/map/water-lines-light.png'), x: 0, y: 0, w: ${W}, h: ${H} },
  dark: { src: require('../../../assets/map/water-lines-dark.png'), x: 0, y: 0, w: ${W}, h: ${H} },
};
`;
  fs.writeFileSync(path.join(ROOT, 'src/ui/map/reliefTiles.ts'), ts);
  console.log(`relief: window + world + bands + water lines, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
