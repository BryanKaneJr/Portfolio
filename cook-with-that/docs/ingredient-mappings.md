# Ingredient mappings

Search exposes one canonical ingredient; recipes still name the exact form on the
detail page. These are the deliberate broad mappings — anything not listed here is a
1:1 match. Review this list whenever an alias or mapping is added.

| Canonical ID | Covers in recipes | Why it's safe |
|---|---|---|
| `chicken` | breast, thigh, legs, drumsticks, tenders | Same animal; recipe card/detail always shows the cut. Not a promise they're interchangeable. |
| `onion` | yellow, red, white onion | Same vegetable; recipe names the color. |
| `tomato` | fresh tomatoes, cherry/grape tomatoes | Fresh only. **Canned tomatoes are a separate ID.** |
| `pasta` | spaghetti, penne, macaroni, fusilli, fettuccine, angel hair, shells, etc. | Shape named in recipe. Egg noodles are separate. |
| `rice` | cooked white/jasmine/long-grain | Recipe states cooked vs. raw. |
| `bread` | sandwich bread, white, whole-grain, baguette, rolls | Recipe names the bread. |
| `lemon`, `lime` | the fruit, its juice and zest | Recipes say "lemon juice" meaning squeezed from the fruit, and import maps it here, so searching "lemon juice" finds Lemon (and Avoid catches it). Bottled juice is still not promised to work. |
| `eggs` | whole eggs, whites, yolks | Same food; the recipe says which part. |
| `salt` | table, kosher, sea, flaky | Recipe names the salt. |
| `sugar` | granulated, caster/superfine | Caster is granulated sugar ground finer; British recipes use it where US ones say sugar. |
| `vegetable_oil` | neutral oil: canola/rapeseed, sunflower, cooking spray | Any neutral cooking oil. Olive and sesame oil stay separate. |
| `bacon` | US bacon, British streaky bacon, rashers | Same cut. Canadian bacon is separate. |
| `tortillas` | flour tortillas, wraps | Recipe names the size. |
| `chicken_broth` | chicken broth / stock | Broccoli Cheddar Soup lists "chicken or vegetable broth" and is indexed as `chicken_broth`, so it is hidden when someone avoids chicken broth. |
| `berries` | blueberries, strawberries, raspberries | Recipe names the berry. |
| `apple` | any variety (Golden Delicious, Granny Smith) | Recipe names the variety. |
| `corn` | fresh ears, frozen or canned kernels | Recipe says which. |
| `yeast` | active dry, instant | Recipe names the type; the two swap with small technique changes. |
| `rosemary` | fresh or dried | Like `thyme`: woody herbs are used either way. (Basil is not: `basil` is fresh, `dried_basil` separate.) |

## Kept deliberately separate (never aliases)
- `garlic` vs `garlic_powder`
- `tomato` vs `canned_tomatoes` vs `tomato_paste`
- `milk` vs `heavy_cream` vs `coconut_milk`
- `lemon` (fresh fruit, juice, zest) vs bottled lemon juice, which isn't in the catalog
- `olive_oil` vs `vegetable_oil` vs `sesame_oil`
- `chicken_broth` vs `vegetable_broth`
- `ginger` (fresh root) vs `ground_ginger`
- `black_pepper` (ground) vs `peppercorns` (whole); `cayenne_pepper` vs `chili_powder`
- `rice` (white) vs `brown_rice` vs `arborio_rice`
- `canned_tomatoes` vs `marinara_sauce` vs `tomato_sauce`
- `parmesan` vs `pecorino_romano`
- `lentils` (brown/green) vs `red_lentils`

Ingredients added for imported recipes are reviewed in `scripts/import/ingredient-map.ts` first, and the same rules apply
there (see `docs/recipe-import.md`).

The validator fails if any name/alias belongs to two ingredients.

## How search reads what people type
`searchIngredients` (`src/logic/normalizeIngredient.ts`) matches names and aliases, so aliases are also how people
find things: everyday and British names belong here (courgette, caster sugar, streaky bacon, yoghurt), as long as
they're the same food. On top of the aliases:
- **Plurals:** "eggplants", "berry" and "tomatoes" match either form.
- **Describing words:** if nothing matches, words like "unsalted", "extra virgin", "boneless", "large" or "shredded"
  are dropped ("unsalted butter" → Butter). Words that change the food are never dropped: dried, ground, canned,
  smoked, chopped (British "chopped tomatoes" are tinned) or minced (British "minced pork" is ground pork).
- **Typos:** if still nothing, one typo is allowed in words of 6+ letters and two in words of 8+ ("brocoli",
  "parmesean"). Shorter words get none, so "pear" never shows Peas.
`tests/searchAudit.test.ts` checks every name, alias and plural, a list of common misspellings, and near-misses that
must stay unmatched.
