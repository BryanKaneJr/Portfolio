/**
 * Fits the owner's painting of the map to the map and cuts it into tiles: the "Painted" style's ground.
 *
 * The painting (art/painting/fullmap.png, kept out of git: see art/painting/README.md) covers the map's frame and the
 * margins seen past its edges (map.margin), in the map's own projection, painted over the template. Its coasts are
 * close to the real ones but not exact (an island a little off, a coast too round), so it is bent to fit: where the
 * painting has land and sea is read from its colours, compared with the land the game draws (its regions, and the
 * lands beyond them past the frame), and the picture is moved, smoothly and a few map units at most, until its
 * coasts lie on the map's (an image registration: "demons" on the two coastlines' distance fields). What still
 * disagrees near a coast after that (a painted islet where there is sea) is filled from the nearest painting of the
 * right kind; a painted lake inland stays.
 *
 * Output: assets/map/painting/ (JPEG tiles of 1024 px and a 2 px overlap, each well under the 5.2 MP iPhone limit) at three scales:
 * full (2.25 px per map unit) over the frame and a little past it, half over the frame and its near margins, a
 * quarter over everything; and src/ui/map/paintingTiles.ts, where each tile goes. Run: npm run painting:build
 * (PAINT_DEBUG=dir also writes pictures of each step there).
 */
import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { H, ROOT, W, landMask, landRings, map } from './lib/geo';

const SRC = path.join(ROOT, 'art/painting/fullmap.png');
const OUT = path.join(ROOT, 'assets/map/painting');
const GEN = path.join(ROOT, 'src/ui/map/paintingTiles.ts');
const DEBUG = process.env.PAINT_DEBUG;

const [MX, MY] = map.margin as [number, number];
const X0 = -MX;
const Y0 = -MY;
const TW = W + 2 * MX; // the painting's extent, map units
const TH = H + 2 * MY;
const TILE = 1024;
const QUALITY = 82;

// ---------------------------------------------------------------- reading the painting
/** Sea is bluer than it is red; snow and ice are bright all over. */
const isSea = (r: number, g: number, b: number) => b - r > 15 && !(r > 180 && g > 180 && b > 180);

/** The colour of each map unit (the average of the painting's pixels in it), and whether it is painted as land. */
function analyse(src: PNG, s: number) {
  const sum = new Float32Array(TW * TH * 3);
  const cnt = new Float32Array(TW * TH);
  for (let y = 0; y < src.height; y++) {
    const cy = Math.min(TH - 1, Math.floor(y / s));
    for (let x = 0; x < src.width; x++) {
      const c = cy * TW + Math.min(TW - 1, Math.floor(x / s));
      const i = (y * src.width + x) * 4;
      sum[c * 3] += src.data[i];
      sum[c * 3 + 1] += src.data[i + 1];
      sum[c * 3 + 2] += src.data[i + 2];
      cnt[c]++;
    }
  }
  const land = new Uint8Array(TW * TH);
  for (let c = 0; c < TW * TH; c++) {
    const n = cnt[c] || 1;
    land[c] = isSea(sum[c * 3] / n, sum[c * 3 + 1] / n, sum[c * 3 + 2] / n) ? 0 : 1;
  }
  return { land: tidy(land, TW, TH) };
}

/** Specks gone: a cell takes the side most of its neighbourhood is on. */
function tidy(m: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let n = 0;
      let t = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          n += m[yy * w + xx];
          t++;
        }
      out[y * w + x] = n * 2 > t ? 1 : 0;
    }
  return out;
}

// ---------------------------------------------------------------- the land it should show
/** The land the game draws: its regions and wastes, and the lands beyond them past the frame. One cell per map unit. */
const referenceLand = (): Uint8Array => landMask(X0, Y0, TW, TH, 1, landRings);

// ---------------------------------------------------------------- fitting
const REACH = 40; // map units: how far a coast pulls
const MAX_SHIFT = 45; // map units: the most any part of the painting moves
const G = 3; // map units per cell of the fit
const NEAR_COAST = 20; // map units: what disagrees further from a coast than this (a lake inland) is left as painted

