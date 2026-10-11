/**
 * Builds src/content/map.json from the region and sea seeds in src/content/{regions,seas}.json.
 *
 * Land shapes come from Natural Earth 1:50m land (public domain, via the world-atlas package).
 * Each landmass is split between the seeds that sit on it: a fine jittered grid of Voronoi cells is
 * handed to the nearest seed, so borders get an organic, hand-drawn wobble instead of straight lines.
 * Islands only ever go to seeds on the same island (so Rhodes never grabs the Anatolian coast).
 * Sea zones are plain Voronoi cells of the sea seeds; land is drawn on top, so they never need clipping.
 * A topology pass (topojson) simplifies shared borders once, so neighbours never gap or overlap,
 * and gives us adjacency plus the border lines used for thick nation borders.
 *
 * Run: npm run map:build  (takes ~a minute)
 */
import fs from 'node:fs';
import path from 'node:path';
import { geoAzimuthalEqualArea, geoPath } from 'd3-geo';
import { Delaunay } from 'd3-delaunay';
import * as topojsonClient from 'topojson-client';
import * as topojsonServer from 'topojson-server';
import * as topojsonSimplify from 'topojson-simplify';
import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import polylabel from 'polylabel';

type LonLat = [number, number];
type Pt = [number, number];

const ROOT = path.resolve(__dirname, '..');
const regions: { id: string; name: string; seeds: LonLat[] }[] = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/regions.json'), 'utf8'),
);
const seaData: {
  seas: { id: string; name: string; seeds: LonLat[] }[];
  wastelands: { id: string; name: string; seeds: LonLat[] }[];
} = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/seas.json'), 'utf8'));

// Lambert azimuthal equal-area centred on central Europe.
const WIDTH = 1000;
const projection = geoAzimuthalEqualArea().rotate([-16, -51]).scale(1).translate([0, 0]);
const p = (ll: LonLat): Pt => projection(ll) as Pt;

