# r5-desserts-snacks: notes for the integrator

Theme file: `src/data/originals/dessertsSnacks.ts` (`DESSERTS_SNACKS_RECIPES`), 20 original recipes, all
`source: ORIGINAL_DRAFT`. Written from general cooking knowledge; no published recipe was searched for or opened.
`npm run check` passes in my worktree: 568 recipes, 382 ingredients, 759 tests.

## Recipes added (in list order) and the gap each fills

| # | Title | id | Gap it fills |
|---|---|---|---|
| 1 | Pineapple Upside-Down Cake | `pineapple-upside-down-cake` | No upside-down or fruit-topped butter cake; pineapple had no dessert |
| 2 | Lemon Meringue Pie | `lemon-meringue-pie` | No meringue pie; first use of a fully blind-baked crust plus stovetop filling |
| 3 | Brown Butter Blondies | `brown-butter-blondies` | Only chocolate brownies existed; a one-bowl bar from pantry staples |
| 4 | Chocolate-Dipped Coconut Macaroons | `chocolate-dipped-coconut-macaroons` | No macaroons; shredded coconut was required by 1 recipe (now 3) |
| 5 | Peanut Butter Blossom Cookies | `peanut-butter-blossom-cookies` | Holiday cookie; distinct from the library's fork-pressed Peanut Butter Cookies |
| 6 | Coconut Pecan Magic Cookie Bars | `coconut-pecan-magic-cookie-bars` | Condensed milk + graham bar cookie; no seven-layer-style bar existed |
| 7 | Pull-Apart Monkey Bread | `pull-apart-monkey-bread` | The only sweet yeast breads were Cinnamon Rolls and Limoncini; from-scratch dough, no canned biscuits |
| 8 | Molten Chocolate Lava Cakes | `molten-chocolate-lava-cakes` | No individual or molten chocolate dessert; serves 4, under 40 minutes |
| 9 | Molasses Crinkle Cookies | `molasses-crinkle-cookies` | Chewy drop cookie for molasses (3 → 4 recipes); library's Gingerbread Cookies are rolled cut-outs |
| 10 | Caramel Flan | `caramel-flan` | No Latin custard; Crème Brûlée is cream and yolks, this is canned milks and a caramel layer |
| 11 | Thai Mango Sticky Rice | `thai-mango-sticky-rice` | First Thai dessert; second recipe needing mango |
| 12 | Fresh Strawberry Pie | `fresh-strawberry-pie` | No uncooked-fruit pie; strawberries otherwise only in shortcake, salad and parfaits |
| 13 | Baked Apple Dumplings | `baked-apple-dumplings` | Whole apples in pastry with syrup; distinct from Apple Pie, Turnovers, Strudel and Crisp |
| 14 | Homemade Soft Pretzels | `homemade-soft-pretzels` | No pretzels; a baked snack/appetizer |
| 15 | Garlic Parmesan Knots | `garlic-parmesan-knots` | Yeast side for pasta nights; the library had focaccia and dinner rolls only |
| 16 | Classic Popovers | `classic-popovers` | No popovers or Yorkshire-style batter bake; breakfast or dinner side from 5 staples |
| 17 | Cheddar Chive Scones | `cheddar-chive-scones` | Savory counterpart to Classic Scones; cheddar in baking |
| 18 | Chewy Honey Oat Granola Bars | `chewy-honey-oat-granola-bars` | Lunchbox snack bar (oats, almonds, cranberries, peanut butter); different from baked UK Oat Flapjacks |
| 19 | Oven-Baked Caramel Popcorn | `oven-baked-caramel-popcorn` | Second popcorn recipe; caramel corn baked dry, distinct from stovetop Kettle Corn |
| 20 | Dark Chocolate Truffles | `dark-chocolate-truffles` | Ganache candy from cream and dark chocolate; Brigadeiros are condensed-milk fudge balls |

Meals and dish types: desserts list `baked_goods` (Flan lists `bake`, like Crème Brûlée). Mango Sticky Rice and
Truffles list no extra type and get Desserts from the meal, as no-bake desserts do. The two non-dessert sweet
snacks (granola bars, caramel popcorn) list `sweets`, like Kettle Corn. Pretzels, knots, popovers and scones are
`baked_goods` with their savory meals (snack/appetizer/side/breakfast).

## Skips and swaps

My list had 23 dishes for 20 slots, so no swap-ins were needed. Three left out:
- **Arroz con Leche**: skipped as too close to the library's Risengrød (Danish Rice Porridge), which is also rice
  simmered in milk with cinnamon and sugar. A Latin version would differ in cinnamon stick, citrus peel and canned
  milks, but the ingredient match would be nearly the same.
