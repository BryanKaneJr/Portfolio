import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { Numeral } from '@/components/ui';
import { useProgressView } from '@/progress/ProgressProvider';
import { lift } from '@/theme/subjectTheme';
import { color, depth, iconSize, radius, space } from '@/theme/tokens';

/**
 * The Knowledge Level on the World Map header, built like the Brainpower and
 * streak chips beside it (owner, 2026-10-03: "a level symbol and the level
 * they are", no "Knowledge Lv." title): a rank shield and the number. Tapping
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
        { flexDirection: 'row', alignItems: 'center', gap: space.xxs, paddingLeft: space.xs, paddingRight: space.md, paddingVertical: space.xxs, borderRadius: radius.pill, borderWidth: depth.border },
        { backgroundColor: color.surface, borderColor: color.brandLine },
        pressed && { opacity: 0.7 },
      ]}>
      <LevelIcon size={iconSize.xl} />
      <Numeral style={{ color: color.brandText }}>{knowledgeLevel}</Numeral>
    </Pressable>
  );
}

/** A glossy violet shield with two rank chevrons, drawn to sit with the clay brain and flame. Decorative. */
export function LevelIcon({ size }: { size: number }) {
  return (
    <View aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Defs>
          <LinearGradient id="lvl-body" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={lift(color.brand, 0.3)} />
            <Stop offset="1" stopColor={color.brand} />
          </LinearGradient>
        </Defs>
        {/* The darker edge underneath, like the buttons and emblems. */}
        <Path d="M16 4.5 L26 8.2 V15.4 C26 21.6 21.8 25.9 16 28.6 C10.2 25.9 6 21.6 6 15.4 V8.2 Z" fill={color.brandEdge} />
        <Path d="M16 3 L26 6.7 V14 C26 20.2 21.8 24.5 16 27.2 C10.2 24.5 6 20.2 6 14 V6.7 Z" fill="url(#lvl-body)" />
        <Ellipse cx="13" cy="8.6" rx="5" ry="2.2" fill="#FFFFFF" opacity={0.28} />
        <Path d="M10.5 15.6 L16 11.4 L21.5 15.6" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d="M10.5 20.6 L16 16.4 L21.5 20.6" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.75} />
      </Svg>
    </View>
  );
}