// Window: Ireland and Morocco's Atlantic coast to the Volga, North Cape to the Sahara's edge.
const frame: LonLat[] = [[-9.9, 30.4], [-10.6, 52], [-9.6, 38.7], [25.8, 71.2], [32, 70.2], [47, 57], [47, 46], [44, 40], [0, 29.6], [31, 29.6]];
const left = Math.min(...frame.map(f => p(f)[0]));
const right = Math.max(...frame.map(f => p(f)[0]));
const top = Math.min(...frame.map(f => p(f)[1]));
const bottom = Math.max(...frame.map(f => p(f)[1]));
const scale = WIDTH / (right - left);
const HEIGHT = Math.round((bottom - top) * scale);
const toPx = (ll: LonLat): Pt => {
  const [x, y] = p(ll);
  return [(x - left) * scale, (y - top) * scale];
};
const toLonLat = (pt: Pt): LonLat => {
  const ll = projection.invert!([pt[0] / scale + left, pt[1] / scale + top]) as LonLat;
  return [round(ll[0], 2), round(ll[1], 2)];
};
function round(n: number, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

console.log(`map ${WIDTH} x ${HEIGHT}`);

// ---------- land ----------
const landTopo = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/world-atlas/land-50m.json'), 'utf8'));
const landGeo = topojsonClient.feature(landTopo, landTopo.objects.land) as any;
const landGeoms: any[] = landGeo.type === 'FeatureCollection' ? landGeo.features.map((f: any) => f.geometry) : [landGeo.geometry];

const windowPoly: Polygon = [
  [
    [0, 0],
    [WIDTH, 0],
    [WIDTH, HEIGHT],
    [0, HEIGHT],
    [0, 0],
  ],
];
const pad = 40;
const loose: Polygon = [
  [
    [-pad, -pad],
    [WIDTH + pad, -pad],
    [WIDTH + pad, HEIGHT + pad],
    [-pad, HEIGHT + pad],
    [-pad, -pad],
  ],
];

// Project land through d3's spherical pipeline: it handles the antimeridian seam and clips to the window.
const pixelProjection = geoAzimuthalEqualArea()
  .rotate([-16, -51])
  .scale(scale)
  .translate([-left * scale, -top * scale])
  .clipExtent([
    [-1, -1],
    [WIDTH + 1, HEIGHT + 1],
  ])
  .precision(0.1);
const projectedLand: MultiPolygon = [];
for (const g of landGeoms) {
  const polys: LonLat[][][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) {
    const rings: Ring[] = [];
    let cur: Pt[] = [];
    const recorder = {
      moveTo(x: number, y: number) {
        cur = [[x, y]];
      },
      lineTo(x: number, y: number) {
        cur.push([x, y]);
      },
      closePath() {
        if (cur.length >= 3) rings.push([...cur, cur[0]]);
        cur = [];
      },
      arc() {},
      rect() {},
    };
    geoPath(pixelProjection, recorder as any)({ type: 'Polygon', coordinates: poly } as any);
    if (!rings.length) continue;
    const composed = (polygonClipping.xor as (...g: Polygon[]) => MultiPolygon)(...rings.map(r => [r] as Polygon));
    projectedLand.push(...composed);
  }
}
const land: MultiPolygon = polygonClipping.intersection(polygonClipping.union(projectedLand), windowPoly);
const landmasses = land.filter(poly => Math.abs(ringArea(poly[0])) > 0.6);
console.log(`landmasses: ${landmasses.length}`);

function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2;
}
function polyArea(poly: Polygon): number {
  return Math.abs(ringArea(poly[0])) - poly.slice(1).reduce((s, h) => s + Math.abs(ringArea(h)), 0);
}
function pointInRing(pt: Pt, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInPoly(pt: Pt, poly: Polygon): boolean {
  if (!pointInRing(pt, poly[0])) return false;
  for (let h = 1; h < poly.length; h++) if (pointInRing(pt, poly[h])) return false;
  return true;
}
function bboxOf(poly: Polygon): [number, number, number, number] {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y] of poly[0]) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}
function distToSegment(pt: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  let t = len ? ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(pt[0] - (a[0] + t * dx), pt[1] - (a[1] + t * dy));
}
function distToPoly(pt: Pt, poly: Polygon): number {
  if (pointInPoly(pt, poly)) return 0;
  let best = Infinity;
  for (const r of poly) for (let i = 0; i < r.length - 1; i++) best = Math.min(best, distToSegment(pt, r[i] as Pt, r[i + 1] as Pt));
  return best;
}

// Deterministic pseudo-random numbers so the map is identical on every build.
let rngState = 1444;
function rand() {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return rngState / 0x7fffffff;
}

// ---------- seeds ----------
type Seed = { owner: string; kind: 'region' | 'waste'; pt: Pt };
const seeds: Seed[] = [];
for (const r of regions) for (const s of r.seeds) seeds.push({ owner: r.id, kind: 'region', pt: toPx(s) });
for (const w of seaData.wastelands) for (const s of w.seeds) seeds.push({ owner: 'waste:' + w.id, kind: 'waste', pt: toPx(s) });

const landmassSeeds: Seed[][] = landmasses.map(() => []);
const warnings: string[] = [];
for (const s of seeds) {
  let idx = landmasses.findIndex(lm => pointInPoly(s.pt, lm));
  if (idx < 0) {
    // A seed in the water: attach it to the closest landmass, and say so (usually a typo).
    let best = Infinity;
    landmasses.forEach((lm, i) => {
      const [x0, y0, x1, y1] = bboxOf(lm);
      if (s.pt[0] < x0 - 30 || s.pt[0] > x1 + 30 || s.pt[1] < y0 - 30 || s.pt[1] > y1 + 30) return;
      const d = distToPoly(s.pt, lm);
      if (d < best) {
        best = d;
        idx = i;
      }
    });
    if (best > 3) warnings.push(`seed of ${s.owner} is ${best.toFixed(1)}px off the coast`);
  }
  if (idx >= 0) landmassSeeds[idx].push(s);
  else warnings.push(`seed of ${s.owner} found no landmass`);
}

// ---------- split landmasses ----------
const pieces = new Map<string, MultiPolygon>();
const addPiece = (owner: string, mp: MultiPolygon) => {
  if (!mp.length) return;
  pieces.set(owner, [...(pieces.get(owner) ?? []), ...mp]);
};

