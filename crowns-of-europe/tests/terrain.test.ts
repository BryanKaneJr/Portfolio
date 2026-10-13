/** The illustrated terrain's tile layer (src/ui/map/terrainLayer.ts) and the generated tile index (terrainTiles.ts). */
import { MAP } from '../src/sim/content';
import { BUFFER, FAMOUS_MIN_W, FAMOUS_RANGES, MOUNTAIN_PT, SHARPNESS, TileCache, decodedBytes, famousMountains, grow, pickLevel, tilesIn, tilesToDraw, webZoom } from '../src/ui/map/terrainLayer';
import { MOUNTAINS } from '../src/ui/map/terrainSymbols';
import { TERRAIN_FINEST_SKIP, TERRAIN_LEVELS, TERRAIN_REGION, TERRAIN_TILE_PX } from '../src/ui/map/terrainTiles';
import { MAP_STYLES } from '../src/ui/map/styles';

jest.mock('react-native', () => ({ Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default } }));
const sources = require('../assets/map/terrain/sources.json');

const R = TERRAIN_REGION;
const EPS = 1e-6;

describe('tile index', () => {
  test('tiles lie on their level\'s grid inside the region, never overlap, and cover the known land', () => {
    for (const level of TERRAIN_LEVELS) {
      const seen = new Set<string>();
      for (const t of level.tiles) {
        expect(t.x).toBeGreaterThanOrEqual(R.x0 - EPS);
        expect(t.y).toBeGreaterThanOrEqual(R.y0 - EPS);
        expect(t.x + t.w).toBeLessThanOrEqual(R.x1 + EPS);
        expect(t.y + t.h).toBeLessThanOrEqual(R.y1 + EPS);
        const gx = Math.max(R.x0, Math.floor(t.x / level.span) * level.span);
        const gy = Math.max(R.y0, Math.floor(t.y / level.span) * level.span);
        expect(t.x).toBeCloseTo(gx, 6);
        expect(t.y).toBeCloseTo(gy, 6);
        const cell = `${Math.floor((t.x + EPS) / level.span)},${Math.floor((t.y + EPS) / level.span)}`;
        expect(seen.has(cell)).toBe(false); // one tile per grid cell: no overlaps
        seen.add(cell);
      }
      // Every region's label point inside the region (known land) has a tile at every level (at the finest, every
      // region's but those it skips).
      const finest = level === TERRAIN_LEVELS[TERRAIN_LEVELS.length - 1];
      for (const r of MAP.regions) {
        const [x, y] = r.label;
        if (x < R.x0 || x >= R.x1 || y < R.y0 || y >= R.y1 || (finest && TERRAIN_FINEST_SKIP.includes(r.id))) continue;
        expect(level.tiles.some(t => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h)).toBe(true);
      }
    }
  });

  test('a tile is marked full exactly when its children inside the region all exist', () => {
    for (let l = 0; l + 1 < TERRAIN_LEVELS.length; l++) {
      const kids = new Set(TERRAIN_LEVELS[l + 1].tiles.map(t => `${Math.round(t.x * 1000)},${Math.round(t.y * 1000)}`));
      const half = TERRAIN_LEVELS[l].span / 2;
      for (const t of TERRAIN_LEVELS[l].tiles) {
        const want: boolean[] = [];
        for (const dy of [0, 1])
          for (const dx of [0, 1]) {
            const x = Math.max(R.x0, Math.floor((t.x + EPS) / TERRAIN_LEVELS[l].span) * TERRAIN_LEVELS[l].span + dx * half);
            const y = Math.max(R.y0, Math.floor((t.y + EPS) / TERRAIN_LEVELS[l].span) * TERRAIN_LEVELS[l].span + dy * half);
            if (x >= R.x1 || y >= R.y1 || x < t.x - EPS || y < t.y - EPS || x >= t.x + t.w - EPS || y >= t.y + t.h - EPS) continue;
            want.push(kids.has(`${Math.round(x * 1000)},${Math.round(y * 1000)}`));
          }
        expect(!!t.full).toBe(want.length > 0 && want.every(Boolean));
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

  test('wherever a level has a tile, the finest one the zoom allows is drawn there (no holes, nothing hidden)', () => {
    for (const [cx, cy, k] of [
      [1950, 860, 1.7],
      [2100, 800, 3],
      [1900, 700, 5],
      [2200, 950, 0.8],
      [2368, 1088, 2.2],
      [2040, 960, 3.5],
    ]) {
      const { screen, drawn } = view(cx, cy, k);
      const tiles = tilesToDraw(TERRAIN_LEVELS, k, 3, screen, drawn);
      const pick = pickLevel(TERRAIN_LEVELS, k, 3);
      const at = (x: number, y: number) => (t: { x: number; y: number; w: number; h: number }) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h;
      for (let x = screen.x0; x < screen.x1; x += (screen.x1 - screen.x0) / 23) {
        for (let y = screen.y0; y < screen.y1; y += (screen.y1 - screen.y0) / 47) {
          const has = (l: number) => TERRAIN_LEVELS[l].tiles.some(at(x, y));
          const drawnAt = (l: number) => tiles.some(t => t.level === l && t.opacity === 1 && at(x, y)(t));
          if (pick.fine >= 1 && pick.alpha === 1 && has(pick.fine)) expect(tiles.some(t => t.level === pick.fine && at(x, y)(t))).toBe(true);
          else if (pick.fine >= 2 && has(pick.fine - 1)) expect(drawnAt(pick.fine - 1)).toBe(true);
          else if (has(0)) expect(drawnAt(0)).toBe(true);
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
      // Every point of the drawn area where the level below has a tile is under it or under the needed one.
      const fineTiles = tilesToDraw(TERRAIN_LEVELS, k, 3, screen, drawn).filter(t => t.level === p.fine);
      for (let x = drawn.x0; x < drawn.x1; x += (drawn.x1 - drawn.x0) / 17) {
        for (let y = drawn.y0; y < drawn.y1; y += (drawn.y1 - drawn.y0) / 31) {
          const on = (t: { x: number; y: number; w: number; h: number }) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h;
          if (!TERRAIN_LEVELS[p.fine - 1].tiles.some(on)) continue;
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

describe("the Illustrated style's mountains (the owner's drawings, sparingly)", () => {
  const ALL = { x0: -1e4, y0: -1e4, x1: 1e4, y1: 1e4 };
  const placed = (key: number) => ({ x: MOUNTAINS[key * 5], y: MOUNTAINS[key * 5 + 1], w: MOUNTAINS[key * 5 + 2] });

  test('only the larger drawings over the famous ranges, none far out', () => {
    expect(famousMountains(0.45, ALL)).toHaveLength(0);
    const drawn = famousMountains(1.7, ALL);
    expect(drawn.length).toBeGreaterThan(20);
    expect(drawn.length).toBeLessThan(80);
    for (const d of drawn) {
      const m = placed(d.key);
      expect(m.w).toBeGreaterThanOrEqual(FAMOUS_MIN_W);
      expect(Object.values(FAMOUS_RANGES).some(r => m.x >= r.x0 && m.x <= r.x1 && m.y >= r.y0 && m.y <= r.y1)).toBe(true);
    }
  });

  test('small and steady on screen: the widest about MOUNTAIN_PT.w at play zoom, growing slowly', () => {
    const widest = (k: number) => Math.max(...famousMountains(k, ALL).map(d => d.w * k));
    expect(widest(1.7)).toBeLessThanOrEqual(MOUNTAIN_PT.w + 1e-9);
    expect(widest(1.7)).toBeGreaterThan(MOUNTAIN_PT.w * 0.8);
    expect(widest(5)).toBeLessThan(MOUNTAIN_PT.w * 1.7); // not 3x, as a drawing scaled with the map would be
    expect(widest(5)).toBeGreaterThan(widest(1.7));
  });

  test('no drawing sits on a bigger one, and the lesser ones give way to names', () => {
    const drawn = famousMountains(1.7, ALL);
    const lesser = drawn.find(d => placed(d.key).w < 30)!;
    const name = { x0: lesser.x + lesser.w * 0.4, y0: lesser.y + lesser.h * 0.4, x1: lesser.x + lesser.w * 0.6, y1: lesser.y + lesser.h * 0.6 };
    expect(famousMountains(1.7, ALL, [name]).some(d => d.key === lesser.key)).toBe(false);
    for (const a of drawn)
      for (const b of drawn) {
        if (a === b) continue;
        const cx = a.x + a.w / 2;
        const cy = a.y + a.h / 2;
        expect(cx > b.x + b.w * 0.15 && cx < b.x + b.w * 0.85 && cy > b.y + b.h * 0.15 && cy < b.y + b.h * 0.85).toBe(false);
      }
  });
});
