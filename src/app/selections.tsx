import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RECIPES, ingredientIndex, ingredientName } from '../data/catalog';
import { CATEGORY_LABELS } from '../data/labels';
import { countExact } from '../logic/matchRecipes';
import { useAppState } from '../state/AppState';
import type { PickMode } from '../state/searchState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

/** Everything in the Use and Avoid lists, with remove / move actions. */
export default function SelectionsScreen() {
  const c = useColors();
  const app = useAppState();
  const { search } = app;
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const order: PickMode[] = focus === 'avoid' ? ['avoid', 'use'] : ['use', 'avoid'];
  const count = useMemo(() => countExact(RECIPES, search), [search]);

  const section = (kind: PickMode) => {
    const use = kind === 'use';
    const list = use ? search.useIds : search.avoidIds;
    const fg = use ? c.herbText : c.avoidText;
    return (
      <View key={kind} style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[t.title, { color: fg, flex: 1 }]} accessibilityRole="header">
            {use ? '✓ Use these' : '⊘ Avoid these'} · {list.length}
          </Text>
          {list.length > 0 ? (
            <Pressable
              onPress={use ? app.clearUse : app.clearAvoid}
              accessibilityRole="button"
              accessibilityLabel={`Clear ${use ? 'Use' : 'Avoid'} list`}
              hitSlop={8}
              style={styles.linkBtn}
            >
              <Text style={[t.bodyStrong, { color: c.textMuted }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={[t.small, { color: c.textMuted, marginBottom: space.sm }]}>
          {use ? 'Every recipe must include all of these.' : 'Recipes with any of these are always hidden.'}
        </Text>

        {list.length === 0 ? (
          <View style={[styles.empty, { borderColor: c.chipBorder }]}>
            <Text style={[t.body, { color: c.textMuted }]}>{use ? 'Nothing to use yet.' : 'Nothing avoided.'}</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
            {list.map((id, i) => {
              const ing = ingredientIndex.byId.get(id);
              return (
                <View key={id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }]}>
                  <View style={styles.flex}>
                    <Text style={[t.bodyStrong, { color: c.text }, !use && styles.strike]}>{ingredientName(id)}</Text>
                    {ing ? <Text style={[t.small, { color: c.textMuted }]}>{CATEGORY_LABELS[ing.category]}</Text> : null}
                  </View>
                  <Pressable
                    onPress={() => app.moveIngredient(id, use ? 'avoid' : 'use')}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${ingredientName(id)} to ${use ? 'Avoid' : 'Use'}`}
                    style={({ pressed }) => [styles.moveBtn, { borderColor: c.chipBorder, opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Text style={[t.small, { color: c.text, fontWeight: '600' }]}>{use ? '→ Avoid' : '→ Use'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => app.remove(id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${ingredientName(id)}`}
                    hitSlop={6}
                    style={styles.removeBtn}
                  >
                    <Text style={[styles.x, { color: c.textMuted }]}>×</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>{order.map(section)}</ScrollView>
      <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.divider }]}>
        <View style={styles.actions}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, { borderColor: c.chipBorder, backgroundColor: c.card, opacity: pressed ? 0.75 : 1 }]}
          >
            <Text style={[t.bodyStrong, { color: c.text }]}>Add more</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/results')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[t.bodyStrong, { color: c.primaryText, fontSize: 17 }]}>
              {count === 0 ? 'See options' : `See ${count} ${count === 1 ? 'recipe' : 'recipes'}`}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  section: { marginBottom: space.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center' },
  linkBtn: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, alignItems: 'flex-end', justifyContent: 'center' },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.md, padding: space.lg, alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 60, paddingVertical: space.sm },
  strike: { textDecorationLine: 'line-through' },
  moveBtn: { minHeight: 36, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, justifyContent: 'center' },
  removeBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  x: { fontSize: 26, fontWeight: '400', marginTop: -2 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  secondary: { minHeight: 52, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 1, minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
