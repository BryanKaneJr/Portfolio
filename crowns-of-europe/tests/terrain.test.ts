/** The illustrated terrain's tile layer (src/ui/map/terrainLayer.ts) and the generated tile index (terrainTiles.ts). */
import { MAP } from '../src/sim/content';
import { BUFFER, SHARPNESS, TileCache, decodedBytes, grow, pickLevel, tilesIn, tilesToDraw, webZoom } from '../src/ui/map/terrainLayer';
import { TERRAIN_LEVELS, TERRAIN_REGION, TERRAIN_TILE_PX } from '../src/ui/map/terrainTiles';
import { MAP_STYLES } from '../src/ui/map/styles';

jest.mock('react-native', () => ({ Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default } }));
const sources = require('../assets/map/terrain/sources.json');

const R = TERRAIN_REGION;
const area = (t: { w: number; h: number }) => t.w * t.h;
const EPS = 1e-6;

describe('tile index', () => {
  test('each level partitions the region exactly: no gaps, no overlaps, nothing outside', () => {
    for (const level of TERRAIN_LEVELS) {
      const total = level.tiles.reduce((s, t) => s + area(t), 0);
      expect(total).toBeCloseTo((R.x1 - R.x0) * (R.y1 - R.y0), 6);
      for (const t of level.tiles) {
        expect(t.x).toBeGreaterThanOrEqual(R.x0 - EPS);
        expect(t.y).toBeGreaterThanOrEqual(R.y0 - EPS);
        expect(t.x + t.w).toBeLessThanOrEqual(R.x1 + EPS);
        expect(t.y + t.h).toBeLessThanOrEqual(R.y1 + EPS);
      }
      // Pairwise: tiles on the same grid never overlap (areas add up and every tile sits on the level's grid).
      for (const t of level.tiles) {
        const gx = Math.max(R.x0, Math.floor(t.x / level.span) * level.span);
        const gy = Math.max(R.y0, Math.floor(t.y / level.span) * level.span);
        expect(t.x).toBeCloseTo(gx, 6);
        expect(t.y).toBeCloseTo(gy, 6);
      }
    }
  });

  test('levels nest: every tile of a level lies inside exactly one tile of the level above', () => {
    for (let l = 1; l < TERRAIN_LEVELS.length; l++) {
      for (const t of TERRAIN_LEVELS[l].tiles) {
        const parents = TERRAIN_LEVELS[l - 1].tiles.filter(p => t.x >= p.x - EPS && t.y >= p.y - EPS && t.x + t.w <= p.x + p.w + EPS && t.y + t.h <= p.y + p.h + EPS);
        expect(parents).toHaveLength(1);
      }
    }
  });

  test('levels double in detail and every tile is at most TILE px square', () => {
    for (let l = 0; l < TERRAIN_LEVELS.length; l++) {
      const lv = TERRAIN_LEVELS[l];
      if (l > 0) expect(lv.ppu).toBe(TERRAIN_LEVELS[l - 1].ppu * 2);
      expect(lv.span).toBeCloseTo(TERRAIN_TILE_PX / lv.ppu, 9);
      for (const t of lv.tiles) {
        expect(t.w * lv.ppu).toBeLessThanOrEqual(TERRAIN_TILE_PX + EPS);
        expect(t.h * lv.ppu).toBeLessThanOrEqual(TERRAIN_TILE_PX + EPS);
      }
    }
  });

  test('the finest level covers the closest zoom on a 3x screen without magnification', () => {
    const K_MAX = 5;
    expect(TERRAIN_LEVELS[TERRAIN_LEVELS.length - 1].ppu).toBeGreaterThanOrEqual(K_MAX * 3);
  });
});

