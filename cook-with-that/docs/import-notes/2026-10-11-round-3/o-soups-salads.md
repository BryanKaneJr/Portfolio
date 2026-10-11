# o-soups-salads: handoff notes

Theme file: `src/data/originals/soupsSaladsSandwiches.ts` (`SOUPS_SALADS_SANDWICHES_RECIPES`), copied here as
`soupsSaladsSandwiches.ts`. 25 original recipes, all `source: ORIGINAL_DRAFT`, written from general cooking knowledge
(no published recipe was searched for or opened).

`npm run check` passes in my worktree: tsc clean, 220 recipes and 273 ingredients validate, 10 suites / 387 tests pass
(362 before, plus one tagline test per new recipe).

## Worktree setup (integrator, please read)
My worktree was created from the last commit (124 recipes, 288 tests), not from the main checkout's uncommitted
round-2 state (195 recipes, `src/data/originals/`, `docs/original-recipes.md`, `tests/originals.test.ts`...). Before
starting I copied the main checkout's `cook-with-that/` working files (excluding `node_modules` and `.import-cache`)
into my worktree, so my diff is against that 195-recipe state. Only my theme file, `scripts/import/ingredient-map.ts`
and `src/data/ingredients.ts` (via `import:catalog`) changed after that.

## Recipes added (in gap-filling order)
Gap pairs the brief listed, made **required** on both sides:

| # | Title | Gap pairs it fills / notes |
|---|---|---|
| 1 | Chicken Tortilla Soup | black beans + chicken, black beans + tomato (fresh plum tomatoes); first recipe to require corn tortillas |
| 2 | Taco Salad | black beans + ground beef, black beans + tomato (also cheddar) |
| 3 | Black Bean and Corn Salad | black beans + bell pepper, black beans + tomato |
| 4 | Black Bean Soup | black beans + bell pepper |
| 5 | Creamy Broccoli and Potato Soup | broccoli + potato |
| 6 | Italian Wedding Soup | ground beef + spinach |
| 7 | Cobb Salad | |
| 8 | Caesar Salad | |
| 9 | Greek Salad | horiatiki: no lettuce, green pepper, Kalamata olives, whole slab of feta |
| 10 | Broccoli Salad with Bacon and Cheddar | |
| 11 | Spinach and Strawberry Salad | |
| 12 | Classic Coleslaw | |
| 13 | Waldorf Salad | first recipe to require walnuts |
| 14 | Macaroni Salad | |
| 15 | Split Pea Soup with Ham | |
| 16 | Butternut Squash Soup | |
| 17 | Beef and Barley Soup | |
| 18 | Corn Chowder | |
| 19 | Cream of Mushroom Soup | |
| 20 | BLT Sandwich | |
| 21 | Philly Cheesesteak | |
| 22 | Meatball Subs | |
| 23 | Egg Salad Sandwiches | |
| 24 | Reuben Sandwich | |
| 25 | Cuban Sandwich | |

Effect in my worktree (`npm run coverage-report`): exact matches for common 2-ingredient pairs 80% → 86%, triples
30% → 38%. Dish types: soup 18 → 27, salad 8 → 18, sandwich 11 → 17. "Corn tortillas" left the "no recipe requires
it" list.

## Skipped from my list (29 dishes, 25 needed, so no replacements)
- **Classic Vegetable Soup**: near-duplicate of NHLBI `minestrone-soup` (tomato-vegetable soup with green beans,
  peas, carrot, celery) and `summer-vegetable-stew`.
- **Cucumber Tomato Salad**: near-duplicate of the seed `greek-chickpea-salad` (cucumber, tomato, red onion, feta,
  red wine vinaigrette) and of my own Greek Salad.
- **Tuna Melt**: near-duplicate of Based Cooking `tuna-sub` (mayo tuna salad, cheddar, bread, tomato).
- **Club Sandwich**: dropped as the fourth to get to 25; it is a BLT plus turkey, and the BLT is in this set.

## Catalog additions (all through `ingredient-map.ts` + `npm run import:catalog`)
New `{ add }` keys I reviewed (registered in `new-ingredients.txt`): anchovies, blue cheese, kalamata olives,
split peas, ham hock, pearl barley, ribeye steak, provolone, sauerkraut, swiss cheese, tortilla chips, grapes,
celery seed.

Keys registered by other workers that my recipes also need (identical key and category, so merge only one copy;
**duplicate keys in the map object literal will fail tsc**): `pork tenderloin` (o-pork-seafood), `corned beef`
(o-beef). The sweep worker also registered `swiss cheese`, `blue cheese`, `kalamata olives` and `grapes` with the
same keys and categories.

Pre-reviewed keys that were already in the map but not in the catalog, now added because my recipes need them:
romaine lettuce (o-chicken uses it too), apple cider vinegar, sunflower seeds, prepared horseradish.

Judgement calls for review:
- `emmental` is an alias of Swiss cheese (US "Swiss" is an Emmental-style cheese; it's what a UK cook buys for a
  Reuben). Drop the alias if you'd rather keep them apart. Gruyère stays separate.
- Kalamata olives are kept apart from the catalog's black olives (brine-cured Greek olives vs mild canned ripe ones).
- Ham hock is kept apart from ham (mostly bone, skin and collagen; it flavors the pot rather than being eaten
  sliced). Split Pea Soup requires both.
- Rye bread, Cuban bread, hoagie and sub rolls use `bread` (the mapping doc says bread covers its kinds);
  acini di pepe and orzo use `pasta`; strawberries use `berries`; ribeye is its own ID rather than sirloin.
- No `GRAMS_PER_CUP` additions are needed: for solids without a cup weight I gave a weight in parentheses
  ("1/2 cup (about 2 1/2 oz)") so metric shows grams (olives, cranberries, sunflower seeds, almonds, grapes,
  blue cheese, queso fresco, sauerkraut, tortilla chips, barley, pasta). I checked every recipe's metric display.

## For the culinary reviewer
- **Caesar Salad** builds its dressing on mayonnaise instead of a raw egg yolk (a food-safety choice; the tagline
  says so). Anchovies are required, since they define the dish.
- **Cuban Sandwich** uses a mojo-marinated pork tenderloin roasted to 145°F (63°C) so the sandwich can be made in an
  evening; orange plus lime stands in for sour orange. The marinade is discarded.
- **Chicken Tortilla Soup**: the onion, chili, tomato and two torn corn tortillas are simmered in 2 cups of broth and
  blended before the chicken goes in, which thickens the base. Six more tortillas are oven-baked into strips.
- **Italian Wedding Soup**: about 55 one-inch meatballs poach raw in the broth (160°F / 71°C stated).
- **Philly Cheesesteak**: the steak is part-frozen for 30–45 minutes so it slices thin; that time is in prepMinutes.
  Thin-sliced whole-muscle beef is cooked "until no pink remains", with no thermometer step.
- **Hard-boiled eggs** (Cobb, Egg Salad): cover with cold water, bring to a boil, cover off the heat for 11 minutes,
  then ice water.
- Hot soups are blended in batches, the blender no more than half full, with the lid held down under a towel.
- **Split Pea Soup**: salt only if needed at the end (hock and ham are salty); low-sodium broth is specified.
- **Broccoli Salad** uses raw broccoli, as the classic does; it softens during a 30-minute chill.
- Chilling, marinating and freezing time is counted in prepMinutes: Coleslaw 80, Macaroni Salad 80, Broccoli Salad
  50, Philly 50, Cuban 45, Black Bean and Corn Salad 35.
