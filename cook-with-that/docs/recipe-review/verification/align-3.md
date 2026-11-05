# al3: aligning 12 four-out-of-five recipes to published amounts

Worktree at d5061d02. Two files changed: `src/data/originals/bakingBreakfast.ts` and `src/data/originals/baking.ts`.
Each change moves a quantity onto the median of 3–9 published versions, scaled to our batch. Sources and the per-source
numbers for each recipe are in `verdicts.json`.

`npm run typecheck` and `npm run validate` pass, and `npx jest -w 2` passes 874 of 874 tests. `npm run audit:recipes` adds no new flag for these
recipes. The only flag among them was already there: the baking soda in the sticky toffee pudding, which went from 0.8
to 0.67 tsp per cup of flour.

| Recipe | Change | Score |
|---|---|---|
| almond-biscotti | butter 4 → 6 tbsp | 5 |
| bakewell-tart | frangipane butter 113 → 140 g, sugar 1/2 → 3/4 cup, almond flour 100 → 150 g; bake 30–35 → 35–40 min | 5 |
| chilaquiles | chips 400°F → 350°F, 12–18 → 15–20 min | 5 |
| chocolate-fudge | no number; clearer firm-center chill cue | 4 |
| churros-with-chocolate-sauce | oil 350 → 375°F, fry 4–5 → 3–4 min; sauce 4 oz chocolate + 2/3 cup cream → 6 oz + 3/4 cup | 5 |
| irish-soda-bread | hot start 425 → 450°F; second stage about 25 min (+5 if needed) | 5 |
| smores-bars | marshmallows 4 → 3 cups | 5 |
| tres-leches-cake | bake 28–32 → 22–28 min; topping powdered sugar 3 tbsp → 1/4 cup | 5 |
| blueberry-crumb-bars | brown sugar 1/2 → 3/4 cup | 4 |
| peanut-butter-cookies | peanut butter 1 → 2/3 cup; 350 → 375°F, 9–11 min; 40 → 36 cookies | 5 |
| shortbread | flour 2 1/4 → 1 3/4 cups; powdered sugar 2/3 → 3/4 cup | 5 |
| sticky-toffee-pudding | dates 8 → 7 oz, flour 1 1/4 → 1 1/2 cups, baking powder 1 → 2 tsp, cake butter 4 → 5 tbsp and sugar 3/4 → 1/2 cup; sauce butter 8 → 7 tbsp, cream 1 → 2/3 cup | 5 |

## Per recipe

**almond-biscotti (5).** Scaled to 2 cups of flour, butter runs 0 to 8 tbsp with a median of about 6.7, and ours had 4.
I set it to 6 tbsp. Sugar, eggs, leavening, salt, almonds and both bakes were already at the median. The nearest single
recipe is Baked Bree's, but ours differs from it on butter (6 against 8 tbsp), almond extract and the upright second
bake.

**bakewell-tart (5).** For a 9-inch tart, the frangipane's median is 150 g each of butter, sugar and ground almonds, with
2 eggs. Ours was 113/100/100 g. It is now 140/150/150 g with 2 eggs and 2 tbsp flour, which keeps it apart from Mary
Berry's version (150/150/150, 1 egg, no flour). The larger filling bakes 35–40 minutes, which is inside the published
25–45 and has the same doneness cue. The pastry and blind bake were already typical.

**chilaquiles (5).** All five oven-chip versions bake the tortillas at 350°F for 12–25 minutes, with a median of 15.
Ours now bakes at 350°F for 15–20 minutes. The sauce, the toss time and the toppings were already standard.

**chocolate-fudge (4, no quantity changed).** The typical values are 3 cups of chips per can, 2 tbsp butter and a 2-hour
chill. Those are the Eagle Brand label recipe that the rework moved away from. Butter 3 → 2 tbsp would also reverse one
of the rework's changes. So the 2 1/2 cups of chips (as in First Year and Hip Hip Gourmet), the 3 tbsp browned butter
and the 3-hour chill all stay. Only the chill cue changed: the fudge should be firm to the center, or get another hour.
It stays a 4 because a 5 would mean going back to Eagle Brand's amounts.

**churros-with-chocolate-sauce (5).** The median frying temperature is 375°F, for about 4 minutes, and ours sat at the
350°F low edge. The sauce median is about 8.4 oz of chocolate per cup of cream; ours was 6 and is now 8 (6 oz to
3/4 cup). The dough was already typical.

**irish-soda-bread (5).** Four of six versions start at 450°F, then drop to 400°F, and the total bake runs 30–45 minutes
with a median of about 40. Ours now starts at 450°F, then bakes about 25 minutes at 400°F, plus 5 more if the bottom
sounds dull. The dough ratios were already at the median. cookMinutes stays 40.

**smores-bars (5).** Scaled to a 9-inch square, the median is about 4.7 oz of marshmallows. Ours had 7 oz, near the top,
and more than the single layer the step describes. It now has 3 cups (about 5 oz). The chocolate (8 oz against a median
of 7.8), base and broil were already typical.

**tres-leches-cake (5).** Comparable 9x13 sponges bake 20–45 minutes with a median of about 25, so ours went from 28–32
to 22–28 minutes, with the same cue (cookMinutes 25). The whipped topping takes 1/4 cup of sugar in four of five
versions, so ours went from 3 tbsp to 1/4 cup. Both changes move away from the Pioneer Woman source (35–45 minutes,
3 tbsp). The topping cream stays at 1 1/2 cups, because the 2-cup median is Pioneer Woman's pint. Ours shares some
amounts with Joy of Baking but differs on leavening, the sugar split, the milk in the batter and in the soak, vanilla
and the bake time.

**blueberry-crumb-bars (4).** The sugar in the crumb went from 1 cup to the median of about 1 1/4 cups (brown sugar
1/2 → 3/4 cup), which is also further from Allrecipes. Four amounts are still at an edge: 5 cups of berries, 350°F,
50–60 minutes and 3 tbsp cornstarch. In each case the typical value is the Allrecipes/Smitten Kitchen number, and the
rework moved off it on purpose, so none of them moved. The recipe works, but it stays a 4.

**peanut-butter-cookies (5).** The median is about 0.4 cup of peanut butter per cup of flour, and ours had 0.67. It is now
2/3 cup with 1 1/2 cups of flour. Most versions bake at 375°F for 8–12 minutes, so ours now bakes at 375°F for
9–11 minutes. The smaller batch makes 36 cookies (servings and cookMinutes updated). Butter, egg, sugars and soda were
already at the median.

**shortbread (5).** Per cup of butter, the median is 2 cups of starch. Ours had 2 7/12 cups, the top edge, and now has
1 3/4 cups of flour plus the 1/3 cup of cornstarch (2 1/12 cups). Sugar by weight has a median of about 105 g, so the
powdered sugar went from 2/3 to 3/4 cup (90 g, plus 12 g sprinkled). The 300°F oven and the bake of about an hour in an
8-inch pan were already typical. No individual amount moved closer to Ahead of Thyme: the flour is now 1/4 cup under
its 2 cups, where it was 1/4 cup over.

**sticky-toffee-pudding (5).** Ours had more dates and sugar and less flour than the published medians for an 8-inch
pan, and a sauce heavy on cream. It now uses 200 g dates, 1 1/2 cups flour, 2 tsp baking powder, 5 tbsp butter and
1/2 cup brown sugar in the cake. The sauce is 7 tbsp butter, 1 cup brown sugar and 2/3 cup cream. The total butter is
unchanged at 3/4 cup, and the steps name the new splits. The bake time of 30–35 minutes was already at the median.
