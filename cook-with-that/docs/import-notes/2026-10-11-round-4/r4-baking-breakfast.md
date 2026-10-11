# r4-baking-breakfast: notes

Theme file: `src/data/originals/bakingBreakfast.ts` (`BAKING_BREAKFAST_RECIPES`). A full copy is next to this file.
I wrote all 20 from my own cooking knowledge. I did not search for or open a published recipe for any of these dishes.
Every recipe uses `source: ORIGINAL_DRAFT`.

`npm run check` in my worktree passes: 462 recipes, 354 ingredients, 10 suites and 648 tests.

## What I added (20), in list order

| # | Title | Meals | Dish type | Gap it fills |
|---|---|---|---|---|
| 1 | Red Velvet Cupcakes | dessert, snack | baked_goods | Only vanilla cupcakes existed. First use of buttermilk in a cake. |
| 2 | Tres Leches Cake | dessert | baked_goods | No Latin American cake. Uses evaporated milk and condensed milk together. |
| 3 | Churros with Chocolate Sauce | dessert, snack | none fits | The library had no fried dessert. |
| 4 | Marshmallow Crispy Rice Treats | dessert, snack | none fits | Classic no-bake treat, made with browned butter and extra marshmallow. |
| 5 | Chocolate Fudge | dessert, snack | none fits | Quick condensed-milk fudge with no thermometer (different from brigadeiros). |
| 6 | No-Bake Peanut Butter Bars | dessert, snack | none fits | Peanut butter dessert that needs no oven. |
| 7 | S'mores Bars | dessert, snack | baked_goods | Graham cookie base, milk chocolate, broiled marshmallows. |
| 8 | Vanilla Panna Cotta | dessert | none fits | First gelatin-set dessert. |
| 9 | Cherry Pie | dessert | baked_goods | Lattice fruit pie (the library had apple, pumpkin, pecan and key lime). |
| 10 | Gingerbread Cookies | dessert, snack | baked_goods | Holiday cut-outs with molasses, ground ginger and cloves. |
| 11 | Almond Biscotti | dessert, snack | baked_goods | Twice-baked cookie. Uses almonds as the main ingredient. |
| 12 | Zucchini Bread | breakfast, dessert, snack | baked_goods | A sweet use for zucchini (the library's zucchini recipes are all savory). |
| 13 | Irish Soda Bread | breakfast, side | baked_goods | Bread with no yeast. Four ingredients. |
| 14 | Rosemary Focaccia | side, snack, appetizer | baked_goods | No-knead yeast bread made in a 9-by-13 pan. |
| 15 | Apple Turnovers | breakfast, dessert, snack | baked_goods | Second sweet use of store-bought puff pastry. |
| 16 | Bakewell Tart | dessert, snack | baked_goods | British tart with a jam layer and an almond sponge. |
| 17 | Double Chocolate Cookies | dessert, snack | baked_goods | Cocoa cookie with chocolate chips (different from Chocolate Chip Cookies). |
| 18 | Lemon Poppy Seed Muffins | breakfast, snack | baked_goods | Lemon muffin made with sour cream. |
| 19 | Apple Cinnamon Muffins | breakfast, snack | baked_goods | Apple breakfast bake with a streusel top. |
| 20 | Chilaquiles | breakfast, lunch, dinner | skillet | Mexican egg breakfast built on corn tortillas. |

## Skips and swaps
- **None skipped as duplicates.** I checked every title on my list against `library-titles.txt` and the other three
  lists, and none duplicates a library recipe or another list.
- **Not written:** Dutch Baby Pancake, Ham and Cheese Breakfast Strata and Chewy Granola Bars. They are items 21–23,
  after the first 20. All three would be good later. The strata and the granola bars use only catalog ingredients
  (ham, bread, eggs, cheddar, milk; oats, honey, peanut butter), and both have a dish type.

## Five recipes have no dish type
Churros, Crispy Rice Treats, Fudge, No-Bake Peanut Butter Bars and Panna Cotta. None of the nine dish types fits them
honestly, because none is baked or one of the savory types. The library already has 39 recipes like this, and these
make 44. If the owner adds a type such as "no-bake" or "candy" later, all five fit it.

## New catalog keys (8)
I registered all eight in `W/new-ingredients.txt` first, and nobody else had them. They were added with
`npm run import:catalog`.

| Key | Category | Aliases | Used by |
|---|---|---|---|
| red food coloring | pantry | red food colouring | Red Velvet Cupcakes |
| marshmallows | pantry | mini marshmallows, miniature marshmallows | Crispy Rice Treats, S'mores Bars |
| crisp rice cereal | grain | crispy rice cereal, rice krispies | Crispy Rice Treats |
| unflavored gelatin | pantry | gelatin, gelatine, powdered gelatin | Panna Cotta |
| cherries | produce | tart cherries, sour cherries | Cherry Pie |
| almond extract | pantry | none | Cherry Pie, Biscotti, Bakewell Tart |
| poppy seeds | pantry | none | Lemon Poppy Seed Muffins |
| almond flour | grain | ground almonds (the British name) | Bakewell Tart |

Collision checks for the integrator:
- I grepped every recipe file for these words in steps and found none. "cherry tomatoes" in steps is safe because it is
  already a Tomato alias, and the longer name wins. The words "cherry" and "almond" on their own are not terms.
- Every recipe step that mentions "rice cereal" says "crisp rice cereal" or just "the cereal". A bare "rice" would read
  as white rice.
- `gelatin` is now an alias. If a VA or NHLBI import has "gelatin" in its steps (sugar-free gelatin desserts, for
  example), it will need this item listed or the wording changed.
- `import:catalog` wrote the marshmallows, crisp rice cereal and gelatin lines in `ingredients.ts` longer than
  Prettier's width. The integrator re-runs `import:catalog` anyway, so I left them as written.

## Equipment beyond oven, stovetop, sheet pans and blender
- A hand or stand mixer for the cupcakes, tres leches (whipped egg whites), s'mores bars, gingerbread, Bakewell tart
  and cookies. Earlier originals assume one too.
- **Churros:** a piping bag with a large open star tip (about 1/2 inch) and a deep-fry thermometer. The star ridges
  help the churros cook through and keep them from bursting.
- **Bakewell Tart:** a 9-inch tart pan with a removable bottom, and pie weights for blind baking.
- Pans: a 12-cup muffin tin, a 9-by-5-inch loaf pan, a 9-inch pie plate, square 8-inch and 9-inch pans, and a
  9-by-13-inch pan (metal for the focaccia and s'mores bars). The panna cotta needs six small ramekins or glasses.
- **S'mores Bars:** the broiler. Use a metal pan lined with foil, not parchment.

## For the culinary reviewer (what to cook-test first)
- **Cherry Pie:** the juice is drained off, thickened with 1/4 cup cornstarch on the stove, then folded back into the
  cherries.
  - Frozen tart cherries give plenty of juice.
  - Fresh sweet cherries give little juice in 30 minutes, so the recipe tops it up with water to 1/2 cup. The gel will
    be very thick but should loosen as the cherries bake.
  - Check that the filling sets and isn't gluey either way. Sugar is 3/4 cup for sweet cherries and 1 cup for tart.
- **Vanilla Panna Cotta:** 1 envelope (2 1/4 tsp) of gelatin to 2 3/4 cups of dairy. That is about 1.1%, aimed to
  unmold after 6 hours and still wobble. Confirm it unmolds cleanly.
- **Rosemary Focaccia:** all-purpose flour (not bread flour, to avoid another catalog item), 500 g of flour to 420 ml
  of water, about 84% hydration. It's made with four sets of folds and two rises. Check that the dough handles
  without bread flour.
- **Almond Biscotti:** 2 cups flour, 3/4 cup sugar, 2 eggs and 4 tbsp melted butter. The dough should be stiff but
  shapeable with floured hands. The second bake stands the slices upright at 325°F (165°C) so they don't need turning.
- **Churros:** a stiff choux-style dough (1 cup water, 4 tbsp butter, 1 cup flour, 2 eggs), fried at 350°F (175°C)
  for 4–5 minutes. Check that the centers cook through.
- **Tres Leches:** a 5-egg separated sponge in a 9-by-13-inch dish. The soak is a 12 oz can of evaporated milk, a
  14 oz can of condensed milk and 1/2 cup of cream. Check how much soak the cake absorbs.
- **Irish Soda Bread:** a traditional four-ingredient loaf with 1 tsp baking soda to 500 g of flour. It bakes at 425°F
  (220°C), then 400°F (200°C).
- **Chilaquiles:**
  - The sauce is a simmered-then-blended tomato, jalapeño, onion and garlic sauce, so it needs no dried chiles.
  - The tortilla wedges are baked rather than fried.
  - The fried eggs are cooked to taste and the recipe gives no doneness temperature, as for any fried egg in the
    library.
- **Baking ratios checked:** each recipe's flour, fat, sugar, eggs and leavening are within normal home-baking ranges.
  Key formulas:

  | Recipe | Formula |
  |---|---|
  | Red velvet | 1 1/4 cups flour, 3/4 cup sugar, 1/2 cup oil, 1 egg, 1/2 cup buttermilk, 1/2 tsp baking soda (acid from buttermilk and vinegar), for 12 |
  | Zucchini bread | 2 cups flour, 1 cup sugar total, 1/2 cup oil, 2 eggs, 2 cups zucchini, 1 tsp baking powder and 1/2 tsp baking soda |
  | Lemon muffins | 2 cups flour, 2 tsp baking powder and 1/2 tsp baking soda, 3/4 cup sour cream, 1 stick butter, 2 eggs |
  | Apple muffins | 2 cups flour, 2 1/2 tsp baking powder, 1 stick butter, 3/4 cup milk, 2 eggs |
  | Double chocolate cookies | 1 1/2 cups flour plus 1/2 cup cocoa, 1 1/2 sticks butter, 1 1/4 cups sugar, 2 eggs |
  | Bakewell frangipane | 1 stick butter, 1/2 cup sugar, 2 eggs, 100 g almond flour |

## Metric
In metric mode, some ingredients would show cups as ml. Where a UK cook would weigh them instead, I wrote the grams in
the quantity:
- cocoa (45 g)
- cornstarch (32 g)
- raspberry jam (100 g)
- sliced almonds (25 g)
- molasses (170 g)
- crisp rice cereal (225 g)
- marshmallows (200 g and 450 g)

I added nothing to `GRAMS_PER_CUP`.
