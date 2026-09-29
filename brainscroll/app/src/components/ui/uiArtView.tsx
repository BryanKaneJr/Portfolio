import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { UI_ART, type UiArtName } from './uiArt';

/** One of the owner's UI illustrations. Decorative: hidden from screen readers (the words beside it carry the meaning). */
export function UiArt({ name, size, style }: { name: UiArtName; size: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={UI_ART[name]}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessible={false}
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      accessibilityIgnoresInvertColors
    />
  );
}
