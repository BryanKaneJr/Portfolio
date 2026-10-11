# bc8 handoff: slice 4 (quickbreakfastspaghetti … zopf)

15 recipes imported. `npm run check` passes in the worktree: 139 recipes, 207 ingredients, 303 tests.
`src/data/imported/basedCooking.ts` is prettier-clean.

## Imported (source key → id: title, and the gap each fills)

| Source key | id: title | Gap filled |
|---|---|---|
| turkish-yogurt-soup | `turkish-yogurt-soup`: Turkish Yogurt Soup (Yayla Çorbası) | rice (required); soup |
| stuffed-round-squash | `rice-stuffed-zucchini`: Rice-Stuffed Zucchini | rice + cheddar (first one); a vegetable main; bake |
| risengroed | `risengrod`: Risengrød (Danish Rice Porridge) | rice; dessert/breakfast; bowl |
| teriyaki-beef | `teriyaki-beef-and-broccoli`: Teriyaki Beef and Broccoli | rice + broccoli and rice + beef (sirloin); broccoli in a main; bowl |
| refried-beans | `refried-black-beans`: Refried Black Beans | black beans; side/appetizer |
| venezuelan-arepa | `black-bean-and-cheese-arepas`: Black Bean and Cheese Arepas | black beans; sandwich |
| tunisian-tajine | `tunisian-tajine`: Tunisian Tajine with Chicken and Spinach | potato + spinach (first one); spinach in a main |
| stuffed-vegetables | `italian-stuffed-vegetables`: Italian Stuffed Vegetables | bell pepper + tomato; side/appetizer |
| scouse | `scouse`: Scouse (Liverpool Beef Stew) | ground beef + potato stew; one_pot |
| yogurt-cake | `italian-yogurt-cake`: Italian Yogurt Cake | dessert; baked_goods |
| sticky-porkchops | `sticky-five-spice-pork-chops`: Sticky Five-Spice Pork Chops | dinner main; skillet |
| slow-cooked-lamb-with-lemon | `slow-cooked-lamb-with-lemon`: Slow-Cooked Lamb with Lemon | Sunday roast; one_pot/bake |
| tomato-and-grilled-paprika-soup | `tomato-and-roasted-red-pepper-soup`: Tomato and Roasted Red Pepper Soup | soup; bell pepper + tomato |
| stoemp | `stoemp`: Stoemp (Belgian Carrot and Potato Mash) | side |
| torrijas | `torrijas`: Torrijas (Spanish Fried Milk Toast) | dessert |

In my worktree after these 15: rice required by 7 recipes (was 3), black beans 4 (was 2), spinach 8, broccoli 8,
soups 11, desserts 13, appetizers 13, sides 20, sandwiches 9. All but Stoemp have a dish type. Stoemp is a mash
and no dish type fits honestly, like the library's Bacon Cheddar Mashed Potatoes. Note that the teriyaki dish uses
`sirloin_steak`, not `ground_beef`, so a ground beef + rice pair is still missing.

## Catalog additions (catalog-keys.txt)
- `masarepa` (grain), with aliases "precooked corn flour" and "precooked cornmeal". It's the precooked white corn
  flour for arepas, not cornmeal, masa harina or cornstarch.
- `queso_fresco` (dairy).
- `dried_mint` (spice). The map's `mint` is fresh leaves, which stays separate.
- `five_spice_powder` (spice, "Five-spice powder"), with aliases "chinese five spice", "chinese five spice powder"
  and "five spice". **Prettier:** `import:catalog` writes this entry as one line of more than 120 characters, so
  `prettier --check src/data/ingredients.ts` flags it, and prettier would wrap it onto several lines. Tests don't
  check this. I left the tool's output as it was.
- `lamb_shoulder` (protein).

`import:draft` also added `bean_sprouts` because the teriyaki page lists them as an optional vegetable. I dropped
them from the recipe, restored `ingredients.ts` and re-added only the 5 entries above with `import:catalog`. **Don't
add bean sprouts for my recipes.**

No `GRAMS_PER_CUP` entries are needed: masarepa ("2 cups (about 280 g)") and queso fresco ("1 cup (about 120 g)")
give their own metric weight. If later recipes measure them by the cup alone, use about 140 g/cup for masarepa and
120 g/cup for crumbled queso fresco. searchAudit passes with all five new names.

