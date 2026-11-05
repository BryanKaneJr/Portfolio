# vf6 review: soupsSaladsSandwiches.ts (25) and comfort.ts (20)

**Counts:** 45 confident, 0 fixed, 0 cut. Scores: 35 at 5, 10 at 4.

`patch.diff` is empty because no recipe needed a change. `npm run check` passes: typecheck, 668 recipes and 399 ingredients
validated, 11 of 11 test suites and 874 tests.

## What was checked
For each recipe I compared the deciding facts against 2–3 published versions:
- liquid to grain or pasta in the one-pot pastas and the soups
- roux to liquid in the casseroles and chowders
- dressing to vegetables in the slaws and salads
- oven temperature and time for the bakes, braises and roasts
- doneness temperatures

Every deciding number fell inside the range the sources share. A few sit at an edge, and I left them as written:
- **Broccoli salad sugar:** 1 tbsp, against the usual 1 1/2–3 tbsp (ATK uses 2). The dried cranberries add sweetness and it's a matter of taste, so I left it.
- **Cheeseburger macaroni liquid:** 2 1/2 cups of broth for 8 oz of elbows, the low end of the 2 1/2–3 cups that one-pot versions use. The recipe already says to add water if it looks dry.
- **Porcupine meatballs rice:** 1/2 cup of rice per 1 1/2 lb of beef, against the usual 1/2 cup per lb. That means fewer "quills", but there's no cooking risk.
- **Swiss steak braise:** 1 3/4–2 hours at 325°F, inside Alton Brown's 1 1/2–2 hours and ATK's about 2 hours at 300°F. It also has a fork-tender cue.
- **BLT bacon:** 15–20 minutes at 400°F for thick-cut, inside The Kitchn's (about 18) and ATK's (13–16).

The house rules hold in every recipe: ground beef at 160°F, poultry at 165°F, pork at 145°F with a rest, salt in every savory dish, and no egg warnings.

## Cuts
None.

## Fixes
None.

## Provenance flags
- **italian-wedding-soup (partial):** the closest match I found is Sweety Salado's "Easy Italian Wedding Soup with
  Homemade Meatballs" (https://sweetysalado.com/en/home/wprm_print/easy-italian-wedding-soup-recipe-with-homemade-meatballs).
  - **Identical:** the whole soup base (2 tbsp oil, 2 ribs celery, 8 cups broth, 3/4 cup acini di pepe, 5 oz baby spinach), 1 egg, 1/2 cup Parmesan, 1/4 cup parsley, 3/4 tsp salt, 1/4 tsp pepper, and 6 servings.
  - **Different:** ours uses all beef (theirs is half beef, half pork), 1/3 cup plain crumbs soaked in 2 tbsp milk (theirs is 1/2 cup Italian crumbs), different garlic, and no oregano.

  The soup-base numbers are also shared by Little Spice Jar's version, so they're common. The meatball numbers are the near-copy part. I made no change; flagged for the owner to decide.

Noted but not flagged:
- **egg-salad-sandwiches** shares 8 eggs, 1 rib of celery, 2 tbsp chives and 1 tsp lemon juice with a Cooklang version. Its mayo (1/2 cup), Dijon (2 tsp) and salt differ, and egg salads converge on these numbers.
- **chicken-tetrazzini** shares 12 oz pasta, 3 cups chicken, 1 cup peas and 375°F with Simply Recipes. The rest of its quantities differ.
