import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecipeCard } from '../../components/RecipeCard';
import { Button, Card, IconButton, LargeHeader, SectionLabel } from '../../components/ui';
import type { Recipe } from '../../data/types';
import { toResult } from '../../logic/matchRecipes';
import { useAppState } from '../../state/AppState';
import { useColors } from '../../theme/colors';
import { space } from '../../theme/spacing';
import { type as t } from '../../theme/typography';

/** Saved: recipes you wrote or changed, and your favorites. */
export default function SavedScreen() {
  const c = useColors();
  const app = useAppState();
  const mine = [...app.ownRecipes, ...app.editedIds.map(id => app.recipeById(id))].filter((r): r is Recipe => !!r);
  const favorites = app.favorites.map(id => app.recipeById(id)).filter((r): r is Recipe => !!r);
  const newRecipe = () => router.push('/edit');
  const card = (r: Recipe) => (
    <RecipeCard
      key={r.id}
      result={{ ...toResult(r, []), alsoNeed: [], staplesUsed: [] }}
      onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: r.id } })}
      isFavorite={app.isFavorite(r.id)}
      onToggleFavorite={() => app.toggleFavorite(r.id)}
      note={
        app.isEdited(r.id)
          ? { text: 'Your version of this recipe', tone: 'good' }
          : app.isOwn(r.id)
            ? { text: 'Your recipe', tone: 'good' }
            : undefined
      }
    />
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LargeHeader
          title="Saved"
          right={<IconButton icon="plus" filled accessibilityLabel="Write a new recipe" onPress={newRecipe} />}
        />
        <View style={styles.pad}>
          <SectionLabel text="Favorites" style={styles.firstLabel} />
          {favorites.length ? (
            <View style={styles.cards}>{favorites.map(card)}</View>
          ) : (
            <Card>
              <Text style={[t.body, { color: c.textMuted }]}>Tap the heart on any recipe to keep it here.</Text>
            </Card>
          )}

          <SectionLabel text="Your recipes" />
          {mine.length ? (
            <View style={styles.cards}>{mine.map(card)}</View>
          ) : (
            <Card style={styles.mineEmpty}>
              <Text style={[t.body, { color: c.textMuted }]}>
                Write your own, or tap the pencil on any recipe to save your version of it.
              </Text>
              <Button label="New recipe" icon="plus" variant="secondary" compact onPress={newRecipe} />
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  pad: { paddingHorizontal: space.lg },
  firstLabel: { marginTop: space.sm },
  cards: { gap: space.md },
  mineEmpty: { gap: space.md, alignItems: 'flex-start' },
});
