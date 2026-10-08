import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

type Props<T extends string> = {
  /** Field name, e.g. "Meal". */
  label: string;
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
 * Compact filter button ("Meal · Dinner ▾") that opens a bottom sheet of choices.
 * Single-select with an explicit "Any" option (build plan §4).
 */
export function Dropdown<T extends string>({ label, anyLabel, options, labels, value, onChange, countFor }: Props<T>) {
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
        accessibilityLabel={`${text}${n !== undefined ? `, ${n} recipes` : ''}`}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: c.divider, backgroundColor: pressed ? c.divider : 'transparent' },
        ]}
      >
        <Text style={[t.body, { color: c.text, flex: 1, fontWeight: selected ? '700' : '400' }]}>{text}</Text>
        {n !== undefined ? <Text style={[t.small, { color: c.textMuted, marginRight: space.md }]}>{n}</Text> : null}
        <Text style={[styles.check, { color: c.primary }]}>{selected ? '✓' : ''}</Text>
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
            backgroundColor: active ? c.text : c.card,
            borderColor: active ? c.text : c.chipBorder,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <View style={styles.flex}>
          <Text style={[t.label, { color: active ? c.bg : c.textMuted, fontSize: 11 }]}>{label}</Text>
          <Text style={[t.bodyStrong, { color: active ? c.bg : c.text }]} numberOfLines={1}>
            {current}
          </Text>
        </View>
        <Text style={[styles.caret, { color: active ? c.bg : c.textMuted }]}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: c.card }]}>
          <View style={[styles.grabber, { backgroundColor: c.chipBorder }]} />
          <View style={styles.sheetHead}>
            <Text style={[t.title, { color: c.text, flex: 1 }]} accessibilityRole="header">
              {label}
            </Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" hitSlop={10} style={styles.done}>
              <Text style={[t.bodyStrong, { color: c.primary }]}>Done</Text>
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
  flex: { flex: 1 },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  caret: { fontSize: 16, marginLeft: space.sm },
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
  check: { width: 22, fontSize: 18, fontWeight: '800', textAlign: 'right' },
});
