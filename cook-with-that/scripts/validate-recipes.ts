/* Run: npm run validate — fails (exit 1) on any content problem. */
import { INGREDIENTS } from '../src/data/ingredients';
import { RECIPES } from '../src/data/recipes';
import { validateContent } from '../src/logic/validateContent';

const issues = validateContent(INGREDIENTS, RECIPES);
if (issues.length) {
  console.error(`✗ ${issues.length} content issue(s):`);
  for (const i of issues) console.error(`  - ${i.where}: ${i.message}`);
  process.exit(1);
}
const review = RECIPES.filter(r => /needs culinary review/i.test(r.source.note)).length;
console.log(`✓ ${RECIPES.length} recipes and ${INGREDIENTS.length} ingredients passed validation.`);
if (review) console.log(`  ⚠ ${review} recipe(s) still marked "needs culinary review" — must be human-checked before release.`);
