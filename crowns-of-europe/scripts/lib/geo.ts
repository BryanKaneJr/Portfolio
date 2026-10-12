/**
 * What the map builders share: the map's Mercator projection, elevation from the Terrain Tiles on AWS Open Data and
 * natural colour from NASA's Blue Marble (both public domain, fetched once into scripts/data/terrain-cache,
 * git-ignored), and a land mask scan-filled from the map's own coastline.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const run = promisify(execFile);
export const ROOT = path.resolve(__dirname, '..', '..');
const CACHE = path.join(ROOT, 'scripts/data/terrain-cache');
export const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/map.json'), 'utf8'));
export const W: number = map.width;
export const H: number = map.height;
const { west, east, north } = map.projection;

// ---------------------------------------------------------------- projection (same as build-map)
export const RAD = Math.PI / 180;
const scale = W / ((east - west) * RAD); // map units per radian
const top = -Math.log(Math.tan(Math.PI / 4 + (north * RAD) / 2));
export const lonOf = (x: number) => west + x / scale / RAD;
export const latOf = (y: number) => (2 * Math.atan(Math.exp(-(y / scale + top))) - Math.PI / 2) / RAD;
export const unitsPerDegree = W / (east - west);

// ---------------------------------------------------------------- elevation tiles
export const TILE = 256;
const tiles = new Map<string, Float32Array | null>();
export const tileKey = (z: number, x: number, y: number) => `${z}/${x}/${y}`;

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
export function tilePixel(z: number, lon: number, lat: number): [number, number] {
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
export function elevation(z: number, lon: number, lat: number): number {
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

/** Fetch (or read from the cache) every elevation tile at zoom z covering the map area x0..x1, y0..y1. */
export async function fetchArea(z: number, x0: number, y0: number, x1: number, y1: number): Promise<void> {
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
export const BM_Z = 6;
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

export async function fetchBlueMarbleArea(z: number, x0: number, y0: number, x1: number, y1: number): Promise<void> {
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
export function natural(z: number, lon: number, lat: number): [number, number, number] {
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

// ---------------------------------------------------------------- land mask from the map's own coastline
export function parseRings(d: string): number[][] {
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
export const landRings: number[][] = [];
for (const r of map.regions) landRings.push(...parseRings(r.path));
for (const w of map.wastelands) landRings.push(...parseRings(w.path));
for (const f of map.far) landRings.push(...parseRings(f.path));

/** Even-odd scanline fill of rings (every land ring by default) onto a grid: x = ox + (col + 0.5) / f. */
export function landMask(ox: number, oy: number, cols: number, rows: number, f: number, rings: number[][] = landRings): Uint8Array {
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