/** Signed distance to the coast (map units, + on land), out to REACH, on a grid of `g` map units per cell. */
function coastDistance(land: Uint8Array, g: number): { d: Float32Array; w: number; h: number } {
  const w = Math.ceil(TW / g);
  const h = Math.ceil(TH / g);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let n = 0;
      let t = 0;
      for (let yy = y * g; yy < Math.min(TH, (y + 1) * g); yy++)
        for (let xx = x * g; xx < Math.min(TW, (x + 1) * g); xx++) {
          n += land[yy * TW + xx];
          t++;
        }
      m[y * w + x] = n * 2 >= t ? 1 : 0;
    }
  const dist = (inside: number) => {
    const d = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = m[i] === inside ? 1e6 : 0;
    const D = Math.SQRT2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!d[i]) continue;
        if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
        if (y > 0) d[i] = Math.min(d[i], d[i - w] + 1, x > 0 ? d[i - w - 1] + D : 1e6, x < w - 1 ? d[i - w + 1] + D : 1e6);
      }
    for (let y = h - 1; y >= 0; y--)
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x;
        if (!d[i]) continue;
        if (x < w - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
        if (y < h - 1) d[i] = Math.min(d[i], d[i + w] + 1, x < w - 1 ? d[i + w + 1] + D : 1e6, x > 0 ? d[i + w - 1] + D : 1e6);
      }
    return d;
  };
  const din = dist(1);
  const dout = dist(0);
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = Math.max(-REACH, Math.min(REACH, (m[i] ? din[i] - 0.5 : -(dout[i] - 0.5)) * g));
  return { d, w, h };
}

function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const pass = (from: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(w * h);
    const len = horizontal ? w : h;
    for (let line = 0; line < (horizontal ? h : w); line++) {
      const at = (k: number) => (horizontal ? line * w + k : k * w + line);
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += from[at(Math.max(0, Math.min(len - 1, k)))];
      for (let k = 0; k < len; k++) {
        out[at(k)] = sum / (2 * r + 1);
        sum += from[at(Math.min(len - 1, k + r + 1))] - from[at(Math.max(0, k - r))];
      }
    }
    return out;
  };
  return pass(pass(src, true), false);
}

/** Bilinear sample of a grid at fractional cell (x, y). */
function sample(f: Float32Array, w: number, h: number, x: number, y: number): number {
  x = Math.max(0, Math.min(w - 1.001, x));
  y = Math.max(0, Math.min(h - 1.001, y));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * w + x0;
  return (f[i] * (1 - fx) + f[i + 1] * fx) * (1 - fy) + (f[i + w] * (1 - fx) + f[i + w + 1] * fx) * fy;
}

/**
 * How far to look into the painting from each point of the map (map units, per cell of G), so that its coasts lie on
 * the map's: step by step, each point looks a little further toward where the painting's coast is as far away as the
 * map's coast is, and the steps are smoothed so the picture bends rather than tears.
 */
function fit(painted: Uint8Array, real: Uint8Array) {
  const P = coastDistance(painted, G);
  const R = coastDistance(real, G);
  const { w, h } = P;
  let dx: Float32Array = new Float32Array(w * h);
  let dy: Float32Array = new Float32Array(w * h);
  // Coarse to fine: first whole coasts slide into place, then bays and capes.
  for (const [iterations, smooth] of [
    [60, 5],
    [50, 3],
    [40, 1],
  ]) {
    for (let it = 0; it < iterations; it++) {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const r = R.d[i];
          if (Math.abs(r) >= REACH && Math.abs(sample(P.d, w, h, x + dx[i] / G, y + dy[i] / G)) >= REACH) continue;
          const qx = x + dx[i] / G;
          const qy = y + dy[i] / G;
          const f = sample(P.d, w, h, qx, qy);
          const gx = (sample(P.d, w, h, qx + 1, qy) - sample(P.d, w, h, qx - 1, qy)) / (2 * G);
          const gy = (sample(P.d, w, h, qx, qy + 1) - sample(P.d, w, h, qx, qy - 1)) / (2 * G);
          const diff = r - f;
          const denom = gx * gx + gy * gy + (diff * diff) / 25;
          if (denom < 1e-6) continue;
          dx[i] += (diff * gx) / denom;
          dy[i] += (diff * gy) / denom;
        }
      dx = boxBlur(boxBlur(dx, w, h, smooth), w, h, smooth);
      dy = boxBlur(boxBlur(dy, w, h, smooth), w, h, smooth);
      for (let i = 0; i < w * h; i++) {
        const l = Math.hypot(dx[i], dy[i]);
        if (l > MAX_SHIFT) {
          dx[i] *= MAX_SHIFT / l;
          dy[i] *= MAX_SHIFT / l;
        }
      }
    }
  }
  return { dx, dy, w, h };
}

// ---------------------------------------------------------------- the build
function writeDebug(name: string, w: number, h: number, px: (x: number, y: number) => [number, number, number]) {
  if (!DEBUG) return;
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      png.data.set([r, g, b, 255], (y * w + x) * 4);
    }
  fs.mkdirSync(DEBUG, { recursive: true });
  fs.writeFileSync(path.join(DEBUG, `${name}.png`), PNG.sync.write(png));
}

