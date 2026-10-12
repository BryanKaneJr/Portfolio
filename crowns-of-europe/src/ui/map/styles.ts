/**
 * Map styles: how the map is painted. The main one, Atlas, takes its cues from the map overhauls strategy players
 * like best: hill shading under the political colours, deep water that darkens with depth, ripple lines along the
 * coasts, bold inked borders over fine province lines that fade as you zoom out, and big names that curve across
 * each country. Parchment is an old hand-coloured map; Flat is a clean modern one and the lightest to draw.
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
  land: (hex: string) => string; // how a nation's colour is painted
  wild: string; // land nobody holds
  waste: { fill: string; line: string; hatch: string | null; label: string };
  far: { fill: string; hatch: string | null; veil: number; coast: string; label: string; seaLabel: string };
  provinceBorder: { color: string; width: number; dash: number[] | null };
  nationBorder: { color: string; width: number; halo: string | null; haloWidth: number };
  coast: { color: string; width: number };
  river: { color: string; width: number };
  font: { nation: string; nationWeight: '400' | '600' | '700'; region: string; regionWeight: '400' | '600' | '700'; italic: string };
  nationLabel: { fill: string; halo: string; curved: boolean; spacing: number; em: number }; // em: a capital's width
  regionLabel: { fill: string; halo: string };
  vignette: string | null; // darkened screen edges
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
    help: 'Hills and sea depths under rich colours, rippled coasts, curved names.',
    sea: '#4f7f99',
    seaZone: { color: 'rgba(226,238,242,0.16)', dash: [3, 5] },
    seaLabel: 'rgba(222,236,241,0.78)',
    waterLines: { image: 'light', opacity: 0.34 }, // with a glow off the shore
    relief: 0.95,
    land: hex => mix(muted(hex, 0.12), '#efe3c2', 0.1),
    wild: '#e3dbbf',
    waste: { fill: '#cbbd97', line: 'rgba(70,55,30,0.35)', hatch: null, label: '#5f5236' },
    far: { fill: '#ded1ae', hatch: 'rgba(118,96,60,0.22)', veil: 0.4, coast: '#7a6646', label: '#6f5d3d', seaLabel: 'rgba(222,236,241,0.6)' },
    provinceBorder: { color: 'rgba(28,20,12,0.30)', width: 0.6, dash: null },
    nationBorder: { color: '#1b130b', width: 1.35, halo: 'rgba(18,12,6,0.30)', haloWidth: 4.5 },
    coast: { color: '#2a2017', width: 0.9 },
    river: { color: '#4b81a6', width: 1.8 },
    font: {
      nation: font('Cinzel_700Bold', SERIF),
      nationWeight: '400', // the font file is the bold cut; asking for bold again would fake a heavier one
      region: font('Cinzel_600SemiBold', SERIF),
      regionWeight: '400',
      italic: font('IMFellEnglish_400Regular_Italic', SERIF),
    },
    nationLabel: { fill: '#22180e', halo: 'rgba(246,238,214,0.62)', curved: true, spacing: 0.26, em: 0.76 },
    regionLabel: { fill: '#2a2118', halo: 'rgba(243,234,211,0.82)' },
    vignette: 'rgba(18,12,6,0.28)',
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
    land: hex => mix(hex, '#ead8ac', 0.48),
    wild: '#ecdfbb',
    waste: { fill: '#e3d3a7', line: 'rgba(110,85,50,0.4)', hatch: 'rgba(120,95,55,0.32)', label: '#6b5534' },
    far: { fill: '#e6d7b1', hatch: 'rgba(120,98,62,0.3)', veil: 0.45, coast: '#6e5636', label: '#6e5636', seaLabel: '#6a6650' },
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
    nationLabel: { fill: '#46301a', halo: 'rgba(240,228,196,0.6)', curved: true, spacing: 0.32, em: 0.66 },
    regionLabel: { fill: '#46301a', halo: 'rgba(240,228,196,0.75)' },
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
    land: hex => hex,
    wild: '#ece6d2',
    waste: { fill: '#d7d2c3', line: 'rgba(0,0,0,0.2)', hatch: null, label: '#6f6a5c' },
    far: { fill: '#e2dfd4', hatch: null, veil: 0, coast: 'rgba(60,60,60,0.45)', label: '#8a8679', seaLabel: '#5d7d93' },
    provinceBorder: { color: 'rgba(0,0,0,0.22)', width: 0.5, dash: null },
    nationBorder: { color: '#141414', width: 1.5, halo: null, haloWidth: 0 },
    coast: { color: '#3a3a3a', width: 0.8 },
    river: { color: '#3d7db3', width: 1.6 },
    font: { nation: SANS!, nationWeight: '700', region: SANS!, regionWeight: '600', italic: SERIF },
    nationLabel: { fill: '#1b1b1b', halo: 'rgba(255,255,255,0.72)', curved: false, spacing: 0.12, em: 0.7 },
    regionLabel: { fill: '#1b1b1b', halo: 'rgba(255,255,255,0.8)' },
    vignette: null,
  },
};

export const MAP_STYLE_LIST: MapStyle[] = [MAP_STYLES.atlas, MAP_STYLES.parchment, MAP_STYLES.flat];
