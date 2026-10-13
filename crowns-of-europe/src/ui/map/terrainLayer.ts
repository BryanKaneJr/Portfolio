/**
 * The illustrated terrain's tile layer, as plain functions (no React, no platform), so it can be tested: which detail
 * level the camera needs, which tiles it draws, how two levels cross-fade, and a small LRU cache that decides which
 * tiles to keep warm. The tiles are made offline by scripts/terrain (render.py): see terrainTiles.ts for the index.
 *
 * World space: every tile is placed in map units, inside the same SVG viewBox as the regions, borders and coasts, so
 * every layer lines up by construction.
 *
 * Levels: level L has PPU[L] pixels per map unit. A screen showing k points per map unit at `dpr` device pixels per
 * point needs k * dpr pixels per map unit; the layer draws the finest level it needs (allowing a little
 * magnification, SHARPNESS), the next coarser one under it while it fades in and around it out to the drawn area's
 * edge, and the coarsest under everything (a few tiles cover the whole region, so a pan past the drawn area, or a
 * tile still loading, shows terrain, never a hole).
 */
import { MOUNTAINS, MOUNTAIN_ART } from './terrainSymbols';
import type { TerrainLevel, TerrainTile } from './terrainTiles';

/** How much magnification is tolerated before the next level is needed: 0.85 means at most 1/0.85 = 1.18x. */
export const SHARPNESS = 0.85;
/** The octave fraction over which a finer level fades in once it is needed. */
export const FADE = 0.4;
/** Fine tiles are drawn over the screen plus this much on every side (a fraction of the screen's size). */
export const BUFFER = 0.15;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LevelPick {
  /** The finest level drawn. */
  fine: number;
  /** Its opacity over the level beneath (0-1): it fades in over the first FADE of an octave. */
  alpha: number;
  /** Device pixels per map unit the screen needs. */
  need: number;
}

/** Which level to draw at zoom k (screen points per map unit) on a screen with `dpr` device pixels per point. */
export function pickLevel(levels: TerrainLevel[], k: number, dpr: number): LevelPick {
  const need = k * dpr * SHARPNESS;
  let fine = levels.length - 1;
  for (let i = 0; i < levels.length; i++)
    if (levels[i].ppu >= need) {
      fine = i;
      break;
    }
  if (fine === 0) return { fine, alpha: 1, need };
  const below = levels[fine - 1].ppu;
  const alpha = Math.max(0, Math.min(1, Math.log2(need / below) / FADE));
  return { fine, alpha, need };
}

const overlaps = (t: TerrainTile, r: Rect) => t.x < r.x1 && t.x + t.w > r.x0 && t.y < r.y1 && t.y + t.h > r.y0;

/** The tiles of a level that touch a rectangle (map units). */
export function tilesIn(level: TerrainLevel, r: Rect): TerrainTile[] {
  return level.tiles.filter(t => overlaps(t, r));
}

/** A rectangle grown by a fraction of its size on every side. */
export function grow(r: Rect, f: number): Rect {
  const dx = (r.x1 - r.x0) * f;
  const dy = (r.y1 - r.y0) * f;
  return { x0: r.x0 - dx, y0: r.y0 - dy, x1: r.x1 + dx, y1: r.y1 + dy };
}

export interface DrawTile extends TerrainTile {
  level: number;
  opacity: number;
}

/**
 * Every tile to draw for a view, bottom to top:
 * - the coarsest level over the whole drawn area (`drawn`: the SVG's area, larger than the screen, which a pan
 *   reveals before the map is redrawn);
 * - the level below the needed one over the drawn area too, so a long pan shows half-resolution terrain at the edges
 *   rather than the coarsest; once the needed level is opaque, not under it where the needed level covers it whole
 *   (`full`: it could not be seen there);
 * - the needed level over the screen plus BUFFER, at its fade-in opacity.
 */
export function tilesToDraw(levels: TerrainLevel[], k: number, dpr: number, screen: Rect, drawn: Rect): DrawTile[] {
  const { fine, alpha } = pickLevel(levels, k, dpr);
  const near = grow(screen, BUFFER);
  const out: DrawTile[] = [];
  const add = (l: number, r: Rect, opacity: number) => {
    for (const t of tilesIn(levels[l], r)) out.push({ ...t, level: l, opacity });
  };
  add(0, drawn, 1);
  if (fine >= 2) {
    for (const t of tilesIn(levels[fine - 1], drawn)) {
      // Hidden only where the needed level covers it whole (tiles are made only where they show land, so a finer one
      // may be missing where a coarser one is not).
      const hidden = alpha >= 1 && !!t.full && t.x >= near.x0 && t.y >= near.y0 && t.x + t.w <= near.x1 && t.y + t.h <= near.y1;
      if (!hidden) out.push({ ...t, level: fine - 1, opacity: 1 });
    }
  }
  if (fine >= 1 && alpha > 0) add(fine, near, alpha);
  return out;
}

/** Decoded memory of a set of tiles, in bytes (RGBA, the pixels each tile actually has). */
export function decodedBytes(levels: TerrainLevel[], tiles: { level: number; w: number; h: number }[]): number {
  return tiles.reduce((s, t) => s + Math.round(t.w * levels[t.level].ppu) * Math.round(t.h * levels[t.level].ppu) * 4, 0);
}

/**
 * A least-recently-used set of tile keys: the tiles drawn now are "touched"; the ring around them (what a pan or a zoom
 * step would need next) is prefetched; when it holds more than `capacity`, the least recently used are evicted and
 * handed to `release` (the platform's prefetch handle is dropped, so its decoded image can be freed).
 */
export class TileCache {
  private order = new Map<string, number>(); // key → last use (monotonic counter)
  private clock = 0;
  constructor(
    readonly capacity: number,
    private readonly load: (key: string) => void,
    private readonly release: (key: string) => void,
  ) {}

