# Checked against published recipes (2026-10-12)

The owner asked to take the 404 recipes written for the app (27 seed + 377 originals) and "find recipes on the
internet that we don't have right to and compare against to see if they work… And cut the least confident ones."
Nobody will cook-test them (decision 18), so this is the check that each one cooks like established versions of the
same dish.

## How
- Nine checkers took about 45 recipes each (brief in this folder's history: published recipes are a reference for
  facts, never copied; when ours was off, only the wrong number moved, to a value inside the range several sources
  agree on). For each recipe they picked the 2–4 facts that decide whether it works (liquid to grain; flour, fat,
  sugar, eggs and leavening; thickener to liquid; pan, oven and time; frying temperature; doneness) and compared them
  with 2–5 published versions: America's Test Kitchen, Food Network, The Kitchn, Taste of Home, King Arthur, BBC Good
  Food, RecipeTin Eats, Once Upon a Chef, Budget Bytes and others. About 500 searches and 66 page reads, 1,208
  distinct sources cited, 3 per recipe for most. Each recipe got a score from 1 to 5 for how sure the checker was
  that a home cook gets a good result.
- Every verdict, score, source list and note is in `verdicts.json`; each checker's summary is `vf1.md` … `vf9.md`.

## Result
- **Every recipe works.** 393 matched published versions as written; 11 had one number outside the published range
  and were fixed. No checker scored anything below 4, so **nothing was cut**: the cut bar was "doesn't work and can't
  be fixed with a small change, or can't be checked", and no recipe met it.
- **Scores:** 308 at 5, 96 at 4. A 4 means it works and sits inside the range, but near an edge of it or in a dish
  that depends more on the cook's pan or oven (each 4's reason is in `verdicts.json`). These are the candidates if
  the owner wants a stricter cut.

### The 11 fixes
| Recipe | Was | Now | Why |
|---|---|---|---|
| classic-grilled-cheese | 3–4 min a side | 5–7 and 4–5 min | medium-low needs longer to melt the cheese |
| greek-lemon-chicken-and-rice | 2 1/4 cups broth for 1 1/2 cups rice | 3 cups | oven versions use 2–2 1/4 cups per cup of rice |
| chicken-and-wild-rice-soup | 1/3 cup flour | 1/2 cup | a creamy soup needs 1–2 tbsp per cup of liquid |
| pork-schnitzel | 1 cup oil | 1 1/2 cups, 1/4 inch in a 12-inch pan | deep enough to swirl over the tops |
| rosemary-garlic-lamb-chops | baste 2–3 min | 3–5 min | 1 1/4-inch chops need longer to reach 130°F |
| cauliflower-cheese | 1/4 cup flour | 1/3 cup | sauce was thinner than every published one |
| pad-kra-pao | 2 tbsp oyster, 2 tsp fish sauce | 3 tbsp, 1 1/2 tbsp | was about 60% of the lightest published seasoning |
| cilantro-lime-rice | 15 min simmer | 18 min | rice could stay firm |
| oven-baked-caramel-popcorn | 1/2 cup kernels | 1/3 cup | the caramel coats 10–12 cups, not 15 |
| tres-leches-cake | 20–25 min bake | 25–30 (now 28–32 after the rework) | below every published time |
| vegetable-tempura | 3/4 cup water in the batter | 1 cup | batter was too thick |

## Provenance: 16 recipes made our own
The checkers also flagged recipes whose quantities match **one** published recipe across the board. The writers
hadn't looked anything up (round 5's transcripts were audited); these are classics they recalled. The rule is that a
recipe may follow a dish's standard ratios but never one source's whole formula, so two more agents reworked each
from ratios: at least four deciding quantities (or the method) now differ from the matched source, every quantity sits
inside the range of 3–5 published versions, and none tracks a different single source. Each was then checked the same
way (scores 4–5). Details: `rework-a.md`, `rework-b.md`, and each recipe's `rework` entry in `verdicts.json`.

| Recipe | Matched | Now |
|---|---|---|
| chocolate-chip-cookies | Nestlé Toll House | more flour and brown sugar, rested dough, 350°F, flaky salt |
| fluffy-pancakes | Allrecipes Good Old-Fashioned | bigger batch, whipped whites folded in, vanilla |
| snickerdoodles | the standard formula | a little brown sugar, cinnamon in the dough, bigger cookies at 400°F |
| peanut-butter-blossom-cookies | Pillsbury Peanut Blossoms | more peanut butter, less sugar and soda, 350°F |
| cheeseburger-soup | Taste of Home | new roux, broth, milk, cheese and salt amounts |
| italian-wedding-soup | Sweety Salado | bigger pot of broth, more pasta and spinach, new meatball mix, serves 8 |
| baked-berry-oatmeal | Heidi Swanson | more oats, milk, butter and berries, one-bowl method, 9-inch dish |
| zucchini-fritters | Once Upon a Chef | more zucchini, flour, feta and dill; lemon zest; longer salting |
| tres-leches-cake | The Pioneer Woman | six-egg sponge, whole milk as the third milk, cream only on top |
| gingerbread-cookies | McCormick | more flour and molasses, allspice and pepper, rolled before chilling |
| chocolate-fudge | Eagle Brand label | fewer chips, browned butter, toasted pecans |
| blueberry-crumb-bars | Allrecipes / Smitten Kitchen | oat crumb, half brown sugar, more berries, 350°F |
| key-lime-pie | Gimme Some Oven | tarter filling baked low, salted crust, longer chill |
| shortbread | Ahead of Thyme | powdered sugar, more flour and cornstarch, 300°F for an hour |
| oven-baked-caramel-popcorn | Allrecipes, halved | molasses, more salt, 225°F, crunch test |
| chocolate-dipped-coconut-macaroons | Once Upon a Chef | almond, meringue folded in, 350°F, more chocolate |

Lower-concern overlaps were left as they are, because they share only the dish's standard numbers: lava cakes
(Jean-Georges' chocolate, butter and eggs), brown butter blondies, mango sticky rice, oyakodon (the textbook 4:1:1
sauce), chipotle black bean dip, chicken Marsala's two liquids, egg salad.

## For new batches
New written recipes get this check too: compare each with published versions before merging, and rework any that
match one source across the board (`docs/original-recipes.md`).
