# o-baking handoff: 25 original desserts and bakes

Theme file: `src/data/originals/baking.ts` (`BAKING_RECIPES`), copied here as `baking.ts`. Every recipe uses
`source: ORIGINAL_DRAFT`. All were written from general baking knowledge and standard ratios. I did not search for,
open or paraphrase any published recipe.

`npm run check` in my worktree passes: 220 recipes (195 + 25), 261 ingredients (254 + 7), 387 tests.

## Worktree base
My worktree was created from `master` (c061183a, 124 recipes). Before writing anything I copied the main checkout's
uncommitted round-3 files into it. I later checked them against `claude/cook-with-that-recipe-sources`: every copied
file matches that branch byte for byte. The only differences are my own changes to `baking.ts`,
`ingredient-map.ts` (the o-baking block) and `ingredients.ts` (the last 7 entries).

## Recipes added (25)
Desserts were the thinnest meal in the library (25 of 195). These are the classics people search for that it lacked.

| Title | Gap it fills |
|---|---|
| Fudgy Brownies | no brownie; first bar-style chocolate bake |
| Sugar Cookies | cut-out cookie with icing (only drop cookies before) |
| Peanut Butter Cookies | first dessert where peanut butter is required |
| Snickerdoodles | cinnamon cookie; first use of cream of tartar |
| Classic Cheesecake | no cheesecake; cream cheese desserts |
| Carrot Cake with Cream Cheese Frosting | first dessert that requires carrot |
| Lemon Bars | lemon dessert bar |
| Peach Cobbler | first peach recipe (new catalog item) |
| Strawberry Shortcake | strawberry dessert; heavy cream |
| Banana Pudding | banana + homemade custard, no oven |
| Pound Cake | pantry-staples-only cake (useful in My Pantry mode) |
| Vanilla Cupcakes with Buttercream | no cupcakes yet |
| Shortbread | 5-ingredient pantry cookie |
| Classic Scones | British teatime; breakfast/snack bake |
| Chocolate Mousse | chilled chocolate dessert, no oven |
| Pumpkin Pie | holiday pie; canned pumpkin + evaporated milk |
| Pecan Pie | holiday pie; pecans |
| Blueberry Crumb Bars | berry bar (blueberries count as `berries`) |
| Soft Dinner Rolls | yeast rolls as a dinner side (only cinnamon rolls before) |
| Lemon Drizzle Cake | British loaf cake |
| Victoria Sponge | British layer cake; jam + cream |
| Sticky Toffee Pudding | British pudding; dates |
| Oat Flapjacks | British oat bar; golden syrup |
| Key Lime Pie | first dessert that requires lime; condensed milk |
| Chocolate Pudding | egg-free stovetop pudding from pantry items |

None of the gap pairs in ORIGINALS.md (black beans, ground beef, broccoli, spinach and so on) fit desserts.

## Skipped from my list (3 of 28)
- **Creamy Rice Pudding**: near-duplicate of the library's `risengrod` (Danish rice porridge: short-grain rice simmered
  in milk, served with cinnamon sugar and butter). It's the same method and nearly the same dish.
- **Coconut Macaroons**: near-duplicate of `bolinhos-de-coco` (chewy baked bites of shredded coconut, sugar and egg).
- **Apple Cinnamon Muffins**: the list has 28 dishes for 25 slots. Apple already has the most dessert recipes (Apple
  Crisp, Apple Pie, Apple Coffee Cake), and two muffins exist, so I dropped this one.
  It is a good candidate for a later round.

No dishes were swapped in; the 25 above are all from the o-baking list.

## Ratio check (all formulas checked before finishing)
Grams are approximate, from the app's cup weights.
- Brownies: butter 113, dark chocolate 115, sugar 200, 2 eggs, flour 62, cocoa 15. No leavening, on purpose (fudgy).
- Sugar cookies: flour 375, butter 227, sugar 200, 1 egg, 1 tsp baking powder. Icing: 230 powdered sugar, 3–4 tbsp milk.
- Peanut butter cookies: flour 190, butter 113, peanut butter 255, sugar 100 (+50 for rolling), brown sugar 105,
  1 egg, 3/4 tsp baking soda.
- Snickerdoodles: flour 345, butter 227, sugar 300, 2 eggs, cream of tartar and baking soda at 2:1 (2 tsp / 1 tsp).
- Cheesecake: cream cheese 900, sugar 200, 4 eggs, sour cream 160, flour 16. Crust: crumbs 150, butter 85, sugar 25.
- Carrot cake (9-by-13): flour 280, sugar 200 + brown 210, oil 240 ml, 4 eggs, carrots 450, 1 tsp each baking powder
  and soda. Frosting: cream cheese 225, butter 113, powdered sugar 345.
- Lemon bars: crust flour 250, butter 227, powdered sugar 57. Filling: 5 eggs, sugar 350, lemon juice 180 ml, flour 40.
- Peach cobbler: peaches 1.4 kg whole, sugar 100 + brown 55, cornstarch 3 tbsp. Topping: flour 190, butter 85,
  milk 160 ml, 2 tsp baking powder.
