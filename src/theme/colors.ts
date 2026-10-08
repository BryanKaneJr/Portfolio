import { useColorScheme } from 'react-native';

export type Palette = {
  bg: string;
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  herb: string;
  herbSoft: string;
  herbText: string;
  avoid: string;
  avoidSoft: string;
  avoidText: string;
  chip: string;
  chipBorder: string;
  divider: string;
  warnSoft: string;
  warnText: string;
};

/** Warm "little kitchen tool" palette from the build plan, plus a dark variant. */
export const light: Palette = {
  bg: '#FFF9F0',
  card: '#FFFFFF',
  cardBorder: '#F0E6D8',
  text: '#242424',
  textMuted: '#667085',
  primary: '#D9543F',
  primaryText: '#FFFFFF',
  primarySoft: '#FBE7E2',
  herb: '#5D8065',
  herbSoft: '#E5EEE7',
  herbText: '#2F4F37',
  avoid: '#8A3B2E',
  avoidSoft: '#F6E3DF',
  avoidText: '#7A2E22',
  chip: '#FFFFFF',
  chipBorder: '#E6DCCD',
  divider: '#EFE6DA',
  warnSoft: '#FFF1D6',
  warnText: '#7A5200',
};

export const dark: Palette = {
  bg: '#1A1714',
  card: '#25211D',
  cardBorder: '#342E28',
  text: '#F4EFE8',
  textMuted: '#A8A29A',
  primary: '#E8664F',
  primaryText: '#FFFFFF',
  primarySoft: '#3A2520',
  herb: '#8DB596',
  herbSoft: '#24332A',
  herbText: '#BFDCC6',
  avoid: '#F0A090',
  avoidSoft: '#3A2420',
  avoidText: '#F5B5A8',
  chip: '#25211D',
  chipBorder: '#3D3630',
  divider: '#342E28',
  warnSoft: '#3A3020',
  warnText: '#F2D08A',
};

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
