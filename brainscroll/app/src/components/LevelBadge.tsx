import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { STAT_CHIP_ICON, statChip, statChipNumber } from '@/components/statChip';
import { Numeral } from '@/components/ui';
import { useProgressView } from '@/progress/ProgressProvider';
import { lift } from '@/theme/subjectTheme';
import { color, space } from '@/theme/tokens';

/**
 * The Knowledge Level on the World Map header, built like the Brainpower and
 * streak chips beside it (owner, 2026-10-03: "a level symbol and the level
 * they are", no "Knowledge Lv." title): a graduation cap and the number. Tapping
 * it opens Profile, where the level lives.
 */
export function LevelBadge() {
  const { knowledgeLevel } = useProgressView();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Knowledge level ${knowledgeLevel}. Open profile`}
      onPress={() => router.navigate('/profile')}
      hitSlop={space.sm}
      style={({ pressed }) => [
        statChip,
        { backgroundColor: color.surface, borderColor: color.brandLine },
        pressed && { opacity: 0.7 },
      ]}>
      <LevelIcon size={STAT_CHIP_ICON} />
      <Numeral style={{ ...statChipNumber, color: color.brandText }}>{knowledgeLevel}</Numeral>
    </Pressable>
  );
}

/** A glossy violet graduation cap (owner's pick, 2026-10-03), drawn to sit with the clay brain and flame. Decorative. */
export function LevelIcon({ size }: { size: number }) {
  return (
    <View aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="lvl-cap" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lift(color.brand, 0.3)} />
            <Stop offset="1" stopColor={color.brand} />
          </LinearGradient>
        </Defs>
        {/* The cap's band, in the darker edge colour like the buttons and emblems. */}
        <Path d="M9 15.5 V20.7 C9 22.6 12.1 24.5 16 24.5 C19.9 24.5 23 22.6 23 20.7 V15.5 L16 18.7 Z" fill={color.brandEdge} />
        <Path d="M16 6.5 L2.5 12.6 L16 18.8 L29.5 12.6 Z" fill="url(#lvl-cap)" />
        <Path d="M16 6.5 L2.5 12.6 L16 14.2 L29.5 12.6 Z" fill="#FFFFFF" opacity={0.22} />
        {/* The tassel. */}
        <Path d="M27 13.6 V20.8" stroke={color.brandText} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx="27" cy="22" r="2.1" fill={color.brandText} />
      </Svg>
    </View>
  );
}
