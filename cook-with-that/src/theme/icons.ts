import type { DishType } from '../data/types';

/**
 * Every icon the app draws. iPhone shows the SF Symbol; Android and web show the Material Symbol from the bundled
 * AppIcons font (assets/fonts, built by scripts/icons/build-icon-fonts.py from this file). `filled` icons come from the
 * filled Material font.
 */
export const ICONS = {
  search: { sf: 'magnifyingglass', md: 'search' },
  settings: { sf: 'gearshape', md: 'settings' },
  heart: { sf: 'heart', md: 'favorite' },
  heartFill: { sf: 'heart.fill', md: 'favorite', filled: true },
  check: { sf: 'checkmark', md: 'check' },
  checkCircle: { sf: 'checkmark.circle.fill', md: 'check_circle', filled: true },
  circle: { sf: 'circle', md: 'radio_button_unchecked' },
  avoid: { sf: 'nosign', md: 'block' },
  chevronRight: { sf: 'chevron.right', md: 'chevron_right' },
  chevronLeft: { sf: 'chevron.left', md: 'chevron_left' },
  chevronDown: { sf: 'chevron.down', md: 'expand_more' },
  plus: { sf: 'plus', md: 'add' },
  edit: { sf: 'pencil', md: 'edit' },
  close: { sf: 'xmark', md: 'close' },
  clock: { sf: 'clock', md: 'schedule' },
  calendar: { sf: 'calendar', md: 'calendar_month' },
  cart: { sf: 'cart', md: 'shopping_cart' },
  bookmark: { sf: 'bookmark', md: 'bookmark' },
  bookmarkFill: { sf: 'bookmark.fill', md: 'bookmark', filled: true },
  pantry: { sf: 'refrigerator', md: 'kitchen' },
  pantryFill: { sf: 'refrigerator.fill', md: 'kitchen', filled: true },
  shuffle: { sf: 'shuffle', md: 'shuffle' },
  trash: { sf: 'trash', md: 'delete' },
  arrowUp: { sf: 'arrow.up', md: 'arrow_upward' },
  swap: { sf: 'arrow.left.arrow.right', md: 'swap_horiz' },
  info: { sf: 'info.circle', md: 'info' },
  undo: { sf: 'arrow.uturn.backward', md: 'undo' },
} as const;

export type IconName = keyof typeof ICONS;

/** A food picture for each dish type, drawn from the AppIcons font on every platform (SF Symbols has few foods). */
export const DISH_ICONS: Record<DishType, string> = {
  pasta: 'dinner_dining',
  soup: 'soup_kitchen',
  salad: 'eco',
  sandwich: 'lunch_dining',
  skillet: 'skillet',
  bake: 'oven',
  one_pot: 'stockpot',
  bowl: 'rice_bowl',
  grilled: 'outdoor_grill',
  fried: 'skillet_cooktop',
  dip: 'water_drop',
  appetizers: 'tapas',
  sides: 'nutrition',
  baked_goods: 'bakery_dining',
  sweets: 'cake',
};
export const DISH_ICON_FALLBACK = 'restaurant';
