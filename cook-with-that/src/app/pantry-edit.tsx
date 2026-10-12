import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { IngredientBrowser } from '../components/IngredientBrowser';
import { Button } from '../components/ui';
import { ingredientName } from '../data/catalog';
import { countCanMake } from '../logic/pantry';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

/** Edit the saved pantry (from the Pantry tab): tap to add or remove. Saved instantly on the device. */
export default function PantryScreen() {
  const c = useColors();
  const app = useAppState();
  const { pantry } = app;
  const { staples } = app;
  const canMake = useMemo(
    () => countCanMake(app.library, app.effectivePantry, { meal: null, dishType: null }),
    [app.library, app.effectivePantry],
  );
  const stapleNames = [...staples].slice(0, 6).map(ingredientName).join(', ');

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[t.body, styles.intro, { color: c.textMuted }]}>
          Tap everything you usually keep on hand, and tap again to remove it. The Pantry tab shows recipes you have
          every required ingredient for.
        </Text>

        <Pressable
          onPress={() => router.push('/staples')}
          accessibilityRole="button"
          accessibilityLabel={
            app.assumeStaples ? `Kitchen staples assumed: ${staples.size}. Edit` : 'Kitchen staples not assumed. Edit'
          }
          style={({ pressed }) => [
            styles.basics,
            { backgroundColor: c.card, borderColor: c.cardBorder, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon
            name={app.assumeStaples ? 'checkCircle' : 'circle'}
            size={22}
            color={app.assumeStaples ? c.herb : c.textFaint}
          />
          <View style={styles.flex}>
            <Text style={[t.bodyStrong, { color: c.text }]}>
              {app.assumeStaples ? `${staples.size} kitchen staples counted` : 'Kitchen staples not counted'}
            </Text>
            {app.assumeStaples ? (
              <Text style={[t.small, { color: c.textMuted }]} numberOfLines={1}>
                {stapleNames}
                {staples.size > 6 ? '…' : ''}
              </Text>
            ) : null}
          </View>
          <Icon name="chevronRight" size={15} color={c.textMuted} weight="semibold" />
        </Pressable>

        <IngredientBrowser target="pantry" layout="compact" />

        {pantry.length > 0 ? (
          <View style={styles.clear}>
            <Button label="Clear pantry" variant="danger" compact onPress={app.clearPantry} />
          </View>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.divider }]}>
        <Text style={[t.small, { color: c.textMuted, marginBottom: space.sm }]}>
          {pantry.length} {pantry.length === 1 ? 'item' : 'items'} saved · {canMake}{' '}
          {canMake === 1 ? 'recipe' : 'recipes'} you can make
        </Text>
        <Button label="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/pantry'))} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  intro: { paddingHorizontal: space.lg, paddingTop: space.sm },
  basics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    marginTop: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.md,
  },
  clear: { alignItems: 'center', marginTop: space.xl },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
});
