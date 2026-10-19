/* Run: npm run validate — fails (exit 1) on any content problem. */
import { INGREDIENTS } from '../src/data/ingredients';
import { ALL_RECIPES, RECIPES } from '../src/data/recipes';
import { validateContent } from '../src/logic/validateContent';

// Recipes switched off are validated too, so they are ready if they come back.
const issues = validateContent(INGREDIENTS, ALL_RECIPES);
if (issues.length) {
  console.error(`✗ ${issues.length} content issue(s):`);
  for (const i of issues) console.error(`  - ${i.where}: ${i.message}`);
  process.exit(1);
}
const review = RECIPES.filter(r => /needs culinary review/i.test(r.source.note)).length;
const off = ALL_RECIPES.length - RECIPES.length;
console.log(
  `✓ ${RECIPES.length} recipes${off ? ` (+${off} switched off)` : ''} and ${INGREDIENTS.length} ingredients passed validation.`,
);
if (review)
  console.log(`  ⚠ ${review} recipe(s) still marked "needs culinary review" — must be human-checked before release.`);
