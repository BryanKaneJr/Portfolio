# r4-sides-apps: handoff notes

Theme file: `src/data/originals/sidesAppetizers.ts` (`SIDES_APPETIZERS_RECIPES`), 20 original recipes, all
`source: ORIGINAL_DRAFT`. Copy `sidesAppetizers.ts` from this folder over the empty theme file, add the 16 map lines in
`map-entries.ts.txt` to `scripts/import/ingredient-map.ts`, then run `npm run import:catalog -- "<key>"` for each of
the 7 keys in `catalog-keys.txt`. With that, `npm run check` passed in my worktree: 462 recipes, 353 ingredients,
648 tests.

## Added (20)

The library had 59 side recipes, 28 appetizers and 58 snacks before this batch.

| Recipe | Meals / dish type | Gap it fills |
|---|---|---|
| German Potato Salad | side, dinner / salad | warm vinegar-and-bacon potato salad; the only other potato salad uses mayonnaise |
| Mashed Sweet Potatoes | side, dinner / one_pot | brown-butter mash; sweet potato had 5 recipes, none mashed |
| Roasted Cauliflower with Parmesan and Garlic | side, dinner / bake | cauliflower 1 → 2 recipes |
| Mexican Street Corn | side, snack / bake | elote; first recipe for **cotija** |
| Rice and Vermicelli Pilaf | side, dinner / one_pot | the "rice with pasta" pair CLAUDE.md lists as a gap |
| Sautéed Garlic Mushrooms | side, dinner / skillet | a plain mushroom side (the only mushroom side was Stuffed Mushrooms) |
| Honey-Glazed Carrots | side, dinner / skillet | a quick carrot side |
| Crispy Roasted Chickpeas | snack, appetizer / bake | a pantry snack |
| Jalapeño Poppers | appetizer, snack / bake | classic party appetizer |
| Potato Skins | appetizer, snack / bake | classic pub appetizer |
| Seven-Layer Dip | appetizer, snack / none | first recipe for **refried beans** |
| Crab Cakes | dinner, appetizer / skillet | first recipe for real **crab meat**; Old Bay 1 → 2, saltines 1 → 2 |
| Shrimp Cocktail | appetizer, snack / none | horseradish 1 → 2 |
| Baba Ganoush | appetizer, snack / bake | a Levantine dip to sit beside Hummus; tahini 3 → 4 |
| Pork and Cabbage Potstickers | appetizer, dinner, snack / skillet | first recipe for **dumpling wrappers** |
| Smashed Cucumber Salad | side, appetizer / salad | Chinese cold dish |
| Three Bean Salad | side, lunch / salad | picnic classic; celery seed 1 → 2, kidney beans 4 → 5 |
| Fattoush | side, lunch / salad | first recipe for **sumac**; radish 2 → 3, mint 1 → 3 |
| Tabbouleh | side, lunch / salad | first recipe for **bulgur** |
| Southern Collard Greens | side, dinner / one_pot | first recipe for **collard greens**; ham hock 1 → 2 |

The title on the list was "Potstickers". I titled it "Pork and Cabbage Potstickers" (id `pork-and-cabbage-potstickers`)
so the card says what's inside.

## Skipped (4 of the 24 on the list; no swaps needed)
- **Greek Lemon Potatoes**: near-duplicate of the seed recipe Lemon Garlic Roasted Potatoes (same potatoes, olive oil,
  garlic and lemon, roasted). It would add nothing new for search.
- **Corn on the Cob with Herb Butter**: overlaps Mexican Street Corn (also corn on the cob, also a side) and is the
  thinner of the two.
- **Fried Plantains** and **Hush Puppies**: the last two on the list; I stopped at 20. Plantains would add a new
  catalog item (plantain) if someone writes it later. `cornmeal` already exists for hush puppies.

Judgement call for the integrator: **Rice and Vermicelli Pilaf** vs the existing **Rice Pilaf** (breakfastSides). I kept
it as a separate dish because the butter-browned vermicelli changes the flavor, and it gives rice + pasta its first exact
match. Vermicelli is listed under the catalog's `pasta` (the shape is named), like spaghetti or angel hair.

