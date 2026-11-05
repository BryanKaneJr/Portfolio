# rwA: rework of 8 provenance-flagged recipes

All 8 reworked, none cut. Each now differs from the flagged source on at least four deciding quantities or the
method, and every number sits inside the range that three or more published versions agree on (details and URLs in
`verdicts.json`). `npm run check`: passes (668 recipes, 874 tests). `npm run audit:recipes`: no new ratio flags.
It shows one new near-duplicate lead: fluffy-pancakes vs dutch-baby-pancake, 63%, from the added vanilla. Those
are different dishes. The pancakes' overlap with banana-pancakes dropped from 83% to 71%.

| Recipe | Flagged source | Main changes | Score |
|---|---|---|---|
| chocolate-chip-cookies | Nestlé Toll House | Flour 2 1/4 → 2 1/2 c; sugar 3/4 → 1/2 c and brown sugar 3/4 → 1 c; dough rests in the fridge 30 min to 2 days; 350°F for 11–13 min (was 375°F, 9–12); flaky salt on top; about 40 cookies | 5 |
| fluffy-pancakes | Allrecipes Good Old-Fashioned | 2 c flour, 3 tbsp sugar, 3/4 tsp salt, 1 3/4 c milk, 2 eggs **separated with the whites whipped and folded in**, 4 tbsp butter, vanilla; about 16 pancakes | 5 |
| snickerdoodles | Standard formula (Glorious Treats) | Kept the dish's standard flour, leavening, butter and egg base. Sugar is now 1 1/4 c white + 1/4 c brown; 1/2 tsp cinnamon in the dough; 2 tsp vanilla; 1/4 c coating; 400°F; bigger 1 1/2-inch balls (about 30, was 48) | 5 |
| peanut-butter-blossom-cookies | Pillsbury 1957 Peanut Blossoms | Peanut butter 1/2 → 2/3 c; dough sugar 1/2 → 1/3 c; flour 1 3/4 → 1 2/3 c; soda 1 → 3/4 tsp; salt 1/2 → 1/4 tsp; milk 2 → 1 tbsp; 350°F for 9–11 min (was 375°F) | 5 |
| cheeseburger-soup | Taste of Home | Butter 4 → 3 tbsp; flour 1/4 → 1/3 c; broth 3 → 3 1/2 c; milk 1 1/2 → 1 1/4 c; cheddar 8 → 10 oz; salt 3/4 → 1/2 tsp (cheese and broth season it); broth whisked in a cup at a time | 5 |
| italian-wedding-soup | Sweety Salado | Broth 8 → 10 c; pasta 3/4 → 1 c; spinach 5 → 6 oz; oil 2 → 1 tbsp; more onion and carrot; crumbs 1/3 → 1/2 c with 1/4 c milk; Parmesan 1/2 → 1/3 c; parsley 1/4 c → 3 tbsp; optional Parmesan rind in the broth; serves 8 in a 6- to 8-qt pot | 5 |
| baked-berry-oatmeal | Heidi Swanson's baked oatmeal | Oats 2 → 2 1/2 c; milk 1 3/4 → 2 1/4 c; butter 3 → 4 tbsp; baking powder 1 → 1 1/2 tsp; berries 1 1/2 → 2 c; 9-inch dish; 40–45 min. Now made **in one bowl**: berries folded through, a 10-minute soak, more berries on top. Heidi's version layers berries under and over the oats. Almonds replace walnuts; serves 8 | 4 |
| zucchini-fritters | Once Upon a Chef (feta and dill) | Zucchini 1 1/4 → 1 1/2 lb; flour 1/2 → 2/3 c; baking powder 1/2 → 1 tsp; feta 1/2 → 3/4 c; dill 2 → 3 tbsp; 4 green onions; pepper 1/2 tsp; salted for 15 min; lemon zest in the fritters; dry ingredients mixed first and the eggs last; about 20 fritters | 5 |

## Notes
- **Baked oatmeal scores 4, not 5.** The bake time for the deeper 2 1/2-cup batch is checked only on paper
  (published 9-inch versions bake about 45 min). The step gives clear signs for when it's done.
- **Lead's suggestions I didn't take:**
  - Cookie salt stays at 3/4 tsp. Moving to 1 tsp would have matched Toll House again.
  - Pancake baking powder is 1 tbsp, not 4 tsp, because the whipped whites add lift. 4 tsp would also have matched
    the Fresh Eggs Daily 2-cup version.
  - Cheeseburger soup salt is 1/2 tsp, not 1 tsp, because 10 oz of cheddar plus broth already season it (decision 14).
  - Oatmeal milk is 2 1/4 cups, not 2, so it stays inside the 7/8–1 cup of milk per cup of oats range.
- **Standard round numbers that recur elsewhere:**
  - The new cookie sugars (1 c brown + 1/2 c white with 1 c butter and 2 eggs) appear in several versions (Baker's,
    Kitchen Magpie). Ours differs from each on flour, salt, temperature, time and the rest.
  - Pancakes: The Golden Balance and Fresh Eggs Daily also use 2 c flour, 2 eggs and 1 tsp vanilla. Ours differs on
    at least three quantities and the method.
  - The wedding-soup crumbs and milk (1/2 c + 1/4 c per pound) are a common amount (Salt and Lavender, Cuisine at
    Home).
- **Clarity fixes while I was there:**
  - Wedding soup: salt and pepper now read "1 1/4 tsp salt, divided", not "1 1/4 tsp, divided salt".
  - Cookies: the flaky salt is in the salt line's preparation.
  - Oatmeal: the butter line reads "4 tbsp butter, melted and slightly cooled, plus 1 tsp for the dish".