describe('level choice', () => {
  test('picks the coarsest level that is sharp enough, and fades the next one in', () => {
    for (const dpr of [1, 2, 3]) {
      for (let k = 0.1; k <= 5; k *= 1.07) {
        const p = pickLevel(TERRAIN_LEVELS, k, dpr);
        const need = k * dpr * SHARPNESS;
        if (p.fine < TERRAIN_LEVELS.length - 1) expect(TERRAIN_LEVELS[p.fine].ppu).toBeGreaterThanOrEqual(need - EPS);
        if (p.fine > 0) expect(TERRAIN_LEVELS[p.fine - 1].ppu).toBeLessThan(need + EPS);
        expect(p.alpha).toBeGreaterThanOrEqual(0);
        expect(p.alpha).toBeLessThanOrEqual(1);
      }
    }
  });

  test('zooming in never lowers the level, and the fade is continuous within a level', () => {
    let last = -1;
    let lastAlpha = 0;
    for (let k = 0.1; k <= 5; k *= 1.01) {
      const p = pickLevel(TERRAIN_LEVELS, k, 3);
      expect(p.fine).toBeGreaterThanOrEqual(last);
      if (p.fine === last) expect(p.alpha).toBeGreaterThanOrEqual(lastAlpha - EPS);
      last = p.fine;
      lastAlpha = p.alpha;
    }
  });
});

describe('tiles to draw', () => {
  const view = (cx: number, cy: number, k: number, w = 390, h = 844) => {
    const screen = { x0: cx - w / 2 / k, y0: cy - h / 2 / k, x1: cx + w / 2 / k, y1: cy + h / 2 / k };
    return { screen, drawn: grow(screen, 0.3) };
  };

  test('the screen is covered by the finest drawn level everywhere inside the region (no holes)', () => {
    for (const [cx, cy, k] of [
      [1950, 860, 1.7],
      [2100, 800, 3],
      [1900, 700, 5],
      [2200, 950, 0.8],
      [2368, 1088, 2.2],
    ]) {
      const { screen, drawn } = view(cx, cy, k);
      const tiles = tilesToDraw(TERRAIN_LEVELS, k, 3, screen, drawn);
      const pick = pickLevel(TERRAIN_LEVELS, k, 3);
      // The opaque layers: the coarsest everywhere, the one under the finest over the screen.
      const opaque = tiles.filter(t => t.opacity === 1);
      for (let x = screen.x0; x < screen.x1; x += (screen.x1 - screen.x0) / 23) {
        for (let y = screen.y0; y < screen.y1; y += (screen.y1 - screen.y0) / 47) {
          if (x < R.x0 || y < R.y0 || x >= R.x1 || y >= R.y1) continue;
          expect(opaque.some(t => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h)).toBe(true);
          if (pick.fine >= 1 && pick.alpha === 1) {
            expect(tiles.some(t => t.level === pick.fine && x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h)).toBe(true);
          }
        }
      }
    }
  });

  test('the needed level is limited to the screen and its buffer, the one below it to the drawn area', () => {
    const { screen, drawn } = view(2000, 850, 3);
    const tiles = tilesToDraw(TERRAIN_LEVELS, 3, 3, screen, drawn);
    const near = grow(screen, BUFFER);
    const { fine } = pickLevel(TERRAIN_LEVELS, 3, 3);
    const touches = (t: { x: number; y: number; w: number; h: number }, r: { x0: number; y0: number; x1: number; y1: number }) => t.x < r.x1 && t.x + t.w > r.x0 && t.y < r.y1 && t.y + t.h > r.y0;
    for (const t of tiles.filter(t => t.level === fine)) expect(touches(t, near)).toBe(true);
    for (const t of tiles.filter(t => t.level > 0 && t.level < fine)) expect(touches(t, drawn)).toBe(true);
    // And their decoded memory is what their pixels say.
    const bytes = decodedBytes(TERRAIN_LEVELS, tiles);
    expect(bytes).toBe(tiles.reduce((s, t) => s + Math.round(t.w * TERRAIN_LEVELS[t.level].ppu) * Math.round(t.h * TERRAIN_LEVELS[t.level].ppu) * 4, 0));
  });

  test("the tiles' sea fades into the Illustrated style's own sea at the region's edge (same colour and shading)", () => {
    const edge = sources.tiles.edge_match;
    expect(MAP_STYLES.illustrated.sea).toBe(edge.sea);
    expect(MAP_STYLES.illustrated.relief).toBe(edge.relief);
    expect(edge.relief_image).toBe('assets/map/terrain/sea-shade.png');
  });

  test('the level below the needed one covers the drawn area for pans, but not under the needed one once that is opaque', () => {
    for (let k = 0.3; k <= 5; k *= 1.05) {
      const { screen, drawn } = view(2000, 850, k);
      const p = pickLevel(TERRAIN_LEVELS, k, 3);
      if (p.fine < 2) continue;
      const near = grow(screen, BUFFER);
      const below = tilesToDraw(TERRAIN_LEVELS, k, 3, screen, drawn).filter(t => t.level === p.fine - 1);
      const inside = (t: { x: number; y: number; w: number; h: number }) => t.x >= near.x0 && t.y >= near.y0 && t.x + t.w <= near.x1 && t.y + t.h <= near.y1;
      if (p.alpha >= 1) expect(below.some(inside)).toBe(false);
      // Every point of the drawn area inside the region is under a tile of the level below or the needed one.
      const fineTiles = tilesToDraw(TERRAIN_LEVELS, k, 3, screen, drawn).filter(t => t.level === p.fine);
      for (let x = drawn.x0; x < drawn.x1; x += (drawn.x1 - drawn.x0) / 17) {
        for (let y = drawn.y0; y < drawn.y1; y += (drawn.y1 - drawn.y0) / 31) {
          if (x < R.x0 || y < R.y0 || x >= R.x1 || y >= R.y1) continue;
          const on = (t: { x: number; y: number; w: number; h: number }) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h;
          expect(below.some(on) || fineTiles.some(on)).toBe(true);
        }
      }
    }
  });

  test('a view outside the region draws nothing from it', () => {
    expect(tilesIn(TERRAIN_LEVELS[3], { x0: 100, y0: 100, x1: 400, y1: 400 })).toEqual([]);
  });
});

