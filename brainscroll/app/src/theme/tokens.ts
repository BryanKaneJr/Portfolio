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
  // Electric Violet: primary CTA, active level, progression. Tuned from #7C5CFF
  // so white button labels pass WCAG AA (4.6:1) while the violet still stands
  // 3:1 off bg (3.7:1) and surface (3.0:1) as a border or fill.
  brand: '#7856FF',
  brandPressed: '#6A4BEA',
  brandEdge: '#5031C2', // the darker bottom edge that makes violet surfaces feel pressable
  // Brand violet as TEXT on dark surfaces: `brand` is only 3.7:1 on bg, below
  // WCAG AA for normal text. This tint passes on bg (7.3:1), surface (6.0:1)
  // and surfaceRaised (4.9:1). Fills, borders and buttons keep `brand`.
  brandText: '#AE9DFF',
  brandSoft: 'rgba(120,86,255,0.14)',
  brandLine: 'rgba(120,86,255,0.45)',
  info: '#4DA3FF', // Bright Blue: information, secondary progress, current node
  success: '#39D98A', // Mint: correct, recall confirmed
  successSoft: 'rgba(57,217,138,0.12)',
  successEdge: '#1F9C5E',
  successLine: 'rgba(57,217,138,0.55)',
  mastery: '#FFC857', // XP Gold: mastery stars, prestige ONLY
  masterySoft: 'rgba(255,200,87,0.12)',
  masteryEdge: '#C28A1E',
  masteryShine: 'rgba(255,240,200,0.4)', // the light sweeping across a gold trophy as it arrives
  danger: '#FF6B6B', // Coral: incorrect/reinforcement; always restrained
  streak: '#FF9F43', // Flame orange: the learning streak only, never gold (mastery) or coral (a miss)
  streakEdge: '#C2661A', // the outline on a streak trophy's count
  streakSoft: 'rgba(255,159,67,0.14)', // the streak chip's wash in the header
  profileHeader: '#2E2466', // the deep violet behind Profile's ring, fading into bg
  dangerSoft: 'rgba(255,107,107,0.10)',
  dangerLine: 'rgba(255,107,107,0.45)',
  // Bow Tie Plum: Dr. Scroll's color, from his bow tie. Anything he says wears it
  // (speech bubbles, tips). Brand violet stays for actions and progression.
  plum: '#C07BE8', // text-safe on surface (4.8:1); never on a plum tint (4.1:1)
  plumDeep: '#9B4FCB', // fills and the splash screen; white text on it passes (4.8:1)
  plumSoft: 'rgba(192,123,232,0.10)',
  plumLine: 'rgba(192,123,232,0.40)',
  text: '#F7F9FC', // Soft White
  textReading: '#E3E8F1', // long-form paragraphs: a touch softer than headings
  textMuted: '#A7B0C0', // Cool Gray: secondary copy, locked
  // Faint: 4.8:1 on bg, but only 3.9:1 on surface and 3.2:1 on surfaceRaised,
  // so on a card use it for decoration and disabled marks, never for words.
  textFaint: '#7D8A96',
  scrim: 'rgba(5,8,16,0.72)',
  // Ink on solid fills: white on violet (4.6:1), near-black on mint (9.9:1) and gold (12:1).
  onBrand: '#FFFFFF',
  onSuccess: '#0D171B',
  onMastery: '#1A1305',
  // Opaque tints for the lesson footer's verdict (a soft tint over bg would let content show through).
  successTint: '#12251F',
  dangerTint: '#241A22',
  // Decorative washes: the lesson bar's sheen and the reward halo behind a numeral.
  sheen: 'rgba(255,255,255,0.22)',
  brandHalo: 'rgba(120,86,255,0.09)',
  masteryHalo: 'rgba(255,200,87,0.07)',
} as const;

/**
 * One colour per subject, for the character sheet's ring and attribute bars
 * (like an RPG's stat colours). Never violet (actions) or gold (mastery).
 */
export const subjectColor: Record<string, string> = {
  'subject.history': '#E8745A', // terracotta: kept well clear of mastery gold
  'subject.science': '#4DA3FF',
  'subject.geography': '#2DD4BF',
  'subject.arts': '#F472B6',
  'subject.world_systems': '#C4B5FD',
  'subject.mind': '#9BE15D',
};

