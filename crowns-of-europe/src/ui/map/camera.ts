/**
 * The map camera's limits, shared by React and the gesture worklets (plain functions: no React, no platform). The
 * screen stays over the known world and the zoom between the whole map and K_MAX; a gesture may pull past either,
 * against a resistance that grows the further it goes, and slides back when let go (MapView).
 */
import { MAP_H, MAP_W } from './geometry';

export const K_MAX = 7; // closest zoom (screen points per map unit)

/** The nearest centre that keeps a w x h screen at zoom k over the known world (centred if the map is smaller). */
export function clampCentre(cx: number, cy: number, k: number, w: number, h: number): [number, number] {
  'worklet';
  const halfW = w / 2 / k;
  const halfH = h / 2 / k;
  return [halfW * 2 >= MAP_W ? MAP_W / 2 : Math.max(halfW, Math.min(MAP_W - halfW, cx)), halfH * 2 >= MAP_H ? MAP_H / 2 : Math.max(halfH, Math.min(MAP_H - halfH, cy))];
}

/** A camera inside the limits: zoom first, then the centre at that zoom. */
export function clampView(cx: number, cy: number, k0: number, w: number, h: number, kMin: number): [number, number, number] {
  'worklet';
  const k = Math.max(kMin, Math.min(K_MAX, k0));
  const [x, y] = clampCentre(cx, cy, k, w, h);
  return [x, y, k];
}

/**
 * How far a pull of `over` points past a limit actually moves the map: about half at first, then ever stiffer,
 * never as far as `dim` (the screen's size that way).
 */
export function rubber(over: number, dim: number): number {
  'worklet';
  if (dim <= 0) return 0;
  return Math.sign(over) * (1 - 1 / ((Math.abs(over) * 0.55) / dim + 1)) * dim;
}

/** The same resistance for zoom, in ratios: past a zoom limit, pinching further gets you ever less. */
export function rubberZoom(k: number, kMin: number): number {
  'worklet';
  if (k > K_MAX) return K_MAX * Math.pow(k / K_MAX, 0.3);
  if (k < kMin) return kMin * Math.pow(k / kMin, 0.3);
  return k;
}
