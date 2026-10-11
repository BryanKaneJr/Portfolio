import { Platform } from 'react-native';

/** Parchment and ink, with dark wood for the chrome around the map. */
export const C = {
  chrome: '#211810',
  chrome2: '#2e2318',
  chromeLine: '#4a3a28',
  chromeText: '#f3e7c9',
  chromeMuted: '#b9a682',
  gold: '#d9a441',
  goldDark: '#a87a24',
  parchment: '#f3ead3',
  parchment2: '#e9dcbc',
  parchmentLine: '#cdb98f',
  ink: '#2a2118',
  inkSoft: '#5b4b38',
  muted: '#83725a',
  red: '#a8382a',
  redSoft: '#f1d6cc',
  green: '#3d7a37',
  greenSoft: '#d9e8cf',
  blue: '#2f5f8a',
  blueSoft: '#d6e3ee',
  sea: '#a6c3cf',
  seaDark: '#8fb1bf',
  coast: '#5d4f3c',
  waste: '#cbbf9f',
  white: '#ffffff',
  overlay: 'rgba(20,14,8,0.55)',
};

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' });
export const sans = Platform.select({ ios: 'System', android: 'sans-serif', default: '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif' });

export const R = { sm: 6, md: 10, lg: 16 };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const FAITH_COLOR: Record<string, string> = {
  catholic: '#e2c46a',
  orthodox: '#6f9fd3',
  muslim: '#4f9a5a',
  protestant: '#b9619a',
  native: '#a88560',
};
export const TERRAIN_COLOR: Record<string, string> = {
  plains: '#cfd89a',
  forest: '#7fa36a',
  hills: '#c4a77a',
  marsh: '#8fae9a',
  mountains: '#a39a8c',
};
export const fmt = (n: number, digits = 0) =>
  (Math.abs(n) >= 1000 && digits === 0 ? Math.round(n).toLocaleString('en-US') : n.toFixed(digits)).replace('-0', '0');
export const signed = (n: number, digits = 0) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n), digits);
export const pct = (n: number) => signed(Math.round(n * 100)) + '%';
export const kmen = (men: number) => (men >= 1000 ? `${(men / 1000).toFixed(men >= 10000 ? 0 : 1)}k` : `${Math.round(men)}`);
