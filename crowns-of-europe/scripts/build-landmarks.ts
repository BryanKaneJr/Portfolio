/**
 * Makes the owner's landmark paintings (art/landmarks/<id>.png, one per landmark in src/content/landmarks.json) ready
 * for the map and the region sheet. Each is cut to what is painted, made smaller (area-averaged, in premultiplied
 * colour) so its longer side is LONG_SIDE pixels, and written to assets/landmarks/<id>.png as a 256-colour picture
 * (a palette PNG with transparency: a fifth the size of full colour, and at this size the paint's grain hides the
 * steps). src/ui/map/landmarkArt.ts lists each with its size in pixels and where it stands (`ground`, a share of its
 * height from the top: the foot of its walls, above the soft wash of ground some are painted on). Nothing is
 * recoloured: the colours are the owner's.
 *
 * Deterministic: the same paintings give the same bytes.
 *
 *   npx tsx scripts/build-landmarks.ts        (npm run landmarks:build)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'art/landmarks');
const OUT_DIR = path.join(ROOT, 'assets/landmarks');
const OUT_TS = path.join(ROOT, 'src/ui/map/landmarkArt.ts');
const LANDMARKS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/landmarks.json'), 'utf8')) as {
  id: string;
  name: string;
}[];

/** Pixels, a picture's longer side: the region sheet shows it in a 64-point well and the map's closest zoom up to
 * about 64 points tall (the Giralda), so this is sharp on a 3x screen at both. */
const LONG_SIDE = 192;
/** The paintings carry a faint speckle round the building (alpha under about an eighth): what is painted is where
 * a row or column has at least EDGE_COUNT pixels more opaque than EDGE_ALPHA. */
const EDGE_ALPHA = 32;
const EDGE_COUNT = 4;
/** Where a picture stands: the lowest row at least GROUND_SHARE as wide as its widest row (counting pixels more
 * than half opaque). */
const GROUND_SHARE = 0.25;
/** Colours in the palette (index 0 is clear), and the rounds of refining it after the first cut. */
const COLOURS = 256;
const REFINE = 6;

interface Baked {
  id: string;
  w: number;
  h: number;
  ground: number;
  bytes: number;
}

/** Cut to what is painted, and make it smaller: RGBA (straight alpha), ow x oh. */
function shrink(src: PNG): { px: Float64Array; ow: number; oh: number; ground: number } {
  const { width: W, height: H, data } = src;
  const a = (x: number, y: number) => data[(y * W + x) * 4 + 3];
  const rows = new Int32Array(H);
  const cols = new Int32Array(W);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (a(x, y) > EDGE_ALPHA) {
        rows[y]++;
        cols[x]++;
      }
  const first = (c: Int32Array) => c.findIndex(n => n >= EDGE_COUNT);
  const last = (c: Int32Array) => c.length - 1 - [...c].reverse().findIndex(n => n >= EDGE_COUNT);
  const x0 = first(cols);
  const x1 = last(cols) + 1;
  const y0 = first(rows);
  const y1 = last(rows) + 1;
  if (x0 < 0 || y0 < 0) throw new Error('nothing painted');
  const cw = x1 - x0;
  const ch = y1 - y0;
  // Its foot: the lowest row a quarter as wide as the widest (half-opaque pixels).
  const solid = new Int32Array(ch);
  for (let y = 0; y < ch; y++) for (let x = x0; x < x1; x++) if (a(x, y0 + y) > 127) solid[y]++;
  const widest = Math.max(...solid);
  let foot = ch;
  while (foot > 0 && solid[foot - 1] < GROUND_SHARE * widest) foot--;

  const scale = Math.min(1, LONG_SIDE / Math.max(cw, ch));
  const ow = Math.round(cw * scale);
  const oh = Math.round(ch * scale);
  const acc = new Float64Array(ow * oh * 4); // r, g, b (premultiplied), alpha; each output pixel's weights sum to 1
  for (let y = 0; y < ch; y++) {
    const oy0 = (y * oh) / ch;
    const oy1 = ((y + 1) * oh) / ch;
    for (let x = 0; x < cw; x++) {
      const i = ((y0 + y) * W + x0 + x) * 4;
      const al = data[i + 3] / 255;
      if (al === 0) continue;
      const ox0 = (x * ow) / cw;
      const ox1 = ((x + 1) * ow) / cw;
      for (let oy = Math.floor(oy0); oy < Math.min(oh, Math.ceil(oy1)); oy++) {
        const wy = Math.min(oy1, oy + 1) - Math.max(oy0, oy);
        for (let ox = Math.floor(ox0); ox < Math.min(ow, Math.ceil(ox1)); ox++) {
          const wgt = wy * (Math.min(ox1, ox + 1) - Math.max(ox0, ox));
          if (wgt <= 0) continue;
          const o = (oy * ow + ox) * 4;
          acc[o] += data[i] * al * wgt;
          acc[o + 1] += data[i + 1] * al * wgt;
          acc[o + 2] += data[i + 2] * al * wgt;
          acc[o + 3] += al * wgt;
        }
      }
    }
  }
  const px = new Float64Array(ow * oh * 4); // straight r, g, b (0-255) and alpha (0-255)
  for (let p = 0; p < ow * oh; p++) {
    const al = Math.min(1, acc[p * 4 + 3]);
    px[p * 4 + 3] = al * 255;
    for (let c = 0; c < 3; c++) px[p * 4 + c] = al > 0 ? Math.min(255, acc[p * 4 + c] / acc[p * 4 + 3]) : 0;
  }
  return { px, ow, oh, ground: foot / ch };
}

