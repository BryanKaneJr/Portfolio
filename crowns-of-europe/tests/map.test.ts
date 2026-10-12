import fs from 'node:fs';
import path from 'node:path';
import { MAP } from '../src/sim/content';
import { newGame } from '../src/sim/state';
import { K_MAX, clampView, rubber, rubberZoom } from '../src/ui/map/camera';
import { COAST_CELLS, MAP_H, MAP_W, lineCells, nationArcs } from '../src/ui/map/geometry';

describe('the map beyond the known world', () => {
  test('the lands past the edges are drawn but lie outside the play window', () => {
    expect(MAP.far.length).toBeGreaterThan(10);
    for (const f of MAP.far) {
      const [x0, y0, x1, y1] = f.bbox;
      const inside = x0 >= 0 && y0 >= 0 && x1 <= MAP_W && y1 <= MAP_H;
      expect(inside).toBe(false);
    }
    // Their names are written out there too, never over a region you can play.
    for (const l of MAP.farLabels) expect(l.x < 0 || l.y < 0 || l.x > MAP_W || l.y > MAP_H).toBe(true);
  });

  test('where the window cuts across land there is no coastline', () => {
    // A cut edge would draw a false shore (and water lines) along the window's border.
    const along = (x0: number, y0: number, x1: number, y1: number) =>
      (Math.abs(x0 - x1) < 0.01 && (Math.abs(x0) < 0.7 || Math.abs(x0 - MAP_W) < 0.7)) || (Math.abs(y0 - y1) < 0.01 && (Math.abs(y0) < 0.7 || Math.abs(y0 - MAP_H) < 0.7));
    for (const seg of MAP.coast.split('M').filter(Boolean)) {
      const pts = seg.split('L').map(p => p.trim().split(/\s+/).map(Number));
      for (let i = 1; i < pts.length; i++) expect(along(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])).toBe(false);
    }
  });
});

describe('coastline cells', () => {
  test('cutting a line into cells keeps every point, in short runs inside their cell bounds', () => {
    const d = 'M0 0L10 0L20 5L30 5L40 10M500 500L510 520L530 530';
    const cells = lineCells(d, 100, 3);
    const pts = new Set<string>();
    for (const c of cells) {
      for (const seg of c.d.split('M').filter(Boolean)) {
        const run = seg.split('L');
        expect(run.length).toBeLessThanOrEqual(3);
        for (const p of run) {
          const [x, y] = p.split(' ').map(Number);
          expect(x).toBeGreaterThanOrEqual(c.bbox[0]);
          expect(x).toBeLessThanOrEqual(c.bbox[2]);
          expect(y).toBeGreaterThanOrEqual(c.bbox[1]);
          expect(y).toBeLessThanOrEqual(c.bbox[3]);
          pts.add(p);
        }
      }
    }
    expect([...pts].sort()).toEqual(['0 0', '10 0', '20 5', '30 5', '40 10', '500 500', '510 520', '530 530'].sort());
    expect(cells.length).toBe(2);
  });

  test('the real coastline loses nothing when cut up', () => {
    const count = (d: string) => new Set(d.split(/[ML]/).filter(Boolean).map(p => p.trim())).size;
    expect(count(COAST_CELLS.map(c => c.d).join(''))).toBe(count(MAP.coast));
  });
});

describe('curved nation names', () => {
  test('every name reads left to right and is never tilted past 75 degrees', () => {
    const s = newGame({ player: 'FRA', seed: 1 });
    const arcs = nationArcs(s);
    expect(arcs.length).toBeGreaterThan(30);
    for (const a of arcs) {
      const [A, , B] = a.curve;
      const ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
      expect(B[0]).toBeGreaterThanOrEqual(A[0]);
      expect(Math.abs(ang)).toBeLessThanOrEqual((76 * Math.PI) / 180);
      expect(a.length).toBeGreaterThan(0);
    }
    // France is written along France.
    const fra = arcs.find(a => a.nation === 'FRA')!;
    expect(s.regions.ile_de_france.owner).toBe('FRA');
    expect(fra.length).toBeGreaterThan(100);
  });
});

