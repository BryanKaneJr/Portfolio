# rwB rework: 8 recipes reworked, 0 cut

All eight now differ from the flagged source in at least four deciding quantities or in method. Each quantity sits
inside the range that 3–5 published versions share, and none of the eight tracks a different single source either.
Recipe text, taglines and steps are our own. Per-recipe ranges and URLs are in `verdicts.json`.

| Recipe | Flagged source | Score |
|---|---|---|
| tres-leches-cake | The Pioneer Woman | 4 |
| gingerbread-cookies | McCormick Gingerbread Men | 5 |
| chocolate-fudge | Eagle Brand label | 4 |
| blueberry-crumb-bars | Allrecipes / Smitten Kitchen | 4 |
| key-lime-pie | Gimme Some Oven | 5 |
| shortbread | Ahead of Thyme | 4 |
| oven-baked-caramel-popcorn | Allrecipes Caramel Popcorn, halved | 4 |
| chocolate-dipped-coconut-macaroons | Once Upon a Chef | 4 |

## Per recipe
- **tres-leches-cake.** A taller six-egg sponge: 1 1/4 cups flour, 1 3/4 tsp baking powder, 1/2 tsp salt, sugar
  split evenly between yolks and whites, 1/3 cup milk and 1 1/2 tsp vanilla. Bakes 28–32 min in a dish at least 2
  inches deep. The soak's third milk is now 2/3 cup whole milk instead of cream, and the cream goes only on top
  (1 1/2 cups). The lead suggested 1/2 cup milk and 2 tsp baking powder, but both are just above the published
  per-cup-of-flour ranges, so I used 1/3 cup and 1 3/4 tsp.
- **gingerbread-cookies.** 3 1/4 cups flour, 2/3 cup brown sugar and 2/3 cup molasses. Spices are 1 1/2 tsp
  cinnamon, allspice in place of nutmeg, 1/4 tsp cloves and a pinch of black pepper. The dough is now rolled between
  parchment right after mixing and chilled as slabs for 1 hour, so the counter needs no flour and prep is 30 minutes
  shorter. The ratios sit between King Arthur's and McCormick's.
- **chocolate-fudge.** 2 1/2 cups (15 oz) chips to the can, which is mid-range. 3 tbsp butter is browned first, and
  the condensed milk goes in to stop the browning. 1 tsp vanilla, a pinch of salt on top, optional dry-toasted pecans
  stirred in, and a 3-hour chill.
- **blueberry-crumb-bars.** An oat crumb: 2 1/2 cups flour plus 1 cup oats, half the dough sugar brown, 1/2 tsp
  baking powder and 1 cup + 2 tbsp butter. The berries go up to 5 cups, and it bakes at 350°F for 50–60 min.
- **key-lime-pie.** The crust gets a little salt and bakes 12 min. Juice goes up to 2/3 cup (the tart end), with
  4 yolks kept so it still sets at least as firmly as Joe's 3-yolk pie. The filling bakes at 325°F for 16–20 min,
  then chills 4 hours, and some zest is saved for the top. I also fixed the ingredient line that read "Key limes limes".
- **shortbread.** Powdered sugar (2/3 cup) in the dough, 2 1/4 cups flour, 1/3 cup cornstarch and 1/2 tsp salt.
  Bakes Scottish-style at 300°F for 55–65 min, in line with Food Network Kitchen's 8-inch, 300°F, about-1-hour bake.
- **oven-baked-caramel-popcorn.** The 2:1:½ caramel is the same in every published version, so the choices are made
  around it. 1 tbsp of the corn syrup becomes molasses, and salt goes to 1 tsp. The caramel boils 5 min, then bakes
  at 225°F for 1 hour, stirred every 20 min, with a crunch test at the end.
- **chocolate-dipped-coconut-macaroons.** Almond extract added. The whites are whipped with 2 tbsp sugar into a
  meringue, which binds the low (2/3 cup) condensed milk. Bakes at 350°F for 16–20 min. The chocolate goes up to
  6 oz to dip and then drizzle, with optional coconut oil for gloss.

## Nothing cut
The caramel corn is the softest case: its base caramel is universal, so it is "ours" through choices inside the range
(molasses, salt, oven, stirring) rather than a new formula. If the owner wants a cleaner break, a peanut or spiced
version would be the next step.

## Check
`npm run check` passes: tsc is clean, the validator passes 668 recipes and 399 ingredients, and jest runs 11 suites
with 874 tests passing. `npm run audit:recipes` flags none of the eight (89 flagged overall, the same as before).
The step checker caught "toast" (a bread alias) in the fudge, which I reworded. Pecans got a gram weight because the
audit showed "3/4 cup → 180 ml". All eight read correctly in metric mode.