/**
 * A palette for the picture's pixels (straight RGBA, 0-255): a median cut into COLOURS - 1 boxes, weighted by
 * opacity, then a few rounds of moving each colour to the middle of the pixels nearest it. Index 0 is clear.
 * Distance is measured on premultiplied colour plus alpha, so a nearly clear edge pixel's hue hardly counts.
 */
function palette(px: Float64Array, n: number): number[][] {
  const pts: number[][] = [];
  for (let p = 0; p < n; p++) {
    const al = px[p * 4 + 3];
    if (Math.round(al) === 0) continue;
    const f = al / 255;
    pts.push([px[p * 4] * f, px[p * 4 + 1] * f, px[p * 4 + 2] * f, al]);
  }
  type Box = { pts: number[][]; spread: number; axis: number };
  const boxOf = (ps: number[][]): Box => {
    let spread = -1;
    let axis = 0;
    for (let c = 0; c < 4; c++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const q of ps) {
        lo = Math.min(lo, q[c]);
        hi = Math.max(hi, q[c]);
      }
      if (hi - lo > spread) {
        spread = hi - lo;
        axis = c;
      }
    }
    return { pts: ps, spread, axis };
  };
  const boxes: Box[] = [boxOf(pts)];
  while (boxes.length < COLOURS - 1) {
    // Split the box with the most pixels times spread along its widest channel, at its median.
    let bi = -1;
    let best = 0;
    boxes.forEach((b, i) => {
      const v = b.pts.length * b.spread;
      if (b.pts.length > 1 && v > best) {
        best = v;
        bi = i;
      }
    });
    if (bi < 0) break;
    const b = boxes[bi];
    const sorted = [...b.pts].sort((p, q) => p[b.axis] - q[b.axis] || p[0] - q[0] || p[1] - q[1] || p[2] - q[2] || p[3] - q[3]);
    const mid = sorted.length >> 1;
    boxes.splice(bi, 1, boxOf(sorted.slice(0, mid)), boxOf(sorted.slice(mid)));
  }
  let cols = boxes.map(b => {
    const m = [0, 0, 0, 0];
    for (const q of b.pts) for (let c = 0; c < 4; c++) m[c] += q[c];
    return m.map(v => v / b.pts.length);
  });
  for (let round = 0; round < REFINE; round++) {
    const sum = cols.map(() => [0, 0, 0, 0, 0]);
    for (const q of pts) {
      const i = nearest(cols, q);
      for (let c = 0; c < 4; c++) sum[i][c] += q[c];
      sum[i][4]++;
    }
    cols = cols.map((c, i) => (sum[i][4] ? sum[i].slice(0, 4).map(v => v / sum[i][4]) : c));
  }
  return [[0, 0, 0, 0], ...cols];
}

