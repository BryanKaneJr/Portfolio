/**
 * Map styles: how the map is painted. The main one, Atlas, takes its cues from the map overhauls strategy players
 * like best: the known world lies on blank parchment (everything past the edges, the deep wastes and the waters no
 * fleet sails), casting a soft shadow onto it; muted colours with the hills and a painted grain showing through;
 * a dark slate sea; quiet borders; and big pale names that curve along each country, spaced out to fill a long
 * thin one. Parchment is an old hand-coloured map; Flat is a clean modern one and the lightest to draw. Painted, the
 * default, lays the realms' colours over the owner's painting of the world.
 */
import { Platform } from 'react-native';
import { mix } from './colors';

import type { MapStyleId } from '../../state/store';

export type { MapStyleId };

export interface MapStyle {
  id: MapStyleId;
  label: string;
  help: string;
  sea: string; // the water before depth shading
  seaZone: { color: string; dash: number[] | null }; // sea-zone boundaries
  seaLabel: string;
  waterLines: { image: 'light' | 'dark'; opacity: number } | null; // lines in the water along the coasts
  relief: number; // opacity of the hill and depth shading
  landColour: number; // how strongly the land's natural colour (Blue Marble) shows through the country colours
  grain: number; // a fine painted grain over the land, the same size on screen at any zoom
  drawn: DrawnTerrain | null; // the hand-drawn terrain (mountains, hills, trees, dunes, reeds), fading in as you zoom in
  land: (hex: string) => string; // how a nation's colour is painted
  wild: string; // known land nobody holds
  unknown: { fill: string; shadow: number; label: Ink; wasteLabel: string }; // the blank parchment, the known world's shadow on it, names written there
  provinceBorder: { color: string; width: number; dash: number[] | null; halo?: string; haloWidth?: number }; // halo: a light casing under the line
  nationBorder: { color: string; width: number; halo: string | null; haloWidth: number };
  coast: { color: string; width: number }; // every coastline, known or not
  river: { color: string; width: number };
  font: { nation: string; nationWeight: '400' | '600' | '700'; region: string; regionWeight: '400' | '600' | '700'; italic: string };
  nationLabel: Ink & { curved: boolean; spacing: number; em: number; spread: boolean }; // em: a capital's width; spread: space a short name out along a long country
  regionLabel: Ink;
  vignette: string | null; // darkened screen edges
  /** The owner's painting as the ground (ui/map/paintingTiles.ts): country colours laid over it at `land` opacity;
   * the unknown veiled at `veil` (the uncharted New World at `uncharted`) rather than covered. */
  painting: { land: number; veil: number; uncharted: number } | null;
  /** The illustrated terrain tiles (ui/map/terrainTiles.ts, made by scripts/terrain): where they exist, the realms'
   * colours are laid over them at `fill` opacity, with rivers and lake shores on top. Elsewhere the same colours lie
   * over a plain land of `base`, with the style's hill shading, so the two meet without a seam of colour. `shore`
   * darkens the water along every coast (strokes of the coastline, widest first, cut to the water). */
  terrain: { fill: number; base: string; river: string; lake: string; shore: { color: string; width: number }[] } | null;
}

/** The drawn terrain's inks (ui/map/terrain.ts), and how far the hill shading gives way to it close up. (The mountain
 * drawings bring their own ink.) */
export interface DrawnTerrain {
  ink: string; // the lines: tree outlines, dunes, reeds
  tree: string; // tree crowns
  reliefClose: number; // the hill shading's strength once the drawn terrain is fully in (a fraction of `relief`)
}

/** How a name is inked: fill, an outline around the letters, and (optionally) a drop shadow. */
export interface Ink {
  fill: string;
  halo: string;
  shadow: string | null;
}

/** A bundled font with a system fallback on the web (native falls back by itself). */
const font = (name: string, fallback: string) => (Platform.OS === 'web' ? `${name}, ${fallback}` : name);
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = Platform.select({ ios: 'System', android: 'sans-serif', default: '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif' });

