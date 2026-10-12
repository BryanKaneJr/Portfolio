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
import { geoMercator, geoPath } from 'd3-geo';
import { Delaunay } from 'd3-delaunay';
import * as topojsonClient from 'topojson-client';
import * as topojsonServer from 'topojson-server';
import * as topojsonSimplify from 'topojson-simplify';
import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import polylabel from 'polylabel';

type LonLat = [number, number];
type Pt = [number, number];

const ROOT = path.resolve(__dirname, '..');
const regions: { id: string; name: string; seeds: LonLat[]; nw?: boolean }[] = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/regions.json'), 'utf8'),
);
const seaData: {
  seas: { id: string; name: string; seeds: LonLat[]; closed?: boolean; charted?: boolean; nw?: boolean }[];
  wastelands: { id: string; name: string; seeds: LonLat[] }[];
  lakes: { name: string; outline: LonLat[] }[];
} = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/seas.json'), 'utf8'));

// Mercator: north is up everywhere, so Europe and the Americas both keep their familiar shapes.
// Window: the Pacific coast of Mexico to the Volga, the North Cape to southern Brazil.
const WEST = -101;
const EAST = 47;
const NORTH = 71.2;
const SOUTH = -25;
const UNITS_PER_DEGREE = 17.4; // keeps Europe at about the size the UI was tuned for
const WIDTH = Math.round((EAST - WEST) * UNITS_PER_DEGREE);
const projection = geoMercator().scale(1).translate([0, 0]);
const p = (ll: LonLat): Pt => projection(ll) as Pt;
const left = p([WEST, 0])[0];
const right = p([EAST, 0])[0];
const top = p([0, NORTH])[1];
const bottom = p([0, SOUTH])[1];
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
const pixelProjection = geoMercator()
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
// Natural Earth's land has no lakes: cut the Great Lakes out by hand (they block marches, not ships).
const lakePolys: Polygon[] = seaData.lakes.map(l => {
  const ring: Pt[] = [];
  l.outline.forEach((a, k) => {
    const b = l.outline[(k + 1) % l.outline.length];
    for (let t = 0; t < 4; t++) ring.push(toPx([a[0] + ((b[0] - a[0]) * t) / 4, a[1] + ((b[1] - a[1]) * t) / 4]));
  });
  return [[...ring, ring[0]] as Ring];
});
const land: MultiPolygon = polygonClipping.difference(polygonClipping.intersection(polygonClipping.union(projectedLand), windowPoly), ...(lakePolys as any));
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

// A fixed jittered grid: the same grid point always gets the same wobble, so two neighbours that build
// their borders from separate patches of the grid still agree on every cell.
const CELL = 4.5;
function jitter(gx: number, gy: number): Pt {
  let h = (Math.imul(gx, 73856093) ^ Math.imul(gy, 19349663) ^ 1444) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  const a = (h & 0xffff) / 0xffff;
  const b = (h >>> 16) / 0xffff;
  return [gx * CELL + (a - 0.5) * CELL * 0.9, gy * CELL + (b - 0.5) * CELL * 0.9];
}
function unionAll(polys: Polygon[]): MultiPolygon {
  let merged: MultiPolygon = [];
  // Union in chunks: polygon-clipping is much faster on a few hundred polygons at a time.
  for (let c = 0; c < polys.length; c += 400) merged = polygonClipping.union(merged, ...(polys.slice(c, c + 400) as any));
  return merged;
}
const wasteSeedsAll = seeds.filter(sd => sd.kind === 'waste');

