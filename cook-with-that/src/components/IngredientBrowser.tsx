import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { INGREDIENTS, ingredientIndex } from '../data/catalog';
import { CATEGORY_LABELS } from '../data/labels';
import { INGREDIENTS_BY_POPULARITY, SUGGESTION_PAGE } from '../data/popularity';
import { INGREDIENT_CATEGORIES, type Ingredient } from '../data/types';
import { searchIngredients } from '../logic/normalizeIngredient';
import { usePickerConfig, type PickerTarget } from '../state/pickerTarget';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';
import { Chip } from './Chip';

const BY_CATEGORY = INGREDIENT_CATEGORIES.map(cat => ({
  cat,
  items: INGREDIENTS.filter(i => i.category === cat).sort((a, b) => a.name.localeCompare(b.name)),
}));
const RANKED = INGREDIENTS_BY_POPULARITY.map(id => ingredientIndex.byId.get(id)).filter((i): i is Ingredient => !!i);

type Props = {
  target: PickerTarget;
  /**
   * compact: search + the top suggestions + a "More options" button that opens the full screen.
   * full:    search + every suggestion + all ingredients grouped by category (the full screen).
   */
  layout: 'compact' | 'full';
  /** Render the search box (the full screen renders its own sticky one). */
  query?: string;
  onQueryChange?: (q: string) => void;
  hideSearch?: boolean;
};

export function IngredientBrowser({ target, layout, query: controlledQuery, onQueryChange, hideSearch }: Props) {
  const c = useColors();
  const cfg = usePickerConfig(target);
  const [localQuery, setLocalQuery] = useState('');
  const query = controlledQuery ?? localQuery;
  const setQuery = onQueryChange ?? setLocalQuery;

  const suggestions = useMemo(
    () => RANKED.filter(i => !cfg.excludeFromSuggestions.has(i.id)),
    [cfg.excludeFromSuggestions],
  );
  const hits = useMemo(() => searchIngredients(ingredientIndex, query), [query]);
  const visible = layout === 'compact' ? suggestions.slice(0, SUGGESTION_PAGE) : suggestions;

  const chip = (ing: Ingredient, hint?: string) => {
    const v = cfg.variantFor(ing.id);
    return (
      <Chip
        key={ing.id}
        label={ing.name}
        hint={hint ?? cfg.chipHintFor(ing.id)}
        variant={v}
        selected={v !== 'neutral'}
        accessibilityLabel={`${ing.name}${cfg.stateLabelFor(ing.id)}`}
        accessibilityHint={cfg.hintFor(ing.id)}
        onPress={() => {
          cfg.onPick(ing.id);
          if (query) setQuery('');
        }}
      />
    );
  };

  return (
    <View>
      {hideSearch ? null : (
        <SearchBox value={query} onChange={setQuery} placeholder={cfg.placeholder} label={cfg.searchLabel} />
      )}

      {query.trim() ? (
        <View style={styles.section}>
          {hits.length ? (
            <View style={styles.wrap}>
              {hits.map(h => chip(h.ingredient, h.matchedAlias ? `(${h.matchedAlias})` : undefined))}
            </View>
          ) : (
            <View style={styles.noIng}>
              <Text style={[t.body, { color: c.text }]}>No ingredient found for “{query.trim()}”.</Text>
              <Pressable onPress={() => setQuery('')} accessibilityRole="button" style={styles.textBtn}>
                <Text style={[t.bodyStrong, { color: c.primary }]}>Clear search</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={[t.label, styles.sectionLabel, { color: c.textMuted }]}>Most common</Text>
            <View style={styles.wrap}>{visible.map(i => chip(i))}</View>
            {layout === 'compact' ? (
              <Pressable
                onPress={() => router.push({ pathname: '/ingredients', params: { for: target } })}
                accessibilityRole="button"
                accessibilityLabel="More options"
                accessibilityHint="Opens every ingredient to scroll through"
                style={({ pressed }) => [
                  styles.moreBtn,
                  { borderColor: c.chipBorder, backgroundColor: c.card, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[t.bodyStrong, { color: c.primary }]}>More options</Text>
                <Text style={[t.small, { color: c.textMuted }]}> {INGREDIENTS.length} ingredients ›</Text>
              </Pressable>
            ) : null}
          </View>

          {layout === 'full'
            ? BY_CATEGORY.map(({ cat, items }) => (
                <View key={cat} style={styles.section}>
                  <Text style={[t.label, styles.sectionLabel, { color: c.textMuted }]}>{CATEGORY_LABELS[cat]}</Text>
                  <View style={styles.wrap}>{items.map(i => chip(i))}</View>
                </View>
              ))
            : null}
        </>
      )}
    </View>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (q: string) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
}) {
  const c = useColors();
  return (
    <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.chipBorder }]}>
      <Text style={{ color: c.textMuted, fontSize: 16 }}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        style={[styles.input, { color: c.text }]}
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        returnKeyType="done"
        clearButtonMode="while-editing"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    minHeight: 48,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: space.sm },
  section: { marginTop: space.lg, paddingHorizontal: space.lg },
  sectionLabel: { marginBottom: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  noIng: { gap: space.xs },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH + 4,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    marginTop: space.md,
  },
  textBtn: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
});
