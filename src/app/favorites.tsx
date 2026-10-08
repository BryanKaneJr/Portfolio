import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { RecipeCard } from '../components/RecipeCard';
import { recipesById } from '../data/catalog';
import type { Recipe } from '../data/types';
import { toResult } from '../logic/matchRecipes';
import { useAppState } from '../state/AppState';
import { useColors } from '../theme/colors';
import { space } from '../theme/spacing';
import { type as t } from '../theme/typography';

export default function FavoritesScreen() {
  const c = useColors();
  const app = useAppState();
  const recipes = app.favorites.map(id => recipesById.get(id)).filter((r): r is Recipe => !!r);

  if (recipes.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: c.bg }]}>
        <Text style={{ fontSize: 40, color: c.primary }}>♡</Text>
        <Text style={[t.body, { color: c.textMuted, textAlign: 'center' }]}>Tap the heart on any recipe to save it here.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={recipes}
      keyExtractor={r => r.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
      renderItem={({ item }) => (
        <RecipeCard
          result={{ ...toResult(item, []), alsoNeed: [] }}
          onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id } })}
          isFavorite
          onToggleFavorite={() => app.toggleFavorite(item.id)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  list: { padding: space.lg, paddingBottom: space.xxl * 2 },
});
