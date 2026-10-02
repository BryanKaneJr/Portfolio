import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { Numeral } from '@/components/ui';
import { useProgressView } from '@/progress/ProgressProvider';
import { color, depth, iconSize, radius, space } from '@/theme/tokens';

/**
 * Brainpower on the World Map header, beside the streak flame and built the
 * same way: the brain and the count (∞ on Unlimited). Tapping it opens the
 * Brainpower screen. Lit while there's some to spend; quiet at 0.
 */
export function BrainpowerBadge() {
  const { today } = useProgressView();
  const unlimited = today.unlimited || today.brainpower === null;
  const n = today.brainpower ?? 0;
  const lit = unlimited || n > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unlimited ? 'Unlimited Brainpower. Open' : `${n} of ${today.brainpowerMax} Brainpower. Open`}
      onPress={() => router.push('/brainpower')}
      hitSlop={space.sm}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: space.xxs, paddingLeft: space.xs, paddingRight: space.md, paddingVertical: space.xxs, borderRadius: radius.pill, borderWidth: depth.border },
        lit ? { backgroundColor: color.brandSoft, borderColor: color.brandLine } : { backgroundColor: color.surface, borderColor: color.border },
        pressed && { opacity: 0.7 },
      ]}>
      <BrainpowerIcon size={iconSize.xl} />
      <Numeral style={{ color: lit ? color.brandText : color.textFaint }}>{unlimited ? '∞' : n}</Numeral>
    </Pressable>
  );
}
