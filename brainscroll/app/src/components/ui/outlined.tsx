import { Text, View, type TextStyle } from 'react-native';
import { fw } from '@/theme/tokens';

// Eight directions around the fill: a thick, even outline on every platform (React Native text has no stroke).
const RING = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => [x, y] as const)).filter(([x, y]) => x || y);

/**
 * A chunky outlined numeral that sits over artwork, like a badge count: white
 * (or `fill`) with a coloured edge so it reads on any image. Decorative: the
 * surrounding label says the same thing in words.
 */
export function OutlinedNumber({ value, fontSize, fill, edge, stroke = Math.max(2, Math.round(fontSize / 12)) }: { value: string; fontSize: number; fill: string; edge: string; stroke?: number }) {
  const base: TextStyle = { ...fw('900'), fontSize, lineHeight: Math.round(fontSize * 1.1), fontVariant: ['tabular-nums'], textAlign: 'center' };
  return (
    <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {RING.map(([x, y]) => (
        <Text key={`${x}${y}`} style={[base, { color: edge, position: 'absolute', left: x * stroke, top: y * stroke, right: -x * stroke }]}>
          {value}
        </Text>
      ))}
      <Text style={[base, { color: fill }]}>{value}</Text>
    </View>
  );
}
