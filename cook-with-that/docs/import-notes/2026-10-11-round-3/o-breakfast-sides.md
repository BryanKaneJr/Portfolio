# o-breakfast-sides: handoff notes

Theme file: `src/data/originals/breakfastSides.ts` (`BREAKFAST_SIDES_RECIPES`), 25 original recipes, all
`source: ORIGINAL_DRAFT`. In my worktree `npm run check` passes: 220 recipes, 264 ingredients, 387 tests.
Common 2-ingredient pairs went from 80% to 85% exact, and triples from 30% to 36% (`npm run coverage-report`).

## Read first: two existing steps had to change (integrator decision)

Two of my new catalog items appear as plain words in steps of two existing Based Cooking recipes. With those items in
the catalog, `tests/import.test.ts` ("every imported recipe lists each catalog ingredient its steps use") fails. Neither
step really uses the ingredient, so I changed one word in each **in my worktree only** to make `npm run check` pass.
These changes are **not** in my handoff files. Whoever merges `cornmeal` or `hot sauce` into the catalog has to apply
them (or some other wording) to `src/data/imported/basedCooking.ts`:

| Recipe | Was | Now |
|---|---|---|
| `southern-biscuits` | "…until the mixture looks like coarse **cornmeal** with a few pea-size bits." | "…looks like coarse **crumbs** with a few pea-size bits." |
| `chicken-paprikash` | "…whisk a ladle of the **hot sauce** into the sour cream…" | "…whisk a ladle of the **hot pan sauce** into the sour cream…" |

Other workers will run into the `hot sauce` one too (o-chicken's Buffalo Chicken Wraps, for example).

## Worktree setup note
My worktree was checked out at HEAD, which doesn't include the uncommitted round-3 prep in the main checkout
(`src/data/originals/`, `docs/original-recipes.md`, `tests/originals.test.ts`, units changes, the 195-recipe state). I
copied those files from `/home/user/Portfolio/cook-with-that` into the worktree before starting. The baseline then
passed (195 recipes, 362 tests). I didn't write anything to the main checkout.

## Recipes added (25)

**Breakfast (8)**
- Breakfast Burritos: eggs, potato, black beans, bell pepper and cheddar, all required. Fills **black beans + eggs**,
  **black beans + potato** and **black beans + bell pepper**. Includes a freeze-and-reheat step.
- Veggie Egg Muffins (my own dish, replacing Soft Scrambled Eggs): broccoli, spinach, bell pepper and cheddar, all
  required. Fills **broccoli + spinach**, **broccoli + bell pepper** and **spinach + bell pepper**.
- Western Omelette: ham, green pepper, onion and cheddar, two 3-egg omelettes.
- Sausage and Egg Breakfast Casserole: with spinach and red pepper (also **spinach + bell pepper**). Can sit overnight.
- Baked Berry Oatmeal
- Egg and Cheese English Muffin Sandwiches: vegetarian, with no optional meat (a meat filling isn't a garnish).
- Avocado Toast with Fried Egg
- Classic Waffles: **needs a waffle iron**, which goes beyond the docs' "oven, stovetop, sheet pans and a blender at
  most" line. I kept it because it's on the assigned list and Sweep skips Based Cooking's `basic-waffles` for that
  reason, so otherwise the library would have no waffles. The first step says to heat a waffle iron. Drop it if the
  equipment rule is strict. No dish type (like the pancakes).

**Sides (10)**: Roasted Broccoli with Parmesan · Rice Pilaf · Skillet Cornbread · Garlic Bread · Roasted Root
Vegetables · Creamed Spinach (fresh spinach, so it counts for "spinach") · Boston Baked Beans (dried navy beans; the
quick soak is built into the times, overnight soak given as an option) · Scalloped Potatoes (cream sauce, no cheese, so
it's distinct from the library's Cheesy Ham and Potato Bake) · Roasted Brussels Sprouts (balsamic and honey) ·
Cilantro Lime Rice.

**Snacks and appetizers (7)**: Deviled Eggs · Tomato Bruschetta · Spinach Artichoke Dip (fresh baby spinach rather than
frozen, so "spinach" searches find it) · Loaded Nachos with Black Beans (tomato is required, which fills **black beans +
tomato**) · Buffalo Chicken Wings (oven-baked, using the baking-powder method; the blue cheese dip is optional) · Stuffed
Mushrooms · Pico de Gallo.

## Skipped from my list (29 listed, 25 written)
- **Soft Scrambled Eggs:** a near-duplicate of the seed recipe Spinach & Feta Scrambled Eggs. I swapped in Veggie Egg
  Muffins because it fills three gap pairs.
- **Crispy Hash Browns:** a near-duplicate of the library's Rösti with Fried Eggs (same shredded, squeezed potato fried
  in a skillet).
- **Corn on the Cob with Herb Butter**, **Honey-Glazed Carrots** and **Crispy Roasted Chickpeas:** list surplus. They
  are the thinnest dishes, fill no gap pairs, and their main ingredients are already well covered (roasted root
  vegetables use carrots; the library has plenty of chickpea recipes). Any of them is a fine later addition.

## Catalog additions (10; see catalog-keys.txt and map-entries.ts.txt)
New map keys, registered in `W/new-ingredients.txt`: `artichoke hearts` (pantry), `navy beans` (protein), `cornmeal`
(grain), `parsnip` (produce), `brussels sprouts` (produce). Same keys as o-soups-salads: `tortilla chips` (grain) and
`blue cheese` (dairy). Keys that were already reviewed and that I put in the catalog: `hot sauce` (spice),
`mustard powder` (spice, alias "dry mustard") and `buttermilk` (dairy).

## For the integrator and culinary reviewer
- **Metric:** cornmeal isn't in `GRAMS_PER_CUP`, so the Skillet Cornbread line reads "1 cup (140 g)" and the metric
  display uses that figure. If cornmeal gets an entry, about 140 g per cup (fine or medium grind) fits. Buttermilk and
  molasses show in ml, which is fine. Every other line converts cleanly; I checked each recipe's metric rendering.
- **Chicken wings** use the `chicken` ID (display name "chicken wings…"), following the broad chicken mapping. I added
  no "chicken wings" map key.
- **Bacon in the baked beans:** salt pork is the traditional choice, but I wrote the recipe with thick-cut bacon on
  purpose, not as a mapping.
- **Things to check when cooking:**
  - wing timing (30 min at 250°F, then 45–50 min at 425°F)
  - whether the bean simmer time suits older dried beans (45–60 min; old beans may need longer before baking)
  - scalloped potato doneness in a 9-by-13-inch dish (40 min covered, then 30–40 uncovered)
  - egg muffin release from a well-greased tin (no liners)
- **Food safety:** sausage and the egg dishes give 160°F / 71°C, and the wings give 165°F / 74°C.
- **Gap pairs still open after my batch:** rice + spinach, potato + broccoli, tomato + broccoli, spinach + black beans,
  black beans + broccoli, black beans + chicken, chicken + cheddar, ground beef + broccoli or spinach. Other workers'
  lists cover most of these. Nothing on any list targets tomato + broccoli or spinach + black beans.
