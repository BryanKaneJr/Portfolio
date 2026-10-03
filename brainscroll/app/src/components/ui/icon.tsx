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
  forward: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  flag: { ios: 'flag', android: 'flag', web: 'flag' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'ios_share' },
  addFriend: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
  people: { ios: 'person.2.fill', android: 'group', web: 'group' },
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  edit: { ios: 'pencil', android: 'edit', web: 'edit' },
  xp: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  knowledge: { ios: 'brain.head.profile', android: 'psychology', web: 'psychology' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  skills: { ios: 'square.stack.3d.up.fill', android: 'layers', web: 'layers' },
  today: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  flame: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  book: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
  map: { ios: 'map.fill', android: 'map', web: 'map' },
  shield: { ios: 'shield.fill', android: 'shield', web: 'shield' },
  phone: { ios: 'phone.fill', android: 'call', web: 'call' },
  mail: { ios: 'envelope.fill', android: 'mail', web: 'mail' },
  // Subjects
  geography: { ios: 'globe.americas.fill', android: 'public', web: 'public' },
  arts: { ios: 'paintpalette.fill', android: 'palette', web: 'palette' },
  world: { ios: 'gearshape.2.fill', android: 'settings', web: 'settings' },
  mind: { ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' },
  history: { ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' },
  science: { ios: 'atom', android: 'science', web: 'science' },
  // Skill-map waypoints, one silhouette per subject (owner, 2026-10-03). Arts' paint splatter is drawn (LevelPath).
  beaker: { ios: 'flask.fill', android: 'science', web: 'science' },
  mountain: { ios: 'mountain.2.fill', android: 'landscape', web: 'landscape' },
  gears: { ios: 'gearshape.2.fill', android: 'settings', web: 'settings' },
  brain: { ios: 'brain.fill', android: 'neurology', web: 'neurology' },
  /** An order question's drag handle. */
  grip: { ios: 'line.3.horizontal', android: 'drag_handle', web: 'drag_handle' },
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
