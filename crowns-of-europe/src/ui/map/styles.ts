/**
 * Map styles: how the map is painted. The main one, Atlas, takes its cues from the map overhauls strategy players
 * like best: the known world lies on blank parchment (everything past the edges, the deep wastes and the waters no
 * fleet sails), casting a soft shadow onto it; muted colours with the hills and a painted grain showing through;
 * a dark slate sea; quiet borders; and big pale names that curve along each country, spaced out to fill a long
 * thin one. Parchment is an old hand-coloured map; Flat is a clean modern one and the lightest to draw.
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
  provinceBorder: { color: string; width: number; dash: number[] | null };
  nationBorder: { color: string; width: number; halo: string | null; haloWidth: number };
  coast: { color: string; width: number }; // every coastline, known or not
  river: { color: string; width: number };
  font: { nation: string; nationWeight: '400' | '600' | '700'; region: string; regionWeight: '400' | '600' | '700'; italic: string };
  nationLabel: Ink & { curved: boolean; spacing: number; em: number; spread: boolean }; // em: a capital's width; spread: space a short name out along a long country
  regionLabel: Ink;
  vignette: string | null; // darkened screen edges
}

/** The drawn terrain's inks (ui/map/terrain.ts), and how far the hill shading gives way to it close up. */
export interface DrawnTerrain {
  wash: string; // the colour washed over a mountain range
  light: string; // a mountain's lit faces
  shade: string; // the shaded flanks of mountains and hills
  ink: string; // the lines: ridges, hills, tree outlines, dunes, reeds
  tree: string; // tree crowns
  snow: string;
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
    drawn: { wash: 'rgba(170,132,80,0.4)', light: 'rgba(255,242,212,0.36)', shade: 'rgba(58,38,20,0.3)', ink: 'rgba(46,32,19,0.8)', tree: 'rgba(38,62,28,0.5)', snow: 'rgba(255,255,255,0.55)', reliefClose: 0.3 },
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
    drawn: { wash: 'rgba(190,150,90,0.3)', light: 'rgba(255,248,232,0.34)', shade: 'rgba(96,64,32,0.28)', ink: 'rgba(84,54,28,0.78)', tree: 'rgba(80,86,42,0.32)', snow: 'rgba(255,255,255,0.55)', reliefClose: 0.35 },
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
  },
};

export const MAP_STYLE_LIST: MapStyle[] = [MAP_STYLES.atlas, MAP_STYLES.parchment, MAP_STYLES.flat];