- Strawberry shortcake: flour 250, butter 113, cream 180 ml, 1 tbsp baking powder. 1 1/2 cups cream whipped.
- Banana pudding custard: milk 720 ml, sugar 150, cornstarch 30, 4 yolks. Boiled 1 minute so it sets.
- Pound cake: butter 227, sugar 250, eggs 200, flour 219, 1/2 tsp baking powder (near equal weights).
- Cupcakes (12): flour 190, sugar 150, butter 113, 2 eggs, milk 120 ml, 1 1/2 tsp baking powder. Buttercream: butter
  227, powdered sugar 400.
- Shortbread: butter 227, sugar 100, flour 250 + cornstarch 30 (classic 1:2:3).
- Scones: flour 250, butter 70, sugar 38, 1 tbsp baking powder, 1 egg + 120 ml milk.
- Chocolate mousse: chocolate 170, butter 28, 3 yolks, cream 360 ml, sugar 38.
- Pumpkin pie: crust flour 190, butter 140. Filling: pumpkin 425, brown sugar 160, 3 eggs, evaporated milk 354 ml
  (9-inch deep dish).
- Pecan pie: crust flour 155, butter 113. Filling: 3 eggs, corn syrup 245 g, brown sugar 160, butter 57, pecans 200.
  This has less syrup and sugar per egg than the usual 1 cup + 1 cup, so it sets firmer and is less sweet.
- Blueberry crumb bars: flour 375, sugar 200, butter 227, 1 egg, 1 tsp baking powder. Filling: blueberries 600,
  sugar 100, cornstarch 3 tbsp.
- Dinner rolls: flour 500, milk 300 ml, butter 57, 1 egg, sugar 50, salt 9 g (1.8%), yeast 7 g (1.4%).
  15 rolls of about 65 g.
- Lemon drizzle: butter 170, sugar 175, 3 eggs, flour 167, 1 1/2 tsp baking powder. Drizzle: 60 ml juice, 100 g sugar.
- Victoria sponge: butter 227, sugar 225, 4 eggs (200), flour 219, 2 1/2 tsp baking powder (equal to self-raising).
- Sticky toffee pudding: flour 155, brown sugar 160, butter 57, 2 eggs, dates 225 soaked in 240 ml water, 1 tsp each
  baking soda and baking powder. Sauce: butter 113, brown sugar 210, cream 240 ml.
- Flapjacks: oats 250, butter 125, brown sugar 105, golden syrup 110.
- Key lime pie: condensed milk 1 can (14 oz), 4 yolks, 1/2 cup lime juice. Crust: crumbs 150, butter 85, sugar 38.
- Chocolate pudding: milk 600 ml, sugar 100, cocoa 20, cornstarch 24 (about 4%), dark chocolate 55.

## Catalog additions (7)
All are reviewed in `ingredient-map.ts`, registered in `W/new-ingredients.txt` and added with `npm run import:catalog`:
`peach` (produce, alias peaches), `vanilla_wafers` (pantry, like `ladyfingers`), `corn_syrup` (pantry, alias light
corn syrup), `dates` (pantry, alias pitted dates), `golden_syrup` (pantry), `raspberry_jam` (pantry) and
`cream_of_tartar` (pantry; this key was already reviewed and only needed adding).

## For the integrator
- **Catalog:** run `npm run import:catalog -- "peach" "vanilla wafers" "corn syrup" "dates" "golden syrup" "raspberry
  jam" "cream of tartar"` after merging the map block.
- **Step-word check:** I ran the step-ingredient check against the other workers' registered keys. None of their food
  words (peanuts, buttermilk, cornmeal and so on) appears in my steps.
- **Metric mode:** I checked every quantity and step in metric. Solids with no cup weight carry an author gram figure:
  cocoa, pecans, graham crumbs, corn syrup, golden syrup, jam, cornstarch in cups, oats and dates. US cans show as
  tins: pumpkin 400 g, condensed milk 400 g, evaporated milk 354 ml.
- **Wording to avoid catalog matches:** I wrote "a square 8-inch pan" instead of "an 8-inch square pan", because
  metric mode would otherwise read "an 20 cm". I avoided "peas" as a size cue, "toast" as a verb, and "sugar" on its
  own in recipes that use only brown sugar.
- **No dish type:** Banana Pudding, Chocolate Mousse and Chocolate Pudding are chilled or stovetop desserts, so no
  dish type honestly fits (same as Tiramisu in the library).

## For the culinary reviewer
- **Chocolate Mousse:** the yolks are cooked to 160°F (71°C) over simmering water, so no raw egg is served.
- **Key Lime Pie:** the yolks are baked for 15–17 minutes in the filling.
- **Cheesecake:** no water bath. It bakes low at 325°F and cools for 1 hour in the turned-off oven with the door
  ajar, which keeps cracks to a minimum.
- **Pumpkin Pie:** the crust is part-baked first (pie weights or dried beans) so the bottom stays crisp. I sized the
  crust and filling for a 9-inch deep-dish plate, since a 15-oz can plus 12-oz evaporated milk overfills a standard one.
- **Pecan Pie:** goes into an unbaked crust on the lowest rack for 50–60 minutes.
- **Key lime:** the line is `lime`, displayed as "limes (Key limes if you can find them)". A Key lime is a variety of
  lime, which I treated like apple varieties. Bottled juice is not suggested.
- **Peach cobbler:** fresh or frozen peaches are the same food. The display name gives "or 2 lb frozen slices,
  thawed", and step 1 explains how to peel fresh peaches by blanching.
- **Carrot cake:** walnuts are an optional topping only, so the cake itself is nut-free.
