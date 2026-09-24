import type { TextStyle, ViewStyle } from 'react-native';

/**
 * BrainScroll design tokens (docs/visual-direction.md, docs/design-system.md).
 *
 * Two modes, one palette:
 *   - LEARNING is quiet: navy/graphite, soft white text, one violet action.
 *     No glow, no gold, no stats competing with the content.
 *   - PROGRESSION is loud: violet glow, big numerals, motion, and gold only
 *     for true mastery/prestige.
 * Only one bright accent should dominate a screen at a time.
 */
export const color = {
  bg: '#131F24', // Slate: app background, a blue-gray that lets colour pop
  bgDeep: '#0D171B', // reward screens sit a step darker so glow has headroom
  surface: '#202F36', // Deep Slate: cards, panels
  surfaceRaised: '#2B3C46',
  surfacePressed: '#33454F',
  border: '#37464F',
  borderStrong: '#4B5D66',
  brand: '#7C5CFF', // Electric Violet: primary CTA, active level, progression
  brandPressed: '#6A4BEA',
  brandSoft: 'rgba(124,92,255,0.14)',
  brandLine: 'rgba(124,92,255,0.45)',
  info: '#4DA3FF', // Bright Blue: information, secondary progress, current node
  success: '#39D98A', // Mint: correct, recall confirmed
  successSoft: 'rgba(57,217,138,0.12)',
  successLine: 'rgba(57,217,138,0.55)',
  mastery: '#FFC857', // XP Gold: mastery stars, prestige ONLY
  masterySoft: 'rgba(255,200,87,0.12)',
  danger: '#FF6B6B', // Coral: incorrect/reinforcement; always restrained
  dangerSoft: 'rgba(255,107,107,0.10)',
  dangerLine: 'rgba(255,107,107,0.45)',
  // Bow Tie Plum: Dr. Scroll's color, from his bow tie. Anything he says wears it
  // (speech bubbles, tips). Brand violet stays for actions and progression.
  plum: '#C07BE8', // text-safe on surface (5.3:1)
  plumDeep: '#9B4FCB', // fills and the splash screen; white text on it passes (4.8:1)
  plumSoft: 'rgba(192,123,232,0.10)',
  plumLine: 'rgba(192,123,232,0.40)',
  text: '#F7F9FC', // Soft White
  textReading: '#E3E8F1', // long-form paragraphs: a touch softer than headings
  textMuted: '#A7B0C0', // Cool Gray: secondary copy, locked
  textFaint: '#7D8A96',
  scrim: 'rgba(5,8,16,0.72)',
} as const;

export type ColorToken = keyof typeof color;

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Layout rules: comfortable one-hand reach and reading line length. */
export const layout = {
  gutter: 20,
  /** ~65–75 characters at reading size; content never stretches wider on tablets/web. */
  readingWidth: 620,
  /** Minimum touch target (iOS HIG 44, Material 48). */
  minTouch: 48,
  buttonHeight: 56,
  answerMinHeight: 60,
  topBarHeight: 56,
} as const;

export const iconSize = { sm: 16, md: 22, lg: 28, xl: 40 } as const;

/**
 * Type scale. Sora/Manrope direction; the system font is used until the font
 * files ship (deferred: see docs/design-system.md). Numerals use tabular figures.
 */
export const type = {
  // Progression / reward
  hero: { fontSize: 56, fontWeight: '800', letterSpacing: -1, lineHeight: 60, fontVariant: ['tabular-nums'] },
  display: { fontSize: 40, fontWeight: '800', letterSpacing: -0.5, lineHeight: 46 },
  // Structure
  h1: { fontSize: 30, fontWeight: '800', letterSpacing: -0.3, lineHeight: 36 },
  h2: { fontSize: 24, fontWeight: '700', letterSpacing: -0.2, lineHeight: 30 },
  title: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  // Reading: the lesson's hero. Generous line height for paragraphs.
  reading: { fontSize: 18, fontWeight: '400', lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 23 },
  bodyStrong: { fontSize: 16, fontWeight: '600', lineHeight: 23 },
  caption: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  button: { fontSize: 16, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  number: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

/** Elevation: subtle, for layering only (dark UIs read depth from borders more than shadows). */
export const elevation = {
  none: {},
  raised: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  overlay: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
} satisfies Record<string, ViewStyle>;

/**
 * Glow is a REWARD effect. Use it on progression moments (Level Complete, level
 * up, mastery), never on lesson screens or navigation.
 */
export const glow = {
  brand: { shadowColor: color.brand, shadowOpacity: 0.55, shadowRadius: 28, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  success: { shadowColor: color.success, shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  mastery: { shadowColor: color.mastery, shadowOpacity: 0.6, shadowRadius: 32, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
} satisfies Record<string, ViewStyle>;

/** Normal feedback 150–250 ms; reward moments may breathe longer. Respect reduce-motion. */
export const motion = { press: 90, fast: 150, normal: 220, slow: 420, celebrate: 900 } as const;
