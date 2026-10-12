import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '../theme/colors';
import type { IconName } from '../theme/icons';
import { radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';
import { Icon } from './Icon';

/** Shared building blocks for the clean iOS look: ink buttons, white cards, grey grouped background. */

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'plain' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  compact?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
  accessibilityLabel,
  accessibilityHint,
  compact,
}: ButtonProps) {
  const c = useColors();
  const look = {
    primary: { bg: c.primary, fg: c.primaryText, border: 'transparent' },
    secondary: { bg: c.card, fg: c.text, border: c.cardBorder },
    plain: { bg: 'transparent', fg: c.accent, border: 'transparent' },
    danger: { bg: 'transparent', fg: c.avoidText, border: 'transparent' },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={disabled ? { disabled } : undefined}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor: look.bg, borderColor: look.border, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={compact ? 16 : 18} color={look.fg} weight="semibold" /> : null}
      <Text style={[t.bodyStrong, { color: look.fg, fontSize: compact ? 15 : 17 }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Round icon button for headers (settings, edit, favorite). */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color,
  filled,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  /** Sit on a white circle (on the grey background). */
  filled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, filled && { backgroundColor: c.card }, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={21} color={color ?? c.text} />
    </Pressable>
  );
}

/** Large title at the top of a tab, with optional buttons on the right and a line under it. */
export function LargeHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={[t.display, { color: c.text, flex: 1 }]} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>
      {subtitle ? <Text style={[t.body, { color: c.textMuted, marginTop: 2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }, style]}>{children}</View>;
}

/** Small grey uppercase heading above a group. */
export function SectionLabel({
  text,
  right,
  style,
}: {
  text: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View style={[styles.sectionLabel, style]}>
      <Text style={[t.label, { color: c.textMuted, flex: 1 }]} accessibilityRole="header">
        {text}
      </Text>
      {right}
    </View>
  );
}

/** Text link in the accent colour, e.g. "Edit", "Browse all ingredients ›". */
export function LinkButton({
  label,
  onPress,
  chevron,
  accessibilityLabel,
  accessibilityHint,
  muted,
}: {
  label: string;
  onPress: () => void;
  chevron?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  muted?: boolean;
}) {
  const c = useColors();
  const color = muted ? c.textMuted : c.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={8}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[t.bodyStrong, { color }]}>{label}</Text>
      {chevron ? <Icon name="chevronRight" size={15} color={color} weight="semibold" /> : null}
    </Pressable>
  );
}

/** iOS segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string; icon?: IconName; color?: string; accessibilityLabel?: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  return (
    <View style={[styles.segment, { backgroundColor: c.fill }, style]} role="tablist">
      {options.map(o => {
        const on = o.value === value;
        const fg = on ? (o.color ?? c.text) : c.textMuted;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            role="tab"
            aria-selected={on}
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            style={[styles.segBtn, on && [styles.segOn, { backgroundColor: c.card }]]}
          >
            {o.icon ? <Icon name={o.icon} size={15} color={fg} weight="semibold" /> : null}
            <Text style={[styles.segText, { color: fg }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** iOS switch in the app's green, with a white thumb on every platform. */
export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  accessibilityLabel: string;
}) {
  const c = useColors();
  // react-native-web colours the "on" thumb teal unless told otherwise (activeThumbColor is web-only).
  const webThumb = { activeThumbColor: '#FFFFFF' } as object;
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: c.herb, false: c.fill }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={c.fill}
      accessibilityLabel={accessibilityLabel}
      {...webThumb}
    />
  );
}

/** Centered message for an empty list, with an optional action. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={36} color={c.textFaint} />
      <Text style={[t.heading, { color: c.text, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[t.body, { color: c.textMuted, textAlign: 'center' }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md + 2,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  compact: { minHeight: 40, borderRadius: radius.pill, paddingHorizontal: space.md + 2 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.xl,
    marginBottom: space.sm,
    paddingHorizontal: space.xs,
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
  segment: { flexDirection: 'row', borderRadius: 9, padding: 2 },
  segBtn: {
    flex: 1,
    minHeight: 32,
    borderRadius: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
  },
  segOn: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segText: { fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
});
