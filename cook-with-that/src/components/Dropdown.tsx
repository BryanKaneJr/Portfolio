import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';
import { Icon } from './Icon';

type Props<T extends string> = {
  /** Field name, e.g. "Meal". */
  label: string;
  /** Shorter name for the pill when nothing is picked, e.g. "Dish" for "Dish type". */
  shortLabel?: string;
  /** Text for the "no filter" option, e.g. "Any meal". */
  anyLabel: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null;
  onChange: (v: T | null) => void;
  /** Optional count shown beside each option. */
  countFor?: (v: T | null) => number;
};

/**
 * Compact filter pill ("Meal ⌄", or "Dinner ⌄" in ink once set) that opens a bottom sheet of choices.
 * Single-select with an explicit "Any" option (build plan §4).
 */
export function Dropdown<T extends string>({
  label,
  shortLabel,
  anyLabel,
  options,
  labels,
  value,
  onChange,
  countFor,
}: Props<T>) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const current = value ? labels[value] : anyLabel;
  const active = value !== null;

  const choose = (v: T | null) => {
    onChange(v);
    setOpen(false);
  };

  const row = (v: T | null, text: string) => {
    const selected = v === value;
    const n = countFor?.(v);
    return (
      <Pressable
        key={v ?? '__any'}
        onPress={() => choose(v)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${text}${n !== undefined ? `, ${n} ${n === 1 ? 'recipe' : 'recipes'}` : ''}`}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: c.divider, backgroundColor: pressed ? c.divider : 'transparent' },
        ]}
      >
        <Text style={[t.body, { color: c.text, flex: 1, fontWeight: selected ? '600' : '400' }]}>{text}</Text>
        {n !== undefined ? <Text style={[t.small, { color: c.textMuted, marginRight: space.md }]}>{n}</Text> : null}
        <View style={styles.check}>
          {selected ? <Icon name="check" size={18} color={c.accent} weight="bold" /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current}. Change`}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: active ? c.primary : c.card,
            borderColor: active ? c.primary : c.chipBorder,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={[styles.buttonText, { color: active ? c.primaryText : c.text }]} numberOfLines={1}>
          {active ? current : (shortLabel ?? label)}
        </Text>
        <Icon name="chevronDown" size={13} color={active ? c.primaryText : c.textMuted} weight="semibold" />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: c.card }]}>
          <View style={[styles.grabber, { backgroundColor: c.textFaint }]} />
          <View style={styles.sheetHead}>
            <Text style={[t.title, { color: c.text, flex: 1 }]} accessibilityRole="header">
              {label}
            </Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" hitSlop={10} style={styles.done}>
              <Text style={[t.bodyStrong, { color: c.accent }]}>Done</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.list} accessibilityRole="radiogroup">
            {row(null, anyLabel)}
            {options.map(o => row(o, labels[o]))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 34,
    maxWidth: 170,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingLeft: space.md,
    paddingRight: space.sm + 2,
  },
  buttonText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingBottom: space.md,
    maxHeight: '75%',
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: space.sm },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  done: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  list: { paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  check: { width: 22, alignItems: 'flex-end' },
});
