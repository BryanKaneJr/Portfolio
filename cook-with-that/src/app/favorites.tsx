import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { dayLabel, SLOT_LABELS } from '../components/AddToPlanSheet';
import { RecipeCard } from '../components/RecipeCard';
import { ingredientInfo } from '../data/catalog';
import { CATEGORY_LABELS } from '../data/labels';
import type { Recipe } from '../data/types';
import { toResult } from '../logic/matchRecipes';
import { addDays, dateKey, parseDateKey, PLAN_SLOTS, shoppingList, weekDays, weekStart } from '../logic/mealPlan';
import { displayQuantity, displayStep } from '../logic/units';
import { isCustomIngredient } from '../logic/userRecipes';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

type Tab = 'saved' | 'plan' | 'shopping';
const TABS: [Tab, string][] = [
  ['saved', 'Saved'],
  ['plan', 'Meal plan'],
  ['shopping', 'Shopping list'],
];

/** My Kitchen: saved and written recipes, the week's meal plan and its shopping list. Opened by ♥ on home. */
export default function KitchenScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'plan' || params.tab === 'shopping' ? params.tab : 'saved');
  const [week, setWeek] = useState(() => weekStart(dateKey(new Date())));

  return (
    <>
      <Stack.Screen options={{ title: 'My Kitchen' }} />
      <View style={[styles.flex, { backgroundColor: c.bg }]}>
        <View style={[styles.tabs, { borderColor: c.chipBorder, backgroundColor: c.card }]} accessibilityRole="tablist">
          {TABS.map(([k, label]) => {
            const on = tab === k;
            return (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.tab, on && { backgroundColor: c.primary }]}
              >
                <Text style={[t.bodyStrong, { color: on ? c.primaryText : c.text, fontSize: 15 }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {tab === 'saved' ? <SavedTab /> : null}
        {tab !== 'saved' ? <WeekBar week={week} onChange={setWeek} /> : null}
        {tab === 'plan' ? <PlanTab week={week} onShopping={() => setTab('shopping')} /> : null}
        {tab === 'shopping' ? <ShoppingTab week={week} /> : null}
      </View>
    </>
  );
}

function SavedTab() {
  const c = useColors();
  const app = useAppState();
  const mine = [...app.ownRecipes, ...app.editedIds.map(id => app.recipeById(id))].filter((r): r is Recipe => !!r);
  const favorites = app.favorites.map(id => app.recipeById(id)).filter((r): r is Recipe => !!r);
  const card = (r: Recipe) => (
    <RecipeCard
      key={r.id}
      result={{ ...toResult(r, []), alsoNeed: [], staplesUsed: [] }}
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: r.id } })}
      isFavorite={app.isFavorite(r.id)}
      onToggleFavorite={() => app.toggleFavorite(r.id)}
      note={app.isEdited(r.id) ? { text: 'Your version of this recipe', tone: 'good' } : undefined}
    />
  );
  return (
    <ScrollView contentContainerStyle={styles.list}>
      <View style={styles.sectionHead}>
        <Text style={[t.title, { color: c.text, flex: 1 }]} accessibilityRole="header">
          Your recipes
        </Text>
        <Pressable
          onPress={() => router.push('/edit')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.newBtn, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[t.bodyStrong, { color: c.primaryText }]}>+ New recipe</Text>
        </Pressable>
      </View>
      {mine.length ? (
        <View style={styles.cards}>{mine.map(card)}</View>
      ) : (
        <Text style={[t.body, { color: c.textMuted }]}>
          Write your own, or tap ✎ on any recipe to make your version of it.
        </Text>
      )}
      <Text style={[t.title, styles.h2, { color: c.text }]} accessibilityRole="header">
        Favorites
      </Text>
      {favorites.length ? (
        <View style={styles.cards}>{favorites.map(card)}</View>
      ) : (
        <Text style={[t.body, { color: c.textMuted }]}>Tap the heart on any recipe to save it here.</Text>
      )}
    </ScrollView>
  );
}