  /** Mark tiles as used now; load any not yet held; evict past capacity. Returns the keys evicted. */
  use(keys: string[]): string[] {
    for (const k of keys) {
      if (!this.order.has(k)) this.load(k);
      this.order.set(k, ++this.clock);
    }
    const evicted: string[] = [];
    if (this.order.size > this.capacity) {
      const pinned = new Set(keys);
      const byAge = [...this.order].filter(([k]) => !pinned.has(k)).sort((a, b) => a[1] - b[1]);
      for (const [k] of byAge) {
        if (this.order.size <= this.capacity) break;
        this.order.delete(k);
        this.release(k);
        evicted.push(k);
      }
    }
    return evicted;
  }

  has(key: string): boolean {
    return this.order.has(key);
  }

  get size(): number {
    return this.order.size;
  }
}

/** The tiles a view will want next: the needed level one step around the screen, and the level after it. */
export function neighbours(levels: TerrainLevel[], k: number, dpr: number, screen: Rect): TerrainTile[] {
  const { fine } = pickLevel(levels, k, dpr);
  const ring = tilesIn(levels[fine], grow(screen, 0.5));
  const finer = fine + 1 < levels.length ? tilesIn(levels[fine + 1], screen) : [];
  return [...ring, ...finer];
}

/** The web-map zoom (256 * 2^z points per 360°) that zoom k shows, for Natural Earth's min_zoom. */
export function webZoom(k: number, unitsPerDegree: number): number {
  return Math.log2((unitsPerDegree * k * 360) / 256);
}

/**
 * The Illustrated style's mountains: the owner's own drawings (art/mountains, placed along the real ranges by
 * scripts/build-terrain.ts for the Atlas style), used sparingly. Only the famous ranges get them, only their larger
 * drawings (FAMOUS_MIN_W map units and up), and small: a steady size on screen, growing only slowly as you zoom in.
 * They fade in from k 0.6 like the Atlas drawings, and give way to the region names (all but the largest).
 */
export const FAMOUS_RANGES: Record<string, Rect> = {
  alps: { x0: 1844, y0: 831, x1: 2044, y1: 948 }, // 5-16.5°E, 43.6-48.3°N
  pyrenees: { x0: 1719, y0: 953, x1: 1815, y1: 982 }, // 2.2°W-3.3°E, 42.2-43.4°N
  carpathians: { x0: 2053, y0: 788, x1: 2227, y1: 931 }, // 17-27°E, 44.3-49.9°N
  apennines: { x0: 1914, y0: 948, x1: 2044, y1: 1066 }, // 9-16.5°E, 38.5-43.6°N
  scandinavian: { x0: 1844, y0: 63, x1: 2105, y1: 514 }, // 5-20°E, 59-70°N
  atlas: { x0: 1583, y0: 1088, x1: 1949, y1: 1265 }, // 10°W-11°E, 29-37.5°N
};
export const FAMOUS_MIN_W = 18; // map units: a drawing at least this wide in the Atlas placement (the ranges' main massifs)
export const MOUNTAIN_PT = { k: 1.7, w: 32, grow: 0.4 }; // the widest drawing's width on screen at play zoom (points), and how it grows with zoom
const WIDEST = 40; // the Atlas placement's widest drawing, map units
const BIG = 30; // drawings this wide and up are drawn even under a name

export interface MountainDraw {
  key: number;
  src: number;
  x: number; // map units
  y: number;
  w: number;
  h: number;
  flip: boolean;
  opacity: number;
}

let famous: { key: number; x: number; y: number; w: number; art: number; flip: boolean }[] | null = null;

/** The drawings to show at zoom k inside `view` (map units), largest first; the lesser ones skip `names` and any
 * larger drawing they would overlap. */
export function famousMountains(k: number, view: Rect, names: Rect[] = []): MountainDraw[] {
  if (!famous) {
    famous = [];
    for (let i = 0; i < MOUNTAINS.length; i += 5) {
      const [x, y, w] = [MOUNTAINS[i], MOUNTAINS[i + 1], MOUNTAINS[i + 2]];
      if (w < FAMOUS_MIN_W || !Object.values(FAMOUS_RANGES).some(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)) continue;
      famous.push({ key: i / 5, x, y, w, art: MOUNTAINS[i + 3], flip: MOUNTAINS[i + 4] === 1 });
    }
    famous.sort((a, b) => b.w - a.w || a.y - b.y || a.x - b.x);
  }
  const opacity = Math.max(0, Math.min(1, (k - 0.6) / 0.4));
  if (opacity <= 0) return [];
  const pt = (MOUNTAIN_PT.w / WIDEST) * Math.pow(k / MOUNTAIN_PT.k, MOUNTAIN_PT.grow); // points per Atlas map unit of width
  const out: MountainDraw[] = [];
  for (const m of famous) {
    const art = MOUNTAIN_ART[m.art];
    const w = (m.w * pt) / k;
    const h = (w * art.h) / art.w;
    const box = { x0: m.x - w / 2, y0: m.y - h / 2, x1: m.x + w / 2, y1: m.y + h / 2 };
    if (!overlapsRect(box, view)) continue;
    if (m.w < BIG && names.some(n => overlapsRect(box, n))) continue;
    if (out.some(o => overlapsRect(box, { x0: o.x + o.w * 0.15, y0: o.y + o.h * 0.15, x1: o.x + o.w * 0.85, y1: o.y + o.h * 0.85 }))) continue;
    out.push({ key: m.key, src: art.src, x: box.x0, y: box.y0, w, h, flip: m.flip, opacity });
  }
  return out;
}

const overlapsRect = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
