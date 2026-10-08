import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ingredientName } from '../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS } from '../data/labels';
import type { Meal } from '../data/types';
import type { RecipeResult } from '../logic/matchRecipes';
import { useColors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';

type Props = {
  result: RecipeResult;
  onPress: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  /** Close-match card: shows "Uses 2 of 3 · Doesn't use: Spinach". */
  close?: boolean;
  /** Meal to show in the meta line (the selected one, else the recipe's first). */
  meal?: Meal | null;
  /** Custom status line (used by pantry mode). */
  note?: { text: string; tone: 'good' | 'warn' };
};

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function RecipeCard({ result, onPress, isFavorite, onToggleFavorite, close, meal, note }: Props) {
  const c = useColors();
  const { recipe, usesIds, missingIds, alsoNeed, totalMinutes } = result;
  const requested = usesIds.length + missingIds.length;
  const metaMeal = meal && recipe.meals.includes(meal) ? meal : recipe.meals[0];
  const meta = [formatMinutes(totalMinutes), MEAL_LABELS[metaMeal], recipe.dishTypes[0] && DISH_TYPE_LABELS[recipe.dishTypes[0]]]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}. ${meta}.${note ? ` ${note.text}.` : ''}${close ? ` Uses ${usesIds.length} of ${requested}. Doesn't use ${missingIds.map(ingredientName).join(', ')}.` : ''}`}
      style={({ pressed }) => [styles.card, { backgroundColor: c.card, borderColor: c.cardBorder, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={[t.heading, { color: c.text }]}>{recipe.title}</Text>
          <Text style={[t.small, { color: c.textMuted, marginTop: 2 }]}>{meta}</Text>
        </View>
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? `Remove ${recipe.title} from favorites` : `Save ${recipe.title} to favorites`}
          style={styles.heart}
        >
          <Text style={[styles.heartText, { color: isFavorite ? c.primary : c.textMuted }]}>{isFavorite ? '♥' : '♡'}</Text>
        </Pressable>
      </View>

      <Text style={[t.small, { color: c.text, marginTop: space.sm }]} numberOfLines={2}>
        {recipe.description}
      </Text>

      {close ? (
        <View style={[styles.closeBox, { backgroundColor: c.warnSoft }]}>
          <Text style={[t.small, { color: c.warnText, fontWeight: '700' }]}>
            Uses {usesIds.length} of {requested}
            <Text style={{ fontWeight: '400' }}> · Doesn't use: </Text>
            {missingIds.map(ingredientName).join(', ')}
          </Text>
        </View>
      ) : null}

      {note ? (
        <View style={[styles.closeBox, { backgroundColor: note.tone === 'good' ? c.herbSoft : c.warnSoft }]}>
          <Text style={[t.small, { color: note.tone === 'good' ? c.herbText : c.warnText, fontWeight: '700' }]}>{note.text}</Text>
        </View>
      ) : null}

      {usesIds.length > 0 ? (
        <Text style={[t.small, styles.line, { color: c.herbText }]}>
          <Text style={styles.bold}>✓ Uses: </Text>
          {usesIds.map(ingredientName).join(', ')}
        </Text>
      ) : null}
      {alsoNeed.length > 0 ? (
        <Text style={[t.small, styles.line, { color: c.textMuted }]} numberOfLines={3}>
          <Text style={[styles.bold, { color: c.text }]}>You'll also need: </Text>
          {alsoNeed.map(i => ingredientName(i.ingredientId)).join(', ')}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  heart: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginTop: -8, marginRight: -8 },
  heartText: { fontSize: 24 },
  line: { marginTop: space.xs + 2 },
  bold: { fontWeight: '700' },
  closeBox: { marginTop: space.sm, paddingHorizontal: space.sm + 2, paddingVertical: space.xs + 2, borderRadius: radius.sm, alignSelf: 'flex-start' },
});
