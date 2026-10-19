import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { RECIPE_IMAGES } from '../data/recipeImages';
import type { DishType, Meal } from '../data/types';
import { useColors } from '../theme/colors';
import { radius } from '../theme/spacing';
import { DishIcon } from './Icon';

type RecipeInfo = { id: string; meals: Meal[]; dishTypes: DishType[] };

/** The bundled picture for a recipe, if it has one (edits of a bundled recipe keep its picture; own recipes have none). */
export const recipeImage = (id: string): number | undefined => RECIPE_IMAGES[id];

/** Square picture for cards and lists; the dish-type icon on a soft tile until the recipe has a picture. */
export function RecipeThumb({
  recipe,
  size,
  style,
}: {
  recipe: RecipeInfo;
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const source = recipeImage(recipe.id);
  return (
    <View
      style={[
        styles.thumb,
        { width: size, height: size, borderRadius: size * 0.22, backgroundColor: c.accentSoft },
        style,
      ]}
      aria-hidden
    >
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      ) : (
        <DishIcon recipe={recipe} size={Math.round(size * 0.48)} color={c.accent} />
      )}
    </View>
  );
}

/** Wide 4:3 picture at the top of a recipe page; nothing at all when the recipe has none. */
export function RecipeHero({ recipe, style }: { recipe: RecipeInfo; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const source = recipeImage(recipe.id);
  if (!source) return null;
  return (
    <View style={[styles.hero, { backgroundColor: c.fill }, style]} aria-hidden>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  hero: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, overflow: 'hidden' },
});