describe('camera limits', () => {
  const W = 390;
  const H = 700;
  const kMin = Math.min(W / MAP_W, H / MAP_H) * 0.95;

  test('the screen stays over the known world and the zoom within its limits', () => {
    const [cx, cy, k] = clampView(-500, 99999, 50, W, H, kMin);
    expect(k).toBe(K_MAX);
    expect(cx - W / 2 / k).toBeCloseTo(0);
    expect(cy + H / 2 / k).toBeCloseTo(MAP_H);
    // Zoomed all the way out the map is centred.
    const [ox, oy, ok] = clampView(0, 0, 0.01, W, H, kMin);
    expect(ok).toBe(kMin);
    expect(ox).toBeCloseTo(MAP_W / 2);
    expect(oy).toBeCloseTo(MAP_H / 2);
  });

  test('pulling past an edge meets growing resistance and never moves a full screen', () => {
    expect(rubber(0, W)).toBe(0);
    let last = 0;
    for (const over of [10, 50, 100, 300, 1000, 10000]) {
      const r = rubber(over, W);
      expect(r).toBeGreaterThan(last);
      expect(r).toBeLessThan(over);
      expect(r).toBeLessThan(W);
      expect(rubber(-over, W)).toBeCloseTo(-r);
      last = r;
    }
    // About half at first.
    expect(rubber(2, W) / 2).toBeCloseTo(0.55, 1);
  });

  test('pinching past a zoom limit gives ever less, and inside the limits nothing', () => {
    expect(rubberZoom(2, kMin)).toBe(2);
    expect(rubberZoom(K_MAX * 2, kMin)).toBeGreaterThan(K_MAX);
    expect(rubberZoom(K_MAX * 2, kMin)).toBeLessThan(K_MAX * 1.3);
    expect(rubberZoom(kMin / 2, kMin)).toBeLessThan(kMin);
    expect(rubberZoom(kMin / 2, kMin)).toBeGreaterThan(kMin * 0.75);
  });
});

describe('the known world and the unknown', () => {
  /** Even-odd point-in-path for the M/L/Z paths the map builder writes. */
  const inside = (d: string, x: number, y: number) => {
    let hit = false;
    for (const ring of d.split('M').filter(Boolean)) {
      const pts = ring
        .replace(/Z/g, '')
        .split('L')
        .map(p => p.trim().split(/\s+/).map(Number));
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
    }
    return hit;
  };
  const label = (id: string) => (MAP.regions.find(r => r.id === id)?.label ?? MAP.seas.find(s => s.id === id)!.label) as [number, number];

  test('waters no fleet can sail are parchment, the seas you sail are not', () => {
    for (const id of ['pacific', 'indian_ocean', 'arctic']) expect(inside(MAP.unknownWater, ...label(id))).toBe(true);
    for (const id of ['channel', 'north_sea', 'biscay', 'west_med', 'black_sea', 'baltic']) expect(inside(MAP.unknownWater, ...label(id))).toBe(false);
    // A closed sea marked charted (the Red Sea) is still drawn as water.
    expect(MAP.seas.find(s => s.id === 'red_sea')?.charted).toBe(true);
    expect(inside(MAP.unknownWater, ...label('red_sea'))).toBe(false);
  });

  test('before the New World is found, its regions are uncharted; the Old World never is', () => {
    expect(inside(MAP.uncharted, ...label('acadia'))).toBe(true);
    expect(inside(MAP.uncharted, ...label('newfoundland'))).toBe(true);
    for (const id of ['ile_de_france', 'castile', 'moscow']) {
      expect(inside(MAP.uncharted, ...label(id))).toBe(false);
      expect(inside(MAP.unknownWater, ...label(id))).toBe(false);
    }
  });
});

describe('baked map pictures', () => {
  /** Width and height from a PNG's or JPEG's header. */
  const size = (file: string): [number, number] => {
    const b = fs.readFileSync(file);
    if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    for (let i = 2; i < b.length; ) {
      const marker = b.readUInt16BE(i);
      if (marker >= 0xffc0 && marker <= 0xffc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
    throw new Error(`no size in ${file}`);
  };

  test('every picture is small enough that iPhones decode it at full size', () => {
    const dir = path.join(__dirname, '../assets/map');
    const files = fs.readdirSync(dir).filter(f => /\.(png|jpg)$/.test(f));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const [w, h] = size(`${dir}/${f}`);
      expect({ f, mp: (w * h) / 1e6 < 5.2 }).toEqual({ f, mp: true });
    }
  });
});

describe('drawn terrain', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { terrainPaths } = require('../src/ui/map/terrain') as typeof import('../src/ui/map/terrain');
  const around = (id: string, r = 40) => {
    const reg = MAP.regions.find(x => x.id === id)!;
    return terrainPaths(reg.label[0] - r, reg.label[1] - r, reg.label[0] + r, reg.label[1] + r, 3);
  };
  test('ridges in the mountains, dunes in the desert, and nothing out at sea', () => {
    expect(around('switzerland').ridge.length).toBeGreaterThan(0);
    expect(around('upper_egypt', 80).dune.length).toBeGreaterThan(0);
    expect(around('masovia', 30).ridge).toBe('');
    const sea = terrainPaths(1000, 700, 1200, 1000, 3); // the open Atlantic
    expect(Object.values(sea).join('')).toBe('');
  });
});