- **Cinnamon Sugar Baked Donuts**: left out because the dish needs a donut pan, beyond the baseline equipment.
- **Chocolate Peanut Butter Energy Bites**: left out as the weakest; it overlaps my granola bars (oats, honey,
  peanut butter, chocolate chips) and the library's No-Bake Peanut Butter Bars.

## Catalog additions (`import:catalog`)

- `glutinous rice` → `glutinous_rice` (grain), alias `sticky rice` (from the `'=glutinous rice'` entry). It is a
  different rice from the catalog's `rice` and won't cook up the same, so it can't share an ID. The steps always say
  "sticky rice" or "glutinous rice", never just "rice". I left out the alias "sweet rice", which could match a search
  for "sweet". **International aisle** (Asian grocers, or a supermarket's Asian section).
- `maraschino cherries` → `maraschino_cherries` (pantry). Used only as an **optional** garnish on the upside-down
  cake, so it joins the "No recipe needs X yet" items until a recipe needs it. If you'd rather not add a
  catalog item for a garnish, delete the `opt(...)` line and the catalog entry together. Step 2 then needs its
  "Set a maraschino cherry…" sentence removed.

Both are registered in `W/new-ingredients.txt`. Neither name appears in any existing recipe's steps (checked with
grep), so they shouldn't trip the step checker elsewhere.

## Equipment beyond the baseline (decision 15: never a filter)

- **Monkey bread**: a 10-inch Bundt or tube pan. It defines the dish. The recipe says "Bundt pan or tube pan"
  and avoids "12-cup", because the units test treats "12-cup Bundt" as an unconverted US measure.
- **Lava cakes**: four ramekins that hold about 3/4 cup each.
- **Popovers**: a 12-cup muffin tin (the library already uses one).
- **Mango sticky rice**: a metal sieve or steamer basket over a pot, lined with a towel or cheesecloth.
- **Flan**: a 9-inch round cake pan, 2 inches deep, in a roasting pan for the water bath.
- A hand or stand mixer for the meringue, cookies and macaroon whites. Kneading is by hand, with stand-mixer
  times given as an option.

## Cook-test first

1. **Thai Mango Sticky Rice**: steaming in a towel-lined sieve instead of a Thai bamboo steamer. Check the 20–25
   minute steam for 1 1/2 cups soaked rice, and whether 1 cup coconut milk + 1/2 cup sugar is absorbed in 30 minutes.
2. **Caramel Flan**: 9-inch pan gives a flan about 1 inch thick. I gave 45–55 minutes in the water bath with a
   wobble-and-knife test; confirm the timing.
3. **Pull-Apart Monkey Bread**: from-scratch dough (3 3/4 cups flour) in a 10-inch Bundt. Check the pan fills to
   about 1 inch below the rim after the second rise and that 35–40 minutes reaches 190°F (88°C) inside.
4. **Fresh Strawberry Pie**: 3 tbsp cornstarch for about 1 1/4 cups purée + 1/4 cup water. Check that it slices
   cleanly after 3 hours without turning gummy.
5. **Chewy Honey Oat Granola Bars**: binder (honey, brown sugar and butter boiled 1 minute, then peanut butter) for
   about 3 1/3 cups dry mix. Check the bars hold when cut and don't crumble.
6. **Baked Apple Dumplings**: 2 1/2 cups flour of pastry split into six 7-inch squares around small (about 6 oz)
   apples. Check the pastry covers the apples and the apples are tender in 50–55 minutes.

The others are standard ratios (blondies, cookies, magic bars, lava cakes, popovers, pretzels, truffles) that I
checked on paper: flour/fat/sugar/egg/leavening, pan sizes and yields.

## Things the integrator should know

- The cooked-rice rule doesn't apply: the sticky rice line is raw, "1 1/2 cups (300 g)".
- Solids with no `GRAMS_PER_CUP` entry carry their own metric in parentheses (coconut, pecans, crisp rice
  cereal, cocoa, cornstarch, baking soda for the pretzel bath, chives, sticky rice), so metric shows grams, not ml.
- Water used two ways is one line with the split in the preparation note (the validator rejects the same ID twice
  with the same optional flag).
- Salt in the savory bakes (scones, knots, pretzels) is measured because dough can't be tasted. The scones keep
  1/2 tsp alongside the cheddar, since unsalted scone dough tastes flat.
