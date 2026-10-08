# Ingredient mappings

Search exposes one canonical ingredient; recipes still name the exact form on the
detail page. These are the deliberate broad mappings — anything not listed here is a
1:1 match. Review this list whenever an alias or mapping is added.

| Canonical ID | Covers in recipes | Why it's safe |
|---|---|---|
| `chicken` | breast, thigh (boneless, skinless) | Same animal; recipe card/detail always shows the cut. Not a promise they're interchangeable. |
| `onion` | yellow, red, white onion | Same vegetable; recipe names the color. |
| `tomato` | fresh tomatoes, cherry/grape tomatoes | Fresh only. **Canned tomatoes are a separate ID.** |
| `pasta` | spaghetti, penne, fettuccine, etc. | Shape named in recipe. Egg noodles are separate. |
| `rice` | cooked white/jasmine/long-grain | Recipe states cooked vs. raw. |
| `bread` | sandwich bread, whole-grain, rolls | Recipe names the bread. |
| `chicken_broth` | chicken broth / stock | Broccoli Cheddar Soup lists "chicken or vegetable broth" and is indexed as `chicken_broth`, so it is hidden when someone avoids chicken broth. |
| `berries` | blueberries, strawberries, raspberries | Only used as optional toppings so far. |

## Kept deliberately separate (never aliases)
- `garlic` vs `garlic_powder`
- `tomato` vs `canned_tomatoes` vs `tomato_paste`
- `milk` vs `heavy_cream` vs `coconut_milk`
- `lemon` (fresh) — bottled juice is not an alias
- `olive_oil` vs `vegetable_oil` vs `sesame_oil`
- `chicken_broth` vs `vegetable_broth`

The validator fails if any name/alias belongs to two ingredients.
