import type { RecipeResult } from './matchRecipes';

/**
 * Stable, predictable ranking (build plan §7). Not personalised.
 *  1. Fewest missing requested ingredients (0 for exact results)
 *  2. Fewest additional required ingredients (assumed kitchen staples don't count)
 *  3. Shortest total time
 *  4. Title A→Z, then ID
 */
export function compareResults(a: RecipeResult, b: RecipeResult): number {
  return (
    a.missingIds.length - b.missingIds.length ||
    a.alsoNeed.length - b.alsoNeed.length ||
    a.totalMinutes - b.totalMinutes ||
    a.recipe.title.localeCompare(b.recipe.title) ||
    (a.recipe.id < b.recipe.id ? -1 : a.recipe.id > b.recipe.id ? 1 : 0)
  );
}
