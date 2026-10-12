/**
 * Glass: the material for everything that floats over the map (bars, buttons, popovers, partial sheets). A blur of
 * what lies beneath, a dark tint so text stays legible, a light hairline at the rim; optionally a gilded one.
 */
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { G, R, float } from '../theme';

export function Glass({
  children,
  style,
  radius = R.pill,
  strong,
  gilt,
  shadow = true,
  pointerEvents,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  strong?: boolean; // more opaque, for panels that hold paragraphs
  gilt?: boolean; // a gilded rim
  shadow?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}) {
  return (
    <View pointerEvents={pointerEvents} style={[{ borderRadius: radius }, shadow && float, style]}>
      {/* Behind the content (zIndex -1: on the web a bare picture would otherwise paint beneath this layer). */}
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', zIndex: -1 }]} pointerEvents="none">
        <BlurView intensity={strong ? 50 : 36} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: strong ? G.glassStrong : G.glass }]} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: gilt ? G.gilt : G.lineStrong }]} />
      </View>
      {children}
    </View>
  );
}
