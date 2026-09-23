import type { TextStyle } from 'react-native';

/**
 * BrainScroll visual tokens — from docs/visual-direction.md.
 *
 * Violet is the brand. Navy/graphite does the heavy lifting. Blue, mint, coral
 * and gold are semantic, not decoration. Gold stays scarce (true mastery only),
 * and only one bright accent should dominate a screen at a time.
 */
export const color = {
  bg: '#111827', // Midnight Navy — app background
  surface: '#1B2436', // Deep Slate — cards, panels
  surfaceRaised: '#232E45',
  border: '#2A3550',
  brand: '#7C5CFF', // Electric Violet — primary CTA, active level
  info: '#4DA3FF', // Bright Blue — information, secondary progress
  success: '#39D98A', // Mint — correct, recall confirmed
  mastery: '#FFC857', // XP Gold — mastery stars, prestige ONLY
  danger: '#FF6B6B', // Coral — incorrect, warning
  text: '#F7F9FC', // Soft White
  textMuted: '#A7B0C0', // Cool Gray — secondary copy, locked
} as const;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Sora/Manrope direction; system font until the font files are added. */
export const type = {
  display: { fontSize: 40, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 23 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  number: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

/** Normal feedback 150–250 ms; mastery moments may breathe longer. Respect reduce-motion. */
export const motion = { fast: 150, normal: 220, celebrate: 900 } as const;
