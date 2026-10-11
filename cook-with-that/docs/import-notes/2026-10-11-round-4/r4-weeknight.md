# r4-weeknight: notes for the integrator and the culinary reviewer

Theme file: `src/data/originals/weeknight.ts` (`WEEKNIGHT_RECIPES`), 20 original recipes, all `source: ORIGINAL_DRAFT`.
Written from general cooking knowledge; no published recipe was searched for or opened. `npm run check` passes in my
worktree: 462 recipes, 350 ingredients, 10 suites, 648 tests.

## Added (list order)

| # | Title | Meals / dish types | Gap it fills |
|---|---|---|---|
| 1 | One-Pot Chicken and Orzo with Spinach | dinner / one_pot | chicken + spinach (7 → 10 with #2 and #12); orzo cooked risotto-style in broth |
| 2 | Tuscan Chicken with Sun-Dried Tomatoes | dinner / skillet | first sun-dried tomato recipe |
| 3 | Sheet-Pan Gnocchi with Sausage and Peppers | dinner / bake | gnocchi (1 → 3 recipes need it), sheet-pan dinners |
| 4 | Avgolemono (Greek Lemon Chicken and Rice Soup) | lunch, dinner / soup, one_pot | soups (37 → 42 overall) |
| 5 | Tater Tot Casserole | dinner / bake | first tater tot recipe; from-scratch mushroom gravy, no canned soup |
| 6 | King Ranch Chicken Casserole | dinner / bake | Tex-Mex casserole; canned green chiles (1 → 4) |
| 7 | Chicken Spaghetti | dinner / pasta, bake | pasta + chicken (6 → 10 with #1, #18 and #20) |
| 8 | Smothered Pork Chops | dinner / skillet | pork chops (6 → 7), Southern braise |
| 9 | Sheet-Pan Salmon with Asparagus and Potatoes | dinner / bake | salmon + potato (1 → 2), asparagus (1 → 2) |
| 10 | Cabbage and Kielbasa Skillet | dinner, lunch / skillet | first kielbasa recipe |
| 11 | Pasta e Fagioli | lunch, dinner / soup, one_pot | cannellini, pancetta |
| 12 | Chicken Gnocchi Soup | lunch, dinner / soup, one_pot | chicken + gnocchi (0 → 1) |
| 13 | Taco Soup | lunch, dinner / soup, one_pot | pinto beans (2 → 3), beef broth |
| 14 | Cheeseburger Soup | lunch, dinner / soup, one_pot | ground beef + potato (4 → 5) |
| 15 | Sheet-Pan Shrimp Boil | dinner / bake | andouille (1 → 2), Old Bay (1 → 2), corn on the cob |
| 16 | Southwest Black Bean Pasta Skillet | dinner, lunch / pasta, skillet, one_pot | **pasta + black beans (0 → 1)**, a common-pair gap named in CLAUDE.md; vegetarian |
| 17 | Baked Pesto Salmon with Green Beans | dinner / bake | pesto (1 → 2), green beans |
| 18 | Chicken Caesar Pasta Salad | lunch, dinner / salad, pasta | make-ahead main-dish salad (dressing is mayo-based, no raw egg, no anchovy, so it differs from the library's Caesar Salad) |
| 19 | French Dip Sandwiches | lunch, dinner / sandwich | first roast beef recipe; provolone (1 → 2) |
| 20 | Chicken Bacon Ranch Pasta | dinner / pasta | pasta + bacon (2 → 3); ranch flavor built from dried dill, dried parsley, onion and garlic powder, so no packet or bottled dressing |

Every recipe has a dish type.

## Skipped and swapped
- **Chicken and Wild Rice Soup** (list #11): written and passing, then held back. A `wild rice` catalog item breaks
  `tests/import.test.ts` › "a word match is only ever a suggestion", which uses `'wild rice'` as its example of an
  unreviewed name (round 3 moved the example there from `'rice noodles'` for the same reason). Tests aren't in my files
  to change, so I swapped in **Chicken Bacon Ranch Pasta**, the 21st dish on my list. The finished soup is in
  `extra-chicken-and-wild-rice-soup.ts.txt` with the four steps to add it: swap the test example to `'black rice'`
  (checked: still `unmapped` with suggestion `rice`), add the `wild rice` map entry, `import:catalog`, append. I marked
  `wild rice` WITHDRAWN in `new-ingredients.txt`.
- No dish on my list duplicated a library recipe. Closest neighbours, all different dishes: Chicken Spaghetti vs Chicken
  Pasta Casserole (penne, tomatoes and mozzarella, no cheese sauce); Chicken Caesar Pasta Salad vs Caesar Salad; Sheet-Pan
  Gnocchi vs Gnocchi with Spinach and Tomato Cream; Taco Soup vs Beef & Bean Chili.

## Catalog additions (`catalog-keys.txt`)
`kielbasa` (protein), `tater tots` (produce), `sun dried tomatoes` (pantry, name "Sun-dried tomatoes"), `roast beef`
(protein). None has aliases, none appears in any existing recipe's steps (grepped), and the search audit passes.
- **tater tots → produce.** Following frozen hash browns (mapped to `potato`, produce) and `frozen_spinach` (produce).
  It is a processed product, so I kept it separate from `potato`, the way the catalog keeps bacon apart from pork chops.
  Change the category if you prefer pantry.
- **roast beef** means cooked, sliced roast beef (deli or leftover). The French Dip says "thinly sliced deli roast beef".
  A raw roast stays `chuck_roast` or another cut.
- **kielbasa** is fully cooked smoked sausage, separate from raw `sausage` and from `andouille_sausage`. The shrimp boil
  uses andouille.
- I didn't add `polish sausage` as a spelling variant. It is a true synonym, but it would put Kielbasa in the results for
  every "sausage" search. Add it if you want it.

## For the culinary reviewer: what to cook-test first
- **Avgolemono:** tempering. 2 cups of hot broth go into 3 eggs + 1/2 cup lemon juice, then back into the pot over low
  heat to about 160°F / 71°C without boiling. Check that 2/3 cup rice in 8 cups of broth gives the right body for 6.
- **Southwest Black Bean Pasta Skillet:** one-pan pasta liquid. 8 oz rotini in 2 1/2 cups broth plus a 14.5-oz can of
  tomatoes, covered, 10–12 minutes. The step says to add water if it dries out early. Check that it isn't soupy or
  scorched in a 12-inch skillet.
- **One-Pot Chicken and Orzo:** 1 1/2 cups (10 oz) orzo in 3 1/2 cups broth, covered, 10–12 minutes. Same check.
- **King Ranch:** the corn tortillas go in unsoftened and soften in the sauce over 40–45 minutes of baking. Check that
  they don't stay leathery. If they do, dip each one briefly in the warm sauce first.
- **Smothered Pork Chops:** 3/4-inch bone-in chops braised 25–30 minutes on low after searing. Check tenderness. Thicker
  chops may need 10 minutes more.
- **Tater Tot Casserole:** frozen tots on a hot filling at 400°F (200°C) for 35–40 minutes. Check that the tots crisp
  and the bottoms don't go soggy.
- **Sheet-pan timings** (425°F / 220°C): shrimp boil (potatoes 15 minutes, then corn and andouille 10, then shrimp 6–8);
  salmon and potatoes (potatoes 20, then salmon on asparagus 10–14); pesto salmon (beans 8, then salmon 12–15); gnocchi
  roasted from the package 22–27 minutes, turned once.
- **Salt:** soups built on store broth give salt as a starting point, and every soup has a "taste for salt" step. Taco
  Soup 1 tsp, Cheeseburger and Chicken Gnocchi 3/4 tsp.

## Equipment
Only oven, stovetop, sheet pans and ordinary pots: a 12-inch (deep, lidded) skillet or Dutch oven, a large soup pot,
a 9-by-13-inch baking dish. Pasta e Fagioli mashes some beans with a fork, so no blender.

## Wording notes (step checker)
Steps always say "corn tortillas" (bare "tortillas" reads as flour tortillas), "diced tomatoes" for canned (bare
"tomatoes" reads as fresh), "dried dill" and "dried parsley" in full, "Dijon" (bare "mustard" reads as yellow mustard)
and "green chiles", never "green chilies" (which reads as the fresh chili).