function main() {
  if (!fs.existsSync(SRC)) throw new Error(`No painting at ${path.relative(ROOT, SRC)} (see art/painting/README.md)`);
  console.log('reading the painting...');
  const src = PNG.sync.read(fs.readFileSync(SRC));
  const s = src.width / TW; // pixels per map unit
  if (Math.abs(src.height / TH - s) > 0.01 * s) throw new Error(`The painting is ${src.width} x ${src.height}: it should have the template's proportions (${TW} x ${TH})`);
  console.log(`${src.width} x ${src.height}, ${s.toFixed(3)} px per map unit; reading land and sea...`);
  const { land } = analyse(src, s);
  const real = referenceLand();
  writeDebug('1-land', TW >> 1, TH >> 1, (x, y) => {
    const i = (y * 2) * TW + x * 2;
    return land[i] && real[i] ? [200, 190, 150] : land[i] ? [220, 60, 50] : real[i] ? [60, 160, 60] : [40, 70, 110];
  });

  console.log('fitting the coasts...');
  const warp = fit(land, real);
  let maxShift = 0;
  for (let i = 0; i < warp.dx.length; i++) maxShift = Math.max(maxShift, Math.hypot(warp.dx[i], warp.dy[i]));
  console.log(`  moved up to ${maxShift.toFixed(1)} map units`);

  // The fitted painting at full size: each pixel looks into the painting where the fit says.
  console.log('bending the painting...');
  const out = Buffer.alloc(src.width * src.height * 4);
  for (let y = 0; y < src.height; y++) {
    const my = (y + 0.5) / s;
    for (let x = 0; x < src.width; x++) {
      const mx = (x + 0.5) / s;
      const ox = sample(warp.dx, warp.w, warp.h, mx / G - 0.5, my / G - 0.5);
      const oy = sample(warp.dy, warp.w, warp.h, mx / G - 0.5, my / G - 0.5);
      let sx = (mx + ox) * s - 0.5;
      let sy = (my + oy) * s - 0.5;
      sx = Math.max(0, Math.min(src.width - 1.001, sx));
      sy = Math.max(0, Math.min(src.height - 1.001, sy));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const a = (y0 * src.width + x0) * 4;
      const b = a + 4;
      const c = a + src.width * 4;
      const d = c + 4;
      const o = (y * src.width + x) * 4;
      for (let k = 0; k < 3; k++)
        out[o + k] = Math.round((src.data[a + k] * (1 - fx) + src.data[b + k] * fx) * (1 - fy) + (src.data[c + k] * (1 - fx) + src.data[d + k] * fx) * fy);
      out[o + 3] = 255;
    }
  }

  // What still disagrees: fill from the nearest painting of the right kind.
  console.log('filling what still disagrees...');
  const fitted = analyse({ width: src.width, height: src.height, data: out } as PNG, s).land;
  const near = coastDistance(real, 1).d;
  const wrong = new Uint8Array(TW * TH);
  let nWrong = 0;
  for (let i = 0; i < TW * TH; i++)
    if (fitted[i] !== real[i] && Math.abs(near[i]) <= NEAR_COAST) {
      wrong[i] = 1;
      nWrong++;
    }
  // For each wrong cell, the nearest right cell of the kind it should be (a breadth-first search from the right ones).
  const from = new Int32Array(TW * TH).fill(-1);
  for (const want of [0, 1]) {
    const queue: number[] = [];
    for (let i = 0; i < TW * TH; i++) if (!wrong[i] && fitted[i] === want) {
      from[i] = i;
      queue.push(i);
    }
    const seen = new Uint8Array(TW * TH);
    for (const i of queue) seen[i] = 1;
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      const x = i % TW;
      for (const j of [x > 0 ? i - 1 : -1, x < TW - 1 ? i + 1 : -1, i - TW, i + TW]) {
        if (j < 0 || j >= TW * TH || seen[j]) continue;
        seen[j] = 1;
        if (wrong[j] && real[j] === want) from[j] = from[i];
        queue.push(j);
      }
    }
  }
  for (let i = 0; i < TW * TH; i++) {
    if (!wrong[i] || from[i] < 0) continue;
    const cx = i % TW;
    const cy = Math.floor(i / TW);
    const fx = from[i] % TW;
    const fy = Math.floor(from[i] / TW);
    for (let py = Math.floor(cy * s); py < Math.min(src.height, Math.floor((cy + 1) * s)); py++)
      for (let px = Math.floor(cx * s); px < Math.min(src.width, Math.floor((cx + 1) * s)); px++) {
        const qx = Math.min(src.width - 1, Math.floor(fx * s) + (px - Math.floor(cx * s)));
        const qy = Math.min(src.height - 1, Math.floor(fy * s) + (py - Math.floor(cy * s)));
        out.copy(out, (py * src.width + px) * 4, (qy * src.width + qx) * 4, (qy * src.width + qx) * 4 + 4);
      }
  }
  console.log(`  ${nWrong} square map units refilled`);
  writeDebug('2-fitted-land', TW >> 1, TH >> 1, (x, y) => {
    const i = (y * 2) * TW + x * 2;
    return fitted[i] && real[i] ? [200, 190, 150] : fitted[i] ? [220, 60, 50] : real[i] ? [60, 160, 60] : [40, 70, 110];
  });

  // Tiles, at three scales.
  console.log('tiles...');
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const levels: { name: string; scale: number; box: [number, number, number, number] }[] = [
    { name: 'full', scale: 1, box: [-150, -150, W + 150, H + 150] },
    { name: 'half', scale: 2, box: [-450, -450, W + 450, H + 450] },
    { name: 'quarter', scale: 4, box: [X0, Y0, X0 + TW, Y0 + TH] },
  ];
  const gen: string[] = [];
  let bytes = 0;
  for (const lv of levels) {
    // The level's pixels: the fitted painting averaged over lv.scale x lv.scale blocks, inside its box.
    const px0 = Math.max(0, Math.floor((lv.box[0] - X0) * s));
    const py0 = Math.max(0, Math.floor((lv.box[1] - Y0) * s));
    const px1 = Math.min(src.width, Math.ceil((lv.box[2] - X0) * s));
    const py1 = Math.min(src.height, Math.ceil((lv.box[3] - Y0) * s));
    const lw = Math.floor((px1 - px0) / lv.scale);
    const lh = Math.floor((py1 - py0) / lv.scale);
    const tiles: string[] = [];
    for (let ty = 0; ty * TILE < lh; ty++)
      for (let tx = 0; tx * TILE < lw; tx++) {
        // Each tile reaches 2 pixels into the next, so no hairline shows where they meet.
        const w = Math.min(TILE + 2, lw - tx * TILE);
        const h = Math.min(TILE + 2, lh - ty * TILE);
        const data = Buffer.alloc(w * h * 4);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            let r = 0;
            let g = 0;
            let b = 0;
            for (let dy = 0; dy < lv.scale; dy++)
              for (let dx = 0; dx < lv.scale; dx++) {
                const o = ((py0 + (ty * TILE + y) * lv.scale + dy) * src.width + px0 + (tx * TILE + x) * lv.scale + dx) * 4;
                r += out[o];
                g += out[o + 1];
                b += out[o + 2];
              }
            const n = lv.scale * lv.scale;
            data.set([Math.round(r / n), Math.round(g / n), Math.round(b / n), 255], (y * w + x) * 4);
          }
        const file = `${lv.name}-${tx}-${ty}.jpg`;
        const jpg = jpeg.encode({ data, width: w, height: h }, QUALITY).data;
        fs.writeFileSync(path.join(OUT, file), jpg);
        bytes += jpg.length;
        // Where it goes on the map (map units).
        const mx = X0 + (px0 + tx * TILE * lv.scale) / s;
        const my = Y0 + (py0 + ty * TILE * lv.scale) / s;
        const r1 = (v: number) => Math.round(v * 100) / 100;
        tiles.push(`    { src: require('../../../assets/map/painting/${file}'), x: ${r1(mx)}, y: ${r1(my)}, w: ${r1((w * lv.scale) / s)}, h: ${r1((h * lv.scale) / s)} },`);
      }
    gen.push(`  {\n    pxPerUnit: ${(s / lv.scale).toFixed(4)},\n    tiles: [\n${tiles.join('\n')}\n    ],\n  },`);
    console.log(`  ${lv.name}: ${lw} x ${lh} px, ${tiles.length} tiles`);
  }
  fs.writeFileSync(
    GEN,
    `/**
 * The owner's painting of the map, fitted to the map's coasts and cut into tiles: three levels, the finest first
 * (pxPerUnit: the painting's pixels per map unit); each tile's place on the map in map units. Generated by
 * scripts/build-painting.ts (npm run painting:build): do not edit by hand.
 */
export interface PaintingTile {
  src: number;
  x: number;
  y: number;
  w: number;
  h: number;
}
export const PAINTING: { pxPerUnit: number; tiles: PaintingTile[] }[] = [
${gen.join('\n')}
];
`,
  );
  console.log(`${Math.round(bytes / 1024 / 1024)} MB of tiles → ${path.relative(ROOT, OUT)}, ${path.relative(ROOT, GEN)}`);
}

main();
