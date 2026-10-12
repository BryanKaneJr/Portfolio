import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { Button, Card, LinkButton } from '../components/ui';
import { ingredientIndex, ingredientName } from '../data/catalog';
import { CATEGORY_LABELS } from '../data/labels';
import { countExact } from '../logic/matchRecipes';
import { useAppState } from '../state/AppState';
import type { PickMode } from '../state/searchState';
import { useColors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

/** Everything in the Use and Avoid lists, with remove / move actions. */
export default function SelectionsScreen() {
  const c = useColors();
  const app = useAppState();
  const { search } = app;
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const order: PickMode[] = focus === 'avoid' ? ['avoid', 'use'] : ['use', 'avoid'];
  const count = useMemo(() => countExact(app.library, search), [app.library, search]);

  const section = (kind: PickMode) => {
    const use = kind === 'use';
    const list = use ? search.useIds : search.avoidIds;
    const fg = use ? c.herbText : c.avoidText;
    return (
      <View key={kind} style={styles.section}>
        <View style={styles.sectionHead}>
          <Icon name={use ? 'check' : 'avoid'} size={20} color={fg} weight="bold" />
          <Text style={[t.title, { color: c.text, flex: 1 }]} accessibilityRole="header">
            {use ? 'Use' : 'Avoid'} · {list.length}
          </Text>
          {list.length > 0 ? (
            <LinkButton
              label="Clear"
              muted
              onPress={use ? app.clearUse : app.clearAvoid}
              accessibilityLabel={`Clear ${use ? 'Use' : 'Avoid'} list`}
            />
          ) : null}
        </View>
        <Text style={[t.small, { color: c.textMuted, marginBottom: space.sm }]}>
          {use ? 'Every recipe must include all of these.' : 'Recipes with any of these are always hidden.'}
        </Text>

        <Card style={styles.card}>
          {list.length === 0 ? (
            <Text style={[t.body, styles.emptyText, { color: c.textMuted }]}>
              {use ? 'Nothing to use yet.' : 'Nothing avoided.'}
            </Text>
          ) : (
            list.map((id, i) => {
              const ing = ingredientIndex.byId.get(id);
              return (
                <View
                  key={id}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.divider }]}
                >
                  <View style={styles.flex}>
                    <Text style={[t.bodyStrong, { color: c.text }, !use && styles.strike]}>{ingredientName(id)}</Text>
                    {ing ? (
                      <Text style={[t.small, { color: c.textMuted }]}>{CATEGORY_LABELS[ing.category]}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => app.moveIngredient(id, use ? 'avoid' : 'use')}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${ingredientName(id)} to ${use ? 'Avoid' : 'Use'}`}
                    style={({ pressed }) => [styles.moveBtn, { backgroundColor: c.fill, opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Icon name="swap" size={14} color={c.text} />
                    <Text style={[t.small, { color: c.text, fontWeight: '600' }]}>{use ? 'Avoid' : 'Use'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => app.remove(id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${ingredientName(id)}`}
                    hitSlop={6}
                    style={styles.removeBtn}
                  >
                    <Icon name="close" size={16} color={c.textMuted} weight="semibold" />
                  </Pressable>
                </View>
              );
            })
          )}
        </Card>
      </View>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>{order.map(section)}</ScrollView>
      <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.divider }]}>
        <View style={styles.actions}>
          <Button
            label="Add more"
            variant="secondary"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
          <Button
            label={count === 0 ? 'See options' : `See ${count} ${count === 1 ? 'recipe' : 'recipes'}`}
            onPress={() => router.replace('/results')}
            style={styles.flex}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  section: { marginBottom: space.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  card: { paddingVertical: 0, paddingHorizontal: space.md },
  emptyText: { paddingVertical: space.lg, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 60, paddingVertical: space.sm },
  strike: { textDecorationLine: 'line-through' },
  moveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
  },
  removeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  actions: { flexDirection: 'row', gap: space.sm },
});
