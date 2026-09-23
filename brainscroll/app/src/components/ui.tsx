import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, radius, space, type } from '@/theme/tokens';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function Label({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'brand' | 'mastery' | 'success' }) {
  const c = { muted: color.textMuted, brand: color.brand, mastery: color.mastery, success: color.success }[tone];
  return <Text style={[type.label, { color: c }]}>{children}</Text>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={[type.title, { color: color.text }]}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[type.body, { color: muted ? color.textMuted : color.text }]}>{children}</Text>;
}

export function BigNumber({ children, tone = 'text' }: { children: ReactNode; tone?: 'text' | 'brand' | 'mastery' }) {
  const c = { text: color.text, brand: color.brand, mastery: color.mastery }[tone];
  return <Text style={[type.number, { color: c }]}>{children}</Text>;
}

export function Card({ children, accent, style }: { children: ReactNode; accent?: boolean; style?: ViewStyle }) {
  return <View style={[styles.card, accent && styles.cardAccent, style]}>{children}</View>;
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'info' | 'success' | 'mastery' }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color[tone] }]} />
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary' }: { label: string; onPress?: () => void; variant?: 'primary' | 'secondary' }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
      ]}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  scroll: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: color.border,
  },
  cardAccent: { borderColor: color.brand },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  buttonPrimary: { backgroundColor: color.brand },
  buttonSecondary: { backgroundColor: color.surfaceRaised, borderWidth: 1, borderColor: color.border },
  buttonLabel: { color: color.text, fontSize: 16, fontWeight: '700' },
});
