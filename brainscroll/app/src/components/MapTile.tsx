import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, depth, fw, radius, space } from '@/theme/tokens';

/**
 * A small square tile beside a skill's map road, after Duolingo's: a picture
 * over a coloured band. They stack down the left of the road (UnlimitedTile,
 * then the week's QuestTile), so they share this one design.
 */
/** The picture's size in a tile (owner, 2026-10-09: "a slight hair smaller"). */
export const MAP_TILE_ART = 52;

export function MapTile({ art, band, done, label, onPress }: { art: ReactNode; band: string; done?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, done && styles.doneTile, pressed && { transform: [{ translateY: depth.edge }], borderBottomWidth: 0, marginBottom: depth.edge }]}>
      <View style={styles.art}>{art}</View>
      <View style={[styles.band, done && styles.doneBand]}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.label, done && { color: color.onSuccess }]}>
          {band}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 76,
    borderRadius: radius.md,
    backgroundColor: color.surfaceRaised,
    borderWidth: depth.border,
    borderColor: color.brandLine,
    borderBottomWidth: depth.edge + depth.border,
    borderBottomColor: color.brandEdge,
    overflow: 'hidden',
  },
  doneTile: { borderColor: color.successLine, borderBottomColor: color.successEdge },
  art: { alignItems: 'center', paddingTop: space.sm, paddingBottom: space.xs },
  band: { backgroundColor: color.brand, paddingVertical: space.xxs, alignItems: 'center' },
  doneBand: { backgroundColor: color.success },
  label: { ...fw('800'), fontSize: 13, color: color.onBrand },
});
