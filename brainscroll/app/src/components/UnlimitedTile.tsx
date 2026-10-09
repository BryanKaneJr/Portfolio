import { router } from 'expo-router';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { MAP_TILE_ART, MapTile } from '@/components/MapTile';
import { useProgress } from '@/progress/ProgressProvider';

/**
 * Unlimited as a tile beside the map road, opposite the week's quest (owner,
 * 2026-10-09): Unlimited's gold brain over "Unlimited", for free learners only.
 * A tap is the learner asking, so the paywall may open; nothing pops it up, and
 * it never appears in a lesson.
 */
export function UnlimitedTile() {
  const { entitlement, account } = useProgress();
  if (account?.status !== 'signed_in' || entitlement.active) return null;
  return (
    <MapTile
      art={<BrainpowerIcon size={MAP_TILE_ART} state="unlimited" />}
      band="Unlimited"
      label="Unlimited: ∞ Brainpower for new levels. Opens Unlimited."
      onPress={() => router.push({ pathname: '/unlimited', params: { from: 'map' } })}
    />
  );
}
