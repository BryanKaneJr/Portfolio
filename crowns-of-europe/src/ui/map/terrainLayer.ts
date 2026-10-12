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
 * magnification, SHARPNESS), the next coarser one under it while the finer one fades in, and the coarsest under
 * everything (a few tiles cover the whole region, so a pan past the drawn area, or a tile still loading, shows
 * terrain, never a hole).
 */
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
 * Every tile to draw for a view, bottom to top: the coarsest level over the whole drawn area (`drawn`: the SVG's
 * area, larger than the screen), then over the screen plus BUFFER the needed level at its fade-in opacity, on the
 * level below it while it is still fading in (once it is opaque, the level below could not be seen, so it is not
 * drawn or decoded).
 */
export function tilesToDraw(levels: TerrainLevel[], k: number, dpr: number, screen: Rect, drawn: Rect): DrawTile[] {
  const { fine, alpha } = pickLevel(levels, k, dpr);
  const near = grow(screen, BUFFER);
  const out: DrawTile[] = [];
  const add = (l: number, r: Rect, opacity: number) => {
    for (const t of tilesIn(levels[l], r)) out.push({ ...t, level: l, opacity });
  };
  add(0, drawn, 1);
  if (fine >= 2 && alpha < 1) add(fine - 1, near, 1);
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
