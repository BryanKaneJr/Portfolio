import { SymbolView } from 'expo-symbols';
import { Platform, StyleSheet, Text, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { shownDishTypes } from '../data/labels';
import type { DishType, Meal } from '../data/types';
import { GLYPHS } from '../theme/iconGlyphs';
import { DISH_ICON_FALLBACK, DISH_ICONS, ICONS, type IconName } from '../theme/icons';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

/** An SF Symbol on iPhone; the matching Material Symbol from the bundled AppIcons font elsewhere. Decorative. */
export function Icon({
  name,
  size = 20,
  color,
  weight = 'regular',
  style,
}: {
  name: IconName;
  size?: number;
  color: ColorValue;
  weight?: Weight;
  style?: StyleProp<ViewStyle>;
}) {
  const icon = ICONS[name];
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={icon.sf}
        size={size}
        tintColor={color}
        weight={weight}
        style={[{ width: size, height: size }, style]}
        aria-hidden
      />
    );
  }
  return <Glyph glyph={icon.md} filled={'filled' in icon} size={size} color={color} style={style} />;
}

type DishInfo = { meals: Meal[]; dishTypes: DishType[] };

/** A dish-type picture (pot, bowl, skillet…) for a recipe, from its most specific dish type. */
export function dishIconFor(recipe: DishInfo): string {
  const type = shownDishTypes(recipe)[0] ?? recipe.dishTypes[0];
  return type ? DISH_ICONS[type] : DISH_ICON_FALLBACK;
}

export function DishIcon({ recipe, size = 26, color }: { recipe: DishInfo; size?: number; color: string }) {
  return <Glyph glyph={dishIconFor(recipe)} size={size} color={color} />;
}

function Glyph({
  glyph,
  filled,
  size,
  color,
  style,
}: {
  glyph: string;
  filled?: boolean;
  size: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: size, height: size }, styles.center, style]} aria-hidden>
      <Text
        style={{
          fontFamily: filled ? 'AppIconsFilled' : 'AppIcons',
          fontSize: size,
          lineHeight: size,
          color,
          includeFontPadding: false,
        }}
        allowFontScaling={false}
        selectable={false}
      >
        {GLYPHS[glyph] ?? ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