const CELL = 4.5;
landmasses.forEach((lm, i) => {
  let ls = landmassSeeds[i];
  if (ls.length === 0) {
    // Small islands with no seed of their own join the nearest seed within reach.
    const c = polylabel(lm as any, 1) as unknown as Pt;
    let best: Seed | null = null;
    let bd = Infinity;
    for (const s of seeds) {
      const d = Math.hypot(s.pt[0] - c[0], s.pt[1] - c[1]);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (best && bd < 120) addPiece(best.owner, [lm]);
    return;
  }
  const owners = new Set(ls.map(s => s.owner));
  if (owners.size === 1) {
    addPiece(ls[0].owner, [lm]);
    return;
  }
  const [x0, y0, x1, y1] = bboxOf(lm);
  const pts: number[] = [];
  for (let y = y0 - CELL; y <= y1 + CELL; y += CELL)
    for (let x = x0 - CELL; x <= x1 + CELL; x += CELL) pts.push(x + (rand() - 0.5) * CELL * 0.9, y + (rand() - 0.5) * CELL * 0.9);
  const delaunay = new Delaunay(Float64Array.from(pts));
  const vor = delaunay.voronoi([x0 - CELL * 2, y0 - CELL * 2, x1 + CELL * 2, y1 + CELL * 2]);
  const byOwner = new Map<string, Polygon[]>();
  const n = pts.length / 2;
  for (let k = 0; k < n; k++) {
    const cx = pts[2 * k];
    const cy = pts[2 * k + 1];
    let best = ls[0];
    let bd = Infinity;
    for (const s of ls) {
      const d = Math.hypot(s.pt[0] - cx, s.pt[1] - cy);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    const cell = vor.cellPolygon(k);
    if (!cell) continue;
    const arr = byOwner.get(best.owner) ?? [];
    arr.push([cell as unknown as Ring]);
    byOwner.set(best.owner, arr);
  }
  for (const [owner, cells] of byOwner) {
    let merged: MultiPolygon = [];
    // Union in chunks: polygon-clipping is much faster on a few hundred polygons at a time.
    for (let c = 0; c < cells.length; c += 400) merged = polygonClipping.union(merged, ...(cells.slice(c, c + 400) as any));
    addPiece(owner, polygonClipping.intersection(merged, lm));
  }
});

// ---------- sea zones ----------
const seaSeeds: { owner: string; pt: Pt }[] = [];
for (const s of seaData.seas) for (const pt of s.seeds) seaSeeds.push({ owner: s.id, pt: toPx(pt) });
const seaDel = Delaunay.from(seaSeeds.map(s => s.pt));
const seaVor = seaDel.voronoi([-pad, -pad, WIDTH + pad, HEIGHT + pad]);
const seaPieces = new Map<string, Polygon[]>();
seaSeeds.forEach((s, k) => {
  const cell = seaVor.cellPolygon(k);
  seaPieces.set(s.owner, [...(seaPieces.get(s.owner) ?? []), [cell as unknown as Ring]]);
});
const seaShapes = new Map<string, MultiPolygon>();
for (const [id, cells] of seaPieces) seaShapes.set(id, polygonClipping.intersection(polygonClipping.union(cells[0], ...cells.slice(1)), loose));

// Land raster for "is this pixel water?" checks (coastal adjacency, seeds in water).
const RW = WIDTH * 2;
const RH = HEIGHT * 2;
const raster = new Uint8Array(RW * RH);
for (const poly of land) {
  for (let row = 0; row < RH; row++) {
    const y = (row + 0.5) / 2;
    const xs: number[] = [];
    for (const r of poly)
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [xi, yi] = r[i];
        const [xj, yj] = r[j];
        if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k] * 2 - 0.5));
      const b = Math.min(RW - 1, Math.floor(xs[k + 1] * 2 - 0.5));
      for (let col = a; col <= b; col++) raster[row * RW + col] = 1;
    }
  }
}
const isWater = (x: number, y: number) => {
  const c = Math.floor(x * 2);
  const r = Math.floor(y * 2);
  if (c < 0 || r < 0 || c >= RW || r >= RH) return true;
  return raster[r * RW + c] === 0;
};
const nearestSea = (pt: Pt) => seaSeeds[seaDel.find(pt[0], pt[1])].owner;

