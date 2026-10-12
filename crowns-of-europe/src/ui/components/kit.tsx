/**
 * Small building blocks shared by every screen, in the "gilded glass" look (see theme.ts): capsule buttons, grouped
 * lists with hairlines, gilded section headers, stat tiles and a segmented control.
 */
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { C, G, R, S, display, displaySemi, sans } from '../theme';
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
  // Capsules. The prominent action is gold; the rest sit quietly on the panel; destructive ones are red-tinted.
  const look = {
    primary: { bg: G.gold, fg: '#1a1408', border: 'transparent' },
    gold: { bg: G.gold, fg: '#1a1408', border: 'transparent' },
    secondary: { bg: G.raised, fg: G.text, border: G.line },
    ghost: { bg: 'transparent', fg: G.gold, border: G.gilt },
    danger: { bg: 'rgba(236,122,104,0.16)', fg: G.bad, border: 'rgba(236,122,104,0.35)' },
  }[tone];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: look.bg, borderColor: look.border, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed && !disabled ? 0.97 : 1 }] },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 15 : 17} color={look.fg} /> : null}
      <View style={{ flexShrink: 1, alignItems: 'center' }}>
        <Text style={[styles.btnText, small && { fontSize: 14 }, { color: look.fg }]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.btnSub, { color: look.fg }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function IconBtn({ name, onPress, size = 20, color = G.text, badge, style, label }: { name: IconName; onPress: () => void; size?: number; color?: string; badge?: number; style?: StyleProp<ViewStyle>; label: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }, style]}>
      <Icon name={name} size={size} color={color} />
      {badge ? <Badge n={badge} style={{ position: 'absolute', top: 0, right: -2 }} /> : null}
    </Pressable>
  );
}

/** A red count, like an app badge. */
export function Badge({ n, style }: { n: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{n > 9 ? '9+' : n}</Text>
    </View>
  );
}

/** A grouped container: rounded, a shade lighter than the panel. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style, gap = S.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/** A tile: a small caption over a big number. */
export function Stat({ label, value, tone, onPress, icon }: { label: string; value: string; tone?: 'good' | 'bad'; onPress?: () => void; icon?: IconName }) {
  const body = (
    <View style={styles.stat}>
      <Row gap={5}>
        {icon ? <Icon name={icon} size={13} color={G.gold} /> : null}
        <Text style={styles.statLabel} numberOfLines={1}>
          {label}
        </Text>
      </Row>
      <Row gap={4} style={{ marginTop: 3 }}>
        <Text style={[styles.statValue, tone === 'good' && { color: G.good }, tone === 'bad' && { color: G.bad }]} numberOfLines={1}>
          {value}
        </Text>
        {onPress ? <Icon name="chevron" size={11} color={G.text3} /> : null}
      </Row>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.75 : 1 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={{ flex: 1 }}>{body}</View>
  );
}

/** A row in a grouped list: what on the left, how much on the right, a hairline between rows. */
export function Line({ label, value, tone, bold }: { label: string; value: string; tone?: 'good' | 'bad' | 'muted'; bold?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, bold && { color: G.text, fontWeight: '700' }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.lineValue, bold && { fontWeight: '800' }, tone === 'good' && { color: G.good }, tone === 'bad' && { color: G.bad }, tone === 'muted' && { color: G.text3 }]}>{value}</Text>
    </View>
  );
}

