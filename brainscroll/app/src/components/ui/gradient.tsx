import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * A soft two-stop gradient filling its parent (owner, 2026-10-01: gradients
 * for a more premium feel). Drawn with react-native-svg, so it needs no new
 * native build. It sits behind the parent's content (render it first) and
 * ignores touches. `rx` rounds it to the parent's corners.
 *
 * The house style is light from above: a lighter tint at the top fading to
 * the colour itself (`lift` in theme/subjectTheme.ts), like a lit surface.
 *
 * It measures the space it fills and draws to that exact size: a percentage-
 * sized Svg on iOS can keep the width it had before the parent finished
 * laying out, which left the gradient short of the right edge on big phones.
 */
export function GradientFill({ from, to, horizontal, rx = 0 }: { from: string; to: string; horizontal?: boolean; rx?: number }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
      }}>
      {size && (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2={horizontal ? '1' : '0'} y2={horizontal ? '0' : '1'}>
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} rx={rx} ry={rx} fill={`url(#${id})`} />
        </Svg>
      )}
    </View>
  );
}
