# Import worker notes

Each parallel import round leaves one notes file per worker: what it imported (source key → recipe id), which
library gap each recipe fills, **every change made to the source recipe** (fixed ratios, temperatures, missing
ingredients, swapped hard-to-find items), the pages it skipped and why, and its provenance checks.

Use them during culinary review: a recipe that differs from its original on purpose is explained here.

- `2026-10-11/`: round 2. Based Cooking slices `bc5` (aglio-e-olio … collard-greens), `bc6` (cooked-chickpeas …
  lemon-juice-salad-dressing), `bc7` (lemon-pudding … quesadilla), `bc8` (quickbreakfastspaghetti … zopf), and
  `nhlbi2` (the NHLBI snapshot). Worker counts inside each file describe its own worktree before merging.
- `2026-10-11-round-3/`: round 3. Seven workers wrote original recipes by theme (`o-chicken`, `o-beef`,
  `o-pork-seafood`, `o-vegetarian`, `o-soups-salads`, `o-breakfast-sides`, `o-baking`): their notes list ratios
  and choices to cook-test rather than source changes. `va` and `nhlbi-books` added two PDF sources, and `sweep`
  took what was left in Based Cooking and NHLBI's web recipes.
