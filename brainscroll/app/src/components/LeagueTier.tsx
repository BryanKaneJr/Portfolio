import { LEAGUE_TIERS, tierName } from '@brainscroll/core';
import { useId } from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Stop, Text as SvgText } from 'react-native-svg';
import { space, type } from '@/theme/tokens';

/**
 * League tiers (owner, 2026-10-08; core LEAGUE_TIERS), each with its own
 * colour, climbing from slate to pearl. None is gold (gold means mastery) or
 * plum (Dr. Scroll's speech), even Dr. Scroll's Circle.
 */
const TIER_STOPS: [string, string][] = [
  ['#B9C4CE', '#5F6E7B'], // Scribblers: pencil slate
  ['#7EDC9C', '#2E8F57'], // Bookworms: leaf green
  ['#6FE0E0', '#1F8A99'], // Apprentices: teal
  ['#7CC4FF', '#2465C9'], // Scholars: sapphire
  ['#A99BFF', '#4B36C9'], // Sages: violet
  ['#E0A6FF', '#7A2DB8'], // Professors: amethyst
  ['#FFB27A', '#D9531E'], // Luminaries: lamplight orange
  ['#FFFFFF', '#FF8FC8'], // Dr. Scroll's Circle: pearl, blushing pink
];
/** A tier's text colour on the app's dark surfaces. */
export const tierInk = (tier: number) => TIER_STOPS[clamp(tier) - 1]![0];
const clamp = (tier: number) => Math.min(LEAGUE_TIERS.length, Math.max(1, Math.round(tier)));
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** A tier's emblem: a hexagon in its colours with its numeral (I to VIII). */
export function TierEmblem({ tier, size = 28 }: { tier: number; size?: number }) {
  const id = `tier${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const t = clamp(tier);
  const [top, bottom] = TIER_STOPS[t - 1]!;
  const w = size * 0.92;
  const pts = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = (Math.PI / 3) * k - Math.PI / 2;
    return `${(size / 2 + Math.cos(a) * (w / 2)).toFixed(1)},${(size / 2 + Math.sin(a) * (size / 2 - 0.5)).toFixed(1)}`;
  });
  return (
    <Svg width={size} height={size} accessible={false}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Polygon points={pts.join(' ')} fill={`url(#${id})`} stroke="rgba(255,255,255,0.55)" strokeWidth={1} />
      <SvgText x={size / 2} y={size / 2 + size * 0.13} fontSize={size * (t > 6 ? 0.3 : 0.36)} fontWeight="800" fill={t === 8 ? '#7A2D5B' : '#FFFFFF'} textAnchor="middle">
        {ROMAN[t - 1]}
      </SvgText>
    </Svg>
  );
}

/** The emblem and the tier's name ("Scholars"), as it sits on a profile. */
export function TierBadge({ tier, size = 22 }: { tier: number; size?: number }) {
  return (
    <View accessible accessibilityLabel={`League: ${tierName(tier)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <TierEmblem tier={tier} size={size} />
      <Text style={[type.meta, { color: tierInk(tier) }]}>{tierName(tier)}</Text>
    </View>
  );
}
