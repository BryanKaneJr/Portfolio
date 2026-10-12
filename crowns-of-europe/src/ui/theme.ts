import { Platform } from 'react-native';

/**
 * "Gilded glass": a dark, rich interface with gilt accents and heraldry (the feel of a historical strategy game)
 * built the way a phone app is: floating translucent controls over the map, capsule buttons, inset sheets with a
 * grab handle, grouped lists. Gold is the one tint, and like a phone's accent colour it marks what you can act on;
 * green and red only ever mean good and bad.
 */
export const G = {
  // Surfaces, darkest first.
  bg: '#0d1015', // behind everything
  panel: '#151a21', // sheets and panels (opaque)
  group: '#1e242e', // grouped lists and tiles on a panel
  raised: '#28303c', // pressed rows, tracks, chips
  glass: 'rgba(18,22,29,0.62)', // floating controls over the map (on top of a blur)
  glassStrong: 'rgba(16,20,26,0.84)', // floating panels that hold text
  // Lines.
  line: 'rgba(255,255,255,0.09)',
  lineStrong: 'rgba(255,255,255,0.16)',
  gilt: 'rgba(214,178,110,0.42)', // gilded hairlines and frames
  // Text.
  text: '#efe9dc',
  text2: '#b3ac9b',
  text3: '#7f7a6d',
  // The tint, and meaning.
  gold: '#d6b26e',
  goldBright: '#ecd08f',
  goldDeep: '#a8853f',
  good: '#80c890',
  bad: '#ec7a68',
  warn: '#e9b45a',
  info: '#79acdd',
};

/** Legacy names, mapped onto the new palette (the screens were written against these). */
export const C = {
  chrome: G.bg,
  chrome2: G.raised,
  chromeLine: G.lineStrong,
  chromeText: G.text,
  chromeMuted: G.text2,
  gold: G.gold,
  goldDark: G.goldDeep,
  parchment: G.panel,
  parchment2: G.group,
  parchmentLine: '#323a47',
  ink: G.text,
  inkSoft: '#cfc8b7',
  muted: G.text3,
  red: G.bad,
  redSoft: 'rgba(236,122,104,0.16)',
  green: G.good,
  greenSoft: 'rgba(128,200,144,0.15)',
  blue: G.info,
  blueSoft: 'rgba(121,172,221,0.15)',
  sea: '#3e5a6a',
  seaDark: '#34505f',
  coast: '#5d4f3c',
  waste: '#cbbf9f',
  white: '#ffffff',
  overlay: 'rgba(5,7,10,0.62)',
};

/** Display lettering (classical capitals, bundled); a book face for flavour; the system face for everything read. */
export const display = Platform.OS === 'web' ? 'Cinzel_700Bold, Georgia, serif' : 'Cinzel_700Bold';
export const displaySemi = Platform.OS === 'web' ? 'Cinzel_600SemiBold, Georgia, serif' : 'Cinzel_600SemiBold';
export const book = Platform.OS === 'web' ? 'IMFellEnglish_400Regular, Georgia, serif' : 'IMFellEnglish_400Regular';
export const bookItalic = Platform.OS === 'web' ? 'IMFellEnglish_400Regular_Italic, Georgia, serif' : 'IMFellEnglish_400Regular_Italic';
export const serif = display;
export const sans = Platform.select({ ios: 'System', android: 'sans-serif', default: '-apple-system, system-ui, "SF Pro Text", "Segoe UI", Roboto, sans-serif' });

/** Corner radii: capsules for controls, generous continuous corners for containers (inner ones concentric). */
export const R = { sm: 8, md: 12, lg: 18, xl: 28, pill: 999 };
export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

/** Soft drop shadow for anything floating over the map. */
export const float = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 10,
};

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
