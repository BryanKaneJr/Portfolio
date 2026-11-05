import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Recipe } from '../data/types';
import { addDays, dateKey, parseDateKey, PLAN_SLOTS, suggestSlot, type PlanSlot } from '../logic/mealPlan';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';
import { Chip } from './Chip';

export const SLOT_LABELS: Record<PlanSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

/** "Today", "Tomorrow", then "Wed 15". */
export function dayLabel(day: string, today = dateKey(new Date())): string {
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  const d = parseDateKey(day);
  return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()}`;
}

type Props = {
  recipe: Recipe;
  visible: boolean;
  onClose: () => void;
  onAdd: (day: string, slot: PlanSlot) => void;
};

/** Pick a day in the next two weeks and a meal slot for a recipe. */
export function AddToPlanSheet({ recipe, visible, onClose, onAdd }: Props) {
  const c = useColors();
  const today = dateKey(new Date());
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const [day, setDay] = useState(today);
  const [slot, setSlot] = useState<PlanSlot>(() => suggestSlot(recipe));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: c.card }]}>
        <View style={[styles.grabber, { backgroundColor: c.chipBorder }]} />
        <Text style={[t.title, styles.head, { color: c.text }]} accessibilityRole="header">
          Add to meal plan
        </Text>
        <Text style={[t.label, styles.label, { color: c.textMuted }]}>Day</Text>
        <View style={styles.wrap}>
          {days.map(d => (
            <Chip
              key={d}
              small
              label={dayLabel(d, today)}
              variant={d === day ? 'filterOn' : 'neutral'}
              selected={d === day}
              onPress={() => setDay(d)}
            />
          ))}
        </View>
        <Text style={[t.label, styles.label, { color: c.textMuted }]}>Meal</Text>
        <View style={styles.wrap}>
          {PLAN_SLOTS.map(s => (
            <Chip
              key={s}
              small
              label={SLOT_LABELS[s]}
              variant={s === slot ? 'filterOn' : 'neutral'}
              selected={s === slot}
              onPress={() => setSlot(s)}
            />
          ))}
        </View>
        <Pressable
          onPress={() => onAdd(day, slot)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.add, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[t.bodyStrong, { color: c.primaryText }]}>
            Add to {dayLabel(day, today)} · {SLOT_LABELS[slot]}
          </Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: space.sm },
  head: { marginTop: space.md },
  label: { marginTop: space.lg, marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  add: {
    marginTop: space.xl,
    minHeight: MIN_TOUCH + 8,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
