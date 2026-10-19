import { useColorScheme } from 'react-native';

export type Palette = {
  /** Screen background (iOS grouped background). */
  bg: string;
  /** Cards, inputs, sheets. */
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  /** Placeholders, disabled controls. */
  textFaint: string;
  /** Main action buttons: ink. */
  primary: string;
  primaryText: string;
  /** Links, icons, the selected tab: tomato. */
  accent: string;
  accentSoft: string;
  /** Text on an accent fill. */
  onAccent: string;
  /** "Use" green. */
  herb: string;
  herbSoft: string;
  herbText: string;
  /** "Avoid" red. */
  avoid: string;
  avoidSoft: string;
  avoidText: string;
  chip: string;
  chipBorder: string;
  divider: string;
  /** Segmented-control track, tags. */
  fill: string;
  warnSoft: string;
  warnText: string;
};

/**
 * Clean iOS look (owner, 2026-10-12): system grouped greys and white cards, ink buttons, tomato only as the accent.
 * Text colours meet WCAG AA (4.5:1) on both the background and the cards.
 */
export const light: Palette = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  cardBorder: '#E5E5EA',
  text: '#111111',
  textMuted: '#6E6E73',
  textFaint: '#AEAEB2',
  primary: '#1C1C1E',
  primaryText: '#FFFFFF',
  accent: '#C93C28',
  accentSoft: '#FCEBE7',
  onAccent: '#FFFFFF',
  herb: '#24824F',
  herbSoft: '#E3F2E8',
  herbText: '#1F7A49',
  avoid: '#C62F22',
  avoidSoft: '#FBE5E2',
  avoidText: '#B5301F',
  chip: '#FFFFFF',
  chipBorder: '#D8D8DD',
  divider: '#E5E5EA',
  fill: '#E3E3E8',
  warnSoft: '#FFF3D6',
  warnText: '#7A5200',
};

export const dark: Palette = {
  bg: '#000000',
  card: '#1C1C1E',
  cardBorder: '#2C2C2E',
  text: '#F5F5F7',
  textMuted: '#98989F',
  textFaint: '#636366',
  primary: '#F5F5F7',
  primaryText: '#111111',
  accent: '#FF6B57',
  accentSoft: '#3A1E1A',
  onAccent: '#111111',
  herb: '#3DBE7A',
  herbSoft: '#16301F',
  herbText: '#7FD9A6',
  avoid: '#FF6B5E',
  avoidSoft: '#3A1C19',
  avoidText: '#FF9C90',
  chip: '#1C1C1E',
  chipBorder: '#38383A',
  divider: '#2C2C2E',
  fill: '#2C2C2E',
  warnSoft: '#3A2F14',
  warnText: '#F2C86B',
};

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
