# o-pork-seafood: handoff notes

Theme file: `src/data/originals/porkSeafood.ts` (`PORK_SEAFOOD_RECIPES`), 25 original recipes, all `source: ORIGINAL_DRAFT`.
`npm run check` in my worktree passes: 220 recipes, 263 ingredients, 387 tests. Common-pair exact matches went from
80% to 82% (`npm run coverage-report`).

Worktree note: the worktree started on `master` (c061183a). Before making any changes I moved it to
`claude/cook-with-that-recipe-sources` (0759aea8), and the baseline check passed there (195 recipes, 362 tests).

## Recipes added (in file order)

| # | Title | Library gap it fills |
|---|---|---|
| 1 | Pork, Broccoli and Bell Pepper Stir-Fry | **broccoli + bell pepper** (both required); first pork stir-fry |
| 2 | Pork and Black Bean Tacos | **black beans + tomato**, **black beans + bell pepper** (all required); ground pork |
| 3 | Cajun Shrimp and Rice Skillet | **rice + spinach**, **spinach + bell pepper** (all required); one-pan shrimp and rice |
| 4 | Pulled Pork | first pulled pork; uses pork shoulder and barbecue sauce |
| 5 | Pork Carnitas Tacos | carnitas: braised, then fried in their own fat |
| 6 | Garlic Herb Pork Tenderloin | first pork tenderloin recipe (new catalog item) |
| 7 | Oven-Baked BBQ Ribs | first ribs recipe (new catalog items: pork ribs, barbecue sauce) |
| 8 | Pork Schnitzel | breaded pork cutlet |
| 9 | Bangers and Mash with Onion Gravy | British sausage dinner |
| 10 | Toad in the Hole | sausages + Yorkshire pudding batter, all pantry staples |
| 11 | Ham and Pea Pasta | first ham pasta |
| 12 | Pork Chops with Apples and Onions | a 4th pork chop dish, but a different one (apples, cider vinegar) |
| 13 | Sausage, Potato and Green Bean Sheet Pan | sheet-pan dinner |
| 14 | Shrimp Scampi with Linguine | shrimp pasta (the library's garlic-butter shrimp is a skillet with no pasta) |
| 15 | Fish Tacos with Lime Slaw | first fish taco; cod + cabbage |
| 16 | Beer-Battered Fish and Chips | deep-fried fish (first use of beer in a batter) |
| 17 | Lemon Garlic Baked Cod | quick baked white fish |
| 18 | Salmon Cakes | canned salmon (new catalog item) |
| 19 | Pan-Seared Salmon with Lemon Butter Spinach | salmon + spinach |
| 20 | Tuna Pasta Bake | canned tuna + pasta + cheddar + corn |
| 21 | Shrimp and Grits | grits (new catalog item); listed for breakfast and dinner |
| 22 | Sausage and White Bean Casserole | sausage + cannellini, one pot (see swaps) |
| 23 | Rosemary Garlic Lamb Chops | first lamb chops recipe (new catalog item) |
| 24 | Lamb Gyros with Tzatziki | ground lamb + pita + Greek yogurt |
| 25 | Mussels in White Wine and Garlic | first mussels recipe (new catalog item) |

## Skipped from my list, and swaps

The list had 28 dishes and I wrote 25:
- **Pork Fried Rice**: skipped as a near-duplicate. The library already has Vegetable Fried Rice and Arroz Chaufa,
  and o-chicken has Chicken Fried Rice with Peas and Carrots.
- **Honey-Glazed Ham**: skipped. It's a holiday roast that needs a whole 8–10 lb bone-in ham and serves 12 or more,
  while the rest of the list is weeknight mains. Easy to add later if wanted.
- **Shrimp Pad Thai**: written, then swapped out for **Sausage and White Bean Casserole** (also on my list). Adding
  the `rice noodles` catalog item breaks `tests/import.test.ts` › "a word match is only ever a suggestion", which
  uses `'rice noodles'` as its example of an unreviewed name. Tests aren't in my list of files to change. The
  finished recipe is in `extra-shrimp-pad-thai.ts.txt` if the integrator wants it. It needs:
  1. In that test, swap the example for another unreviewed name: `'wild rice'` (checked: still
     `{ status: 'unmapped', key: 'wild rice', suggestion: 'rice' }`).
  2. Map entries:
     `'rice noodles': { add: 'grain' }, // dried flat rice noodles (rice sticks); egg noodles are separate`,
     `'rice sticks': '=rice noodles',` and
     `'tamarind paste': { add: 'pantry' }, // sour tamarind pulp sold in jars, the base of pad thai sauce`.
  3. `npm run import:catalog -- "rice noodles" "tamarind paste" "bean sprouts" "peanuts"` (bean sprouts and
     peanuts are pre-reviewed keys that are already in the map).
  The sweep worker registered `rice noodles` too, so they will hit the same test. I added a "withdrawn" line for my
  rice noodles, tamarind paste, bean sprouts and peanuts entries in `new-ingredients.txt`.

## Ingredients

New catalog entries (`catalog-keys.txt`): pork tenderloin, pork ribs (alias baby back ribs), barbecue sauce (spice,
like ketchup and chili sauce; aliases bbq sauce, barbeque sauce), grits, canned salmon, mussels, lamb chops,
malt vinegar and apple cider vinegar. Apple cider vinegar was already a pre-reviewed key in the map, so it has no
new map entry. o-chicken registered `barbecue sauce | spice` too, with the same key and category.

- **Malt vinegar** is only an optional serve-with (fish and chips), so it's one of the catalog items "no recipe
  requires yet" in the coverage report. I added it so that Avoid sees it. Drop the opt line and the entry if you'd
  rather not have optional-only catalog items.
- Kept separate on purpose: pork tenderloin vs pork loin vs pork chops (different cuts that cook differently);
  canned salmon vs salmon fillets (same rule as canned tuna vs tuna steak); lamb chops vs lamb shoulder and ground lamb.

## For the integrator and culinary reviewer

- **Doneness:** pork 145°F / 63°C with a rest; sausages and ground pork or lamb 160°F / 71°C; fish 145°F / 63°C;
  salmon cakes 160°F because they're bound with egg. For lamb chops I used 145°F (63°C), the USDA minimum, which is
  medium; many cooks pull them at 130–135°F. Shoulder dishes (pulled pork, carnitas) cook far past 145°F until they
  shred, and pulled pork says "about 200°F / 93°C".
- **Tacos are tagged `sandwich`** to follow the library's earlier taco recipes (Slow-Cooker Chicken Tacos,
  Beef Chimichangas).
- **Beer-Battered Fish and Chips has no dish type.** None fits honestly. I wrote the frying-oil temperatures in steps
  that don't mention the oven, so metric shows plain °C rather than fan or gas settings.
- **Pulled Pork is tagged `bake`** (oven-braised), and the buns are optional.
- **Two sets of servings to check:** Shrimp and Grits lists breakfast as well as dinner (it's a brunch staple).
  Mussels serve 4 as a main (1 lb each) and are also tagged appetizer.
- **Step wording I chose to get past the step checker:** "corn tortillas" every time (bare "tortillas" means flour
  tortillas), "bell pepper" rather than "the pepper", "canned salmon" rather than "the salmon" in Salmon Cakes,
  "Greek yogurt" rather than "the yogurt", "Dijon mustard" rather than "the mustard", "table knife" rather than
  "butter knife", and "the tomatoes" rather than "diced tomatoes" (an alias of canned tomatoes) in the taco relish.
- Quantities that would read badly in metric got a weight: grits "1 cup (about 150 g)", queso fresco "2 oz",
  cabbage "8 oz".
