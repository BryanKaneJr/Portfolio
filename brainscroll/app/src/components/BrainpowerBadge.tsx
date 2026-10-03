import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { BrainpowerIcon } from '@/components/BrainpowerIcon';
import { STAT_CHIP_ICON, statChip, statChipNumber } from '@/components/statChip';
import { Numeral } from '@/components/ui';
import { useProgressView } from '@/progress/ProgressProvider';
import { color, space } from '@/theme/tokens';

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
        statChip,
        unlimited
          ? { backgroundColor: color.surface, borderColor: color.mastery }
          : lit
            ? { backgroundColor: color.brandSoft, borderColor: color.brandLine }
            : { backgroundColor: color.surface, borderColor: color.border },
        pressed && { opacity: 0.7 },
      ]}>
      <BrainpowerIcon size={STAT_CHIP_ICON} state={unlimited ? 'unlimited' : n > 0 ? 'lit' : 'empty'} />
      <Numeral style={{ ...statChipNumber, color: unlimited ? color.mastery : lit ? color.brandText : color.textFaint }}>{unlimited ? '∞' : n}</Numeral>
    </Pressable>
  );
}
