# vf5 review: vegetarian.ts (25) and worldKitchen.ts (20)

I checked 45 recipes against 2 to 5 published versions each. URLs and per-recipe notes are in `verdicts.json`, and the fixes are in `patch.diff`.

## Counts
| Verdict | Count |
|---|---|
| Confident | 43 (31 scored 5, 12 scored 4) |
| Fixed | 2 (both scored 4) |
| Cut | 0 |

`npm run check` passed after the fixes: 668 recipes and 399 ingredients validated, 11 test suites and 874 tests passed.

## Cuts
None. Every recipe is a well-documented dish, and each one's deciding numbers fall inside, or at the edge of, the range the published versions use.

## Fixes
- **cauliflower-cheese**: the sauce flour went from **1/4 cup to 1/3 cup**.
  - Before: about 31 g of flour in 2 1/2 cups (590 ml) of milk, about 53 g per litre.
  - Published sauces run from 60 to 110 g per litre, and most sit at 70 to 80: Aldi 50 g/500 ml, Great British Chefs 30 g/400 ml, BBC Good Food 4 tbsp/500 ml, Tesco 50 g/450 ml, Woman & Home 40 g/500 ml.
  - Boiled cauliflower also weeps into the dish, so the old sauce would have run thin. With 1/3 cup it is about 71 g per litre.
  - Nothing else changed.
- **pad-kra-pao**: **oyster sauce went from 2 to 3 tbsp, and fish sauce from 2 tsp to 1 1/2 tbsp**.
  - The old seasoning for 1 1/2 lb of chicken came to about 60% of the lowest salt level among six published versions (SJSU, Woks of Life, Tastemade, Hungry in Thailand, Observatory, Not Quite Nigella).
  - Those versions use about 1 tbsp of fish sauce and about 2 tbsp of oyster sauce per pound of chicken.
  - The new amounts sit at the low end of that range. Soy sauce, sugar, water and the method are unchanged.

There was also one wording change in a recipe marked confident:
- **falafel-with-tahini-sauce**, step 1: "they will double in size" became "until swollen to about twice their size". The old wording was close to a sentence on a published falafel page (Inspired Taste / Feel Good Foodie). The numbers are unchanged.

## Provenance flags (left as is, not fixed)
- **zucchini-fritters**: close to Once Upon a Chef's "Zucchini Fritters with Feta and Dill".
  - Shared with it: 2 eggs, 2 tbsp dill, 1/2 cup feta, 1/4 tsp pepper, 1/2 tsp baking powder, salting for 10 minutes then squeezing, and the same mixing order.
  - Ours differs in the zucchini (1 1/4 lb against 1 lb), the flour (1/2 cup against 1/4 cup), the green onions (3 against 2) and the oil, and it adds a yogurt sauce.
  - It is not identical, but it is the nearest thing to a single source in this set. Worth a second look if the owner wants zero resemblance.
- **oyakodon** (mild): the sauce and chicken are Just One Cookbook's 2-serving card doubled: 1 cup liquid, 1/4 cup soy, 1/4 cup mirin and 20 oz of thighs. Ours uses chicken broth instead of dashi and 1 tbsp of sugar. This 4:1:1 donburi ratio is the textbook one, so I'd treat this as low risk.

## Borderline, judged fine (no change)
- **jamaican-rice-and-peas**: 3 3/4 cups of liquid for 2 cups of rice works out to 1.9 per cup of rice. Published versions run 2 to 2.35. Once the coconut fat is counted, the real water is about 1.6 per cup of rinsed long-grain rice, which is a normal absorption ratio.
- **black-bean-burgers**: 1 egg and 3/4 cup panko for 2 cans of beans is lighter on binder than ATK (2 eggs, 1 cup panko). It matches the oven-dried versions (This Healthy Table: 3/4 cup and 1 egg), and drying the beans removes the moisture that makes patties fall apart.
- **black-bean-and-sweet-potato-enchiladas**: the sauce has 1.3 tbsp chili powder per cup of broth, a little above the usual 1. That is a matter of taste.
- **gnocchi-with-spinach-and-tomato-cream**: 2 lb of gnocchi for 4 servings is generous, but gnocchi is far less dense than dry pasta.
