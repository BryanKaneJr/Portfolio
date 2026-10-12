# r5-breakfast notes

Theme file: `src/data/originals/breakfast.ts` (`BREAKFAST_RECIPES`), 20 original recipes, all `source: ORIGINAL_DRAFT`.
`npm run check` passes in the worktree: typecheck, validator (568 recipes, 381 ingredients), jest 759/759.
Coverage report after the batch: pairs 98%, triples 68% (was 66%); breakfast recipes 62 → 82, bowls 33 → 38.

## Recipes added (and the gap each fills)

| id | Title | Gap / why |
|---|---|---|
| `shakshuka` | Shakshuka (Eggs Poached in Spiced Tomato Sauce) | Classic brunch dish the library lacked; title separates it from Menemen (Turkish scrambled eggs) |
| `loco-moco` | Loco Moco (Hawaiian Burger and Egg Rice Bowl) | **eggs + rice + ground beef** (all required) |
| `arroz-a-la-cubana` | Arroz a la Cubana (Rice with Tomato Sauce, Fried Eggs and Bananas) | **eggs + rice + tomato**: the sauce is made from grated fresh tomatoes, so it hits `tomato`, not `canned_tomatoes`. Spanish version, with banana (in the catalog) rather than plantain |
| `broccoli-and-egg-fried-rice` | Broccoli and Egg Fried Rice | **eggs + rice + broccoli** |
| `omurice` | Omurice (Japanese Chicken Omelet Rice) | eggs + rice + chicken; ketchup fried rice under an omelet |
| `tex-mex-migas` | Tex-Mex Migas with Crispy Tortilla Strips | Eggs + corn tortillas + Monterey Jack; different from the library's Chilaquiles (no sauce) |
| `buttermilk-biscuits-and-sausage-gravy` | Buttermilk Biscuits and Sausage Gravy | Southern classic; biscuits written in, so the dish is complete on its own |
| `corned-beef-hash-with-fried-eggs` | Corned Beef Hash with Fried Eggs | Uses cooked corned beef (pairs with the library's corned beef brisket recipe) |
| `potato-and-egg-breakfast-tacos` | Potato and Egg Breakfast Tacos | eggs + potato + tortillas |
| `cheddar-grits-with-fried-eggs` | Cheddar Grits with Fried Eggs | Second grits recipe; grits had only Shrimp and Grits |
| `croque-madame` | Croque Madame (Ham and Gruyère Sandwich with a Fried Egg) | Full sandwich; the library only has Croque-Monsieur Bites (appetizer) |
| `kedgeree` | Kedgeree (Curried Rice with Smoked Salmon and Eggs) | British breakfast; eggs + rice + smoked fish |
| `broccoli-potato-and-cheddar-frittata` | Broccoli, Potato and Cheddar Frittata | **eggs + potato + broccoli** (potato added as the list suggested) |
| `ham-and-swiss-breakfast-strata` | Ham and Swiss Breakfast Strata | "Ham and Cheese Breakfast Strata" from the list; named the cheese. Different from the sausage/cheddar casserole |
| `dutch-baby-pancake` | Dutch Baby Pancake with Lemon and Powdered Sugar | Oven pancake; skillet type per the pancake rule |
| `overnight-cinnamon-french-toast-bake` | Overnight Cinnamon French Toast Bake | Make-ahead bake; distinct from the skillet French Toast |
| `tomato-egg-and-cheddar-breakfast-quesadillas` | Tomato, Egg and Cheddar Breakfast Quesadillas | **eggs + tomato + cheddar** |
| `black-bean-and-egg-breakfast-bowls-with-rice` | Black Bean and Egg Breakfast Bowls with Rice | **eggs + rice + black beans** |
| `home-fries-with-peppers-and-onions` | Home Fries with Peppers and Onions | Side and breakfast; parboil-then-fry method, unlike Parmesan Potatoes |
| `savory-oatmeal-with-spinach-parmesan-and-a-fried-egg` | Savory Oatmeal with Spinach, Parmesan and a Fried Egg | Savory use of oats (oats were all sweet) |

## Skips and swaps (my list had 23 dishes; I needed 20, so no swaps-in were needed)

- **Potato, Spinach and Cheddar Frittata**: skipped. It's a near-duplicate of the library's *Hash Brown Vegetable
  Frittata* (VA), which is potato + spinach + peppers + cheddar in a frittata. That one uses `frozen_spinach`, so the
  potato + spinach + cheddar triple stays open on paper, but r5-comfort's *Twice-Baked Potatoes with Spinach and
  Cheddar* is assigned to fill it. Broccoli frittata kept potato, so there's still a potato frittata in my batch.
- **Steak and Eggs with Crispy Potatoes**: skipped. Too close to *Bitoque (Portuguese Steak and Egg)* plus *Steak with
  Garlic Butter and Pan Potatoes*, both already in the library.
- **Chicken Congee**: skipped. r5-world's list has *Arroz Caldo*, the Filipino chicken-and-ginger rice porridge; two
  chicken rice porridges in one round would be near-duplicates. If r5-world drops Arroz Caldo, Congee is worth adding later.

## Catalog additions

- `smoked_salmon` (protein, "Smoked salmon"), via `npm run import:catalog -- "smoked salmon"`. The key was already
  reviewed in `ingredient-map.ts` (`{ add: 'protein' }`, "not interchangeable with fresh salmon"), so the map is
  unchanged. Registered in `W/new-ingredients.txt`. No existing recipe's steps say "smoked salmon", so it causes no
  step-check collisions. Kedgeree calls for hot-smoked salmon; its steps say "the smoked salmon" every time, so
  the step checker never reads it as fresh `salmon`.

No other new ingredients. `plantain` (registered by r5-grill-fry) was not used: Arroz a la Cubana uses banana, as in Spain.

## Cook-test first

1. **Arroz a la Cubana**: the grated-fresh-tomato sauce (2 lb tomatoes reduced 25–30 min to about half) and the
   rice ratio (1 1/2 cups long-grain to 2 1/2 cups water, 18 min + 10 min rest). Check the sauce yield is enough for 4.
2. **Buttermilk Biscuits and Sausage Gravy**: 9 square biscuits from 2 1/2 cups flour patted to 6 by 9 inches at
   450°F (230°C) for 13–16 min; gravy is 1/3 cup flour + 1 tbsp butter + sausage fat to 3 cups milk. Check the gravy is
   thick enough (it thickens on standing).
3. **Kedgeree**: rinsed basmati at 1 1/2 cups to 2 1/4 cups water, 12 min covered + 10 min rest, with peas steamed on
   top during the rest.
4. **Dutch Baby**: 3 eggs, 2/3 cup each milk and flour, 10-inch skillet at 425°F (220°C) for 18–22 min.
5. **Overnight French Toast Bake and Ham and Swiss Strata**: bake times (45–55 and 50–60 min at 350°F / 175°C) from
   cold; both list 260 prep minutes (20 active plus the 4-hour minimum chill).
6. **Omurice**: the draped 2-egg omelet in a 10-inch pan; might want an 8-inch pan for a thicker, softer omelet.

## For the integrator

- Only two files changed: `src/data/originals/breakfast.ts` and `src/data/ingredients.ts` (+1 line, `smoked_salmon`).
  Run `npm run import:catalog -- "smoked salmon"` after copying the theme file in.
- Salt decisions (decision 14): no added salt in the Ham and Swiss Strata (ham and Swiss season it) or the Croque Madame
  (ham, Gruyère). Fried rice relies on soy sauce. Sausage gravy and corned beef hash say "add salt only if needed".
  The salt in those two recipes is for the biscuit dough and the potato cooking water.
- Step-wording fixes the checker forced: "the warm sauce" (not "the tomato sauce", which is the canned `tomato_sauce`)
  in Arroz a la Cubana, and "the diced Roma tomatoes" (not "diced tomatoes", a `canned_tomatoes` alias) in the quesadillas.
- Equipment: only the baseline. The Dutch Baby mentions a blender, or whisking by hand. A pastry blender is optional
  for the biscuits (fingertips work).
- Cotija uses an author-metric "1/4 cup (30 g)" because cotija has no grams-per-cup entry. Grits line is
  "1 cup (160 g)" for the same reason.
