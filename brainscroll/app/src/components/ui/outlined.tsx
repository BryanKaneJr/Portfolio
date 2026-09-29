import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { color, fw } from '@/theme/tokens';

export type OutlineTone = 'brand' | 'gold' | 'streak' | 'locked';

/** Each outline runs light at the top to deep at the bottom, like the trophy art's own lighting. */
const OUTLINE: Record<OutlineTone, [string, string]> = {
  brand: [color.brandText, color.brandEdge],
  gold: [color.mastery, color.masteryEdge],
  streak: [color.mastery, color.streakEdge],
  locked: [color.borderStrong, color.bg],
};

/**
 * A chunky badge numeral over artwork ("100" on the perfect-lesson trophy):
 * a white face with a true vector outline in a top-to-bottom gradient, drawn
 * as SVG so the edge is smooth and even at any size. Decorative: the label
 * beside it says the same thing in words.
 */
export function OutlinedNumber({ value, fontSize, tone }: { value: string; fontSize: number; tone: OutlineTone }) {
  const id = `outline-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stroke = Math.max(2, Math.round(fontSize * 0.09));
  const width = Math.ceil(value.length * fontSize * 0.64 + stroke * 2);
  const height = Math.ceil(fontSize * 1.08 + stroke * 2);
  const [top, bottom] = OUTLINE[tone];
  const text = { x: width / 2, y: stroke + fontSize * 0.86, fontSize, fontFamily: fw('900').fontFamily, textAnchor: 'middle' as const };
  return (
    <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        {/* The outline: the same numeral stroked wide with round joins, behind the face. */}
        <SvgText {...text} fill={`url(#${id})`} stroke={`url(#${id})`} strokeWidth={stroke * 2} strokeLinejoin="round" strokeLinecap="round">
          {value}
        </SvgText>
        <SvgText {...text} fill={tone === 'locked' ? color.textMuted : color.onBrand}>
          {value}
        </SvgText>
      </Svg>
    </View>
  );
}
