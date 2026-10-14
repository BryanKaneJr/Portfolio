/** Map geometry for the UI: parsed polygons for hit-testing, and where to put nation names. */
import { GRAPH, MAP, MAP_REGION, MAP_SEA } from '../../sim/content';
import type { GameState, NationId, RegionId } from '../../sim/types';

export const MAP_W = MAP.width;
export const MAP_H = MAP.height;

export interface LineCell {
  d: string;
  bbox: [number, number, number, number];
}

/**
 * A long line (the coastline) cut into short runs and grouped by area, so a view strokes only the stretches it
 * shows. Runs share their end points, and with round caps the joins look the same as one unbroken line.
 */
export function lineCells(d: string, cell = 320, run = 48): LineCell[] {
  const cells = new Map<string, { parts: string[]; bbox: [number, number, number, number] }>();
  for (const seg of d.split('M')) {
    const pts = seg.split('L').map(p => p.trim().split(/[\s,]+/).map(Number));
    for (let i = 0; i + 1 < pts.length; i += run - 1) {
      const chunk = pts.slice(i, i + run);
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (const [x, y] of chunk) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      const key = `${Math.floor((x0 + x1) / 2 / cell)},${Math.floor((y0 + y1) / 2 / cell)}`;
      const c = cells.get(key);
      const part = 'M' + chunk.map(p => `${p[0]} ${p[1]}`).join('L');
      if (!c) cells.set(key, { parts: [part], bbox: [x0, y0, x1, y1] });
      else {
        c.parts.push(part);
        c.bbox = [Math.min(c.bbox[0], x0), Math.min(c.bbox[1], y0), Math.max(c.bbox[2], x1), Math.max(c.bbox[3], y1)];
      }
    }
  }
  return [...cells.values()].map(c => ({ d: c.parts.join(''), bbox: c.bbox }));
}

/** The play window's coastline and the far lands' coasts, by area. */
export const COAST_CELLS = lineCells(MAP.coast);
export const FAR_COAST_CELLS = lineCells(MAP.far.map(f => f.coast).join(''));

type Ring = number[]; // flat x,y pairs
interface Shape {
  id: string;
  rings: Ring[];
  bbox: [number, number, number, number];
}

function parsePath(d: string): Ring[] {
  const rings: Ring[] = [];
  let cur: Ring = [];
  const re = /([MLZ])([^MLZ]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    if (cmd === 'Z') {
      if (cur.length) rings.push(cur);
      cur = [];
      continue;
    }
    const nums = m[2].trim().split(/[\s,]+/).map(Number);
    if (cmd === 'M' && cur.length) {
      rings.push(cur);
      cur = [];
    }
    for (let i = 0; i + 1 < nums.length; i += 2) cur.push(nums[i], nums[i + 1]);
  }
  if (cur.length) rings.push(cur);
  return rings;
}

function bboxOf(rings: Ring[]): [number, number, number, number] {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const r of rings)
    for (let i = 0; i < r.length; i += 2) {
      if (r[i] < x0) x0 = r[i];
      if (r[i] > x1) x1 = r[i];
      if (r[i + 1] < y0) y0 = r[i + 1];
      if (r[i + 1] > y1) y1 = r[i + 1];
    }
  return [x0, y0, x1, y1];
}

const regionShapes: Shape[] = MAP.regions.map(r => {
  const rings = parsePath(r.path);
  return { id: r.id, rings, bbox: bboxOf(rings) };
});
const seaShapes: Shape[] = MAP.seas
  .filter(s => !s.closed)
  .map(s => {
    const rings = parsePath(s.path);
    return { id: s.id, rings, bbox: bboxOf(rings) };
  });
const wasteShapes: Shape[] = MAP.wastelands.map(w => {
  const rings = parsePath(w.path);
  return { id: w.id, rings, bbox: bboxOf(rings) };
});
/** Bounding boxes of the wildernesses (for drawing only what is on screen). */
export const WASTE_BBOX: Record<string, [number, number, number, number]> = Object.fromEntries(wasteShapes.map(w => [w.id, w.bbox]));

