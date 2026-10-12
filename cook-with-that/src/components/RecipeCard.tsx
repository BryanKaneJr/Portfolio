import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ingredientName } from '../data/catalog';
import { DISH_TYPE_LABELS, MEAL_LABELS, shownDishTypes } from '../data/labels';
import type { Meal } from '../data/types';
import type { RecipeResult } from '../logic/matchRecipes';
import { useColors } from '../theme/colors';
import { radius, space } from '../theme/spacing';
import { type as t } from '../theme/typography';
import { DishIcon, Icon } from './Icon';

type Props = {
  result: RecipeResult;
  onPress: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  /** Close-match card: shows "Uses 2 of 3 · Doesn't use: Spinach". */
  close?: boolean;
  /** Meal to show in the meta line (the selected one, else the recipe's first). */
  meal?: Meal | null;
  /** Custom status line (pantry results, your versions). */
  note?: { text: string; tone: 'good' | 'warn' };
};

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/**
 * Short recipe card: a dish-type picture, the title, time · meal · type, the tagline, and one status line
 * ("Uses all 3 · 12 more ingredients"). The full ingredient list is on the recipe page.
 */
export function RecipeCard({ result, onPress, isFavorite, onToggleFavorite, close, meal, note }: Props) {
  const c = useColors();
  const { recipe, usesIds, missingIds, alsoNeed, staplesUsed, totalMinutes } = result;
  const requested = usesIds.length + missingIds.length;
  const metaMeal = meal && recipe.meals.includes(meal) ? meal : recipe.meals[0];
  const type = shownDishTypes(recipe).map(d => DISH_TYPE_LABELS[d])[0];
  const meta = [formatMinutes(totalMinutes), MEAL_LABELS[metaMeal], type].filter(Boolean).join(' · ');
  const requiredCount = recipe.ingredients.filter(i => !i.optional).length;
  const more = alsoNeed.length + staplesUsed.length;

  let status: { text: string; detail?: string; tone: 'good' | 'warn' | 'muted' };
  if (note) status = { text: note.text, tone: note.tone };
  else if (close)
    status = {
      text: `Uses ${usesIds.length} of ${requested}`,
      detail: `Doesn't use ${missingIds.map(ingredientName).join(', ')}`,
      tone: 'warn',
    };
  else if (usesIds.length > 0)
    status = {
      text: usesIds.length === 1 ? `Uses ${ingredientName(usesIds[0])}` : `Uses all ${usesIds.length}`,
      detail: more ? `${more} more ${more === 1 ? 'ingredient' : 'ingredients'}` : 'nothing else',
      tone: 'good',
    };
  else status = { text: `${requiredCount} ingredients`, tone: 'muted' };

  const toneColor = { good: c.herbText, warn: c.warnText, muted: c.textMuted }[status.tone];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}. ${meta}. ${status.text}${status.detail ? `, ${status.detail}` : ''}.`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.card, borderColor: c.cardBorder, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={styles.top}>
        <View style={[styles.tile, { backgroundColor: c.accentSoft }]}>
          <DishIcon recipe={recipe} size={26} color={c.accent} />
        </View>
        <View style={styles.flex}>
          <Text style={[t.heading, { color: c.text }]} numberOfLines={2}>
            {recipe.title}
          </Text>
          <View style={styles.meta}>
            <Icon name="clock" size={13} color={c.textMuted} />
            <Text style={[styles.metaText, { color: c.textMuted }]} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? `Remove ${recipe.title} from favorites` : `Save ${recipe.title} to favorites`
          }
          style={styles.heart}
        >
          <Icon name={isFavorite ? 'heartFill' : 'heart'} size={21} color={isFavorite ? c.accent : c.textFaint} />
        </Pressable>
      </View>

      <Text style={[t.small, styles.tagline, { color: c.textMuted }]} numberOfLines={2}>
        {recipe.description}
      </Text>

      <View style={styles.status}>
        {status.tone === 'good' ? <Icon name="check" size={14} color={toneColor} weight="bold" /> : null}
        <Text style={[styles.statusText, { color: toneColor }]} numberOfLines={2}>
          <Text style={styles.bold}>{status.text}</Text>
          {status.detail ? (
            <Text style={{ color: status.tone === 'warn' ? toneColor : c.textMuted }}> · {status.detail}</Text>
          ) : null}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.md + 2 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  tile: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { fontSize: 13, flexShrink: 1 },
  heart: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginTop: -6, marginRight: -6 },
  tagline: { marginTop: space.sm + 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: space.sm },
  statusText: { fontSize: 14, lineHeight: 19, flexShrink: 1 },
  bold: { fontWeight: '600' },
});
