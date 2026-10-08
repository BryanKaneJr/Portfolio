import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IngredientBrowser, SearchBox } from '../components/IngredientBrowser';
import { UseAvoidToggle } from '../components/UseAvoidToggle';
import { ingredientName } from '../data/catalog';
import { useAppState } from '../state/AppState';
import { isPickerTarget, usePickerConfig, type PickerTarget } from '../state/pickerTarget';
import { useColors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

const TITLES: Record<PickerTarget, string> = {
  pick: 'All ingredients',
  pantry: 'Add to pantry',
  staples: 'Add staples',
};

/**
 * "More options": every ingredient in one long scroll — most common first, then
 * grouped by category — with search pinned to the top. Taps apply immediately to the
 * same list the previous screen was editing; Done just goes back.
 */
export default function AllIngredientsScreen() {
  const c = useColors();
  const app = useAppState();
  const params = useLocalSearchParams<{ for?: string }>();
  const target: PickerTarget = isPickerTarget(params.for) ? params.for : 'pick';
  const cfg = usePickerConfig(target);
  const [query, setQuery] = useState('');

  const summary =
    target === 'pick'
      ? summarize(app.search.useIds, 'Use') + ' · ' + summarize(app.search.avoidIds, 'Avoid')
      : target === 'pantry'
        ? `${app.pantry.length} in your pantry${app.assumeStaples ? ' + staples' : ''}`
        : `${app.stapleIds.length} staples`;

  return (
    <View style={[styles.flex, { backgroundColor: c.bg }]}>
      <Stack.Screen options={{ title: TITLES[target] }} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Sticky header: search (+ Use/Avoid switch when picking) */}
        <View style={[styles.sticky, { backgroundColor: c.bg, borderBottomColor: c.divider }]}>
          {target === 'pick' ? <UseAvoidToggle compactHint /> : null}
          <SearchBox value={query} onChange={setQuery} placeholder={cfg.placeholder} label={cfg.searchLabel} />
        </View>

        <IngredientBrowser target={target} layout="full" query={query} onQueryChange={setQuery} hideSearch />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: c.bg, borderTopColor: c.divider }]}>
        <Text style={[t.small, { color: c.textMuted, marginBottom: space.sm }]} numberOfLines={2}>
          {summary}
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

function summarize(ids: string[], label: string): string {
  if (ids.length === 0) return `${label}: none`;
  const names = ids.map(ingredientName);
  return `${label}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  sticky: { paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  primary: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
