/**
 * Keeping the illustrated terrain's tiles warm: a TileCache (terrainLayer.ts) whose loads are the platform's own image
 * prefetch (the browser's image cache on the web, React Native's on a phone), so the tiles a pan or a zoom step will
 * need next are decoded before they are drawn, and whose evictions drop that handle so the platform may free them.
 * All tiles are bundled with the app (no network): "load" only reads and decodes a local asset.
 */
import { Asset } from 'expo-asset';
import { Image, Platform } from 'react-native';
import { TileCache } from './terrainLayer';
import { TERRAIN_LEVELS } from './terrainTiles';

/** Most tiles kept warm at once: enough for the screen's tiles at two levels plus the ring around them. */
export const CACHE_TILES = 160;

const byKey = new Map<string, number>();
for (const level of TERRAIN_LEVELS) for (const t of level.tiles) byKey.set(t.key, t.src);

const held = new Map<string, unknown>();

function load(key: string) {
  const src = byKey.get(key);
  if (src === undefined) return;
  const uri = Asset.fromModule(src).uri;
  if (Platform.OS === 'web') {
    const img = new window.Image();
    img.decoding = 'async';
    img.src = uri;
    held.set(key, img);
  } else {
    held.set(key, true);
    Image.prefetch(uri).catch(() => held.delete(key));
  }
}

function release(key: string) {
  held.delete(key);
}

export const terrainCache = new TileCache(CACHE_TILES, load, release);

/** What the layer drew last, for the walkthroughs and the performance check (window.__coe.terrain). */
export const terrainStats = { tiles: 0, decodedBytes: 0, level: -1, alpha: 0, cached: 0, evicted: 0 };
