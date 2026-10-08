import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IngredientBrowser } from '../components/IngredientBrowser';
import { RECIPES, ingredientName } from '../data/catalog';
import { countCanMake } from '../logic/pantry';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

/** Edit the saved pantry: tap to add/remove. Saved instantly on the device. */
export default function PantryScreen() {
  const c = useColors();
  const app = useAppState();
  const { pantry } = app;
  const { staples } = app;
  const canMake = useMemo(() => countCanMake(RECIPES, app.effectivePantry, { meal: null, dishType: null }), [app.effectivePantry]);
  const stapleNames = [...staples].slice(0, 6).map(ingredientName).join(', ');

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={[t.body, styles.intro, { color: c.textMuted }]}>
          Tap everything you usually keep on hand. Tap again to remove. Only recipes where you have every required ingredient will show.
        </Text>

        <Pressable
          onPress={() => router.push('/staples')}
          accessibilityRole="button"
          accessibilityLabel={app.assumeStaples ? `Kitchen staples assumed: ${staples.size}. Edit` : 'Kitchen staples not assumed. Edit'}
          style={({ pressed }) => [styles.basics, { backgroundColor: c.herbSoft, borderColor: c.herb, opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[t.bodyStrong, { color: c.herbText }]}>
            {app.assumeStaples ? `✓ ${staples.size} kitchen staples assumed` : 'Kitchen staples not assumed'}
            <Text style={{ color: c.primary }}>  Edit</Text>
          </Text>
          {app.assumeStaples ? (
            <Text style={[t.small, { color: c.herbText }]} numberOfLines={1}>
              {stapleNames}
              {staples.size > 6 ? '…' : ''} — no need to add these.
            </Text>
          ) : null}
        </Pressable>

        <IngredientBrowser
          excludeFromSuggestions={staples}
          placeholder="Search to add to pantry..."
          searchLabel="Search ingredients to add to your pantry"
          variantFor={id => (pantry.includes(id) || staples.has(id) ? 'use' : 'neutral')}
          chipHintFor={id => (staples.has(id) && !pantry.includes(id) ? 'staple' : undefined)}
          stateLabelFor={id => (staples.has(id) && !pantry.includes(id) ? ', kitchen staple' : pantry.includes(id) ? ', in pantry' : '')}
          hintFor={id =>
            staples.has(id) && !pantry.includes(id)
              ? 'Stops assuming you have this staple'
              : pantry.includes(id)
                ? 'Removes it from your pantry'
                : 'Adds it to your pantry'
          }
          onPick={id => (staples.has(id) && !pantry.includes(id) ? app.toggleStaple(id) : app.togglePantry(id))}
        />

        {pantry.length > 0 ? (
          <Pressable onPress={app.clearPantry} accessibilityRole="button" style={styles.clear}>
            <Text style={[t.bodyStrong, { color: c.avoidText }]}>Clear pantry</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.divider }]}>
        <Text style={[t.small, { color: c.textMuted, marginBottom: space.sm }]}>
          {pantry.length} {pantry.length === 1 ? 'item' : 'items'} saved · {canMake} {canMake === 1 ? 'recipe' : 'recipes'} you can make
        </Text>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[t.bodyStrong, { color: c.primaryText, fontSize: 17 }]}>Done</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  intro: { paddingHorizontal: space.lg, paddingTop: space.sm },
  basics: { marginHorizontal: space.lg, marginTop: space.md, borderWidth: 1.5, borderRadius: radius.md, padding: space.md, gap: 2 },
  clear: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'center', marginTop: space.xl },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  primary: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
