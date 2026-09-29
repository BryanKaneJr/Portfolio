import { Image, View } from 'react-native';
import { Icon, Numeral } from '@/components/ui';
import { STREAK_FLAME } from '@/components/ui/streakArt';
import { useProgressView } from '@/progress/ProgressProvider';
import { color, iconSize, space } from '@/theme/tokens';

/**
 * The learning streak on the World Map header: a flame and the day count.
 * Lit once today counts, dim while it's still yesterday's run. No warning,
 * no countdown, nothing when there's no streak (docs/specs/SOCIAL_REWARDS.md).
 */
export function StreakBadge() {
  const { streak } = useProgressView();
  if (streak.current === 0) return null;
  const tint = streak.today ? color.streak : color.textFaint;
  return (
    <View
      accessible
      accessibilityLabel={`${streak.current}-day learning streak${streak.today ? '' : ', today not counted yet'}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
      {STREAK_FLAME ? (
        // The owner's flame; dimmed (not recoloured) while today isn't counted yet.
        <Image source={STREAK_FLAME} style={{ width: iconSize.xl, height: iconSize.xl, opacity: streak.today ? 1 : 0.4 }} resizeMode="contain" accessibilityIgnoresInvertColors />
      ) : (
        <Icon name="flame" tint={tint} size={iconSize.lg} />
      )}
      <Numeral style={{ color: tint }}>{streak.current}</Numeral>
    </View>
  );
}