function WeekBar({ week, onChange }: { week: string; onChange: (w: string) => void }) {
  const c = useColors();
  const thisWeek = weekStart(dateKey(new Date()));
  const first = parseDateKey(week);
  const last = parseDateKey(addDays(week, 6));
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const label =
    week === thisWeek ? 'This week' : week === addDays(thisWeek, 7) ? 'Next week' : `${fmt(first)} – ${fmt(last)}`;
  const arrow = (dir: -1 | 1) => (
    <Pressable
      onPress={() => onChange(addDays(week, 7 * dir))}
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? 'Previous week' : 'Next week'}
      hitSlop={6}
      style={styles.arrow}
    >
      <Text style={{ color: c.primary, fontSize: 24, fontWeight: '700' }}>{dir < 0 ? '‹' : '›'}</Text>
    </Pressable>
  );
  return (
    <View style={styles.weekBar}>
      {arrow(-1)}
      <View style={styles.weekLabel}>
        <Text style={[t.heading, { color: c.text }]}>{label}</Text>
        {week === thisWeek || week === addDays(thisWeek, 7) ? (
          <Text style={[t.small, { color: c.textMuted }]}>
            {fmt(first)} – {fmt(last)}
          </Text>
        ) : null}
      </View>
      {arrow(1)}
    </View>
  );
}

