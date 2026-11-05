# vf8 review: baking.ts (25) and dessertsSnacks.ts (20)

45 recipes checked against 2 to 4 published versions each. Search summaries were used where they gave the numbers. A page was fetched only when the numbers were missing from the summary.

## Counts
- Confident: 44 (33 scored 5, 11 scored 4)
- Fixed: 1 (scored 4)
- Cut: 0

## Cuts
None. Every recipe's deciding ratios (flour, fat, sugar, eggs, leavening, liquid, thickener), pan size, oven temperature and time fall inside the range that published versions use. The methods are complete and give sound doneness cues.

## Fixes
- **oven-baked-caramel-popcorn**: the caramel (1/2 cup butter, 1 cup brown sugar, 1/4 cup corn syrup) coats 10 to 12 cups of popcorn in published versions: Allrecipes halved, Sally's Baking Addiction and Presto. Our 1/2 cup of kernels pops to about 15 cups, so the coating would be thin and patchy. The kernels went from 1/2 cup to 1/3 cup, and the yield line in step 3 went from "about 15 cups" to "about 10 cups". Nothing else changed.

## Provenance flags
**Strong** (our quantities match one specific published recipe almost across the board):
- **peanut-butter-blossom-cookies**: matches Pillsbury's 1957 Bake-Off "Peanut Blossoms" amount for amount: 1 3/4 cups flour, 1/2 cup each of white and brown sugar, 1 tsp baking soda, 1/2 tsp salt, 1/2 cup fat, 1/2 cup peanut butter, 2 tbsp milk, 1 tsp vanilla, 1 egg, 375°F. The only change is butter for shortening.
- **blueberry-crumb-bars**: this is the Allrecipes "Blueberry Crumb Bars" in Smitten Kitchen's adaptation: 3 cups flour, 1 cup sugar, 1 tsp baking powder, 1 cup butter, 1 egg, lemon zest and juice, 4 cups berries with 1/2 cup sugar, 9x13 pan, 375°F, about 45 min. Ours differs only in cornstarch (3 tbsp against 4 tsp), salt and cinnamon.
- **key-lime-pie**: nearly identical to Gimme Some Oven's: 1 1/2 cups crumbs, 6 tbsp butter, a 14 oz can, 4 yolks, 1/2 cup juice, 350°F for 10 min then 15 min, and a 3-hour chill. The crust sugar is 3 tbsp against their 2 tbsp.
- **chocolate-dipped-coconut-macaroons**: very close to Once Upon a Chef's: a 14 oz bag of coconut, 1 tsp vanilla, 1/4 tsp salt, 2 whipped whites, a 4 oz chocolate dip, 325°F. Ours has 2/3 cup condensed milk against their 7/8 cup. 2/3 cup is still inside the published range, so I left it.
- **shortbread**: the quantities match Ahead of Thyme's classic shortbread exactly (1 cup butter, 1/2 cup sugar, 1/4 tsp salt, 2 cups flour, 1/4 cup cornstarch, 325°F). Their pan is 9 inches and ours is 8.
- **oven-baked-caramel-popcorn**: the caramel amounts and method (4-minute boil, soda and vanilla, 250°F for 1 hour, stirring every 15 minutes) are exactly half the Allrecipes "Caramel Popcorn". Its popcorn amount was off, and the fix brings that into the published range too, so the whole recipe now reads as a halved Allrecipes version. The owner may want it rewritten or cut on provenance grounds.
- **snickerdoodles**: the long-standing standard formula (2 3/4 cups flour, 2 tsp cream of tartar, 1 tsp soda, 1 1/2 cups sugar, 2 eggs) with all butter, the same as Glorious Treats' version. It's a widely shared heritage formula, so this is a lower concern.

**Soft** (most core amounts match one source, with real differences elsewhere):
- **molten-chocolate-lava-cakes**: the chocolate, butter, eggs, yolks and sugar equal the widely reprinted Jean-Georges formula. The flour (2 tbsp against 2 tsp) and the oven (425°F for 12 to 14 min against 450°F for 6 to 7 min) differ.
- **brown-butter-blondies**: close to Love From the Oven's brown butter blondies. Ours adds a yolk and baking powder.
- **thai-mango-sticky-rice**: the rice, can of coconut milk and sugar equal Joshua Weissman's. The salt and topping differ. It's a natural "one can" design.

Generic standard ratios that need no flag: Victoria sponge (equal weights, 4 eggs), popovers (3 eggs, 1 1/2 cups milk, 1 1/2 cups flour), truffles (2:1 ganache).

## Lower-confidence notes (score 4, no change)
- peanut-butter-cookies: 1 cup of peanut butter to 1 1/2 cups of flour is at the rich end of the published range.
- molten-chocolate-lava-cakes: 12 to 14 min at 425°F is inside the 11 to 14 min range for 425°F recipes. A cook should check at 12.
- caramel-flan: 45 to 55 min against the 50 to 60 min in published recipes, but the jiggle and knife test covers it.
- pull-apart-monkey-bread: 35 to 40 min is at the long end, but it is guarded by a check for 190°F.
- sticky-toffee-pudding, baked-apple-dumplings, chewy-honey-oat-granola-bars, thai-mango-sticky-rice, shortbread, blueberry-crumb-bars and chocolate-dipped-coconut-macaroons: they work and are in range, but sit nearer the edges or carry provenance flags.

## Check
`npm run check`: typecheck passes; the validator reports 668 recipes and 399 ingredients passed; jest runs 11 suites and 874 tests, all passing.
The first full run had one jest worker killed by SIGKILL, from memory pressure while other checkers ran at the same time. With 2 workers everything passed.
