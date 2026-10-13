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
import { PEAK_SIZE, PEAK_SPRITES, TERRAIN_PEAKS } from './terrainPeaks';
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
 * The Illustrated style's mountains and hills are features, not part of the tiles: one list of summits
 * (terrainPeaks.ts) drawn over the realms' colours. Each level's summits fade in from its zoom on, and a glyph keeps a
 * steady size on screen (the top tier's height at each level's own zoom, straight in between, shrinking slowly below
 * play zoom), so zooming never magnifies them and no two sets of peaks ever show at once.
 */
export function peakPt(k: number, sizes: number[], ks: number[] = PEAK_SIZE.k): number {
  if (k <= ks[0]) return sizes[0] * Math.pow(k / ks[0], 0.45);
  for (let i = 1; i < ks.length; i++) if (k <= ks[i]) return sizes[i - 1] + ((sizes[i] - sizes[i - 1]) * (k - ks[i - 1])) / (ks[i] - ks[i - 1]);
  return sizes[sizes.length - 1];
}

export interface PeakDraw {
  key: number;
  src: number;
  x: number; // the sprite's box, map units
  y: number;
  w: number;
  h: number;
  opacity: number;
}

/** The peaks to draw at zoom k inside `view` (map units). Middle and small peaks and hills give way to the names in
 * `names` (boxes in map units); a top-tier massif is drawn even under a name (the map would not be the map without
 * it; the name is written over it). */
export function peaksToDraw(k: number, view: Rect, names: Rect[] = []): PeakDraw[] {
  const out: PeakDraw[] = [];
  const top = peakPt(k, PEAK_SIZE.top);
  const hill = peakPt(k, PEAK_SIZE.hill);
  for (let i = 0; i < TERRAIN_PEAKS.length; i += 6) {
    const [a, b] = PEAK_SIZE.from[TERRAIN_PEAKS[i + 4]];
    if (k <= a) continue;
    const isHill = TERRAIN_PEAKS[i + 2] === 1;
    const tier = TERRAIN_PEAKS[i + 3];
    const pt = isHill ? hill : top * PEAK_SIZE.tier[tier];
    const min = isHill ? PEAK_SIZE.hillMinPt : PEAK_SIZE.minPt;
    if (pt <= min) continue;
    const sp = PEAK_SPRITES[TERRAIN_PEAKS[i + 5]];
    const g = pt / k;
    const w = sp.w * g;
    const h = sp.h * g;
    const x = TERRAIN_PEAKS[i] - sp.ax * w;
    const y = TERRAIN_PEAKS[i + 1] + PEAK_SIZE.base[isHill ? 1 : 0] * g - sp.ay * h;
    const box = { x0: x, y0: y, x1: x + w, y1: y + h };
    if (!overlapsRect(box, view)) continue;
    if ((isHill || tier !== 0) && names.some(n => overlapsRect(box, n))) continue;
    out.push({ key: i / 6, src: sp.src, x, y, w, h, opacity: Math.min(1, (k - a) / (b - a), pt - min) });
  }
  return out;
}

const overlapsRect = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