/** The palette entry nearest a premultiplied colour (r, g, b, alpha). */
function nearest(cols: number[][], q: number[]): number {
  let bi = 0;
  let bd = Infinity;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    const d = (c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2 + (c[2] - q[2]) ** 2 + (c[3] - q[3]) ** 2;
    if (d < bd) {
      bd = d;
      bi = i;
    }
  }
  return bi;
}

/** A palette PNG (colour type 3) with its transparency (tRNS). `pal`: premultiplied r, g, b and alpha (0-255). */
function writePalettePng(file: string, w: number, h: number, idx: Uint8Array, pal: number[][]): number {
  // Entries with any transparency first, so tRNS can stop at the last of them.
  const order = pal.map((_, i) => i).sort((i, j) => (pal[i][3] >= 254.5 ? 1 : 0) - (pal[j][3] >= 254.5 ? 1 : 0) || i - j);
  const remap = new Uint8Array(pal.length);
  order.forEach((old, i) => (remap[old] = i));
  const straight = order.map(i => {
    const [r, g, b, al] = pal[i];
    const A = Math.round(al);
    return A === 0 ? [0, 0, 0, 0] : [r, g, b].map(v => Math.max(0, Math.min(255, Math.round((v * 255) / al)))).concat(A);
  });
  const plte = Buffer.from(straight.flatMap(c => c.slice(0, 3)));
  const lastClear = straight.reduce((m, c, i) => (c[3] < 255 ? i : m), -1);
  const trns = Buffer.from(straight.slice(0, lastClear + 1).map(c => c[3]));
  const raw = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0; // no filter: best for palette pictures
    for (let x = 0; x < w; x++) raw[y * (w + 1) + 1 + x] = remap[idx[y * w + x]];
  }
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(tb) >>> 0);
    return Buffer.concat([len, tb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // palette
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('PLTE', plte),
    ...(trns.length ? [chunk('tRNS', trns)] : []),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9, memLevel: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}

function bake(id: string): Baked {
  const file = path.join(SRC_DIR, `${id}.png`);
  if (!fs.existsSync(file)) throw new Error(`no painting for ${id}: ${path.relative(ROOT, file)}`);
  const { px, ow, oh, ground } = shrink(PNG.sync.read(fs.readFileSync(file)));
  const n = ow * oh;
  const pal = palette(px, n);
  const idx = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const al = px[p * 4 + 3];
    if (Math.round(al) === 0) continue;
    const f = al / 255;
    idx[p] = 1 + nearest(pal.slice(1), [px[p * 4] * f, px[p * 4 + 1] * f, px[p * 4 + 2] * f, al]);
  }
  const bytes = writePalettePng(path.join(OUT_DIR, `${id}.png`), ow, oh, idx, pal);
  return { id, w: ow, h: oh, ground, bytes };
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const known = new Set(LANDMARKS.map(l => l.id));
for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith('.png') && !known.has(f.slice(0, -4))) fs.unlinkSync(path.join(OUT_DIR, f));
const baked = LANDMARKS.map(l => bake(l.id));
fs.writeFileSync(
  OUT_TS,
  `// Generated by scripts/build-landmarks.ts from art/landmarks (the owner's paintings). Do not edit; run
// npm run landmarks:build.
/** Each landmark's picture (by its id): its size in pixels, cut to what is painted, and \`ground\`, where it stands
 * (the foot of its walls) as a share of its height from the top. */
export const LANDMARK_ART: Record<string, { src: number; w: number; h: number; ground: number }> = {
${LANDMARKS.map((l, i) => `  '${l.id}': { src: require('../../../assets/landmarks/${l.id}.png'), w: ${baked[i].w}, h: ${baked[i].h}, ground: ${baked[i].ground.toFixed(3)} }, // ${l.name}`).join('\n')}
};
`,
);
const total = baked.reduce((t, b) => t + b.bytes, 0);
console.log(baked.map(b => `${b.id} ${b.w}x${b.h} ${(b.bytes / 1024).toFixed(1)} KB`).join('\n'));
console.log(`${baked.length} pictures, ${(total / 1024).toFixed(0)} KB`);
