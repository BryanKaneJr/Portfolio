/**
 * Makes the owner's unit drawings ready for the map: the soldiers (art/troops) and the ships (art/ships). Each is cut
 * to what is drawn and made smaller (area-averaged, in premultiplied colour), written to assets/units/<name>.png, and
 * listed with its size in src/ui/map/unitArt.ts, which MapView's army and fleet tokens draw from. For a ship it also
 * notes where its tallest mast stands (`mast`, a share of its width), so the realm's banner flies from it.
 *
 * Each figure also gets its shadow, <name>-shadow.png: the figure's silhouette cast on the ground behind it and to
 * the right (lit from the front left), flattened, blurred and fading with height, so the figure stands on the map
 * rather than floating over it. Its place is given in the figure's own pixels (`shadow`).
 *
 *   npx tsx scripts/build-units.ts        (npm run units:build)
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets/units');
const OUT_TS = path.join(ROOT, 'src/ui/map/unitArt.ts');
/** Pixels, a figure's height: enough for the tallest token (about 60 points at the closest zoom) on a 3x screen. */
const HEIGHT = 192;

const TROOPS = [
  { name: 'soldier-a', what: 'a lone halberdier' },
  { name: 'soldier-b', what: 'a lone halberdier, slashed sleeves' },
  { name: 'squad-4', what: 'four pikemen' },
  { name: 'squad-5', what: 'five men, pikes and a halberd' },
] as const;
const SHIPS = [
  { name: 'ship', what: 'a lone ship' },
  { name: 'fleet', what: 'five ships' },
] as const;

interface Baked {
  w: number;
  h: number;
  mast: number;
  shadow: { x: number; y: number; w: number; h: number };
}

/** The cast shadow: a point `h` pixels above the feet falls SHADOW_X * h to the right and SHADOW_Y * h up; it is
 * blurred by SHADOW_BLUR pixels, SHADOW_ALPHA dark at the feet and fading to a third of that at the top. */
const SHADOW_X = 0.42;
const SHADOW_Y = 0.24;
const SHADOW_BLUR = 3;
const SHADOW_ALPHA = 0.62;

/** A box blur of radius r, run three times (close to a gaussian), on a one-channel image. */
function blur(a: Float64Array, w: number, h: number, r: number): Float64Array {
  let src = a;
  for (let pass = 0; pass < 3; pass++) {
    const tmp = new Float64Array(w * h);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum / (2 * r + 1);
        sum += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
      }
    }
    const out = new Float64Array(w * h);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / (2 * r + 1);
        sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    src = out;
  }
  return src;
}

/** The figure's shadow (from its alpha, ow x oh, standing on its bottom row), written to <name>-shadow.png. */
function castShadow(name: string, alpha: Float64Array, ow: number, oh: number): Baked['shadow'] {
  const pad = SHADOW_BLUR * 3 + 2;
  const sw = Math.ceil(ow + oh * SHADOW_X) + 2 * pad;
  const sh = Math.ceil(oh * SHADOW_Y) + 2 * pad;
  // The shadow canvas's (pad, sh - pad) is the figure's bottom-left corner (its feet's row).
  const feetY = sh - pad;
  const a = new Float64Array(sw * sh);
  for (let Y = 0; Y < sh; Y++) {
    const up = (feetY - Y) / SHADOW_Y; // how high above the feet this point of the shadow comes from
    if (up < 0 || up > oh) continue;
    const sy = oh - 1 - up;
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    for (let X = 0; X < sw; X++) {
      const sx = X - pad - up * SHADOW_X;
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const at = (x: number, y: number) => (x >= 0 && x < ow && y >= 0 && y < oh ? alpha[y * ow + x] : 0);
      const v = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
      a[Y * sw + X] = v * (1 - (0.67 * up) / oh);
    }
  }
  const b = blur(a, sw, sh, SHADOW_BLUR);
  const out = new PNG({ width: sw, height: sh });
  for (let p = 0; p < sw * sh; p++) {
    out.data[p * 4] = 24;
    out.data[p * 4 + 1] = 16;
    out.data[p * 4 + 2] = 8;
    out.data[p * 4 + 3] = Math.round(Math.min(1, b[p] * SHADOW_ALPHA) * 255);
  }
  fs.writeFileSync(path.join(OUT_DIR, `${name}-shadow.png`), PNG.sync.write(out, { colorType: 6 }));
  return { x: -pad, y: oh - feetY, w: sw, h: sh };
}

