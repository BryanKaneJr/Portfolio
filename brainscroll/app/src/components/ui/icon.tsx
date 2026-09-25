import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View, type ColorValue } from 'react-native';

/**
 * Named icons: SF Symbols on iOS, Material Symbols on Android and web. Use an
 * icon beside a number or status (XP, stars, today) so the eye finds it before
 * reading. Never draw an icon with a text character.
 */
const ICONS = {
  close: { ios: 'xmark', android: 'close', web: 'close' },
  flag: { ios: 'flag', android: 'flag', web: 'flag' },
  xp: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  knowledge: { ios: 'brain.head.profile', android: 'psychology', web: 'psychology' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  skills: { ios: 'square.stack.3d.up.fill', android: 'layers', web: 'layers' },
  today: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' },
} as const satisfies Record<string, SymbolViewProps['name']>;
export type IconName = keyof typeof ICONS;

/** Decorative: the text beside it carries the meaning, so screen readers skip it. */
export function Icon({ name, tint, size = 20 }: { name: IconName; tint: ColorValue; size?: number }) {
  return (
    <View aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
      <SymbolView name={ICONS[name]} tintColor={tint} size={size} />
    </View>
  );
}
