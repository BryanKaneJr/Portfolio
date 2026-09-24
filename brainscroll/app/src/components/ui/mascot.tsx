import { MASCOT_NAME, type MascotPose } from '@brainscroll/core';
import { Image, type ImageSourcePropType, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { color, radius, space, type } from '@/theme/tokens';

const reference: ImageSourcePropType = require('../../../assets/images/mascot/reference.webp');

/**
 * Pose art. Only the reference exists so far, so every pose shows it; add each
 * `mascot.<pose>` image here as it's approved (docs/mascot.md).
 */
const POSE_ART: Partial<Record<MascotPose, ImageSourcePropType>> = { reference };

export function mascotArt(pose: MascotPose): ImageSourcePropType {
  return POSE_ART[pose] ?? reference;
}

const SIZE = { xs: 44, sm: 64, md: 96, lg: 168 } as const;
export type MascotSize = keyof typeof SIZE;

/** Dr. Scroll on his own. Decorative: whatever he says must also be in text. */
export function DrScroll({ pose = 'reference', size = 'md', style }: { pose?: MascotPose; size?: MascotSize; style?: ViewStyle }) {
  const px = SIZE[size];
  return (
    <View style={[{ width: px, height: px }, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      <Image source={mascotArt(pose)} style={{ width: px, height: px }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

/**
 * Dr. Scroll with a speech bubble. `row` sits him beside the bubble (tips,
 * reactions); `stack` puts him above it (intros and big moments). Screen
 * readers hear "Dr. Scroll says: …" and skip the picture.
 */
export function DrScrollSays({ pose = 'reference', lines, size, layout = 'row', style }: {
  pose?: MascotPose;
  lines: readonly string[];
  size?: MascotSize;
  layout?: 'row' | 'stack';
  style?: ViewStyle;
}) {
  const stack = layout === 'stack';
  return (
    <View style={[stack ? styles.stack : styles.row, style]}>
      <DrScroll pose={pose} size={size ?? (stack ? 'lg' : 'sm')} />
      <View
        accessible
        accessibilityLabel={`${MASCOT_NAME} says: ${lines.join(' ')}`}
        style={[styles.bubble, stack ? styles.bubbleStack : styles.bubbleRow]}>
        <View style={[styles.tail, stack ? styles.tailUp : styles.tailLeft]} />
        {lines.map((line, i) => (
          <Text key={i} style={i === 0 && lines.length > 1 ? [type.title, { color: color.text }] : [type.body, { color: lines.length > 1 ? color.textMuted : color.text }]}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const TAIL = 10;
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  stack: { alignItems: 'center', gap: space.md },
  bubble: { backgroundColor: color.surface, borderColor: color.border, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  bubbleRow: { flex: 1 },
  bubbleStack: { alignSelf: 'stretch' },
  tail: { position: 'absolute', width: TAIL * 2, height: TAIL * 2, backgroundColor: color.surface, borderColor: color.border, transform: [{ rotate: '45deg' }] },
  tailLeft: { left: -TAIL, bottom: space.lg, borderLeftWidth: 1, borderBottomWidth: 1 },
  tailUp: { top: -TAIL, alignSelf: 'center', borderLeftWidth: 1, borderTopWidth: 1 },
});