export type ColorToken = keyof typeof color;

/**
 * Depth: tappable and important surfaces stand on a thick bottom edge in a
 * darker shade (4 px), which collapses when pressed. This is what makes the UI
 * feel physical rather than flat. Borders are 2 px, never hairlines. `line`
 * (1 px) is only for separators and quiet inner frames (footer rules, inputs
 * at rest, evidence and comparison boxes), never a tappable surface.
 */
export const depth = { edge: 4, border: 2, line: 1 } as const;

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
  /** Compact buttons (in-sheet choices): iOS's 44 pt minimum. */
  buttonHeightCompact: 44,
  /** A square icon plate beside a row's text (subject rows, "Coming soon"). */
  iconPlate: 40,
} as const;

/** Icon sizes: xs for tiny badges, sm beside captions, md beside body text, lg for controls and headers, xl for placeholders. */
export const iconSize = { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 } as const;

/**
 * Nunito everywhere: rounded and friendly like Dr. Scroll, and very legible at
 * reading sizes. Custom fonts pick their weight by family, not fontWeight, so
 * every style takes its weight from `fw()`. Loaded in app/_layout.tsx.
 */
export const fontFamily = {
  '400': 'Nunito_400Regular',
  '600': 'Nunito_600SemiBold',
  '700': 'Nunito_700Bold',
  '800': 'Nunito_800ExtraBold',
  '900': 'Nunito_900Black',
} as const;
export const fw = (weight: keyof typeof fontFamily): TextStyle => ({ fontFamily: fontFamily[weight] });

/**
 * Type scale, in Nunito. Numerals use tabular figures. Refined 2026-10-02 (owner
 * picked "B" over the original and Plus Jakarta Sans): smaller, tighter
 * headlines and numbers, quieter labels, and sentence-case buttons, so the app
 * reads premium rather than loud. Lesson text (reading, lead, choice) stays a
 * size up, for comfortable reading.
 */
export const type = {
  // Progression / reward
  hero: { fontSize: 44, ...fw('800'), letterSpacing: -1.2, lineHeight: 48, fontVariant: ['tabular-nums'] },
  display: { fontSize: 30, ...fw('800'), letterSpacing: -0.6, lineHeight: 35 },
  // Structure
  h1: { fontSize: 26, ...fw('800'), letterSpacing: -0.4, lineHeight: 31 },
  h2: { fontSize: 21, ...fw('700'), letterSpacing: -0.3, lineHeight: 27 },
  title: { fontSize: 18, ...fw('700'), letterSpacing: -0.2, lineHeight: 24 },
  // Reading: the lesson's hero. Generous line height for paragraphs.
  reading: { fontSize: 19, ...fw('400'), lineHeight: 29 },
  body: { fontSize: 15, ...fw('400'), lineHeight: 22 },
  bodyStrong: { fontSize: 15, ...fw('600'), lineHeight: 22 },
  caption: { fontSize: 13, ...fw('400'), lineHeight: 18 },
  // Tiny metadata: levels on map tiles, letters in answer badges.
  meta: { fontSize: 12, ...fw('700'), lineHeight: 16 },
  // Tappable choices (answer options, onboarding skills): a touch larger than body.
  choice: { fontSize: 17, ...fw('600'), lineHeight: 24 },
  // A highlighted line in a lesson: the key idea, a comparison's label.
  lead: { fontSize: 19, ...fw('700'), lineHeight: 26 },
  label: { fontSize: 11, ...fw('700'), letterSpacing: 1.4, textTransform: 'uppercase' },
  button: { fontSize: 16, ...fw('700'), letterSpacing: 0, textTransform: 'none' },
  number: { fontSize: 24, ...fw('800'), letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  // A stat tile's value: three tiles share a phone-width row.
  numberSm: { fontSize: 19, ...fw('800'), letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
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
// A hair slower than first set (owner, 2026-10-03); `press` stays quick so taps feel instant.
export const motion = { press: 90, fast: 180, normal: 280, slow: 520, celebrate: 1100 } as const;
