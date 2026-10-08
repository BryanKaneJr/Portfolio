import { LEAGUE_TIERS, tierName } from '@brainscroll/core';
import { Text, View } from 'react-native';
import { UiArt, type UiArtName } from '@/components/ui';
import { space, type } from '@/theme/tokens';

/**
 * League tiers (owner, 2026-10-08; core LEAGUE_TIERS): seven gems, the
 * owner's art (docs/images-league-tiers.md), then the Crown: the silver,
 * gem-set crown we already had (`medieval.crown`; owner: "we just use the
 * crown image we already have"). None is gold (gold means mastery). Each
 * tier's name is written in its gem's colour.
 */
const TIERS: { art: UiArtName; ink: string }[] = [
  { art: 'league-quartz', ink: '#F7E4EC' },
  { art: 'league-amethyst', ink: '#DDBDFF' },
  { art: 'league-aquamarine', ink: '#B8F4EF' },
  { art: 'league-sapphire', ink: '#9CCBFF' },
  { art: 'league-emerald', ink: '#93F2B6' },
  { art: 'league-ruby', ink: '#FF9EAE' },
  { art: 'league-diamond', ink: '#FFFFFF' },
  { art: 'league-crown', ink: '#E4EAF0' },
];
const tierOf = (tier: number) => TIERS[Math.min(LEAGUE_TIERS.length, Math.max(1, Math.round(tier))) - 1]!;
/** A tier's text colour on the app's dark surfaces. */
export const tierInk = (tier: number) => tierOf(tier).ink;

/** A tier's emblem: its gem, or at the top, the Crown. */
export function TierEmblem({ tier, size = 28 }: { tier: number; size?: number }) {
  return <UiArt name={tierOf(tier).art} size={size} />;
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
