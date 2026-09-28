import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { feedback, useReduceMotion } from '@/theme/feedback';
import { Icon, type IconName } from './icon';
import { color, depth, iconSize, layout, motion, radius, space, type } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'mastery' | 'danger';

/**
 * One obvious action per screen: `primary` (violet, filled). `success` is the
 * Continue after a correct answer; `mastery` is reserved for mastery moments.
 * Buttons depress on press (their 4 px darker edge collapses) and are full-width by default.
 *
 * States: default, pressed, `disabled` (grey, flat), and `loading`: the button
 * keeps its colour and shape, stops taking taps, and shows three breathing
 * dots after its label ("Checking ···"), so a wait never looks like a frozen
 * or disabled button. Pass a label that says what's happening.
 *
 * `selected` turns a button into one choice of a set (report categories): it
 * reads as a radio to screen readers and shows a check, so the pick is never
 * carried by colour alone. Wrap the set in a `radiogroup` view.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  compact,
  icon,
  selected,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** In flight: keeps the variant's look, ignores taps, shows busy dots. */
  loading?: boolean;
  compact?: boolean;
  icon?: ReactNode;
  /** One choice of a set: a radio for screen readers, with a check when picked. */
  selected?: boolean;
  style?: ViewStyle;
}) {
  const v = disabled && !loading ? 'disabled' : variant;
  const inert = disabled || loading;
  const choice = selected !== undefined;
  return (
    <Pressable
      accessibilityRole={choice ? 'radio' : 'button'}
      accessibilityLabel={label}
      // aria-* props: React Native reads them as accessibilityState, and react-native-web puts them on the DOM.
      aria-disabled={!!inert}
      aria-checked={choice ? selected : undefined}
      aria-busy={choice ? undefined : !!loading}
      disabled={inert}
      onPress={() => {
        if (variant !== 'ghost') feedback('select');
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        styles[v],
        v !== 'ghost' && v !== 'disabled' && (pressed ? { borderBottomWidth: v === 'secondary' || v === 'danger' ? depth.border : 0, transform: [{ translateY: depth.edge }] } : { borderBottomWidth: depth.edge }),
        pressed && v === 'ghost' && { opacity: 0.6 },
        style,
      ]}>
      {selected ? <Icon name="check" tint={LABEL[v]} size={iconSize.md} /> : icon}
      <Text style={[type.button, { textAlign: 'center', flexShrink: 1 }, compact && { fontSize: type.caption.fontSize }, { color: LABEL[v] }]}>{label}</Text>
      {loading && <BusyDots tint={LABEL[v]} />}
    </Pressable>
  );
}

/** Size of one busy dot: small enough to sit on the label's baseline. */
const DOT = 6;

/** Three dots that breathe in turn. Still (but visible) with reduce motion. */
function BusyDots({ tint }: { tint: string }) {
  const reduce = useReduceMotion();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return t.setValue(0);
    const loop = Animated.loop(Animated.timing(t, { toValue: 3, duration: motion.celebrate * 1.2, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduce, t]);
  return (
    <View style={{ flexDirection: 'row', gap: space.xs }} aria-hidden accessible={false} importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={{
            width: DOT,
            height: DOT,
            borderRadius: radius.pill,
            backgroundColor: tint,
            opacity: reduce ? 0.8 : t.interpolate({ inputRange: [0, i, i + 0.5, i + 1, 3], outputRange: [0.35, 0.35, 1, 0.35, 0.35], extrapolate: 'clamp' }),
          }}
        />
      ))}
    </View>
  );
}

/** Label ink per variant; each passes WCAG AA on its fill (see tokens.ts). */
const LABEL: Record<ButtonVariant | 'disabled', string> = {
  primary: color.onBrand,
  secondary: color.text,
  ghost: color.textMuted,
  success: color.onSuccess,
  mastery: color.onMastery,
  danger: color.danger,
  // Readable (5.2:1 on surfaceRaised) yet clearly off: the flat grey slab and missing edge say "not yet".
  disabled: color.textMuted,
};

const styles = StyleSheet.create({
  base: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  compact: { minHeight: layout.buttonHeightCompact, paddingHorizontal: space.lg },
  primary: { backgroundColor: color.brand, borderBottomColor: color.brandEdge },
  secondary: { backgroundColor: color.surface, borderWidth: depth.border, borderColor: color.border },
  ghost: { backgroundColor: 'transparent' },
  success: { backgroundColor: color.success, borderBottomColor: color.successEdge },
  mastery: { backgroundColor: color.mastery, borderBottomColor: color.masteryEdge },
  // Irreversible actions only (e.g. delete account). Outlined, never a filled red slab.
  danger: { backgroundColor: color.dangerSoft, borderWidth: depth.border, borderColor: color.dangerLine },
  disabled: { backgroundColor: color.surfaceRaised, marginBottom: depth.edge },
});

/** A quiet icon-only button (close, report). Always has a spoken label. */
export function IconButton({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={space.md}
      style={({ pressed }) => [iconStyles.hit, pressed && { opacity: 0.5 }]}>
      <Icon name={icon} tint={color.textMuted} size={iconSize.lg} />
    </Pressable>
  );
}
const iconStyles = StyleSheet.create({
  hit: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
});