function PlanTab({ week, onShopping }: { week: string; onShopping: () => void }) {
  const c = useColors();
  const app = useAppState();
  const today = dateKey(new Date());
  const days = weekDays(week);
  const any = days.some(d => app.plan[d]);
  return (
    <ScrollView contentContainerStyle={styles.list}>
      {any ? (
        <Pressable
          onPress={onShopping}
          accessibilityRole="button"
          style={({ pressed }) => [styles.outlineBtn, { borderColor: c.chipBorder, opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={[t.bodyStrong, { color: c.primary }]}>Shopping list for this week ›</Text>
        </Pressable>
      ) : (
        <Text style={[t.body, { color: c.textMuted, marginBottom: space.md }]}>
          Tap + to plan a meal, or use “Add to meal plan” on any recipe.
        </Text>
      )}
      {days.map(day => (
        <View
          key={day}
          style={[styles.dayCard, { backgroundColor: c.card, borderColor: day === today ? c.primary : c.cardBorder }]}
        >
          <Text style={[t.heading, { color: c.text }]}>
            {parseDateKey(day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            {day === today ? <Text style={{ color: c.primary }}> · Today</Text> : null}
          </Text>
          {PLAN_SLOTS.map(slot => {
            const ids = app.plan[day]?.[slot] ?? [];
            return (
              <View key={slot} style={[styles.slot, { borderTopColor: c.divider }]}>
                <Text style={[t.label, styles.slotLabel, { color: c.textMuted }]}>{SLOT_LABELS[slot]}</Text>
                <View style={styles.flex}>
                  {ids.map(id => {
                    const r = app.recipeById(id);
                    if (!r) return null;
                    return (
                      <View key={id} style={styles.planned}>
                        <Pressable
                          onPress={() => router.push({ pathname: '/recipe/[id]', params: { id } })}
                          accessibilityRole="button"
                          style={styles.flex}
                        >
                          <Text style={[t.body, { color: c.text }]} numberOfLines={2}>
                            {r.title}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => app.unplanRecipe(day, slot, id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${r.title} from ${dayLabel(day, today)} ${SLOT_LABELS[slot]}`}
                          hitSlop={8}
                          style={styles.x}
                        >
                          <Text style={{ color: c.textMuted, fontSize: 18 }}>×</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                  <Pressable
                    onPress={() => router.push({ pathname: '/plan-add', params: { day, slot } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Add a recipe to ${dayLabel(day, today)} ${SLOT_LABELS[slot]}`}
                    style={styles.addRow}
                  >
                    <Text style={[t.small, { color: c.primary, fontWeight: '700' }]}>+ Add</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

function ShoppingTab({ week }: { week: string }) {
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
      <View style={styles.empty}>
        <Text style={[t.body, { color: c.textMuted, textAlign: 'center' }]}>
          Plan some meals for this week, and everything they need shows up here.
        </Text>
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Pressable
        onPress={() => setIncludeOnHand(v => !v)}
        accessibilityRole="switch"
        accessibilityState={{ checked: !includeOnHand }}
        style={styles.toggleRow}
      >
        <View
          style={[styles.box, { borderColor: c.primary, backgroundColor: includeOnHand ? 'transparent' : c.primary }]}
        >
          {includeOnHand ? null : <Text style={styles.boxTick}>✓</Text>}
        </View>
        <Text style={[t.body, { color: c.text, flex: 1 }]}>Leave out what’s in my pantry and kitchen staples</Text>
      </Pressable>
      {groups.length === 0 ? (
        <Text style={[t.body, { color: c.herbText, marginTop: space.md }]}>
          ✓ Your pantry already covers everything this week’s meals need.
        </Text>
      ) : null}
      {groups.map(g => (
        <View key={g.category}>
          <Text style={[t.label, styles.h3, { color: c.textMuted }]}>
            {g.category === 'other' ? 'Other' : CATEGORY_LABELS[g.category]}
          </Text>
          {g.items.map(item => {
            const on = checked.has(item.ingredientId);
            return (
              <Pressable
                key={item.ingredientId}
                onPress={() => app.toggleShoppingItem(week, item.ingredientId)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={[styles.item, { borderBottomColor: c.divider, opacity: on ? 0.5 : 1 }]}
              >
                <View style={[styles.box, { borderColor: c.chipBorder, backgroundColor: on ? c.herb : 'transparent' }]}>
                  {on ? <Text style={styles.boxTick}>✓</Text> : null}
                </View>
                <View style={styles.flex}>
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
        </View>
      ))}
      {checkedCatalog.length ? (
        <Pressable
          onPress={() => app.addToPantry(checkedCatalog)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.outlineBtn, { borderColor: c.chipBorder, opacity: pressed ? 0.75 : 1 }]}
        >
          <Text style={[t.bodyStrong, { color: c.primary }]}>
            Add {checkedCatalog.length} checked {checkedCatalog.length === 1 ? 'item' : 'items'} to my pantry
          </Text>
        </Pressable>
      ) : null}
      {checked.size ? (
        <Pressable onPress={() => app.clearShoppingChecks(week)} accessibilityRole="button" style={styles.addRow}>
          <Text style={[t.small, { color: c.textMuted, textAlign: 'center' }]}>Clear the checkmarks</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.pill,
    padding: 4,
    marginHorizontal: space.lg,
    marginTop: space.md,
  },
  tab: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.lg, paddingBottom: space.xxl * 2 },
  cards: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md, gap: space.md },
  newBtn: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h2: { marginTop: space.xl, marginBottom: space.md },
  h3: { marginTop: space.lg, marginBottom: space.xs },
  weekBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, marginTop: space.sm },
  weekLabel: { flex: 1, alignItems: 'center' },
  arrow: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  outlineBtn: {
    minHeight: MIN_TOUCH,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
    marginTop: space.md,
  },
  dayCard: { borderWidth: 1.5, borderRadius: radius.lg, padding: space.md, marginBottom: space.md },
  slot: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.sm, paddingTop: space.sm },
  slotLabel: { width: 92, paddingTop: 4 },
  planned: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  x: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  addRow: { minHeight: 36, justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: MIN_TOUCH },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxTick: { color: '#fff', fontWeight: '800', fontSize: 14 },
  strike: { textDecorationLine: 'line-through' },
});