## New catalog entries (7 keys, 16 map lines)
`cotija` (dairy), `refried beans` (pantry, like `baked_beans`), `crab meat` (protein), `dumpling wrappers` (grain),
`sumac` (spice), `bulgur` (grain), `collard greens` (produce). Registered in `W/new-ingredients.txt`; no other
worker registered the same foods. Aliases are only true alternative names: cotija cheese, canned refried beans, crabmeat,
lump crab meat, gyoza wrappers, ground sumac, bulgur wheat, bulghur, collards. I left out "crab" (it would catch
imitation crab searches) and "wonton wrappers" (a thinner, square product).

**Step-collision check:** before adding, I grepped every recipe in `src/data` for these names and aliases: none
appears in an existing step (the only near hit is "refried-style" in a Based Cooking bean recipe, which normalizes to
"refried style" and doesn't match). After merging the other round-4 files, rerun `npm run check`: a step in someone
else's recipe that says "sumac", "collards", "refried beans", "crab meat" or "bulgur" would now need that ingredient
listed. Also, va2 is adding `napa cabbage`. My potstickers deliberately use plain green `cabbage`.

## Dish types
- 18 of 20 have one. **Seven-Layer Dip** and **Shrimp Cocktail** have none, because no type honestly fits a no-cook
  layered dip or poached shrimp.
- Broiled dishes (Mexican Street Corn, Baba Ganoush) are tagged `bake`, as the library already does for oven-roasted
  vegetables and Whipped Butternut Squash.
- Mashed Sweet Potatoes is `one_pot` because the potatoes are boiled, the butter is browned and everything is mashed in
  the same pot.

## Equipment
Oven (including the **broiler** for the corn and the eggplant), stovetop, sheet pans. Beyond that: a 12-inch nonstick
skillet **with a lid** (potstickers), a Dutch oven or large soup pot (collards), and a fine sieve (pilaf, tabbouleh,
baba ganoush). There's no deep-frying. The corn gives an outdoor-grill alternative and the eggplant a gas-flame one;
the recipes don't need either.

## For the culinary reviewer (cook-test these first)
- **Baba Ganoush**: broilers vary a lot. I gave 25–35 min at about 6 inches, plus a fallback of 10–15 min baking at
  400°F if the centers are still firm. Check that the dip isn't watery after the 10-minute drain.
- **Potstickers**: the yield. I estimate 1 lb pork plus 8 oz cabbage makes about 48 at roughly 1 tbsp each, cooked in
  three batches of about 16 in a 12-inch pan. Check the steam time (6–7 min with 1/3 cup water) cooks the filling to
  160°F.
- **Crab Cakes**: 1/3 cup mayo, 1 egg and 12 crushed saltines per 1 lb of crab, chilled for 30 min. Check they hold
  together when flipped. The egg binder is why the doneness line says 160°F.
- **Shrimp Cocktail**: 3–4 min at a bare simmer for 2 lb of 21–25 count shrimp in 3 quarts of water.
- **German Potato Salad**: the dressing is 1/3 cup cider vinegar, 1/3 cup broth and 2 tbsp sugar with the fat from
  8 oz of bacon. Check the sweet-sour balance.
- **Mexican Street Corn**: 12–16 min under a high broiler at about 6 inches.
- **Three Bean Salad**: the dressing (1/2 cup vinegar, 1/3 cup sugar, 1/3 cup oil) is moderately sweet. Older versions
  use more sugar.

## For the integrator: two unit-display issues in `src/logic/units.ts` (not my file; I worked around both)
1. **Inch ranges convert wrongly.** `convertLengths` converts only the last number, so "4–6 inches" became "4–15 cm".
   No recipe uses an inch range today: I reworded mine to "about 6 inches". It's worth a fix (convert both ends,
   as `rangeOf` does for cups) before another writer hits it.
2. **"3 quarts of water" in step text isn't converted.** Only "N-quart" adjectives are handled, so
   `tests/units.test.ts` fails. I moved the 3 quarts into the ingredient list (`water`, '3 quarts', which converts) and
   the step now says "Pour the water into a large pot".

Metric display: `GRAMS_PER_CUP` has no bulgur, so I wrote the bulgur as '1/2 cup (70 g)'. The author's grams win.
Cotija is given as '3/4 cup (about 3 oz)', which shows "about 85 g". Mint and salsa show ml, which reads fine.
