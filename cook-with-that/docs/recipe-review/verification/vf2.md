# vf2 review: chicken.ts (25) and world.ts (20)

Base: `b1278d6b`. 45 recipes checked against 2–4 published versions each (URLs in `verdicts.json`).

## Counts
| Verdict | Count | Scores |
|---|---|---|
| Confident | 44 | 5 × 35, 4 × 9 |
| Fixed | 1 | 4 |
| Cut | 0 | – |

## Cuts
None. Every dish has several well-known published versions, and each recipe's key numbers (rice-to-liquid ratios, roux and
thickener amounts, dumpling leavening, oven temperatures and times, frying temperature, doneness) fall inside the range
those versions use.

## Fixes
- **greek-lemon-chicken-and-rice**: changed the chicken broth from 2 1/4 to **3 cups**. The rice is baked under the chicken, covered
  for 25 min and then uncovered for 15–20 min. Published oven versions use 2 to 2 1/4 cups of liquid per cup of long-grain rice
  (RecipeTin Eats 2 1/4, The Chunky Chef 2, Hungry Happens 2 1/4 plus lemon, Fresh Connection more). Ours had about 1.6, so the top
  layer would likely stay hard. The new amount is about 2.1 to 1. Nothing else changed.

## Close calls kept as written (score 4)
- **jollof-rice**: 1 1/2 cups of broth per cup of parboiled rice, plus the reduced purée. That is the wet end of the published range
  (about 1–1.2 cups of stock per cup, plus the stew base), but converted rice tolerates it, so I left it.
- **arroz-con-pollo**: about 1.75 cups of liquid (broth plus tomato sauce) per cup of long-grain rice. Published versions run from 1.25
  to 2 per cup, and ours keeps a reserve splash of water, as ATK's does.
- **classic-chicken-pot-pie**: bakes 30–35 min at 400°F. That is shorter than some published pies (35–55 min), but the filling goes in
  hot and already cooked, and the doneness cue is clear.
- **chicken-broccoli-and-rice-casserole**, **cheesy-chicken-enchiladas**, **jambalaya-with-chicken-and-sausage**,
  **roast-turkey-breast-with-pan-gravy**, **weeknight-coq-au-vin**, **chicken-pad-see-ew**: in range. They score 4 only because
  the times vary with the cook's pan or oven.

## Audit flags checked and dismissed
- `chicken-katsu-with-rice`, liquid 1.17 per cup: correct for Japanese short-grain rice (1.1–1.2, Just One Cookbook).
- `chicken-broccoli-and-rice-casserole` and `mujadara`, high liquid per cup: the figure counts the cheese sauce and the lentil boiling
  water. The rice itself gets 1 3/4 cups per cup.
- `ropa-vieja` and `japchae`, no internal temperature: braised until it shreds, and thin stir-fried strips. Neither needs one.

## Provenance flags
None. No recipe matches a single published recipe across the board. One partial overlap, for the record:
**chicken-marsala** uses 3/4 cup Marsala and 1/2 cup broth, the same two liquid amounts as Cook's Country's chicken Marsala.
Its other quantities, ingredients (shallot, thyme, 10 oz mushrooms, dry Marsala) and method differ, so I don't treat it as a copy.

## Check
`npm run check` after the fix: typecheck OK, 668 recipes and 399 ingredients pass validation, and 874 of 874 tests pass.