function bake(dir: string, name: string): Baked {
  const src = PNG.sync.read(fs.readFileSync(path.join(ROOT, dir, `${name}.png`)));
  // What is drawn: the bounds of everything not transparent. The bottom is where the figure stands.
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
  // The top of the tallest part (a ship's mainmast): the middle of the drawn pixels in the top row.
  let sx = 0, n = 0;
  for (let x = x0; x < x1; x++)
    if (src.data[(y0 * src.width + x) * 4 + 3] > 8) {
      sx += x;
      n++;
    }
  const mast = (sx / n + 0.5 - x0) / cw;
  const oh = Math.min(HEIGHT, ch);
  const ow = Math.round((cw * oh) / ch);
  const acc = new Float64Array(ow * oh * 4); // r, g, b (premultiplied), alpha; each output pixel's weights sum to 1
  for (let y = 0; y < ch; y++) {
    const oy0 = (y * oh) / ch;
    const oy1 = ((y + 1) * oh) / ch;
    for (let x = 0; x < cw; x++) {
      const ox0 = (x * ow) / cw;
      const ox1 = ((x + 1) * ow) / cw;
      const i = ((y0 + y) * src.width + x0 + x) * 4;
      const a = src.data[i + 3] / 255;
      if (a === 0) continue;
      for (let oy = Math.floor(oy0); oy < Math.min(oh, Math.ceil(oy1)); oy++) {
        const wy = Math.min(oy1, oy + 1) - Math.max(oy0, oy);
        for (let ox = Math.floor(ox0); ox < Math.min(ow, Math.ceil(ox1)); ox++) {
          const wgt = wy * (Math.min(ox1, ox + 1) - Math.max(ox0, ox));
          if (wgt <= 0) continue;
          const o = (oy * ow + ox) * 4;
          acc[o] += src.data[i] * a * wgt;
          acc[o + 1] += src.data[i + 1] * a * wgt;
          acc[o + 2] += src.data[i + 2] * a * wgt;
          acc[o + 3] += a * wgt;
        }
      }
    }
  }
  const out = new PNG({ width: ow, height: oh });
  const alpha = new Float64Array(ow * oh);
  for (let p = 0; p < ow * oh; p++) {
    const a = acc[p * 4 + 3];
    alpha[p] = Math.min(1, a);
    out.data[p * 4 + 3] = Math.round(Math.min(1, a) * 255);
    for (let c = 0; c < 3; c++) out.data[p * 4 + c] = a > 0 ? Math.round(Math.min(255, acc[p * 4 + c] / a)) : 0;
  }
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), PNG.sync.write(out, { colorType: 6 }));
  return { w: ow, h: oh, mast, shadow: castShadow(name, alpha, ow, oh) };
}

const troops = TROOPS.map(a => bake('art/troops', a.name));
const ships = SHIPS.map(a => bake('art/ships', a.name));
const src = (name: string) => `require('../../../assets/units/${name}.png')`;
const shadow = (name: string, b: Baked) => `shadow: { src: ${src(`${name}-shadow`)}, x: ${b.shadow.x}, y: ${b.shadow.y}, w: ${b.shadow.w}, h: ${b.shadow.h} }`;
fs.writeFileSync(
  OUT_TS,
  `// Generated by scripts/build-units.ts from art/troops and art/ships (the owner's drawings). Do not edit; run
// npm run units:build.
/** The army figures: each picture's size in pixels; the figure stands on its bottom edge. \`shadow\`: its cast shadow's
 * picture and box, in the figure's pixels from its top left. */
export const TROOP_ART = {
${TROOPS.map((a, i) => `  '${a.name}': { src: ${src(a.name)}, w: ${troops[i].w}, h: ${troops[i].h}, ${shadow(a.name, troops[i])} }, // ${a.what}`).join('\n')}
} as const;
export type TroopArt = keyof typeof TROOP_ART;
/** The fleet figures, the same way; \`mast\`: where the tallest mast's top is, as a share of the width from the left. */
export const SHIP_ART = {
${SHIPS.map((a, i) => `  '${a.name}': { src: ${src(a.name)}, w: ${ships[i].w}, h: ${ships[i].h}, mast: ${ships[i].mast.toFixed(3)}, ${shadow(a.name, ships[i])} }, // ${a.what}`).join('\n')}
} as const;
export type ShipArt = keyof typeof SHIP_ART;
`,
);
console.log([...TROOPS, ...SHIPS].map((a, i) => { const b = [...troops, ...ships][i]; return `${a.name} ${b.w}x${b.h}`; }).join(', '));
