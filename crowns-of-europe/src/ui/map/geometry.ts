/** Map geometry for the UI: parsed polygons for hit-testing, and where to put nation names. */
import { GRAPH, MAP, MAP_REGION, MAP_SEA } from '../../sim/content';
import type { GameState, NationId, RegionId } from '../../sim/types';

export const MAP_W = MAP.width;
export const MAP_H = MAP.height;

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