describe('tile cache', () => {
  test('keeps at most its capacity, never evicts what is in use, evicts the least recently used', () => {
    const loaded: string[] = [];
    const released: string[] = [];
    const c = new TileCache(4, k => loaded.push(k), k => released.push(k));
    c.use(['a', 'b', 'c']);
    c.use(['d']);
    expect(c.size).toBe(4);
    c.use(['a', 'e']); // b is now the least recently used
    expect(released).toEqual(['b']);
    expect(c.has('a')).toBe(true);
    expect(c.size).toBe(4);
    c.use(['f', 'g', 'h', 'i', 'j']); // more in use at once than the capacity: those are kept, everything else goes
    expect(['f', 'g', 'h', 'i', 'j'].every(k => c.has(k))).toBe(true);
    expect(loaded).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
  });
});

describe('scales and projection', () => {
  test('web zoom of the camera matches the map scale (17.4 units per degree)', () => {
    const upd = MAP.width / (MAP.projection.east - MAP.projection.west);
    expect(webZoom(1, upd)).toBeCloseTo(Math.log2((upd * 360) / 256), 9);
    expect(webZoom(2, upd) - webZoom(1, upd)).toBeCloseTo(1, 9);
  });

  test('the pipeline projects lon/lat exactly as the game does (sample points from pyproj via EPSG:3857)', () => {
    const { west, east, north } = MAP.projection;
    const RAD = Math.PI / 180;
    const scale = MAP.width / ((east - west) * RAD);
    const top = -Math.log(Math.tan(Math.PI / 4 + (north * RAD) / 2));
    const samples: { lon: number; lat: number; x: number; y: number }[] = sources.projection_check;
    expect(samples.length).toBeGreaterThan(5);
    for (const p of samples) {
      expect((p.lon - west) * RAD * scale).toBeCloseTo(p.x, 6);
      expect((-Math.log(Math.tan(Math.PI / 4 + (p.lat * RAD) / 2)) - top) * scale).toBeCloseTo(p.y, 6);
    }
  });
});
