import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View, type ColorValue } from 'react-native';

/**
 * Named icons: SF Symbols on iOS, Material Symbols on Android and web. Use an
 * icon beside a number or status (XP, stars, today) so the eye finds it before
 * reading. Never draw an icon with a text character.
 */
const ICONS = {
  close: { ios: 'xmark', android: 'close', web: 'close' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  flag: { ios: 'flag', android: 'flag', web: 'flag' },
  xp: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  knowledge: { ios: 'brain.head.profile', android: 'psychology', web: 'psychology' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  skills: { ios: 'square.stack.3d.up.fill', android: 'layers', web: 'layers' },
  today: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  book: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
  map: { ios: 'map.fill', android: 'map', web: 'map' },
  shield: { ios: 'shield.fill', android: 'shield', web: 'shield' },
  // Subjects
  geography: { ios: 'globe.americas.fill', android: 'public', web: 'public' },
  money: { ios: 'dollarsign.circle.fill', android: 'payments', web: 'payments' },
  arts: { ios: 'paintpalette.fill', android: 'palette', web: 'palette' },
  world: { ios: 'gearshape.2.fill', android: 'settings', web: 'settings' },
  history: { ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' },
  science: { ios: 'atom', android: 'science', web: 'science' },
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
