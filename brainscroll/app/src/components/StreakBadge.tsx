import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Numeral, UiArt } from '@/components/ui';
import { useProgressView } from '@/progress/ProgressProvider';
import { color, depth, iconSize, radius, space } from '@/theme/tokens';

/**
 * The learning streak on the World Map header: a flame and the day count.
 * Tapping it opens the streak screen (and its Share).
 * The owner's flame once today counts, the ember while it's still yesterday's run. No warning,
 * no countdown, nothing when there's no streak (docs/specs/SOCIAL_REWARDS.md).
 */
export function StreakBadge() {
  const { streak } = useProgressView();
  if (streak.current === 0) return null;
  const tint = streak.today ? color.streak : color.textFaint;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${streak.current}-day learning streak${streak.today ? '' : ', today not counted yet'}. Open`}
      onPress={() => router.push('/streak')}
      hitSlop={space.sm}
      // A chunky chip in the streak's own colour, like a stat counter (lit only once today counts).
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: space.xxs, paddingLeft: space.xs, paddingRight: space.md, paddingVertical: space.xxs, borderRadius: radius.pill, borderWidth: depth.border },
        streak.today ? { backgroundColor: color.streakSoft, borderColor: color.streak } : { backgroundColor: color.surface, borderColor: color.border },
        pressed && { opacity: 0.7 },
      ]}>
      {/* The lit flame once today counts; the ember while it's still yesterday's run. */}
      <UiArt name={streak.today ? 'streak-flame' : 'streak-ember'} size={iconSize.xl} />
      <Numeral style={{ color: tint }}>{streak.current}</Numeral>
    </Pressable>
  );
}
