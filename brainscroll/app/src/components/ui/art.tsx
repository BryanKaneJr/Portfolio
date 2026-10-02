import { Image, View, type ViewStyle } from 'react-native';
import { ART } from '@/content/art';
import { radius } from '@/theme/tokens';

/**
 * A level's illustration (docs/image-manifest.md), when its file exists in
 * app/assets/images/art/. Decorative, so screen readers skip it; renders
 * nothing until the image has been made.
 */
export function LevelArt({ art, size = 120, style }: { art?: string; size?: number; style?: ViewStyle }) {
  const source = art ? ART[art] : undefined;
  if (!source) return null;
  return (
    <View testID={`art:${art}`} style={[{ width: size, height: size, borderRadius: radius.lg, overflow: 'hidden' }, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Image source={source} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

export const hasLevelArt = (art?: string) => !!(art && ART[art]);
