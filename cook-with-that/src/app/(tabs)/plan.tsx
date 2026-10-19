import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { dayLabel, SLOT_LABELS } from '../../components/AddToPlanSheet';
import { Icon } from '../../components/Icon';
import {
  Button,
  Card,
  EmptyState,
  LargeHeader,
  LinkButton,
  SectionLabel,
  Segmented,
  Toggle,
} from '../../components/ui';
import { ingredientInfo } from '../../data/catalog';
import { CATEGORY_LABELS } from '../../data/labels';
import { addDays, dateKey, parseDateKey, PLAN_SLOTS, shoppingList, weekDays, weekStart } from '../../logic/mealPlan';
import { displayQuantity, displayStep } from '../../logic/units';
import { isCustomIngredient } from '../../logic/userRecipes';
import { useAppState } from '../../state/AppState';
import { useColors } from '../../theme/colors';
import { MIN_TOUCH, radius, space } from '../../theme/spacing';
import { type as t } from '../../theme/typography';

type PlanView = 'week' | 'shopping';

/** Plan: the week's breakfasts, lunches and dinners, and the shopping list they add up to. */
export default function PlanScreen() {
  const c = useColors();
  const [view, setView] = useState<PlanView>('week');
  const [week, setWeek] = useState(() => weekStart(dateKey(new Date())));

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LargeHeader title="Plan" />
        <View style={styles.pad}>
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'week', label: 'Week', icon: 'calendar' },
              { value: 'shopping', label: 'Shopping list', icon: 'cart' },
            ]}
          />
          <WeekBar week={week} onChange={setWeek} />
          {view === 'week' ? (
            <WeekView week={week} onShopping={() => setView('shopping')} />
          ) : (
            <ShoppingView week={week} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function WeekBar({ week, onChange }: { week: string; onChange: (w: string) => void }) {
  const c = useColors();
  const thisWeek = weekStart(dateKey(new Date()));
  const first = parseDateKey(week);
  const last = parseDateKey(addDays(week, 6));
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const name = week === thisWeek ? 'This week' : week === addDays(thisWeek, 7) ? 'Next week' : null;
  const arrow = (dir: -1 | 1) => (
    <Pressable
      onPress={() => onChange(addDays(week, 7 * dir))}
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? 'Previous week' : 'Next week'}
      hitSlop={6}
      style={({ pressed }) => [styles.arrow, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Icon name={dir < 0 ? 'chevronLeft' : 'chevronRight'} size={18} color={c.accent} weight="semibold" />
    </Pressable>
  );
  return (
    <View style={styles.weekBar}>
      {arrow(-1)}
      <View style={styles.weekLabel}>
        <Text style={[t.heading, { color: c.text }]}>{name ?? `${fmt(first)} – ${fmt(last)}`}</Text>
        {name ? (
          <Text style={[t.small, { color: c.textMuted }]}>
            {fmt(first)} – {fmt(last)}
          </Text>
        ) : null}
      </View>
      {arrow(1)}
    </View>
  );
}

/** One short row per day: the planned meals as named lines, and a + to add one. */
function WeekView({ week, onShopping }: { week: string; onShopping: () => void }) {
  const c = useColors();
  const app = useAppState();
  const today = dateKey(new Date());
  const days = weekDays(week);
  const any = days.some(d => app.plan[d]);
  return (
    <>
      <Card style={styles.week}>
        {days.map((day, i) => {
          const d = parseDateKey(day);
          const isToday = day === today;
          const items = PLAN_SLOTS.flatMap(slot => (app.plan[day]?.[slot] ?? []).map(id => ({ slot, id })));
          return (
            <View
              key={day}
              style={[styles.dayRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }]}
            >
              <View style={styles.dayCol} accessibilityLabel={dayLabel(day, today)}>
                <Text style={[styles.dow, { color: isToday ? c.accent : c.textMuted }]}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                </Text>
                <View style={[styles.dateDot, isToday && { backgroundColor: c.accent }]}>
                  <Text style={[styles.date, { color: isToday ? c.onAccent : c.text }]}>{d.getDate()}</Text>
                </View>
              </View>
              <View style={styles.items}>
                {items.map(({ slot, id }) => {
                  const r = app.recipeById(id);
                  if (!r) return null;
                  return (
                    <View key={`${slot}:${id}`} style={styles.item}>
                      <Pressable
                        onPress={() => router.push({ pathname: '/recipe/[id]', params: { id } })}
                        accessibilityRole="button"
                        accessibilityLabel={`${SLOT_LABELS[slot]}: ${r.title}`}
                        style={styles.flex}
                      >
                        <Text style={[t.label, { color: c.textMuted, fontSize: 11 }]}>{SLOT_LABELS[slot]}</Text>
                        <Text style={[t.body, { color: c.text }]} numberOfLines={1}>
                          {r.title}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => app.unplanRecipe(day, slot, id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${r.title} from ${dayLabel(day, today)} ${SLOT_LABELS[slot]}`}
                        hitSlop={8}
                        style={styles.remove}
                      >
                        <Icon name="close" size={14} color={c.textFaint} weight="semibold" />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/plan-add', params: { day } })}
                accessibilityRole="button"
                accessibilityLabel={`Add a recipe to ${dayLabel(day, today)}`}
                hitSlop={4}
                style={({ pressed }) => [styles.add, { backgroundColor: c.fill, opacity: pressed ? 0.6 : 1 }]}
              >
                <Icon name="plus" size={16} color={c.accent} weight="semibold" />
              </Pressable>
            </View>
          );
        })}
      </Card>
      {any ? (
        <Button
          label="Shopping list for this week"
          icon="cart"
          variant="secondary"
          onPress={onShopping}
          style={styles.gapTop}
        />
      ) : (
        <Text style={[t.small, styles.tip, { color: c.textMuted }]}>
          Tap + to plan a meal, or use “Add to meal plan” on any recipe.
        </Text>
      )}
    </>
  );
}

function ShoppingView({ week }: { week: string }) {
  const c = useColors();
  const app = useAppState();
  const [includeOnHand, setIncludeOnHand] = useState(false);
  const days = weekDays(week);
  const onHand = useMemo(
    () => (includeOnHand ? new Set<string>() : new Set(app.effectivePantry)),
    [includeOnHand, app.effectivePantry],
  );
  const groups = useMemo(
    () => shoppingList(app.plan, weekDays(week), app.recipeById, onHand, ingredientInfo),
    [app.plan, week, app.recipeById, onHand],
  );
  const checked = new Set(app.shoppingChecked[week] ?? []);
  const checkedCatalog = [...checked].filter(id => !isCustomIngredient(id) && !app.pantry.includes(id));
  const planned = days.some(d => app.plan[d]);

  if (!planned)
    return (
      <EmptyState
        icon="cart"
        title="Nothing to buy yet"
        body="Plan some meals for this week, and everything they need shows up here, grouped by aisle."
      />
    );

  return (
    <>
      <Card style={styles.switchCard}>
        <Text style={[t.body, { color: c.text, flex: 1 }]}>Leave out my pantry and kitchen staples</Text>
        <Toggle
          value={!includeOnHand}
          onValueChange={v => setIncludeOnHand(!v)}
          accessibilityLabel="Leave out what’s in my pantry and kitchen staples"
        />
      </Card>
      {groups.length === 0 ? (
        <Text style={[t.body, styles.tip, { color: c.herbText }]}>
          Your pantry already covers everything this week’s meals need.
        </Text>
      ) : null}
      {groups.map(g => (
        <View key={g.category}>
          <SectionLabel text={g.category === 'other' ? 'Other' : CATEGORY_LABELS[g.category]} />
          <Card style={styles.listCard}>
            {g.items.map((item, i) => {
              const on = checked.has(item.ingredientId);
              return (
                <Pressable
                  key={item.ingredientId}
                  onPress={() => app.toggleShoppingItem(week, item.ingredientId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={[
                    styles.shopItem,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider },
                  ]}
                >
                  <Icon name={on ? 'checkCircle' : 'circle'} size={22} color={on ? c.herb : c.textFaint} />
                  <View style={[styles.flex, on && styles.done]}>
                    <Text style={[t.bodyStrong, { color: c.text }, on && styles.strike]}>{item.name}</Text>
                    <Text style={[t.small, { color: c.textMuted }]}>
                      {item.uses
                        .map(u => {
                          const qty = displayQuantity(u.quantityText, app.units, item.ingredientId, u.displayName);
                          // "6 garlic cloves · Garlic Chicken Skillet": what to buy, then what it's for.
                          return [
                            [qty, displayStep(u.displayName, app.units)].filter(Boolean).join(' '),
                            u.recipeTitle,
                          ].join(' · ');
                        })
                        .join('\n')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </View>
      ))}
      {checkedCatalog.length ? (
        <Button
          label={`Add ${checkedCatalog.length} checked to my pantry`}
          icon="pantry"
          variant="secondary"
          onPress={() => app.addToPantry(checkedCatalog)}
          style={styles.gapTop}
        />
      ) : null}
      {checked.size ? (
        <View style={styles.center}>
          <LinkButton label="Clear the checkmarks" muted onPress={() => app.clearShoppingChecks(week)} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  pad: { paddingHorizontal: space.lg },
  weekBar: { flexDirection: 'row', alignItems: 'center', marginVertical: space.md },
  weekLabel: { flex: 1, alignItems: 'center' },
  arrow: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  week: { paddingVertical: 0, paddingHorizontal: space.md },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 58, paddingVertical: space.sm },
  dayCol: { width: 40, alignItems: 'center' },
  dow: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  dateDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  date: { fontSize: 17, fontWeight: '600' },
  items: { flex: 1, gap: space.xs },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  remove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  add: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tip: { marginTop: space.md, textAlign: 'center' },
  gapTop: { marginTop: space.lg },
  switchCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  listCard: { paddingVertical: 0, paddingHorizontal: space.md },
  shopItem: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  done: { opacity: 0.5 },
  strike: { textDecorationLine: 'line-through' },
  center: { alignItems: 'center', marginTop: space.md },
});
