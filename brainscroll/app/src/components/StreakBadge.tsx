import { Image, View } from 'react-native';
import { Numeral } from '@/components/ui';
import { STREAK_EMBER, STREAK_FLAME } from '@/components/ui/streakArt';
import { useProgressView } from '@/progress/ProgressProvider';
import { color, iconSize, space } from '@/theme/tokens';

/**
 * The learning streak on the World Map header: a flame and the day count.
 * The owner's flame once today counts, the ember while it's still yesterday's run. No warning,
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
      {/* The lit flame once today counts; the ember while it's still yesterday's run. */}
      <Image source={streak.today ? STREAK_FLAME : STREAK_EMBER} style={{ width: iconSize.xl, height: iconSize.xl }} resizeMode="contain" accessibilityIgnoresInvertColors />
      <Numeral style={{ color: tint }}>{streak.current}</Numeral>
    </View>
  );
}