/** A general's rank: one to five gold stars, the rest dim. */
export function Stars({ n, size = 13 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${n}-star general`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Icon key={i} name="star" size={size} color={i <= n ? G.goldBright : 'rgba(255,255,255,0.14)'} />
      ))}
    </View>
  );
}

export function Bar({ value, color = G.gold, back = G.raised, height = 6 }: { value: number; color?: string; back?: string; height?: number }) {
  return (
    <View style={{ height, backgroundColor: back, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

/** A section: its name in gilded capitals with a fine rule running off to the right (and an optional action). */
export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ marginTop: S.lg }}>
      <Row style={{ marginBottom: 8 }}>
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.sectionRule} />
        {right}
      </Row>
      {children}
    </View>
  );
}

export function Pill({ text, color = G.raised, textColor = G.text }: { text: string; color?: string; textColor?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={[styles.pillText, { color: textColor }]}>{text}</Text>
    </View>
  );
}

/** A segmented control (scrolls sideways when there are many segments). */
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string; badge?: number }[]; value: K; onChange: (k: K) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.md }}>
      <View style={styles.segTrack}>
        {tabs.map(t => {
          const on = value === t.key;
          return (
            <Pressable key={t.key} testID={`tab-${t.key}`} onPress={() => onChange(t.key)} style={[styles.seg, on && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={[styles.segText, on && styles.segTextOn]}>{t.label}</Text>
              {t.badge ? <Badge n={t.badge} style={{ marginLeft: 5 }} /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={[styles.small, { color: G.text3, fontStyle: 'italic', paddingVertical: S.sm }]}>{text}</Text>;
}

export const styles = StyleSheet.create({
  title: { fontFamily: display, fontSize: 32, color: G.text, letterSpacing: 1 },
  h1: { fontFamily: display, fontSize: 24, color: G.text, letterSpacing: 0.5 },
  h2: { fontFamily: display, fontSize: 19, color: G.text, letterSpacing: 0.4 },
  h3: { fontFamily: displaySemi, fontSize: 15, color: G.text, letterSpacing: 0.3 },
  body: { fontFamily: sans, fontSize: 15, color: G.text, lineHeight: 21 },
  small: { fontFamily: sans, fontSize: 13, color: G.text2, lineHeight: 18 },
  tiny: { fontFamily: sans, fontSize: 11.5, color: G.text3, lineHeight: 15 },
  label: { fontFamily: sans, fontSize: 11, color: G.text3, textTransform: 'uppercase', letterSpacing: 0.9, fontWeight: '600' },
  num: { fontFamily: sans, fontSize: 15, color: G.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, paddingHorizontal: 20, borderRadius: R.pill, borderWidth: 1 },
  btnSmall: { minHeight: 36, paddingHorizontal: 14 },
  btnText: { fontFamily: sans, fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
  btnSub: { fontFamily: sans, fontSize: 11, opacity: 0.75, marginTop: 1 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#e5533f', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', fontFamily: sans },
  card: { backgroundColor: G.group, borderRadius: R.md, padding: S.md },
  stat: { backgroundColor: G.group, borderRadius: R.md, paddingVertical: 9, paddingHorizontal: 11 },
  statLabel: { fontFamily: sans, fontSize: 10.5, color: G.text3, textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: '600', flexShrink: 1 },
  statValue: { fontFamily: sans, fontSize: 19, color: G.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.parchmentLine, gap: 12 },
  lineLabel: { fontFamily: sans, fontSize: 15, color: G.text2, flex: 1 },
  lineValue: { fontFamily: sans, fontSize: 15, color: G.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
  sectionTitle: { fontFamily: displaySemi, fontSize: 12.5, color: G.gold, letterSpacing: 1.6, textTransform: 'uppercase', flexShrink: 1 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: G.gilt, opacity: 0.6, minWidth: 12 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: R.pill, alignSelf: 'flex-start' },
  pillText: { fontFamily: sans, fontSize: 11.5, fontWeight: '700' },
  segTrack: { flexDirection: 'row', backgroundColor: G.group, borderRadius: R.pill, padding: 3, gap: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: G.line },
  seg: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 32, borderRadius: R.pill },
  segOn: { backgroundColor: G.raised, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: G.gilt },
  segText: { fontFamily: sans, fontSize: 13.5, fontWeight: '600', color: G.text2 },
  segTextOn: { color: G.text, fontWeight: '700' },
  // Kept for screens that style their own tabs.
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 32, borderRadius: R.pill },
  tabOn: { backgroundColor: G.raised },
  tabText: { fontFamily: sans, fontSize: 13.5, fontWeight: '600', color: G.text2 },
  tabTextOn: { color: G.text },
});