## Map entries (map-entries.ts.txt)
13 lines: the five `{ add }` keys above and their spelling variants, plus `'head of garlic': 'garlic'`,
`'parmigiano cheese': 'parmesan'` and `'lemon rind': 'lemon'`. Wordings that were only parser debris ("t cayenne
pepper", "water 3 dl", "gr of cheese"…) were fixed by hand with `--allow-blocked` and not added to the map.

## For the reviewer: edits beyond wording
- **Risengrød:** the source's "Pama porridge rice" is short-grain white rice. I put it under `rice` (white rice),
  with the display name "short-grain white rice (porridge or pudding rice)". If the owner treats short-grain like
  arborio (its own ID), this one should move to `arborio_rice` or a new short-grain entry, and it would then no longer
  count toward the rice gap. Servings went from 2 to 4 (1 liter of milk).
- **Teriyaki:** the page was thin. I chose sirloin for "beef slices", rice over noodles, and broccoli and carrot from
  the optional vegetables. I dropped baby corn, water chestnut, bean sprouts and chili. I corrected the sauce ratio:
  the source's 2 tbsp cornstarch in 200 ml water would set like glue, so it's now 1 tbsp cornstarch, 1/2 cup water,
  3 tbsp soy and 1 1/2 tbsp honey. I also added the missing step of pouring in the sauce.
- **Refried beans:** the source's "pre-cooked beans" are now canned black beans, a common Mexican choice and the
  library's gap.
- **Arepas:** the source lists fillings "to taste (ham, cheese, beans…)". I wrote it up with black beans and white
  cheese (the Venezuelan "dominó"). The source cooked them 2 1/2 minutes a side, too short to cook through, so it's
  now 6–8 minutes a side. The water-to-flour ratio is the usual package ratio.
- **Tunisian tajine:** I used the chicken and spinach option (the page offers tuna or chicken, and parsley or
  spinach), mozzarella for "your favorite melty cheese" and green olives. The potatoes are pan-fried in 1/3 cup oil
  instead of deep-fried.
- **Scouse:** UK beef gravy granules are hard to find in the US, so the stew is thickened with 2 tbsp flour instead.
  I dropped the optional parsnip, swede and cabbage. All quantities are mine (the source had almost none).
- **Yogurt cake:** "instant yeast" is a mistranslation of Italian *lievito istantaneo*, which is baking powder, so it
  now says 1 tbsp baking powder. I dropped the optional fruit and the "add milk" line.
- **Tomato and red pepper soup:** the Dutch "bruschetta herbs" are now Italian seasoning, and the ginger syrup is now
  1 tsp honey. I added the missing simmer before blending and changed the source's 12 servings to 6.
- **Lamb:** the potatoes were optional in the source and are now required, because they cook in the pot. Prep is
  500 min because the lamb marinates overnight.
- **Rice-stuffed zucchini:** the source's optional "cheese" is now cheddar and required, because it's part of the
  stuffing. The displayed name says round zucchini, or regular zucchini.

## Provenance checks
I checked every imported page three ways: a grep of the snapshot, a grep of its full `git log --follow -p` history
in based-luke, and a web search for distinctive sentences, which found only mirrors.
- **Commit 0694559 (publicdomainrecipes.com) touched 6 of my pages:** refried-beans, slow-cooked-lamb-with-lemon,
  stuffed-round-squash, stuffed-vegetables, venezuelan-arepa and yogurt-cake. I grepped each one's full history in
  pdr-codeberg and found no outside credit. Stuffed-vegetables and yogurt-cake were added there by pestanzul (author
  of the already-imported tiramisu and stracciatella), and the arepa by its author leliel.
- **refried-beans:** until 0694559 the page said "Originally published at yaroslavps.com". That is the contributor's
  own site: Yaroslav de la Peña Smirnov, whose other pages are already imported. His page there credits no other
  source. It's the same author's own work, not an outside original.
- **tunisian-tajine:** it came in with 97e5806 ("foss cooking content added"). The research clone
  Rushmore75_foss.cooking is shallow (one commit) and has identical text with no credits. Its link to "the
  traditional version" points at based.cooking's own `tajine` page, which is excluded and by a different author.
- **sticky-porkchops:** "chinese inspired" describes the style, not a credit. Its git history shows the page started
  as the same author's ramen page and was rewritten.
- **shrimp-creole** is excluded (see excludes.txt) even though it would have filled rice + tomato + bell pepper. It's
  the closest call: a family adaptation of a Junior League community-cookbook recipe with different quantities.

## Promising pages I skipped (not provenance)
- shakshouka: too close to the library's Menemen, and the page lists no peppers or quantities.
- salsa: the title collides with the catalog ingredient "Salsa" (jarred), so steps saying "salsa" would read as that
  ingredient. It's also near Corn Salsa.
- spaghetti-and-meatballs: it reads like published magazine copy ("Do not overmix or the meatballs will be tough",
  "Parmesan-Romano cheese blend", melon baller). I couldn't trace it and couldn't clear it.
- ragu-napoletano: a good family recipe, but a big project (6–10 lb tomatoes, three meats, 4–5 hours, 10–12
  servings). Worth a later round.
- tarte-merengada: the intro reads like translated site copy. Not traced.
- schnitzel: needs veal cutlets.
- Too thin to cook from or near-duplicates: tuna-salad (near Tuna Sub), seafood-pasta (near Shrimp Fettuccine
  Alfredo), sausage-rolls, tortellini, quickbreakfastspaghetti, zarangollo.
- Others: two-ingredient-pancakes, swedish-pancakes and spiced-apple-pancakes (the library has 3 pancakes, none with
  a dish type). roasted-chicken-breast (Reddit link, a 155°F pull temperature, needs a probe thermometer).
  slowcooked-green-bean-beef-soup-supreme (built on canned soup and a pre-seasoned meat pack). savory-squash (a
  brand-name blue cheese). schinkenfleckerl-gratinated (1 kg ham, 2-hour bake). tahini-short-bread (its method is
  on another page). sugar-free cookies (erythritol blend). torta-frita-criolla (fine, just lower priority).
- Out of scope by the brief: drinks, compote, pickles, sauerkraut, sauces, doughs, breads, starters and basics.