// ---------- topology: simplify shared borders once, get neighbours and border lines ----------
const ids = [...pieces.keys()];
const fc = {
  type: 'FeatureCollection',
  features: ids.map(id => ({ type: 'Feature', id, properties: { id }, geometry: { type: 'MultiPolygon', coordinates: pieces.get(id) } })),
};
let topo: any = topojsonServer.topology({ land: fc as any }, 1e5);
topo = topojsonSimplify.presimplify(topo, topojsonSimplify.planarTriangleArea);
topo = topojsonSimplify.simplify(topo, 0.35);
const simplified = topojsonClient.feature(topo, topo.objects.land) as any;
const neigh = topojsonClient.neighbors(topo.objects.land.geometries);

// Which geometries use each arc → border lines between each pair.
const arcUsers = new Map<number, Set<number>>();
topo.objects.land.geometries.forEach((g: any, gi: number) => {
  const walk = (a: any): void => {
    if (typeof a === 'number') {
      const k = a < 0 ? ~a : a;
      if (!arcUsers.has(k)) arcUsers.set(k, new Set());
      arcUsers.get(k)!.add(gi);
    } else a.forEach(walk);
  };
  walk(g.arcs);
});
const decoded = topojsonClient.mesh(topo, topo.objects.land, () => true); // forces arc decode below
void decoded;
const arcCoords = (k: number): Pt[] => {
  const line = topojsonClient.mesh(topo, { type: 'GeometryCollection', geometries: [{ type: 'LineString', arcs: [k] }] } as any);
  return (line.coordinates[0] ?? []) as Pt[];
};
const borderMap = new Map<string, Pt[][]>();
for (const [k, users] of arcUsers) {
  if (users.size !== 2) continue;
  const [a, b] = [...users].map(gi => ids[gi]).sort();
  const key = `${a}|${b}`;
  borderMap.set(key, [...(borderMap.get(key) ?? []), arcCoords(k)]);
}

const pathOf = (mp: number[][][][]): string =>
  mp
    .map(poly =>
      poly
        .map(ring => {
          const pts = ring.slice(0, -1);
          return 'M' + pts.map(([x, y]) => `${round(x)} ${round(y)}`).join('L') + 'Z';
        })
        .join(''),
    )
    .join('');