landmasses.forEach((lm, i) => {
  const ls = landmassSeeds[i];
  if (ls.length === 0) {
    // Islands with no seed of their own join the nearest seed within reach, or else the nearest wilderness.
    const c = polylabel(lm as any, 1) as unknown as Pt;
    const nearest = (list: Seed[]) => {
      let best: Seed | null = null;
      let bd = Infinity;
      for (const sd of list) {
        const d = Math.hypot(sd.pt[0] - c[0], sd.pt[1] - c[1]);
        if (d < bd) {
          bd = d;
          best = sd;
        }
      }
      return { best, bd };
    };
    const near = nearest(seeds);
    if (near.best && near.bd < 120) addPiece(near.best.owner, [lm]);
    else {
      const w = nearest(wasteSeedsAll).best;
      if (w) addPiece(w.owner, [lm]);
    }
    return;
  }
  const owners = new Set(ls.map(sd => sd.owner));
  if (owners.size === 1) {
    addPiece(ls[0].owner, [lm]);
    return;
  }
  const [x0, y0, x1, y1] = bboxOf(lm);
  const seedDel = Delaunay.from(ls.map(sd => sd.pt));
  const seedVor = seedDel.voronoi([x0 - CELL, y0 - CELL, x1 + CELL, y1 + CELL]);
  // Regions: grid cells handed to the nearest seed, built only around each region's own Voronoi cells.
  const regionOwners = [...new Set(ls.filter(sd => sd.kind === 'region').map(sd => sd.owner))];
  const regionPieces: MultiPolygon = [];
  for (const owner of regionOwners) {
    let bx0 = Infinity,
      by0 = Infinity,
      bx1 = -Infinity,
      by1 = -Infinity;
    ls.forEach((sd, k) => {
      if (sd.owner !== owner) return;
      const cell = seedVor.cellPolygon(k);
      if (!cell) return;
      for (const [x, y] of cell) {
        bx0 = Math.min(bx0, x);
        by0 = Math.min(by0, y);
        bx1 = Math.max(bx1, x);
        by1 = Math.max(by1, y);
      }
    });
    const gx0 = Math.floor(bx0 / CELL) - 3;
    const gx1 = Math.ceil(bx1 / CELL) + 3;
    const gy0 = Math.floor(by0 / CELL) - 3;
    const gy1 = Math.ceil(by1 / CELL) + 3;
    const pts: number[] = [];
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) pts.push(...jitter(gx, gy));
    const del = new Delaunay(Float64Array.from(pts));
    const vor = del.voronoi([gx0 * CELL - CELL, gy0 * CELL - CELL, gx1 * CELL + CELL, gy1 * CELL + CELL]);
    const cells: Polygon[] = [];
    let hint = 0;
    for (let k = 0; k < pts.length / 2; k++) {
      hint = seedDel.find(pts[2 * k], pts[2 * k + 1], hint);
      if (ls[hint].owner !== owner) continue;
      const cell = vor.cellPolygon(k);
      if (cell) cells.push([cell as unknown as Ring]);
    }
    const piece = polygonClipping.intersection(unionAll(cells), lm);
    addPiece(owner, piece);
    regionPieces.push(...piece);
  }
  // Wilderness: whatever land is left, split between the wilderness seeds by plain Voronoi.
  const wasteSeeds = ls.filter(sd => sd.kind === 'waste');
  if (!wasteSeeds.length) return;
  const rest = regionPieces.length ? polygonClipping.difference([lm], ...(regionPieces as any)) : [lm];
  if (!rest.length) return;
  const wasteVor = Delaunay.from(wasteSeeds.map(sd => sd.pt)).voronoi([x0 - CELL, y0 - CELL, x1 + CELL, y1 + CELL]);
  const byWaste = new Map<string, Polygon[]>();
  wasteSeeds.forEach((sd, k) => {
    const cell = wasteVor.cellPolygon(k);
    if (cell) byWaste.set(sd.owner, [...(byWaste.get(sd.owner) ?? []), [cell as unknown as Ring]]);
  });
  for (const [owner, cells] of byWaste) addPiece(owner, polygonClipping.intersection(unionAll(cells), rest));
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
for (const lake of lakePolys) {
  const r0 = lake[0];
  for (let row = 0; row < RH; row++) {
    const y = (row + 0.5) / 2;
    const xs: number[] = [];
    for (let i = 0, j = r0.length - 1; i < r0.length; j = i++) {
      const [xi, yi] = r0[i];
      const [xj, yj] = r0[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.ceil(xs[k] * 2 - 0.5));
      const b = Math.min(RW - 1, Math.floor(xs[k + 1] * 2 - 0.5));
      for (let col = a; col <= b; col++) raster[row * RW + col] = 2;
    }
  }
}
/**
 * Open sea (lakes don't count: they make no coast). Past the edge of the map the world carries on as it is at
 * the edge: land that runs off the map stays land (Persia beyond Tabriz is not a sea), water stays water.
 */
const isWater = (x: number, y: number) => {
  const c = Math.min(RW - 1, Math.max(0, Math.floor(x * 2)));
  const r = Math.min(RH - 1, Math.max(0, Math.floor(y * 2)));
  return raster[r * RW + c] === 0;
};
for (const sd of seaSeeds) if (!isWater(sd.pt[0], sd.pt[1])) warnings.push(`sea seed of ${sd.owner} at ${toLonLat(sd.pt).join(", ")} is on land`);
const nearestSea = (pt: Pt) => seaSeeds[seaDel.find(pt[0], pt[1])].owner;
// Closed waters (the Pacific, Hudson Bay...) are drawn but sit outside the game: no coasts, no links.
const CLOSED = new Set(seaData.seas.filter(sd => sd.closed).map(sd => sd.id));

// ---------- topology: simplify shared borders once, get neighbours and border lines ----------
const ids = [...pieces.keys()];
const fc = {
  type: 'FeatureCollection',
  features: ids.map(id => ({ type: 'Feature', id, properties: { id }, geometry: { type: 'MultiPolygon', coordinates: pieces.get(id) } })),
};
let topo: any = topojsonServer.topology({ land: fc as any }, 1e5);
topo = topojsonSimplify.presimplify(topo, topojsonSimplify.planarTriangleArea);
// Wilderness outlines can be rougher than the land people fight over: weight their points down.
{
  const users = new Map<number, string[]>();
  topo.objects.land.geometries.forEach((g: any, gi: number) => {
    const walk = (a: any): void => {
      if (typeof a === 'number') {
        const k = a < 0 ? ~a : a;
        users.set(k, [...(users.get(k) ?? []), ids[gi]]);
      } else a.forEach(walk);
    };
    walk(g.arcs);
  });
  topo.arcs.forEach((arc: number[][], k: number) => {
    if ((users.get(k) ?? []).every(id => id.startsWith('waste:'))) for (const pt of arc) if (pt.length > 2) pt[2] *= 0.3;
  });
}
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
  const seas = [...seaCount.entries()]
    .filter(([sea, c]) => c >= 3 && !CLOSED.has(sea))
    .sort((a, b) => b[1] - a[1])
    .map(([sea]) => sea);
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
    ...(s.closed ? { closed: true } : {}),
    ...(s.charted ? { charted: true } : {}),
  };
});
const seaNeighbors = new Map<string, Set<string>>();
for (let k = 0; k < seaSeeds.length; k++) {
  for (const j of seaDel.neighbors(k)) {
    const a = seaSeeds[k].owner;
    const b = seaSeeds[j].owner;
    if (a === b || CLOSED.has(a) || CLOSED.has(b)) continue;
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

/** Drop the stretches of a line that run along an edge of a box: where land is cut off there, it is no coast. */
function offEdges(lines: Pt[][], box: [number, number, number, number]): Pt[][] {
  const [x0, y0, x1, y1] = box;
  const onEdge = (a: Pt, b: Pt) =>
    (Math.abs(a[0] - x0) < 0.6 && Math.abs(b[0] - x0) < 0.6) ||
    (Math.abs(a[0] - x1) < 0.6 && Math.abs(b[0] - x1) < 0.6) ||
    (Math.abs(a[1] - y0) < 0.6 && Math.abs(b[1] - y0) < 0.6) ||
    (Math.abs(a[1] - y1) < 0.6 && Math.abs(b[1] - y1) < 0.6);
  const out: Pt[][] = [];
  for (const line of lines) {
    let run: Pt[] = [line[0]];
    for (let i = 1; i < line.length; i++) {
      if (onEdge(line[i - 1], line[i])) {
        if (run.length > 1) out.push(run);
        run = [line[i]];
      } else run.push(line[i]);
    }
    if (run.length > 1) out.push(run);
  }
  return out;
}
const coastPath = linePath(
  offEdges(
    [...arcUsers.entries()].filter(([, u]) => u.size === 1).map(([k]) => arcCoords(k)),
    [0, 0, WIDTH, HEIGHT],
  ),
);

// ---------- the lands beyond the known world ----------
// Drawn for looks only (an outline and old-map shading), never part of the game: from the Pacific coast to
// India and from the high Arctic to the far south, with the play window itself cut out. Wide margins, because a
// phone held upright shows far more height than the map has when zoomed all the way out.
const FAR_X = 800;
const FAR_Y = 1400;
const farWindow: Polygon = [
  [
    [-FAR_X, -FAR_Y],
    [WIDTH + FAR_X, -FAR_Y],
    [WIDTH + FAR_X, HEIGHT + FAR_Y],
    [-FAR_X, HEIGHT + FAR_Y],
    [-FAR_X, -FAR_Y],
  ],
];
const farProjection = geoMercator()
  .scale(scale)
  .translate([-left * scale, -top * scale])
  .clipExtent([
    [-FAR_X - 1, -FAR_Y - 1],
    [WIDTH + FAR_X + 1, HEIGHT + FAR_Y + 1],
  ])
  .precision(0.5);
/** Douglas-Peucker: far lands need far fewer points than the land people fight over. */
function simplifyRing(r: Pt[], tol: number): Pt[] {
  if (r.length < 5) return r;
  const keep = new Uint8Array(r.length);
  keep[0] = keep[r.length - 1] = 1;
  const stack: [number, number][] = [[0, r.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let wd = tol;
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(r[i], r[a], r[b]);
      if (d > wd) {
        wd = d;
        worst = i;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return r.filter((_, i) => keep[i]);
}
const farRings: Polygon[] = [];
for (const g of landGeoms) {
  const polys: LonLat[][][] = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) {
    let cur: Pt[] = [];
    const rings: Ring[] = [];
    const recorder = {
      moveTo(x: number, y: number) {
        cur = [[x, y]];
      },
      lineTo(x: number, y: number) {
        cur.push([x, y]);
      },
      closePath() {
        const s = simplifyRing(cur, 0.9);
        if (s.length >= 3 && Math.abs(ringArea([...s, s[0]] as Ring)) > 6) rings.push([...s, s[0]] as Ring);
        cur = [];
      },
      arc() {},
      rect() {},
    };
    geoPath(farProjection, recorder as any)({ type: 'Polygon', coordinates: poly } as any);
    if (rings.length) farRings.push(...(polygonClipping.xor as (...g: Polygon[]) => MultiPolygon)(...rings.map(r => [r] as Polygon)));
  }
}
const farLand: MultiPolygon = polygonClipping.difference(polygonClipping.intersection(unionAll(farRings), farWindow), windowPoly);
// One path per 600-unit cell of the far margins (by where each piece sits), so the map draws only what is on screen.
const farCells = new Map<string, Polygon[]>();
for (const poly of farLand) {
  const [x0, y0, x1, y1] = bboxOf(poly);
  const key = `${Math.floor((x0 + x1) / 2 / 600)},${Math.floor((y0 + y1) / 2 / 600)}`;
  farCells.set(key, [...(farCells.get(key) ?? []), poly]);
}
const farOut = [...farCells.values()].map(polys => {
  const boxes = polys.map(bboxOf);
  const rings = polys.flatMap(poly => poly.map(r => r as Pt[]));
  return {
    path: pathOf(polys as any),
    // The real coast only: not the cut along the play window, nor the outer edge of the drawing.
    coast: linePath(offEdges(offEdges(rings, [0, 0, WIDTH, HEIGHT]), [-FAR_X, -FAR_Y, WIDTH + FAR_X, HEIGHT + FAR_Y])),
    bbox: [Math.min(...boxes.map(b => b[0])), Math.min(...boxes.map(b => b[1])), Math.max(...boxes.map(b => b[2])), Math.max(...boxes.map(b => b[3]))].map(v => round(v)),
  };
});
const farLabels = ((seaData as any).farLands ?? []).map((f: { name: string; at: LonLat; sea?: boolean }) => {
  const [x, y] = toPx(f.at);
  return { name: f.name, x: round(x), y: round(y), ...(f.sea ? { sea: true } : {}) };
});
console.log(`far lands: ${farLand.length} pieces in ${farOut.length} cells`);

// ---------- the unknown: what the map paints as blank parchment ----------
// Waters no fleet can sail (the closed seas, unless marked charted) are terra incognita, like the wastes and the world past the edges, and
// so is the open sea in a ragged band along the window's edges (so the known sea never stops at a ruled line).
// Before the New World is found, its regions, its seas and the Great Lakes are too. The edges of the unknown
// waters wobble like a hand-drawn chart rather than following the sea zones' straight lines; they are cut from the
// drawn (simplified) land so the parchment meets every coast exactly.
/** Smooth value noise (a fixed hash, so every build agrees): -1..1. */
function valueNoise(x: number, y: number): number {
  const hash = (i: number, j: number) => {
    let h = (i * 374761393 + j * 668265263) | 0;
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
}
/** Push every point of a shape along a smooth noise field (edges cut into 4-unit steps first). */
function wobble(mp: MultiPolygon, amp: number, scale: number): MultiPolygon {
  const warp = ([x, y]: Pt): Pt => [
    x + amp * (0.7 * valueNoise(x / scale, y / scale) + 0.3 * valueNoise((x * 3) / scale + 40, (y * 3) / scale)),
    y + amp * (0.7 * valueNoise(x / scale + 91, y / scale + 13) + 0.3 * valueNoise((x * 3) / scale + 7, (y * 3) / scale + 55)),
  ];
  return mp.map(poly =>
    poly.map(ring => {
      const out: Pt[] = [];
      for (let i = 0; i + 1 < ring.length; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[i + 1];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
        for (let k = 0; k < n; k++) out.push(warp([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]));
      }
      out.push(out[0]);
      return out as Ring;
    }),
  );
}
const drawnShapes = new Map<string, Polygon[]>();
simplified.features.forEach((f: any, gi: number) => {
  drawnShapes.set(ids[gi], (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as Polygon[]);
});
const drawnLand = unionAll([...drawnShapes.values()].flat());
const water = polygonClipping.difference(windowPoly, drawnLand);
const cellsOf = (pick: (sd: (typeof seaData.seas)[number]) => boolean): MultiPolygon => unionAll(seaData.seas.filter(pick).flatMap(sd => seaShapes.get(sd.id) ?? []));
const WOBBLE = 16; // map units the edge of the unknown strays from the sea zones' lines
const WOBBLE_SCALE = 70; // and over what distance it turns
const closedWater = polygonClipping.intersection(water, wobble(cellsOf(sd => !!sd.closed && !sd.charted), WOBBLE, WOBBLE_SCALE));
// The known sea's own ragged shore, 30 to 90 units in from the window's edges.
const INSET = 60;
const frame: MultiPolygon = wobble(
  [
    [
      [
        [INSET, INSET],
        [WIDTH - INSET, INSET],
        [WIDTH - INSET, HEIGHT - INSET],
        [INSET, HEIGHT - INSET],
        [INSET, INSET],
      ],
    ],
  ],
  30,
  90,
);
const edgeWater = polygonClipping.difference(water, frame);
const unknownWater = polygonClipping.union(closedWater, edgeWater);
const nwWater = polygonClipping.intersection(water, wobble(cellsOf(sd => !!sd.nw && !sd.closed), WOBBLE, WOBBLE_SCALE));
const nwRegions = regions.filter(r => r.nw).flatMap(r => drawnShapes.get(r.id) ?? []);
const uncharted = unionAll([...nwRegions, ...nwWater, ...lakePolys]);
console.log(`unknown waters: ${unknownWater.length} pieces; uncharted before discovery: ${uncharted.length} pieces`);

const out = {
  width: WIDTH,
  height: HEIGHT,
  projection: { type: 'mercator', west: WEST, east: EAST, north: NORTH, south: SOUTH },
  regions: regionOut.sort((a, b) => a.id.localeCompare(b.id)),
  borders,
  seas: seaOut,
  wastelands: wasteOut,
  lakes: seaData.lakes.map((l, k) => {
    const c = polylabel(lakePolys[k] as any, 0.5) as unknown as Pt;
    return { name: l.name, label: [round(c[0]), round(c[1])] };
  }),
  coast: coastPath,
  unknownWater: pathOf(unknownWater as any),
  uncharted: pathOf(uncharted as any),
  far: farOut,
  farLabels,
  margin: [FAR_X, FAR_Y],
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
