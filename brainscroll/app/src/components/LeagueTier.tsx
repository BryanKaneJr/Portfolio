import { LEAGUE_TIERS, tierName } from '@brainscroll/core';
import { useId } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';
import { space, type } from '@/theme/tokens';

/**
 * League tiers (owner, 2026-10-08; core LEAGUE_TIERS): seven gems, then the
 * Crown. Each is drawn in code as one simple shape in its own colours. None
 * is gold (gold means mastery), so the Crown is royal violet set with pearls.
 */
const TIER_STOPS: [string, string][] = [
  ['#F7E4EC', '#B98FA0'], // Quartz: rose quartz
  ['#DDBDFF', '#7A3FC8'], // Amethyst
  ['#B8F4EF', '#2BA3AE'], // Aquamarine
  ['#9CCBFF', '#1F4FB8'], // Sapphire
  ['#93F2B6', '#13874A'], // Emerald
  ['#FF9EAE', '#B3133A'], // Ruby
  ['#FFFFFF', '#9CD3F0'], // Diamond
  ['#CDBEFF', '#5A35D6'], // Crown: royal violet
];
const clamp = (tier: number) => Math.min(LEAGUE_TIERS.length, Math.max(1, Math.round(tier)));
/** A tier's text colour on the app's dark surfaces. */
export const tierInk = (tier: number) => TIER_STOPS[clamp(tier) - 1]![0];

/** A tier's emblem: its gem, cut, with a glint; or, at the top, the Crown. */
export function TierEmblem({ tier, size = 28 }: { tier: number; size?: number }) {
  const id = `tier${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const t = clamp(tier);
  const [top, bottom] = TIER_STOPS[t - 1]!;
  // Drawn on a 24-unit grid.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      {t === LEAGUE_TIERS.length ? (
        <>
          {/* Three points and a band, set with pearls. */}
          <Path d="M3 9 L7.5 13 L12 5 L16.5 13 L21 9 L19 19 H5 Z" fill={`url(#${id})`} stroke="rgba(255,255,255,0.7)" strokeWidth={0.8} strokeLinejoin="round" />
          <Path d="M5.6 16 H18.4" stroke="rgba(255,255,255,0.55)" strokeWidth={0.8} />
          {[[3, 9], [12, 5], [21, 9]].map(([x, y]) => <Circle key={x} cx={x} cy={y} r={1.6} fill="#FFF6FB" />)}
          <Circle cx={12} cy={17.6} r={1.1} fill="#FFF6FB" />
        </>
      ) : (
        <>
          {/* A brilliant cut: table, crown facets down to the girdle, then the pavilion to a point. */}
          <Polygon points="7,4 17,4 21.5,9 12,21 2.5,9" fill={`url(#${id})`} stroke="rgba(255,255,255,0.7)" strokeWidth={0.8} strokeLinejoin="round" />
          <Path d="M2.5 9 H21.5 M7 4 L9.5 9 L12 21 L14.5 9 L17 4 M9.5 9 L12 4 L14.5 9" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={0.6} strokeLinejoin="round" />
          <Polygon points="7,4 12,4 9.5,9 2.5,9" fill="rgba(255,255,255,0.35)" />
        </>
      )}
    </Svg>
  );
}

/** The emblem and the league's name ("Sapphire League"), as it sits on a profile. */
export function TierBadge({ tier, size = 22 }: { tier: number; size?: number }) {
  return (
    <View accessible accessibilityLabel={tierName(tier)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
      <TierEmblem tier={tier} size={size} />
      <Text style={[type.meta, { color: tierInk(tier) }]}>{tierName(tier)}</Text>
    </View>
  );
}