function inside(shape: Shape, x: number, y: number): boolean {
  const [x0, y0, x1, y1] = shape.bbox;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  let c = false;
  for (const r of shape.rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i],
        yi = r[i + 1],
        xj = r[j],
        yj = r[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

export function regionAt(x: number, y: number): RegionId | null {
  for (const s of regionShapes) if (inside(s, x, y)) return s.id;
  return null;
}
const REGION_SHAPE = new Map(regionShapes.map(s => [s.id, s]));
/** Is this point inside this region (cheaper than regionAt when the region is known)? */
export function inRegion(id: RegionId, x: number, y: number): boolean {
  const shape = REGION_SHAPE.get(id);
  return !!shape && inside(shape, x, y);
}
export function wasteAt(x: number, y: number): string | null {
  for (const s of wasteShapes) if (inside(s, x, y)) return s.id;
  return null;
}
export function seaAt(x: number, y: number): string | null {
  for (const s of seaShapes) if (inside(s, x, y)) return s.id;
  return null;
}

export const regionPoint = (id: string): [number, number] => (MAP_REGION[id]?.label ?? MAP_SEA[id]?.label ?? [0, 0]) as [number, number];

export interface NationLabel {
  nation: NationId;
  x: number;
  y: number;
  size: number; // map units
  area: number;
}

/** Each nation's biggest connected block of land (its regions). */
function nationBlocks(s: GameState): { nation: NationId; regions: RegionId[]; area: number }[] {
  const byOwner = new Map<NationId, RegionId[]>();
  for (const r of Object.values(s.regions)) {
    if (!r.owner) continue;
    const l = byOwner.get(r.owner);
    if (l) l.push(r.id);
    else byOwner.set(r.owner, [r.id]);
  }
  const out: { nation: NationId; regions: RegionId[]; area: number }[] = [];
  for (const [n, regions] of byOwner) {
    const set = new Set(regions);
    const seen = new Set<RegionId>();
    let best: RegionId[] = [];
    let bestArea = 0;
    for (const start of regions) {
      if (seen.has(start)) continue;
      const comp: RegionId[] = [];
      const q = [start];
      seen.add(start);
      while (q.length) {
        const cur = q.pop()!;
        comp.push(cur);
        for (const e of GRAPH[cur]) if (e.kind === 'land' && set.has(e.to) && !seen.has(e.to)) {
          seen.add(e.to);
          q.push(e.to);
        }
      }
      const area = comp.reduce((t, r) => t + MAP_REGION[r].area, 0);
      if (area > bestArea) {
        bestArea = area;
        best = comp;
      }
    }
    out.push({ nation: n, regions: best, area: bestArea });
  }
  return out;
}

const shapeById = new Map(regionShapes.map(sh => [sh.id, sh]));

export interface NationArc {
  nation: NationId;
  curve: [[number, number], [number, number], [number, number]]; // quadratic baseline, left to right (map units)
  mid: [number, number];
  length: number; // of the baseline (map units)
  thickness: number; // room across the land at the middle (map units)
  samples: [number, number][]; // points along the baseline, for keeping names apart
  area: number;
}

/**
 * Where each nation's name is written, the way old atlases and strategy maps do it: along the long axis of its
 * land, bending gently with the shape (Chile, Norway, the Ottoman crescent), always reading left to right.
 */
export function nationArcs(s: GameState): NationArc[] {
  const out: NationArc[] = [];
  for (const b of nationBlocks(s)) {
    const pts: number[] = [];
    for (const id of b.regions) {
      const sh = shapeById.get(id);
      if (!sh) continue;
      for (const r of sh.rings) for (let i = 0; i < r.length; i += 4) pts.push(r[i], r[i + 1]);
    }
    const n = pts.length / 2;
    if (n < 6) continue;
    let mx = 0,
      my = 0;
    for (let i = 0; i < n; i++) {
      mx += pts[2 * i];
      my += pts[2 * i + 1];
    }
    mx /= n;
    my /= n;
    let sxx = 0,
      syy = 0,
      sxy = 0;
    for (let i = 0; i < n; i++) {
      const dx = pts[2 * i] - mx;
      const dy = pts[2 * i + 1] - my;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
    let ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    // A roundish country is written level; nothing steeper than 75 degrees.
    const spread = Math.sqrt(((sxx - syy) / n) ** 2 + (2 * sxy / n) ** 2) / ((sxx + syy) / n);
    if (spread < 0.25) ang = 0;
    ang = Math.max(-1.31, Math.min(1.31, ang));
    // Within 75 degrees of level the axis always points rightwards, so names read left to right, tilted at most
    // 75 degrees either way (never upside down).
    const ux = Math.cos(ang),
      uy = Math.sin(ang);
    const vx = -uy,
      vy = ux;
    let tMin = Infinity,
      tMax = -Infinity;
    const ts = new Float64Array(n);
    const ns = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const dx = pts[2 * i] - mx;
      const dy = pts[2 * i + 1] - my;
      ts[i] = dx * ux + dy * uy;
      ns[i] = dx * vx + dy * vy;
      if (ts[i] < tMin) tMin = ts[i];
      if (ts[i] > tMax) tMax = ts[i];
    }
    const len = tMax - tMin;
    // The middle of the land across the axis, near each end and in the middle: the spine the name follows.
    const across = (t0: number, t1: number) => {
      let lo = Infinity,
        hi = -Infinity;
      for (let i = 0; i < n; i++) {
        if (ts[i] < t0 || ts[i] > t1) continue;
        if (ns[i] < lo) lo = ns[i];
        if (ns[i] > hi) hi = ns[i];
      }
      return lo === Infinity ? { c: 0, w: 0 } : { c: (lo + hi) / 2, w: hi - lo };
    };
    const tA = tMin + len * 0.14;
    const tB = tMin + len * 0.86;
    const left = across(tMin + len * 0.08, tMin + len * 0.24);
    const mid = across(tMin + len * 0.4, tMin + len * 0.6);
    const right = across(tMin + len * 0.76, tMin + len * 0.92);
    const at = (t: number, c: number): [number, number] => [mx + ux * t + vx * c, my + uy * t + vy * c];
    // The ends follow the land, but the line through them turns at most 20 degrees off the axis and never past
    // 75 degrees from level.
    const lean = Math.max(Math.max(-0.35, -1.31 - ang), Math.min(Math.min(0.35, 1.31 - ang), Math.atan2(right.c - left.c, tB - tA)));
    const meanC = (left.c + right.c) / 2;
    const half = (Math.tan(lean) * (tB - tA)) / 2;
    const bendLimit = len * 0.18;
    const midC = Math.max(meanC - bendLimit, Math.min(meanC + bendLimit, mid.c));
    const A = at(tA, meanC - half);
    const B = at(tB, meanC + half);
    const M = at((tA + tB) / 2, midC);
    const ctrl: [number, number] = [2 * M[0] - (A[0] + B[0]) / 2, 2 * M[1] - (A[1] + B[1]) / 2];
    const samples: [number, number][] = [];
    for (let k = 0; k <= 8; k++) {
      const q = k / 8;
      samples.push([
        (1 - q) * (1 - q) * A[0] + 2 * (1 - q) * q * ctrl[0] + q * q * B[0],
        (1 - q) * (1 - q) * A[1] + 2 * (1 - q) * q * ctrl[1] + q * q * B[1],
      ]);
    }
    let arcLen = 0;
    for (let k = 1; k < samples.length; k++) arcLen += Math.hypot(samples[k][0] - samples[k - 1][0], samples[k][1] - samples[k - 1][1]);
    out.push({
      nation: b.nation,
      curve: [A, ctrl, B],
      mid: samples[4],
      length: arcLen,
      thickness: Math.max(mid.w, Math.min(left.w, right.w)),
      samples,
      area: b.area,
    });
  }
  return out;
}

/** One label per nation, on its biggest connected block of land. */
export function nationLabels(s: GameState): NationLabel[] {
  const byOwner = new Map<NationId, RegionId[]>();
  for (const r of Object.values(s.regions)) {
    if (!r.owner) continue;
    const l = byOwner.get(r.owner);
    if (l) l.push(r.id);
    else byOwner.set(r.owner, [r.id]);
  }
  const out: NationLabel[] = [];
  for (const [n, regions] of byOwner) {
    const set = new Set(regions);
    const seen = new Set<RegionId>();
    let best: RegionId[] = [];
    let bestArea = 0;
    for (const start of regions) {
      if (seen.has(start)) continue;
      const comp: RegionId[] = [];
      const q = [start];
      seen.add(start);
      while (q.length) {
        const cur = q.pop()!;
        comp.push(cur);
        for (const e of GRAPH[cur]) if (e.kind === 'land' && set.has(e.to) && !seen.has(e.to)) {
          seen.add(e.to);
          q.push(e.to);
        }
      }
      const area = comp.reduce((t, r) => t + MAP_REGION[r].area, 0);
      if (area > bestArea) {
        bestArea = area;
        best = comp;
      }
    }
    let x = 0,
      y = 0;
    for (const r of best) {
      const a = MAP_REGION[r].area;
      x += MAP_REGION[r].label[0] * a;
      y += MAP_REGION[r].label[1] * a;
    }
    x /= bestArea;
    y /= bestArea;
    // Keep the label on land: snap to the region whose label point is nearest the centroid.
    const near = best.reduce((acc, r) => {
      const [lx, ly] = MAP_REGION[r].label;
      const d = (lx - x) ** 2 + (ly - y) ** 2;
      return d < acc.d ? { r, d } : acc;
    }, { r: best[0], d: Infinity });
    if (best.length <= 2) [x, y] = MAP_REGION[near.r].label;
    out.push({ nation: n, x, y, size: Math.sqrt(bestArea) * 0.22, area: bestArea });
  }
  return out;
}
