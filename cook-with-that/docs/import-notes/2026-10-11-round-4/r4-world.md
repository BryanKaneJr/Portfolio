# r4-world: handoff notes

Theme file: `src/data/originals/world.ts` (`WORLD_RECIPES`), 20 original dinners from around the world, all
`source: ORIGINAL_DRAFT`. I wrote them from general cooking knowledge and did not open any published recipe. In my worktree
`npm run check` passes with 462 recipes, 355 ingredients and 648 tests. Every recipe has at least one meal and one dish type.

## Setup
The worktree started at `c061183a` (master). `git merge --ff-only claude/cook-with-that-recipe-sources` moved it to
`16934c17`. Baseline `npm run check` passed: 442 recipes, 628 tests.

## Recipes added (20), best first
1. **Chana Masala**: a chickpea curry in an onion and tomato gravy, different from the seed *Chickpea & Spinach
   Coconut Curry*. Catalog items only.
2. **Chicken Korma**: browned onions blended with almonds, plus whole spices, yogurt and cream. It is mild and has no
   tomato, so it stays distinct from *Chicken Tikka Masala*.
3. **Palak Paneer**: blanched spinach blended into a purée, with pan-fried paneer. It is the first paneer dish (new
   key `paneer`).
4. **Chicken Pad See Ew**: wide rice noodles with dark soy sauce, egg and broccoli (new key `dark soy sauce`,
   which was already reviewed). It is a different dish from *Shrimp Pad Thai*.
5. **Arroz con Pollo**: bone-in thighs cooked in the pot with rice, sazón, sofrito, olives and peas. It is
   different from *Valencian-Style Chicken Paella*.
6. **Chicken Katsu with Rice**: shallow-fried panko cutlets, short-grain rice and a homemade katsu sauce (ketchup,
   Worcestershire, soy and sugar), so no bottle is needed.
7. **Banh Mi Sandwiches**: garlic and fish-sauce pork tenderloin, quick-pickled carrot and daikon (new key `daikon`),
   and sriracha mayo. It is the library's first Vietnamese sandwich.
8. **Chicken Souvlaki with Pita**: lemon-oregano chicken under the broiler, with homemade tzatziki. It is different
   from *Lamb Gyros with Tzatziki*.
