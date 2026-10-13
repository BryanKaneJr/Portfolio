/**
 * The nations' map colours (nations.json `color`): every one unlike every other, and a nation's neighbours (land or
 * strait, as the game starts) far unlike it, its neighbours' neighbours and those across a shared sea clearly so.
 * Colours are compared as the map draws them (nationColor: a little parchment mixed in), in OKLab.
 *
 *   npx tsx scripts/dev/nation-colors.ts           report the closest pairs of the colours in nations.json
 *   npx tsx scripts/dev/nation-colors.ts --write   pick new colours (simulated annealing, seeded) and write them
 *
 * The iconic colours (ANCHOR) are kept close to their hue; everyone else may move anywhere in a band of lightness and
 * colourfulness that reads well under the realms' wash on every style. tests/map.test.ts checks the limits (MIN_* in
 * scripts/lib/nationColors.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { NATION } from '../../src/sim/content';
import { PARCHMENT, colorDistance, mix, oklab } from '../../src/ui/map/colorMath';
import { MIN_ALL, MIN_NEAR, MIN_NEIGHBOUR, nationPairs } from '../lib/nationColors';

const ANCHOR: Record<string, string> = {
  FRA: '#3a63b5', // royal blue
  ENG: '#c0392b', // red
  CAS: '#e0b23a', // gold
  ARA: '#e07b39', // orange, the gold and red of its pales
  POR: '#2d7a4c', // green
  TUR: '#2a8c87', // teal
  HAB: '#e9e6dc', // white (a cool white, so it is not the parchment of the unknown)
  MOS: '#3f8f3a', // green
  SWE: '#5b8fd0', // a lighter blue than France's
  POL: '#b8336a', // crimson
  BUR: '#8b5ca8', // purple
  BYZ: '#8e2f6d', // purple
  HUN: '#94a83f', // olive
};

const shown = (hex: string) => mix(hex, PARCHMENT, 0.12);

function report(colors: Record<string, string>) {
  const { neighbours, near } = nationPairs();
  const ids = Object.keys(colors);
  const rows: [number, string, string][] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const k = ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`;
      const kind = neighbours.has(k) ? 'neighbours' : near.has(k) ? 'near' : 'apart';
      rows.push([colorDistance(shown(colors[ids[i]]), shown(colors[ids[j]])), k, kind]);
    }
  for (const kind of ['neighbours', 'near', 'apart']) {
    const r = rows.filter(x => x[2] === kind).sort((a, b) => a[0] - b[0]);
    console.log(`${kind}: ${r.length} pairs, closest ${r.slice(0, 6).map(x => `${x[1]} ${x[0].toFixed(3)}`).join(', ')}`);
  }
  console.log(`parchment: closest ${ids.map(id => [id, colorDistance(shown(colors[id]), PARCHMENT)] as const).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([id, d]) => `${id} ${d.toFixed(3)}`).join(', ')}`);
}

// ---------------------------------------------------------------- OKLCh <-> sRGB
function fromOklch(L: number, C: number, h: number): string | null {
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  if (rgb.some(c => c < -0.001 || c > 1.001)) return null;
  const enc = (c: number) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
  return '#' + rgb.map(c => enc(c).toString(16).padStart(2, '0')).join('');
}
function toOklch(hex: string): [number, number, number] {
  const [L, a, b] = oklab(hex);
  return [L, Math.hypot(a, b), Math.atan2(b, a)];
}

function optimise(start: Record<string, string>, seed: number): { colors: Record<string, string>; cost: number } {
  const { neighbours, near } = nationPairs();
  const ids = Object.keys(start);
  const index = new Map(ids.map((id, i) => [id, i]));
  const pairs: [number, number, number, number][] = []; // i, j, minimum, weight
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const k = ids[i] < ids[j] ? `${ids[i]}|${ids[j]}` : `${ids[j]}|${ids[i]}`;
      if (neighbours.has(k)) pairs.push([i, j, MIN_NEIGHBOUR + 0.03, 60]);
      else if (near.has(k)) pairs.push([i, j, MIN_NEAR + 0.025, 40]);
      else pairs.push([i, j, MIN_ALL + 0.02, 40]);
    }
  const byNation = ids.map(() => [] as number[]);
  pairs.forEach(([i, j], p) => {
    byNation[i].push(p);
    byNation[j].push(p);
  });
  let rand = seed;
  const rnd = () => ((rand = (rand * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const lch = ids.map(id => toOklch(start[id]));
  const hex = ids.map(id => start[id]);
  const lab = hex.map(h => oklab(shown(h)));
  const parch = oklab(PARCHMENT);
  const rebels = oklab('#3a3a3a');
  const dist = (x: number[], y: number[]) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  const own = (i: number, c: [number, number, number], lb: number[]) => {
    const [L, C] = c;
    let e = 0;
    // A band that reads well under the wash on every style: not too dark, not paper-pale, and muted like an old
    // atlas (colourful enough to tell apart, never neon).
    if (L < 0.4) e += (0.4 - L) ** 2 * 600;
    if (L > 0.87) e += (L - 0.87) ** 2 * 600;
    const hue = ((((c[2] * 180) / Math.PI) % 360) + 360) % 360;
    // Light colours stay soft, and cyans (which look electric long before other hues) softer still.
    const cmax = Math.min(L > 0.7 ? 0.13 - 0.25 * (L - 0.7) : 0.13, hue > 185 && hue < 245 ? 0.085 : 1);
    if (C > cmax) e += (C - cmax) ** 2 * 6000;
    if (C > 0.09) e += (C - 0.09) ** 2 * 60;
    // Not grey (that is the rebels' and the wilds'), unless the realm's colour is white; and never the parchment.
    if (C < 0.04 && ids[i] !== 'HAB') e += (0.04 - C) ** 2 * 3000;
    const dp = dist(lb, parch);
    if (dp < 0.08) e += (0.08 - dp) ** 2 * 3000;
    const dr = dist(lb, rebels);
    if (dr < 0.2) e += (0.2 - dr) ** 2 * 3000;
    const anchor = ANCHOR[ids[i]];
    const target = oklab(shown(anchor ?? start[ids[i]]));
    e += dist(lb, target) ** 2 * (anchor ? 4000 : 1.5);
    return e;
  };
  const pairCost = (p: number, labs: number[][]) => {
    const [i, j, min, w] = pairs[p];
    const d = dist(labs[i], labs[j]);
    return d < min ? (min - d) ** 2 * w * 100 : 0;
  };
  let T = 0.05;
  const N = 800000;
  for (let it = 0; it < N; it++) {
    const i = Math.floor(rnd() * ids.length);
    const [L, C, h] = lch[i];
    const step = 0.25 + 0.75 * (1 - it / N);
    const cand: [number, number, number] = [L + (rnd() - 0.5) * 0.08 * step, Math.max(0, C + (rnd() - 0.5) * 0.06 * step), h + (rnd() - 0.5) * 0.9 * step];
    const hx = fromOklch(...cand);
    if (!hx) continue;
    const lb = oklab(shown(hx));
    let before = own(i, lch[i], lab[i]);
    for (const p of byNation[i]) before += pairCost(p, lab);
    const old = lab[i];
    lab[i] = lb;
    let after = own(i, cand, lb);
    for (const p of byNation[i]) after += pairCost(p, lab);
    if (after <= before || rnd() < Math.exp((before - after) / T)) {
      lch[i] = cand;
      hex[i] = hx;
    } else lab[i] = old;
    T = 0.05 * Math.pow(0.0005 / 0.05, it / N);
  }
  void index;
  let cost = 0;
  for (let i = 0; i < ids.length; i++) cost += own(i, lch[i], lab[i]);
  for (let p = 0; p < pairs.length; p++) cost += pairCost(p, lab);
  return { colors: Object.fromEntries(ids.map((id, i) => [id, hex[i]])), cost };
}

const current = Object.fromEntries(Object.values(NATION).map(n => [n.id, n.color]));
if (process.argv.includes('--write')) {
  // A few seeded runs; the best one wins.
  const runs = [12345, 777, 4242, 9001].map(seed => optimise(current, seed));
  runs.forEach((r, i) => console.log(`run ${i}: cost ${r.cost.toFixed(4)}`));
  const next = runs.sort((a, b) => a.cost - b.cost)[0].colors;
  const file = path.join(__dirname, '../../src/content/nations.json');
  let text = fs.readFileSync(file, 'utf8');
  for (const [id, c] of Object.entries(next)) {
    const re = new RegExp(`("id": "${id}",[^\\n]*?"color": ")#[0-9a-fA-F]{6}(")`);
    if (!re.test(text)) throw new Error(`no colour for ${id}`);
    text = text.replace(re, `$1${c}$2`);
  }
  fs.writeFileSync(file, text);
  console.log('wrote', file);
  report(next);
} else report(current);