const linePath = (lines: Pt[][]): string =>
  lines.map(l => 'M' + l.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')).join('');

const regionOut: any[] = [];
const wasteOut: any[] = [];
const regionIds = new Set(regions.map(r => r.id));
simplified.features.forEach((f: any, gi: number) => {
  const id = ids[gi];
  const mp: number[][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const byArea = [...mp].sort((a, b) => polyArea(b as Polygon) - polyArea(a as Polygon));
  const firstSeed = seeds.find(sd => sd.owner === id)?.pt;
  const home = (firstSeed && mp.find(poly => pointInPoly(firstSeed, poly as Polygon))) || byArea[0];
  const label = polylabel(home as any, 0.5) as unknown as Pt & { distance: number };
  const area = mp.reduce((s, poly) => s + polyArea(poly as Polygon), 0);
  const allPts = mp.flat(2) as unknown as Pt[];
  const xs = allPts.map(q => q[0]);
  const ys = allPts.map(q => q[1]);
  const bbox = [round(Math.min(...xs)), round(Math.min(...ys)), round(Math.max(...xs)), round(Math.max(...ys))];
  if (id.startsWith('waste:')) {
    wasteOut.push({ id: id.slice(6), path: pathOf(mp), label: [round(label[0]), round(label[1])], area: Math.round(area) });
    return;
  }
  // Coastal seas: boundary points with water just outside them, sorted by how much coast they share.
  const seaCount = new Map<string, number>();
  for (const poly of mp)
    for (const ring of poly)
      for (let i = 0; i < ring.length - 1; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[i + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
        for (let s = 0; s < steps; s++) {
          const x = ax + ((bx - ax) * s) / steps;
          const y = ay + ((by - ay) * s) / steps;
          for (const [dx, dy] of [
            [2, 0],
            [-2, 0],
            [0, 2],
            [0, -2],
          ]) {
            if (isWater(x + dx, y + dy)) {
              const sea = nearestSea([x + dx, y + dy]);
              seaCount.set(sea, (seaCount.get(sea) ?? 0) + 1);
              break;
            }
          }
        }
      }
  const seas = [...seaCount.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const neighbors = neigh[gi].map((ni: number) => ids[ni]).filter((n: string) => regionIds.has(n)).sort();
  regionOut.push({
    id,
    path: pathOf(mp),
    label: [round(label[0]), round(label[1])],
    labelRadius: round(label.distance),
    lonlat: toLonLat(label as unknown as Pt),
    bbox,
    area: Math.round(area),
    neighbors,
    seas,
  });
});

const borders = [...borderMap.entries()]
  .filter(([key]) => key.split('|').every(k => regionIds.has(k)))
  .map(([key, lines]) => {
    const [a, b] = key.split('|');
    return { a, b, path: linePath(lines) };
  });

// Sea neighbours: zones whose Voronoi cells touch through water.
const seaOut = seaData.seas.map(s => {
  const shape = seaShapes.get(s.id)!;
  const largest = [...shape].sort((a, b) => polyArea(b) - polyArea(a))[0];
  // Label at the water-only pole of the zone: sample seeds, pick the one deepest at sea.
  const ownSeeds = seaSeeds.filter(q => q.owner === s.id).map(q => q.pt);
  const label = ownSeeds[0];
  return {
    id: s.id,
    path: pathOf(shape as any),
    label: [round(label[0]), round(label[1])],
    bbox: bboxOf(largest).map(v => round(v)),
  };
});
const seaNeighbors = new Map<string, Set<string>>();
for (let k = 0; k < seaSeeds.length; k++) {
  for (const j of seaDel.neighbors(k)) {
    const a = seaSeeds[k].owner;
    const b = seaSeeds[j].owner;
    if (a === b) continue;
    // Only count the link if the midpoint between the two seeds is open water.
    const mid: Pt = [(seaSeeds[k].pt[0] + seaSeeds[j].pt[0]) / 2, (seaSeeds[k].pt[1] + seaSeeds[j].pt[1]) / 2];
    if (!isWater(mid[0], mid[1])) continue;
    if (!seaNeighbors.has(a)) seaNeighbors.set(a, new Set());
    seaNeighbors.get(a)!.add(b);
  }
}
const seaLinks = (seaData as any).seaLinks ?? { add: [], remove: [] };
for (const [a, b] of seaLinks.add) {
  for (const [x, y] of [[a, b], [b, a]]) {
    if (!seaNeighbors.has(x)) seaNeighbors.set(x, new Set());
    seaNeighbors.get(x)!.add(y);
  }
}
for (const [a, b] of seaLinks.remove) {
  seaNeighbors.get(a)?.delete(b);
  seaNeighbors.get(b)?.delete(a);
}
for (const s of seaOut) (s as any).neighbors = [...(seaNeighbors.get(s.id) ?? [])].sort();

const coastPath = linePath(
  [...arcUsers.entries()].filter(([, u]) => u.size === 1).map(([k]) => arcCoords(k)),
);

const out = {
  width: WIDTH,
  height: HEIGHT,
  projection: { rotate: [-16, -51], left, top, scale },
  regions: regionOut.sort((a, b) => a.id.localeCompare(b.id)),
  borders,
  seas: seaOut,
  wastelands: wasteOut,
  coast: coastPath,
};
fs.writeFileSync(path.join(ROOT, 'src/content/map.json'), JSON.stringify(out));
const missing = regions.filter(r => !regionOut.find(o => o.id === r.id)).map(r => r.id);
for (const w of warnings) console.warn('warning:', w);
if (missing.length) console.warn('missing regions:', missing.join(', '));
const noSea = regionOut.filter(r => r.seas.length === 0).length;
console.log(
  `regions ${regionOut.length}, borders ${borders.length}, seas ${seaOut.length}, wastelands ${wasteOut.length}, inland regions ${noSea}`,
);
console.log(`size ${(fs.statSync(path.join(ROOT, 'src/content/map.json')).size / 1024).toFixed(0)} KB`);