9. **Pozole Rojo**: pork shoulder and hominy in a guajillo chile broth (new keys `hominy` and `guajillo chiles`; the
   heat comes from the catalog's `dried red chilies` (árbol)). It is the library's first hominy dish.
10. **Ropa Vieja**: braised and shredded flank steak with peppers, tomato sauce and green olives. It is the first
    Cuban braise.
11. **Peri-Peri Chicken**: bone-in legs marinated in a blended sauce of red chili, roasted red pepper, lemon and garlic,
    then roasted, with sauce held back for serving.
12. **Jollof Rice**: parboiled rice in a reduced tomato, red pepper and Scotch bonnet base. It is the library's first
    West African dish.
13. **Thai Peanut Noodles**: linguine or spaghetti in a peanut-lime sauce with raw crunchy vegetables, served warm or
    cold. It is different from *Chicken Satay with Peanut Sauce*.
14. **Mapo Tofu**: soft tofu and ground pork in chili bean paste with Sichuan peppercorns (new keys
    `chili bean paste` and `sichuan peppercorns`). It is the first recipe that needs both tofu and ground pork.
15. **Pork Yakisoba**: instant ramen blocks (new key `ramen noodles`), pork, cabbage and carrot in a Worcestershire-based
    sauce.
16. **Japchae (Korean Sweet Potato Noodles)**: dangmyeon (key `sweet potato noodles`, already reviewed) with beef,
    spinach, shiitake and carrot.
17. **Vietnamese Lemongrass Chicken**: caramelized lemongrass thighs over jasmine rice with a nuoc cham-style dipping
    sauce.
18. **Aloo Gobi**: potato and cauliflower, covered and then browned, in one skillet. Catalog items only.
19. **Mujadara (Lentils and Rice with Crispy Onions)**: brown lentils and rice cooked together under deeply browned
    onions. It fills the lentils + rice pairing.
20. **Chicken Saltimbocca**: cutlets with sage and prosciutto and a white wine and butter pan sauce.

`npm run coverage-report` still shows 96% of common pairs and 64% of triples. These dishes add depth, not new common
combinations.

## Skipped (2 of 22; no swaps needed, since the list had 22 dishes for 20 slots)
- **Sesame Chicken**: a near-duplicate of the library's *Crispy Chicken with Sticky Sauce* (Based Cooking). That recipe
  is bite-size chicken in a cornstarch, egg and flour coating, fried and then tossed in a honey, soy, brown sugar, rice
  vinegar, sesame oil and garlic glaze, which is sesame chicken without the seeds.
- **Bobotie**: not a duplicate. I dropped it to fit 20 because US home cooks know it least, and it would have needed
  a new `mango chutney` key. It is a good candidate for a later round.

## New catalog keys (9): see catalog-keys.txt and map-entries.ts.txt
- New `{ add }` keys: `paneer` (dairy), `ramen noodles` (grain), `chili bean paste` (pantry), `sichuan peppercorns`
  (spice), `hominy` (pantry), `guajillo chiles` (spice), `daikon` (produce). All 7 are in the shared registry
  `W/new-ingredients.txt`.
- These two were already reviewed in the map and only need `import:catalog`: `dark soy sauce` (pantry) and
  `sweet potato noodles` (grain).
- Aliases are true alternative names only: paneer cheese; doubanjiang and chili bean sauce; szechuan peppercorns;
  canned hominy and white hominy; guajillo chilies and dried guajillo chiles; daikon radish. None of them contains
  "egg".
- **No collisions with existing steps.** None of the new names or aliases appears in any library recipe's steps, so
  the step check stays clean. `sichuan peppercorns` and `daikon radish` are longer than `peppercorns` and `radish`, so
  they win the longest-term match.
- `import:catalog` writes each entry on one line. Two of them (`chili_bean_paste`, `guajillo_chiles`) are longer than
  120 characters, so I ran `npx prettier --write src/data/ingredients.ts` afterwards. `npm run check` doesn't need
  this, but the file stays prettier-clean.

## For the integrator
- **Metric display, no failures.** A few solid ingredients measured in cups fall back to ml because `GRAMS_PER_CUP`
  has no entry for them: almonds (1/3 cup → 80 ml), cabbage (2 and 4 cups → 480 and 950 ml), green olives, roasted
  red peppers, peanuts and mint. If someone owns `src/logic/units.ts`, rough weights are: slivered almonds ~110 g,
  shredded cabbage ~70–90 g, sliced green olives ~135 g, chopped peanuts ~145 g, roasted red peppers ~150 g and
  mint leaves ~25 g per cup.
- **Units quirk** (I didn't touch `src/logic`): in a quantity like `12 oz dried or 1 lb fresh`, only the first measure
  converts, so metric mode leaves "1 lb". I reworded the yakisoba to instant blocks only.
- Equipment: oven, stovetop, sheet pans and a blender (korma, palak paneer, pozole, peri-peri, jollof). A sieve
  strains the pozole sauce. The mapo tofu peppercorns are ground in a mortar or spice grinder, or crushed under a
  heavy pan. Skewers (souvlaki) and kitchen scissors (japchae) are optional.

## For the culinary reviewer (what to cook-test first)
- **Jollof Rice**: the liquid is 2 cups of parboiled rice to 3 cups of broth plus the reduced base, with an extra 1/4
  cup if needed. Plain long-grain rice would need less liquid, which is why the recipe names parboiled.
- **Chicken Pad See Ew**: how long dried wide rice noodles need to soak varies by brand. Step 6 adds a splash of water
  if they are still firm. I used broccoli because Chinese broccoli (gai lan) isn't in the catalog, and it isn't
  broccoli, so it is not offered as an option.
- **Arroz con Pollo**: rice and bone-in thighs on the stovetop on low for 25–30 minutes. Check that the rice is done
  and the bottom doesn't scorch. Salt is only 1/2 tsp because adobo seasoning and sazón are both salty.
- **Chicken Korma**: the yogurt marinade goes into the pot. The almond and onion purée should keep the sauce smooth,
  so check that it doesn't look split.
- **Pork Yakisoba**: it uses instant ramen blocks with the seasoning packets thrown away, because fresh yakisoba
  noodles are hard to find and I didn't alias them to ramen. The sauce is 1/4 cup Worcestershire, 2 tbsp oyster sauce,
  2 tbsp ketchup, 1 tbsp soy sauce and 2 tsp sugar for 4 blocks; check that it is saucy enough.
- **Mapo Tofu**: red pepper flakes stand in for Sichuan chili flakes. They are listed as themselves, not mapped to
  anything.
- **Peri-Peri Chicken**: the reserved sauce is raw (garlic and chili). It is set aside before it touches raw chicken
  and kept in the fridge.
- **Pozole Rojo**: hominy cans come in 25–29 oz sizes. The quantity gives that range (metric: 710–800 g each).
- Prep times include minimum marinating or pickling: korma +30 min, souvlaki +30, lemongrass chicken +30, peri-peri
  +2 h, banh mi pickles 30 min (running alongside the pork marinade), and the pad see ew noodle soak 30–40 min.
