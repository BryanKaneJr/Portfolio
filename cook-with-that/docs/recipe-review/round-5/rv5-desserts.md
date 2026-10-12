# rv5-desserts: paper review of `src/data/originals/dessertsSnacks.ts` (round 5)

## Summary
- **Reviewed:** all 20 recipes in `DESSERTS_SNACKS_RECIPES`. For each one I checked the flour, fat, sugar, egg, leavening, liquid and yeast ratios, the pan size against the batter or dough volume, the bake times and temperatures, the yields, that the "divided" amounts add up, the tags and the ingredient IDs.
- **Fixed:** 5 recipes. All were small step edits: three yields that didn't match the portion size, one pan warning and one optional garnish that read as required. No ingredient amounts, temperatures, tags or IDs changed.
- **Questions for the owner:** 1 main one (the pretzels' formula matches a published recipe), plus 3 lower-risk provenance notes and 1 optional tweak. I would drop none of the 20.
- No catalog ingredients were added (no `map-entries.ts.txt` or `catalog-keys.txt`).
- `npm run check` passes: 668 recipes and 399 ingredients validated, 11/11 suites, 874 tests.

## Fixed
- `peanut-butter-blossom-cookies`: step 7 said "1-inch balls", but the dough is about 760 g. That would make roughly 50–75 cookies, and the list has only 40 kisses. → Changed to "Shape the dough into 40 balls of about 1 tbsp each, one for each kiss". The cookie count now matches the kisses and the 40 servings. The 8–10 minutes at 375°F still suits 1-tbsp balls.
- `molasses-crinkle-cookies`: step 6 said "1 1/4-inch balls", which gives about 40–50 cookies from about 850 g of dough, against 32 servings and a 33-minute bake schedule. → Changed to "Shape the dough into 32 balls of about 1 1/2 tbsp each". The yield, servings and cookMinutes now agree.
- `dark-chocolate-truffles`: "Scoop the ganache by the rounded teaspoon" gives about 30–40 truffles from about 360 g of ganache, against 24 servings. → Changed to "Scoop the ganache into 24 pieces of a heaping 2 tsp each".
- `pull-apart-monkey-bread`: the pan was a "10-inch Bundt pan or tube pan". The usual tube pan is an angel-food pan with a removable bottom, and the butter and caramel would run out of it. → Changed to "a 10-inch Bundt pan, or a tube pan without a removable bottom so the caramel cannot leak out".
- `molten-chocolate-lava-cakes`: powdered sugar is `opt(...)`, but the last step said "Dust with powdered sugar" with no "if you like". → Changed to "Serve right away, dusted with powdered sugar and with raspberries and whipped cream if you like."

## For the owner
1. **`homemade-soft-pretzels` matches a published formula. Recommendation: have a writer rework the numbers, then keep the dish.**
   - **The match:** the bath (10 cups water, 2/3 cup baking soda), 8 pieces rolled into 24-inch ropes, 30 seconds in the bath and 12–14 minutes at 450°F are all in Alton Brown's Food Network soft pretzel recipe. A web search confirmed those numbers (copies at thefreshloaf.com/comment/163381 and twopeasandtheirpod.com/homemade-soft-pretzels).
   - **The dough matches too (from memory):** 1 1/2 cups warm water, about 4 1/2 cups flour, 2 oz butter, 1 packet of yeast and oiled parchment.
   - **What differs:** the step wording is the writer's own, and the brown sugar, the whole-egg wash and the butter brush at the end are different.
   - **Why it matters:** quantities aren't protected expression, but `docs/original-recipes.md` says not to copy one source's quantities, and round 4 excluded VA pages for matching published recipes.
   - **The recipe itself is sound** as a recipe.
   - **Suggested rework:** a different batch size (6 large or 12 small), a smaller bath (for example 8 cups water with 1/2 cup soda), and the bake and rope lengths adjusted to match.
2. **Lower-risk provenance notes.** These are standard formulas for the dish, checked from memory, not searched. I recommend keeping all three.
   - `coconut-pecan-magic-cookie-bars`:
     - The amounts are Eagle Brand's can-label recipe (1/2 cup butter, 1 1/2 cups graham crumbs, 14 oz can, 1 1/3 cups coconut, 1 cup nuts, 350°F or 325°F for glass, about 25 minutes). The only change is 1 cup of chips instead of 2.
     - "Magic Cookie Bars" is also Eagle Brand's own name for them.
     - The dish is that formula, so the amounts can stay. Consider a neutral title such as "Coconut Pecan Layer Bars"; the id stays the same either way.
   - `molten-chocolate-lava-cakes`: 4 oz chocolate, 1 stick butter, 2 eggs + 2 yolks and 1/4 cup sugar is the well-known restaurant ratio. The flour (2 tbsp), oven and time differ. This is the dish's standard ratio; keep it.
   - `oven-baked-caramel-popcorn`: this is the widely shared caramel-corn formula (butter, brown sugar, corn syrup, salt, a 4-minute boil, baking soda, 1 hour at 250°F stirring every 15 minutes) at half size. It is standard; keep it.
3. **`chewy-honey-oat-granola-bars` (optional tweak).** The binder is about 1 cup for about 3 1/3 cups of dry mix, which is in the usual range for chewy no-bake bars. Pressing hard and chilling should make them hold. For extra insurance against crumbling, boil the honey, sugar and butter for 2 minutes instead of 1. I left it as written.
4. **Script flags, no change:**
   - `molasses-crinkle-cookies` (0.89 tsp baking soda per cup of flour): the classic molasses crinkle uses about 2 tsp soda per 2 1/4 cups flour. The molasses and dark brown sugar supply the acid, and the extra soda gives the spread, dark color and crackled top. Keep it.
   - `lemon-meringue-pie` (400 min), `caramel-flan` (515 min) and `fresh-strawberry-pie` (380 min): these totals include the dough chill and the cooling and setting time. The library's other chilled desserts do the same (cherry pie, cheesecake, panna cotta).
5. **The writer's cook-test list, read on paper.** All are sound:
   - **Mango sticky rice:** a 4-hour soak and 20–25 minutes of steaming in a towel-lined sieve is normal. 1 cup of coconut milk for 300 g of rice is in the usual range.
   - **Flan:** about 3 2/3 cups of custard in a 9-inch pan is about 7/8 inch deep. 45–55 minutes in a 350°F water bath, with the wobble-and-knife test, is right; it may be done at the early end.
   - **Monkey bread:** about 930 g of dough plus coating suits a 12-cup Bundt. The baking sheet underneath catches any drips.
   - **Strawberry pie:** 3 tbsp cornstarch for about 1 1/2 cups of purée and water is 2 tbsp per cup, a standard glaze set.
   - **Apple dumplings:** a 7-inch square at 1/8 inch is about 105 g of pastry, which is one sixth of the dough. That is the classic size for a 6-oz apple.
   - **Granola bars:** see item 3.

## Checked, no change
`pineapple-upside-down-cake`, `lemon-meringue-pie`, `brown-butter-blondies`, `chocolate-dipped-coconut-macaroons`, `coconut-pecan-magic-cookie-bars`, `caramel-flan`, `thai-mango-sticky-rice`, `fresh-strawberry-pie`, `baked-apple-dumplings`, `homemade-soft-pretzels` (cooking only; see the provenance note), `garlic-parmesan-knots`, `classic-popovers`, `cheddar-chive-scones`, `chewy-honey-oat-granola-bars`, `oven-baked-caramel-popcorn`.

Every "divided" line adds up across the steps. The catalog IDs are the same food as their lines (berries for strawberries and raspberries, eggs for egg whites, milk_chocolate for kisses). Meals and dish types follow the library's precedents: the flan is `bake` like Crème Brûlée, the snack sweets are `sweets` like Kettle Corn, and the no-bake desserts get Desserts from their meal. All oven temperatures carry °C, and there are no safety issues: no meat or frying, and the hot-sugar steps are handled carefully.

The two "add water if needed" fallbacks (the pineapple juice top-up and the scones' 1–2 tsp) follow the library's usual "splash of water" pattern, so I left them.
