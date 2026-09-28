import type { ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';
import { liveRegion, useAnnounce } from '@/theme/feedback';
import { color, type } from '@/theme/tokens';

type Tone = 'text' | 'muted' | 'faint' | 'brand' | 'success' | 'danger' | 'mastery' | 'info' | 'plum';
const toneColor = (t: Tone) => ({ text: color.text, muted: color.textMuted, faint: color.textFaint, brand: color.brandText, success: color.success, danger: color.danger, mastery: color.mastery, info: color.info, plum: color.plum })[t];

interface TextProps {
  children: ReactNode;
  tone?: Tone;
  center?: boolean;
  style?: TextStyle;
  numberOfLines?: number;
  /** Shrink to fit `numberOfLines` instead of truncating (for a line that must stay whole at large text sizes). */
  adjustsFontSizeToFit?: boolean;
  /** What screen readers say instead of the visible text (e.g. "Level 3 to 4" for "Lv. 3 → 4"). */
  accessibilityLabel?: string;
}

/**
 * Every style scales with the OS text size (Dynamic Type / font scale). Only
 * the two display sizes cap their growth: they are already huge, and at 3×
 * a single word would break mid-letter. Fixed-size badges cap their own text.
 */
const CAP: Partial<Record<keyof typeof type, number>> = { display: 1.5, h1: 1.8 };

function make(base: TextStyle, defaultTone: Tone = 'text', role?: 'header', cap?: number) {
  function StyledText({ children, tone = defaultTone, center, style, numberOfLines, adjustsFontSizeToFit, accessibilityLabel }: TextProps) {
    return (
      <Text
        accessibilityRole={role}
        accessibilityLabel={accessibilityLabel}
        maxFontSizeMultiplier={cap}
        numberOfLines={numberOfLines}
        adjustsFontSizeToFit={adjustsFontSizeToFit}
        style={[base, { color: toneColor(tone) }, center && { textAlign: 'center' }, style]}>
        {children}
      </Text>
    );
  }
  return StyledText;
}

/** Small uppercase context line ("ASTRONOMY · LEVEL 4"). Never the main message. */
export const Eyebrow = make(type.label, 'muted');
/** @deprecated alias kept for older call sites. */
export const Label = Eyebrow;
export const Display = make(type.display, 'text', 'header', CAP.display);
export const H1 = make(type.h1, 'text', 'header', CAP.h1);
export const H2 = make(type.h2, 'text', 'header');
export const Title = make(type.title, 'text', 'header');
/** Long-form lesson paragraphs: the content is the hero. */
export const Reading = make({ ...type.reading, color: color.textReading });
export const Caption = make(type.caption, 'muted');

export function Body({ children, muted, tone, center, style, accessibilityLabel }: TextProps & { muted?: boolean }) {
  return (
    <Text accessibilityLabel={accessibilityLabel} style={[type.body, { color: toneColor(tone ?? (muted ? 'muted' : 'text')) }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

/**
 * A status line that appears after an action, away from where focus is: an
 * error ("Couldn't send that…", `tone="danger"`, the default), a confirmation
 * (`tone="text"`) or a quiet note (`tone="muted"`). Screen readers hear it as
 * soon as it shows. Pass plain text.
 */
export function Notice({ children, tone = 'danger', center }: { children: string; tone?: 'danger' | 'text' | 'muted'; center?: boolean }) {
  useAnnounce(children);
  return (
    <Text
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      accessibilityLiveRegion={liveRegion}
      style={[type.body, { color: toneColor(tone) }, center && { textAlign: 'center' }]}>
      {children}
    </Text>
  );
}

/**
 * Big crisp numerals for levels and XP. A number that counts up passes its
 * settled value as `accessibilityLabel`, so a screen reader never reads a
 * number mid-count.
 */
export function Numeral({ children, tone = 'text', size = 'number', style, accessibilityLabel }: TextProps & { size?: 'number' | 'hero' | 'display' }) {
  // Hero numbers ("+35 XP") are already huge: let Dynamic Type grow them a little, not 3×.
  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      maxFontSizeMultiplier={size === 'number' ? undefined : 1.4}
      style={[type[size], { color: toneColor(tone), fontVariant: ['tabular-nums'] }, style]}>
      {children}
    </Text>
  );
}
/** @deprecated use Numeral. */
export const BigNumber = Numeral;
