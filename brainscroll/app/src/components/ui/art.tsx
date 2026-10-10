import { Image, View, type ViewStyle } from 'react-native';
import { ART, ART_SHEET, ART_SHEETS } from '@/content/art';
import { radius } from '@/theme/tokens';

/**
 * A level's illustration (docs/image-manifest.md), when its file exists in
 * app/assets/images/art/. Decorative, so screen readers skip it; renders
 * nothing until the image has been made. The art ships four to a sheet
 * (scripts/lib/art-sheets.ts), so this shows the sheet with only its cell in view.
 */
export function LevelArt({ art, size = 120, style }: { art?: string; size?: number; style?: ViewStyle }) {
  const place = art ? ART[art] : undefined;
  if (!place) return null;
  const [sheet, cell] = place;
  const { cols, rows, cell: px, edge } = ART_SHEET;
  const k = size / px;
  const box = px + 2 * edge;
  return (
    <View testID={`art:${art}`} style={[{ width: size, height: size, borderRadius: radius.lg, overflow: 'hidden' }, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Image
        source={ART_SHEETS[sheet]}
        style={{ position: 'absolute', width: cols * box * k, height: rows * box * k, left: -((cell % cols) * box + edge) * k, top: -(Math.floor(cell / cols) * box + edge) * k }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

export const hasLevelArt = (art?: string) => !!(art && ART[art]);