function grey(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  const l = Math.round(((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11);
  return '#' + ((1 << 24) | (l << 16) | (l << 8) | l).toString(16).slice(1);
}
const muted = (hex: string, t: number) => mix(hex, grey(hex), t);

export const MAP_STYLES: Record<MapStyleId, MapStyle> = {
  painted: {
    id: 'painted',
    label: 'Painted',
    help: "A painted map of the world with the realms' colours washed over it.",
    sea: '#2b5a6b',
    seaZone: { color: 'rgba(220,236,240,0.16)', dash: null },
    seaLabel: 'rgba(226,238,240,0.78)',
    waterLines: null,
    relief: 0,
    landColour: 0,
    grain: 0.55,
    drawn: null,
    land: hex => mix(hex, '#ffffff', 0.06),
    wild: 'rgba(0,0,0,0)', // land nobody holds shows the painting as it is
    unknown: { fill: '#e6d3ad', shadow: 0, label: { fill: '#f3ead6', halo: 'rgba(40,28,14,0.6)', shadow: 'rgba(20,14,7,0.5)' }, wasteLabel: '#f1e4c8' },
    provinceBorder: { color: 'rgba(24,18,10,0.28)', width: 0.55, dash: null },
    nationBorder: { color: 'rgba(22,16,9,0.75)', width: 1.05, halo: 'rgba(255,248,230,0.22)', haloWidth: 3 },
    coast: { color: 'rgba(30,26,20,0.35)', width: 0.6 },
    river: { color: 'rgba(70,120,140,0)', width: 0 }, // the painting has its rivers
    font: {
      nation: font('Cinzel_700Bold', SERIF),
      nationWeight: '400',
      region: font('Cinzel_600SemiBold', SERIF),
      regionWeight: '400',
      italic: font('IMFellEnglish_400Regular_Italic', SERIF),
    },
    nationLabel: { fill: '#f4efe2', halo: 'rgba(22,17,10,0.6)', shadow: 'rgba(16,12,7,0.65)', curved: true, spacing: 0.08, em: 0.76, spread: true },
    regionLabel: { fill: '#f6f2e6', halo: 'rgba(24,18,11,0.78)', shadow: null },
    vignette: null,
    painting: { land: 0.42, veil: 0.28, uncharted: 0.62 },
    terrain: null,
  },
  illustrated: {
    id: 'illustrated',
    label: 'Illustrated',
    help: 'An illustrated atlas drawn from real elevation, forests and rivers (central Europe so far), the realms\' colours washed over it.',
    sea: '#8ea9b3', // the tiles' sea (EDGE_MATCH in scripts/terrain/config.py), so the region's edge doesn't show on the water
    seaZone: { color: 'rgba(52,78,88,0.16)', dash: null },
    seaLabel: 'rgba(52,78,88,0.72)',
    waterLines: null,
    relief: 0.55,
    landColour: 0.2,
    grain: 1,
    drawn: { ink: 'rgba(46,32,19,0.8)', tree: 'rgba(38,62,28,0.5)', reliefClose: 0.3 },
    land: hex => mix(muted(hex, 0.08), '#ffffff', 0.08),
    wild: '#c4c1b4', // cool grey, so land you could settle never reads as the warm parchment of the unknown
    unknown: { fill: '#e6c79d', shadow: 0.6, label: { fill: '#efe3c8', halo: 'rgba(92,66,36,0.35)', shadow: 'rgba(70,48,22,0.35)' }, wasteLabel: '#8d6c45' },
    // Over textured terrain the lines carry a faint light casing, so they hold against forest and mountain ink.
    provinceBorder: { color: 'rgba(30,22,12,0.42)', width: 0.6, dash: null, halo: 'rgba(250,244,228,0.3)', haloWidth: 1.8 },
    nationBorder: { color: 'rgba(24,17,9,0.82)', width: 1.1, halo: 'rgba(250,244,228,0.38)', haloWidth: 3.2 },
    coast: { color: 'rgba(40,32,22,0.7)', width: 0.8 },
    river: { color: '#4f7189', width: 1.5 },
    font: {
      nation: font('Cinzel_700Bold', SERIF),
      nationWeight: '400', // the font file is the bold cut; asking for bold again would fake a heavier one
      region: font('Cinzel_600SemiBold', SERIF),
      regionWeight: '400',
      italic: font('IMFellEnglish_400Regular_Italic', SERIF),
    },
    nationLabel: { fill: '#e8ede0', halo: 'rgba(22,17,10,0.55)', shadow: 'rgba(16,12,7,0.6)', curved: true, spacing: 0.08, em: 0.76, spread: true },
    regionLabel: { fill: '#f0eee4', halo: 'rgba(24,18,11,0.72)', shadow: null },
    vignette: null,
    painting: null,
    terrain: {
      fill: 0.5,
      base: '#d9d0aa',
      river: 'rgba(58,98,118,0.9)',
      lake: 'rgba(58,82,92,0.75)',
      shore: [
        { color: 'rgba(38,66,84,0.1)', width: 9 },
        { color: 'rgba(38,66,84,0.12)', width: 4 },
      ],
    },
  },
  atlas: {
    id: 'atlas',
    label: 'Atlas',
    help: 'The known world on parchment: muted colours over the hills, a slate sea, big curved names.',
    sea: '#3e5a6a',
    seaZone: { color: 'rgba(210,226,232,0.12)', dash: null },
    seaLabel: 'rgba(214,228,233,0.62)',
    waterLines: null,
    relief: 1,
    landColour: 0.34,
    grain: 1,
    drawn: { ink: 'rgba(46,32,19,0.8)', tree: 'rgba(38,62,28,0.5)', reliefClose: 0.3 },
    land: hex => mix(muted(hex, 0.08), '#ffffff', 0.08),
    wild: '#c4c1b4', // cool grey, so land you could settle never reads as the warm parchment of the unknown
    unknown: { fill: '#e6c79d', shadow: 0.6, label: { fill: '#efe3c8', halo: 'rgba(92,66,36,0.35)', shadow: 'rgba(70,48,22,0.35)' }, wasteLabel: '#8d6c45' },
    provinceBorder: { color: 'rgba(24,18,10,0.2)', width: 0.55, dash: null },
    nationBorder: { color: 'rgba(22,16,9,0.62)', width: 0.95, halo: 'rgba(20,14,8,0.14)', haloWidth: 3 },
    coast: { color: 'rgba(48,36,22,0.62)', width: 0.75 },
    river: { color: '#4f7189', width: 1.5 },
    font: {
      nation: font('Cinzel_700Bold', SERIF),
      nationWeight: '400', // the font file is the bold cut; asking for bold again would fake a heavier one
      region: font('Cinzel_600SemiBold', SERIF),
      regionWeight: '400',
      italic: font('IMFellEnglish_400Regular_Italic', SERIF),
    },
    nationLabel: { fill: '#e8ede0', halo: 'rgba(22,17,10,0.55)', shadow: 'rgba(16,12,7,0.6)', curved: true, spacing: 0.08, em: 0.76, spread: true },
    regionLabel: { fill: '#f0eee4', halo: 'rgba(24,18,11,0.72)', shadow: null },
    vignette: null,
    painting: null,
    terrain: null,
  },
  parchment: {
    id: 'parchment',
    label: 'Parchment',
    help: 'An old hand-coloured map: watercolour washes, brown ink, engraved coasts.',
    sea: '#c7cfb9',
    seaZone: { color: 'rgba(92,82,60,0.22)', dash: [2, 4] },
    seaLabel: '#5a5641',
    waterLines: { image: 'dark', opacity: 0.42 },
    relief: 0.55,
    landColour: 0,
    grain: 0.7,
    drawn: { ink: 'rgba(84,54,28,0.78)', tree: 'rgba(80,86,42,0.32)', reliefClose: 0.35 },
    land: hex => mix(hex, '#ead8ac', 0.48),
    wild: '#ecdfbb',
    unknown: { fill: '#e9dab4', shadow: 0.3, label: { fill: '#6e5636', halo: 'rgba(240,228,196,0.6)', shadow: null }, wasteLabel: '#6b5534' },
    provinceBorder: { color: 'rgba(96,70,40,0.42)', width: 0.6, dash: [1.4, 2.2] },
    nationBorder: { color: '#59401f', width: 1.4, halo: 'rgba(150,96,44,0.30)', haloWidth: 5 },
    coast: { color: '#4b3720', width: 1 },
    river: { color: '#5b7c86', width: 1.5 },
    font: {
      nation: font('IMFellEnglish_400Regular', SERIF),
      nationWeight: '400',
      region: font('IMFellEnglish_400Regular', SERIF),
      regionWeight: '400',
      italic: font('IMFellEnglish_400Regular_Italic', SERIF),
    },
    nationLabel: { fill: '#46301a', halo: 'rgba(240,228,196,0.6)', shadow: null, curved: true, spacing: 0.32, em: 0.66, spread: false },
    regionLabel: { fill: '#46301a', halo: 'rgba(240,228,196,0.75)', shadow: null },
    vignette: 'rgba(84,58,26,0.42)',
    painting: null,
    terrain: null,
  },
  flat: {
    id: 'flat',
    label: 'Flat',
    help: 'Clean, flat colours and crisp borders: the clearest and the lightest to draw.',
    sea: '#86aac3',
    seaZone: { color: 'rgba(255,255,255,0.35)', dash: [3, 5] },
    seaLabel: '#43657c',
    waterLines: null,
    relief: 0,
    landColour: 0,
    grain: 0,
    drawn: null,
    land: hex => hex,
    wild: '#ece6d2',
    unknown: { fill: '#e4e1d8', shadow: 0.18, label: { fill: '#8a8679', halo: 'rgba(255,255,255,0.6)', shadow: null }, wasteLabel: '#8a8679' },
    provinceBorder: { color: 'rgba(0,0,0,0.22)', width: 0.5, dash: null },
    nationBorder: { color: '#141414', width: 1.5, halo: null, haloWidth: 0 },
    coast: { color: 'rgba(40,40,40,0.7)', width: 0.8 },
    river: { color: '#3d7db3', width: 1.6 },
    font: { nation: SANS!, nationWeight: '700', region: SANS!, regionWeight: '600', italic: SERIF },
    nationLabel: { fill: '#1b1b1b', halo: 'rgba(255,255,255,0.72)', shadow: null, curved: false, spacing: 0.12, em: 0.7, spread: false },
    regionLabel: { fill: '#1b1b1b', halo: 'rgba(255,255,255,0.8)', shadow: null },
    vignette: null,
    painting: null,
    terrain: null,
  },
};

export const MAP_STYLE_LIST: MapStyle[] = [MAP_STYLES.illustrated, MAP_STYLES.painted, MAP_STYLES.atlas, MAP_STYLES.parchment, MAP_STYLES.flat];
