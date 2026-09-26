import type { ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';
import { color, type } from '@/theme/tokens';

type Tone = 'text' | 'muted' | 'faint' | 'brand' | 'success' | 'danger' | 'mastery' | 'info' | 'plum';
const toneColor = (t: Tone) => ({ text: color.text, muted: color.textMuted, faint: color.textFaint, brand: color.brandText, success: color.success, danger: color.danger, mastery: color.mastery, info: color.info, plum: color.plum })[t];

interface TextProps {
  children: ReactNode;
  tone?: Tone;
  center?: boolean;
  style?: TextStyle;
  numberOfLines?: number;
}
function make(base: TextStyle, defaultTone: Tone = 'text', role?: 'header') {
  function StyledText({ children, tone = defaultTone, center, style, numberOfLines }: TextProps) {
    return (
      <Text accessibilityRole={role} numberOfLines={numberOfLines} style={[base, { color: toneColor(tone) }, center && { textAlign: 'center' }, style]}>
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
export const Display = make(type.display, 'text', 'header');
export const H1 = make(type.h1, 'text', 'header');
export const H2 = make(type.h2, 'text', 'header');
export const Title = make(type.title, 'text', 'header');
/** Long-form lesson paragraphs: the content is the hero. */
export const Reading = make({ ...type.reading, color: color.textReading });
export const Caption = make(type.caption, 'muted');

export function Body({ children, muted, tone, center, style }: TextProps & { muted?: boolean }) {
  return <Text style={[type.body, { color: toneColor(tone ?? (muted ? 'muted' : 'text')) }, center && { textAlign: 'center' }, style]}>{children}</Text>;
}

/** Big crisp numerals for levels and XP. */
export function Numeral({ children, tone = 'text', size = 'number', style }: TextProps & { size?: 'number' | 'hero' | 'display' }) {
  return <Text style={[type[size], { color: toneColor(tone), fontVariant: ['tabular-nums'] }, style]}>{children}</Text>;
}
/** @deprecated use Numeral. */
export const BigNumber = Numeral;
