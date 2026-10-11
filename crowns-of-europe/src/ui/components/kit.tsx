/** Small building blocks shared by every screen. */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { C, R, S, sans, serif } from '../theme';
import { Icon, type IconName } from './Icon';

export function T({
  children,
  style,
  v = 'body',
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  v?: 'title' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny' | 'label' | 'num';
  numberOfLines?: number;
}) {
  return (
    <Text style={[styles[v], style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Btn({
  label,
  onPress,
  tone = 'primary',
  icon,
  disabled,
  small,
  style,
  sub,
  testID,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold';
  icon?: IconName;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  sub?: string;
  testID?: string;
}) {
  const bg = { primary: C.chrome2, secondary: C.parchment2, danger: C.red, ghost: 'transparent', gold: C.gold }[tone];
  const fg = { primary: C.chromeText, secondary: C.ink, danger: '#fff', ghost: C.ink, gold: C.chrome }[tone];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        tone === 'secondary' && { borderWidth: 1, borderColor: C.parchmentLine },
        tone === 'ghost' && { borderWidth: 1, borderColor: C.parchmentLine },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 15 : 18} color={fg} /> : null}
      <View style={{ flexShrink: 1, alignItems: 'center' }}>
        <Text style={[styles.btnText, small && { fontSize: 13 }, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.btnSub, { color: fg }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function IconBtn({ name, onPress, size = 22, color = C.chromeText, badge, style, label }: { name: IconName; onPress: () => void; size?: number; color?: string; badge?: number; style?: StyleProp<ViewStyle>; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }, style]}>
      <Icon name={name} size={size} color={color} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style, gap = S.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Stat({ label, value, tone, onPress, icon }: { label: string; value: string; tone?: 'good' | 'bad'; onPress?: () => void; icon?: IconName }) {
  const body = (
    <View style={styles.stat}>
      <Row gap={4}>
        {icon ? <Icon name={icon} size={13} color={C.muted} /> : null}
        <Text style={styles.statLabel}>{label}</Text>
      </Row>
      <Text style={[styles.statValue, tone === 'good' && { color: C.green }, tone === 'bad' && { color: C.red }]}>{value}</Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      {body}
    </Pressable>
  ) : (
    <View style={{ flex: 1 }}>{body}</View>
  );
}

export function Line({ label, value, tone, bold }: { label: string; value: string; tone?: 'good' | 'bad' | 'muted'; bold?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, bold && { fontWeight: '700' }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.lineValue, bold && { fontWeight: '700' }, tone === 'good' && { color: C.green }, tone === 'bad' && { color: C.red }, tone === 'muted' && { color: C.muted }]}>{value}</Text>
    </View>
  );
}

export function Bar({ value, color = C.gold, back = C.parchment2, height = 6 }: { value: number; color?: string; back?: string; height?: number }) {
  return (
    <View style={{ height, backgroundColor: back, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, backgroundColor: color }} />
    </View>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ marginTop: S.md }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </Row>
      {children}
    </View>
  );
}

export function Pill({ text, color = C.parchment2, textColor = C.ink }: { text: string; color?: string; textColor?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={[styles.pillText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string; badge?: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: S.md }}>
      {tabs.map(t => (
        <Pressable key={t.key} testID={`tab-${t.key}`} onPress={() => onChange(t.key)} style={[styles.tab, value === t.key && styles.tabOn]}>
          <Text style={[styles.tabText, value === t.key && styles.tabTextOn]}>{t.label}</Text>
          {t.badge ? (
            <View style={[styles.badge, { position: 'relative', top: 0, right: 0, marginLeft: 4 }]}>
              <Text style={styles.badgeText}>{t.badge}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={[styles.small, { color: C.muted, fontStyle: 'italic', paddingVertical: S.sm }]}>{text}</Text>;
}

export const styles = StyleSheet.create({
  title: { fontFamily: serif, fontSize: 34, color: C.chromeText, fontWeight: '700', letterSpacing: 0.5 },
  h1: { fontFamily: serif, fontSize: 24, color: C.ink, fontWeight: '700' },
  h2: { fontFamily: serif, fontSize: 19, color: C.ink, fontWeight: '700' },
  h3: { fontFamily: serif, fontSize: 16, color: C.ink, fontWeight: '700' },
  body: { fontFamily: sans, fontSize: 15, color: C.ink, lineHeight: 21 },
  small: { fontFamily: sans, fontSize: 13, color: C.inkSoft, lineHeight: 18 },
  tiny: { fontFamily: sans, fontSize: 11, color: C.muted },
  label: { fontFamily: sans, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },
  num: { fontFamily: sans, fontSize: 15, color: C.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, paddingHorizontal: S.lg, borderRadius: R.md },
  btnSmall: { minHeight: 36, paddingHorizontal: S.md, borderRadius: R.sm },
  btnText: { fontFamily: sans, fontSize: 15, fontWeight: '700' },
  btnSub: { fontFamily: sans, fontSize: 11, opacity: 0.8, marginTop: 1 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', fontFamily: sans },
  card: { backgroundColor: C.parchment, borderRadius: R.md, padding: S.md, borderWidth: 1, borderColor: C.parchmentLine },
  stat: { backgroundColor: C.parchment2, borderRadius: R.sm, paddingVertical: 6, paddingHorizontal: 8 },
  statLabel: { fontFamily: sans, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' },
  statValue: { fontFamily: sans, fontSize: 16, color: C.ink, fontWeight: '700', marginTop: 1, fontVariant: ['tabular-nums'] },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.parchmentLine, gap: 12 },
  lineLabel: { fontFamily: sans, fontSize: 14, color: C.inkSoft, flex: 1 },
  lineValue: { fontFamily: sans, fontSize: 14, color: C.ink, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sectionTitle: { fontFamily: serif, fontSize: 15, color: C.ink, fontWeight: '700' },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start' },
  pillText: { fontFamily: sans, fontSize: 11, fontWeight: '700' },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: C.chrome2, borderWidth: 1, borderColor: C.chromeLine },
  tabOn: { backgroundColor: C.gold, borderColor: C.gold },
  tabText: { fontFamily: sans, fontSize: 13, fontWeight: '700', color: C.chromeText },
  tabTextOn: { color: C.chrome },
});
