# al7: aligning 11 recipes to the published amounts

All 11 now score 5. Nine had a quantity, time or temperature moved onto the median of 3-7 published versions. Two
(fried chicken, tempura) already sat at the median against a wider set of sources, so only their doneness cues were
clarified. No recipe matches a single source's whole formula. None of these had a `rework` entry.

| Recipe | Change | Typical published value |
|---|---|---|
| cheesy-chicken-enchiladas | chili powder 4 → 2 1/2 tbsp | 1 tbsp per cup of sauce liquid (GSO 2, FN 2, Budget Bytes 1, Cookie and Kate 1/2, Season & Thyme about 1/2) |
| chicken-broccoli-and-rice-casserole | 375 → 350°F; rice cooked through in 2 cups water (was 1 3/4, left firm), with the broccoli steamed on top for the last 5 min; sauce 3 → 2 1/4 cups liquid (1 cup broth, 1 1/4 cups milk) with 3 tbsp flour; bake 32-35 → 25-27 min (15 covered + 10-12) | 350°F, about 25 min, rice cooked before baking at 2:1, about 2-2 1/4 cups sauce per cup of rice |
| classic-chicken-pot-pie | bake 30-35 → 35-40 min at 400°F; cookMinutes 75 → 80 | single-crust pies at 400°F: 30, 35, 35-40, 35-45, 45-55 min (median about 38-40) |
| greek-lemon-chicken-and-rice | 375 → 350°F; 25 covered + 15-20 uncovered → 35 + 10; cookMinutes 60 → 65 | all sources 350°F; about 35 min covered + 10 uncovered; liquid ratio (about 2.1:1) already typical and unchanged |
| jambalaya-with-chicken-and-sausage | broth 3 1/4 → 2 3/4 cups | about 1.8 cups liquid (broth plus tomato juice) per cup of rice; ours was 2.0, now about 1.75 |
| roast-turkey-breast-with-pan-gravy | main roast 350 → 325°F; "checking from 1 1/4 hours" added | Ina Garten, Striped Spatula, Lemon Blossoms all 325°F; about 1 3/4-2 1/4 h total |
| weeknight-coq-au-vin | covered braise 35 → 30 min; cookMinutes 75 → 70 | 30 min (FN Kitchen, An Edible Mosaic, Cooks on Main, Suburban Soapbox); wine and broth already typical |
| fried-green-tomatoes | oil 1/4 inch (about 2 cups, topped up) → 1/2 inch (about 3 cups); 350 → 375°F over medium-high; cookMinutes 20 → 25 | 375°F (Southern Living, Daring Gourmet, Butter and Baggage; ATK 350, P. Allen Smith 360); about 1/2 inch of oil |
| grilled-bbq-chicken-drumsticks | sauce now set over the cooler side, lid closed, for 10-15 min (was 8-10 min over direct heat), then 1-2 min over the hot side to char; finish about 180 → 175°F; cookMinutes 55 → 60 | most sources glaze over indirect heat for about 15 min; finish 175°F |
| southern-buttermilk-fried-chicken | no number moved; thermometer cue now "away from the bone" | in at 350°F, held about 310-315°F, about 14 min: ours (350, 300-325, 12-15) is at the median |
| vegetable-tempura-with-soy-ginger-dipping-sauce | no number moved; sweet potato gets a skewer doneness cue | 1 egg + about 1 cup ice water per cup of flour, 350°F: ours is at the median since the earlier batter fix |

Checks: `npm run typecheck`, `npm run validate` and `npx jest -w 2` all pass (874 tests). `npm run audit:recipes`
adds no new flag. The casserole's existing liquid-per-rice flag dropped from 4.75 to 4.25; the audit counts the cheese
sauce as rice liquid, while the rice itself cooks in a standard 2 cups of water.
