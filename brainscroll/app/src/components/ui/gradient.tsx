import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * A soft two-stop gradient filling its parent (owner, 2026-10-01: gradients
 * for a more premium feel). Drawn with react-native-svg, so it needs no new
 * native build. It sits behind the parent's content (render it first) and
 * ignores touches. `rx` rounds it to the parent's corners.
 *
 * The house style is light from above: a lighter tint at the top fading to
 * the colour itself (`lift` in theme/subjectTheme.ts), like a lit surface.
 */
export function GradientFill({ from, to, horizontal, rx = 0 }: { from: string; to: string; horizontal?: boolean; rx?: number }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" accessible={false} importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={horizontal ? '1' : '0'} y2={horizontal ? '0' : '1'}>
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" rx={rx} ry={rx} fill={`url(#${id})`} />
    </Svg>
  );
}
