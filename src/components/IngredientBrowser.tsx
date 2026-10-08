import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { INGREDIENTS, ingredientIndex } from '../data/catalog';
import { POPULAR_INGREDIENT_IDS } from '../data/ingredients';
import { CATEGORY_LABELS } from '../data/labels';
import { INGREDIENT_CATEGORIES, type Ingredient } from '../data/types';
import { searchIngredients } from '../logic/normalizeIngredient';
import { useColors } from '../theme/colors';
import { MIN_TOUCH, radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';
import { Chip, type ChipVariant } from './Chip';

const BY_CATEGORY = INGREDIENT_CATEGORIES.map(cat => ({
  cat,
  items: INGREDIENTS.filter(i => i.category === cat).sort((a, b) => a.name.localeCompare(b.name)),
}));
const POPULAR = POPULAR_INGREDIENT_IDS.map(id => ingredientIndex.byId.get(id)).filter((i): i is Ingredient => !!i);

type Props = {
  /** How each ingredient chip should look right now. */
  variantFor: (id: string) => ChipVariant;
  onPick: (id: string) => void;
  /** Accessibility hint for a chip, e.g. "Adds to Use list". */
  hintFor: (id: string) => string;
  /** Extra words for the chip's accessibility label, e.g. ", in pantry". */
  stateLabelFor?: (id: string) => string;
  /** Small muted hint after the name, e.g. "staple". */
  chipHintFor?: (id: string) => string | undefined;
  placeholder?: string;
  searchLabel: string;
  showPopular?: boolean;
};

/** Search box + Popular + category groups. One tap per ingredient, no extra screens. */
export function IngredientBrowser({
  variantFor,
  onPick,
  hintFor,
  stateLabelFor,
  chipHintFor,
  placeholder = 'Search ingredients...',
  searchLabel,
  showPopular = true,
}: Props) {
  const c = useColors();
  const [query, setQuery] = useState('');
  const hits = useMemo(() => searchIngredients(ingredientIndex, query), [query]);

  const chip = (ing: Ingredient, hint?: string) => {
    const v = variantFor(ing.id);
    return (
      <Chip
        key={ing.id}
        label={ing.name}
        hint={hint ?? chipHintFor?.(ing.id)}
        variant={v}
        selected={v !== 'neutral'}
        accessibilityLabel={`${ing.name}${stateLabelFor?.(ing.id) ?? ''}`}
        accessibilityHint={hintFor(ing.id)}
        onPress={() => {
          onPick(ing.id);
          if (query) setQuery('');
        }}
      />
    );
  };

  return (
    <View>
      <View style={[styles.searchBox, { backgroundColor: c.card, borderColor: c.chipBorder }]}>
        <Text style={{ color: c.textMuted, fontSize: 16 }}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          style={[styles.input, { color: c.text }]}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
          clearButtonMode="while-editing"
          accessibilityLabel={searchLabel}
        />
      </View>

      {query.trim() ? (
        <View style={styles.section}>
          {hits.length ? (
            <View style={styles.wrap}>{hits.map(h => chip(h.ingredient, h.matchedAlias ? `(${h.matchedAlias})` : undefined))}</View>
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
          {showPopular ? (
            <View style={styles.section}>
              <Text style={[t.label, styles.sectionLabel, { color: c.textMuted }]}>Popular</Text>
              <View style={styles.wrap}>{POPULAR.map(i => chip(i))}</View>
            </View>
          ) : null}
          {BY_CATEGORY.map(({ cat, items }) => (
            <View key={cat} style={styles.section}>
              <Text style={[t.label, styles.sectionLabel, { color: c.textMuted }]}>{CATEGORY_LABELS[cat]}</Text>
              <View style={styles.wrap}>{items.map(i => chip(i))}</View>
            </View>
          ))}
        </>
      )}
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
  textBtn: { minHeight: MIN_TOUCH, justifyContent: 'center', alignSelf: 'flex-start' },
});
