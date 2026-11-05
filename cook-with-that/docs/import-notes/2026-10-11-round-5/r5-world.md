# r5-world: handoff notes

Theme file: `src/data/originals/worldKitchen.ts` (`WORLD_KITCHEN_RECIPES`). It has 20 original dinners from around the
world, all `source: ORIGINAL_DRAFT`. I wrote them from general cooking knowledge and did not search for or open any
published recipe. In my worktree `npm run check` passes: 568 recipes, 385 ingredients, 759 tests. That count
includes only my 20 recipes and 5 catalog additions on top of the 548 / 380 / 739 baseline.

## Setup
The worktree started at `f1ea9ecd` (master). `git merge --ff-only claude/cook-with-that-recipe-sources` moved it to
`ba551f7f`. The baseline `npm run check` passed with 548 recipes and 739 tests.

## Recipes added (20), in list order
| # | Title | id | Gap it fills / how it differs from the library |
|---|---|---|---|
| 1 | Beef Bulgogi | `beef-bulgogi` | Sliced ribeye marinated with soy, garlic and grated apple. Different from *Korean Ground Beef Rice Bowls* (ground beef). |
| 2 | Kimchi Fried Rice with Fried Eggs | `kimchi-fried-rice-with-fried-eggs` | The library's first kimchi dish (new key `kimchi`). Bacon, gochujang, day-old rice. |
| 3 | General Tso's Chicken | `general-tsos-chicken` | Deep-fried (heavy pot, thermometer, 350°F) thighs in a dried-chili, hoisin and rice-vinegar sauce. Different from *Crispy Chicken with Sticky Sauce* (honey-soy glaze, no chilies). Adds to the thin `fried` type. |
| 4 | Bean and Cheese Pupusas with Curtido | `bean-and-cheese-pupusas-with-curtido` | First Salvadoran dish and first masa harina dish (new key). Includes the curtido and a thin tomato sauce. |
| 5 | Chicken Maafe (West African Peanut Stew) | `chicken-maafe` | Chicken, sweet potato and carrots in a tomato and peanut butter sauce. |
| 6 | Jamaican Rice and Peas | `jamaican-rice-and-peas` | Coconut milk, kidney beans, thyme, allspice and a whole Scotch bonnet. Different from *Caribbean Black Beans and Rice* (black beans, stewed tomatoes, brown rice). |
| 7 | Oyakodon (Chicken and Egg Rice Bowl) | `oyakodon` | Chicken + rice + eggs bowl. Uses chicken broth where Japan uses dashi. First mirin dish (new key). |
| 8 | Gyudon (Beef and Onion Rice Bowl) | `gyudon` | Shaved ribeye and onions simmered in soy, mirin and ginger. |
| 9 | Arroz Caldo (Filipino Chicken Rice Porridge) | `arroz-caldo` | Ginger, fish sauce, fried garlic and turmeric (standing in for the usual kasubha color). See the congee note below. |
| 10 | Patatas Bravas | `patatas-bravas` | Parboiled, then shallow-fried in 1/2 inch of oil at 350°F, with a smoky tomato sauce and quick aioli. Appetizer and side, `fried`. |
| 11 | Kuku Sabzi (Persian Herb Frittata) | `kuku-sabzi` | First Persian dish: parsley, cilantro, dill, green onion and walnuts. Started on the stove, finished in the oven. |
| 12 | Pad Kra Pao (Thai Basil Chicken with a Fried Egg) | `pad-kra-pao` | Hand-chopped thighs, garlic, chilies and basil, with a Thai-style crisp fried egg. Rice is required (chicken + rice + eggs). |
| 13 | Shrimp Nasi Goreng (Indonesian Fried Rice) | `shrimp-nasi-goreng` | Shallot, garlic and chili paste with a quick homemade sweet soy, so no kecap manis key is needed. |
| 14 | Gado-Gado (Indonesian Salad with Peanut Sauce) | `gado-gado` | Eggs + potato + vegetables (green beans, cabbage, bean sprouts, cucumber) with crisp tofu and peanut sauce. Adds to the thin `salad` type. |
| 15 | Saag Aloo (Spiced Potatoes and Spinach) | `saag-aloo` | Potato + spinach as required ingredients. Uses `cumin seeds` (already-reviewed key, now in the catalog). Different from *Aloo Gobi* and *Palak Paneer*. |
| 16 | Chicken Biryani | `chicken-biryani` | Layered (dum) biryani with yogurt-marinated chicken, parboiled basmati, saffron milk and fried onions. See the biryani note below. |
| 17 | Chiles Rellenos with Ranchero Sauce | `chiles-rellenos` | Broiled poblanos (new key) stuffed with Monterey Jack, egg-batter fried in 1/2 inch of oil at 350°F. |
| 18 | Bobotie (South African Curried Beef Bake) | `bobotie` | Curried ground beef with apricot jam, raisins and almonds under an egg custard. Round 4 skipped it because it needed mango chutney; this version uses the catalog's apricot jam. |
| 19 | Cuban Beef Picadillo with Potatoes | `cuban-beef-picadillo-with-potatoes` | **Potato + tomato (fresh) + ground beef**, all required. Different from the NHLBI *Chicken Picadillo*: beef, fried potato cubes, white wine, stuffed olives, cumin, and no lemon juice or capers. |
| 20 | Feijoada (Brazilian Black Bean and Pork Stew) | `feijoada` | Dried black beans with bacon, pork shoulder and smoked kielbasa, served with rice and orange slices. Different from *Frijol con Puerco* (Yucatecan beans and pork with no smoked meats, served with radish, avocado and lime). |

Coverage: three common triples now have an exact match that they lacked before: potato + tomato + ground beef
(picadillo), potato + spinach + tomato and potato + spinach + garlic (saag aloo). `npm run coverage-report` still
rounds to 98% of pairs and 66% of triples (242/364). Oyakodon and pad kra pao add depth to chicken + rice + eggs.

## Skips and swaps
- **Skipped: Moroccan Chickpea and Vegetable Stew.** It is a near-duplicate of the VA's *Slow-Cooker Moroccan Chickpea
  and Lentil Stew* (chickpeas, squash, pepper, tomato, cumin, turmeric, cinnamon and ginger), and the library also
  has *Moroccan Chicken Stew with Couscous* and *Apricot Chicken Tagine*. My list had 21 dishes for 20 slots, so I
  didn't need a swap.
- **Kept, but check these pairs:**
  - **Chicken Biryani vs. Lamb Biryani** (Based Cooking). The library's version is Tamil one-pot: rice is cooked in
    the lamb broth by absorption. Mine is a layered dum biryani: marinated chicken, parboiled rice layered on top,
    then saffron milk, butter, herbs and fried onions, sealed and steamed. Different protein and different technique,
    so I kept the plain title. Rename it "Layered Chicken Biryani" if the owner wants more distance.
  - **Arroz Caldo vs. r5-breakfast's Chicken Congee.** Both are chicken rice porridges and both are on the lists.
    Mine is distinctly Filipino: lots of ginger, fish sauce, turmeric color, crisp fried garlic and garlic oil, lime,
    with optional hard-boiled eggs. Compare it with the congee when you merge.
  - **General Tso's vs. Crispy Chicken with Sticky Sauce**: see table row 3.

## Catalog additions (5): see catalog-keys.txt and map-entries.ts.txt
- New `{ add }` keys, all in the shared registry `W/new-ingredients.txt`:
  - `kimchi` (pantry, like sauerkraut)
  - `masa harina` (grain)
  - `mirin` (pantry)
  - `poblano pepper` (produce, aliases: poblano peppers, poblano chiles, poblano)
- Already reviewed in the map, only run through `import:catalog`: `cumin seeds` (spice).
- No collisions: none of the new names or aliases appears in any existing recipe's steps (I grepped `src/data`).
  No alias starts with a common word. `poblano` is the only one-word alias, and it's the pepper's own name. I gave
  kimchi no aliases on purpose: "cabbage kimchi" would make a search for "cabbage" list kimchi.
- After `import:catalog` I ran `npx prettier --write src/data/ingredients.ts`, because the poblano entry is longer than
  the print width.

## Ingredient choices (recipe decisions, not mappings)
- **Bulgogi:** grated apple instead of Asian pear (the catalog has no pear). The ribeye line says shaved ribeye for hot
  pot also works; it's the same cut and the same ID.
- **Pad kra pao:** "fresh Thai basil leaves (Italian basil also works)" uses the catalog's `basil`. Thai and Italian
  basil are both varieties of *Ocimum basilicum*, like red and yellow onions. Holy basil (a different species) isn't
  mentioned. The chilies are `red_chili` (Thai bird's eye).
- **Nasi goreng:** I didn't add a `kecap manis` key. The dish uses 3 tbsp soy sauce and 2 1/2 tbsp dark brown sugar,
  warmed into a syrup, and the step names it as a stand-in.
- **Oyakodon** uses low-sodium chicken broth instead of dashi. **Gyudon** uses water. Neither uses sake.
- **Maafe** gets its heat from cayenne, so it needs no Scotch bonnet. **Rice and peas** keeps the whole Scotch bonnet,
  which is defining there.
- **Biryani:** paprika plus cayenne stand in for Kashmiri chili powder, and butter for ghee.
- **Pupusas:** low-moisture mozzarella stands in for quesillo.
- **Feijoada:** smoked kielbasa stands in for linguiça (catalog `kielbasa`). Steps say "kielbasa", never "sausage",
  because "sausage" is the raw-sausage alias.
- **Salt (decision 14):** I didn't add salt where soy sauce, fish sauce or bacon season the dish: bulgogi, kimchi fried
  rice, General Tso's, oyakodon, gyudon, pad kra pao, nasi goreng and arroz caldo. Feijoada does get salt despite the
  bacon and kielbasa, because a pound of beans needs it.

## Needs an international aisle (or a specialty store)
- Mirin, fish sauce, oyster sauce, hoisin and gochujang: the Asian aisle of most large supermarkets.
- Kimchi: the refrigerated case at most large supermarkets, otherwise an Asian market.
- Masa harina (Maseca): the Hispanic aisle, widely stocked.
- Thai basil and bird's eye chilies: Asian markets. The recipe says Italian basil works, and Fresno chilies are fine.
- Scotch bonnet: Caribbean or international produce. Habaneros are the usual stand-in; this isn't written into the
  recipe.
- Saffron (biryani): the spice aisle, but expensive.

## Equipment
Everything fits the baseline: oven, stovetop, sheet pans and a blender. The blender makes the pupusa sauce and the
ranchero sauce. The three fried dishes (General Tso's, patatas bravas, chiles rellenos) use a heavy pot or heavy
12-inch skillet and a thermometer, with oil temperatures in the steps. The chiles rellenos poblanos are roasted under
the broiler. Kuku sabzi needs a 10-inch ovenproof skillet, and bobotie a 9-by-13-inch dish. A salad spinner, a wok,
a small strainer (for the arroz caldo garlic) and toothpicks are optional or ordinary.

## For the integrator
- **Metric display:** no failures. Two dry ingredients measured in cups fall back to ml because `GRAMS_PER_CUP` lacks
  them: cornstarch (General Tso's, 1/2 cup + 1 tbsp → 120 ml + 1 tbsp; about 128 g per cup) and refried beans
  (pupusas, 1 cup → 240 ml; about 250 g per cup). To avoid the same fallback, I gave masa harina, kimchi and bean
  sprouts in oz with cups in parentheses.
- `GRAMS_PER_CUP` has `dill: 10`, which suits loose fronds but badly undercounts packed chopped dill (30–40 g). Kuku
  sabzi gives its dill as "1 small bunch (about 1 oz)" to sidestep this.
- **Wording I changed to satisfy the checkers:** "brown sugar dissolves" instead of "sugar dissolves" (the bare word
  reads as white sugar). "Heat the oil … to 350°F" keeps "oil" inside the 60-character window, so frying temperatures
  show plain °C rather than fan and gas marks. Pots are named without quart sizes, and the bobotie dish is
  "9-by-13-inch" (a "9x13-inch" dish rendered as "9x33 cm").
- **Prep times include waits:** bulgogi (freezing 30–40 min plus marinating 30 min), gyudon (freezing), pupusas (the
  curtido rests 1 hour while the sauce and dough are made), biryani (1-hour marinade, with a 30-minute rice soak that
  overlaps it) and feijoada (1-hour quick soak).

## Cook-test these first
1. **Chicken Biryani:** the stovetop dum step (25 min on the lowest heat over a yogurt sauce) could scorch. The step
   offers a 325°F oven for 30 minutes as the alternative. Check that bone-in thighs reach 165°F after 20 min covered
   plus 25 min steaming, and that a 4–5 minute parboil of soaked basmati comes out right.
2. **Pupusas:** check that 12 oz (about 3 cups) masa harina to 2 1/4 cups warm water, adjusted by the tablespoon,
   gives a soft dough that seals without cracking. Also check that 2 tbsp of filling per pupusa doesn't burst.
3. **Jamaican Rice and Peas:** check that 2 cups long-grain rice to 3 1/4 cups liquid (bean liquid, a can of coconut
   milk, water) cooks through in 20–25 min on low without catching.
4. **General Tso's:** check the sauce balance (1/4 cup sugar, 3 tbsp rice vinegar, 2 tbsp hoisin, 3 tbsp soy) and that
   the cornstarch-flour coating stays crisp after tossing.
5. **Arroz Caldo:** check that 1 cup rice to 8 cups liquid gives a loose porridge in 35–40 min.
6. **Nasi Goreng:** check that the homemade sweet soy (3 tbsp soy, 2 1/2 tbsp dark brown sugar) seasons 5 cups of rice
   enough.
7. **Bobotie:** check that 3 eggs and 1 cup milk make enough custard to cover a 9-by-13-inch dish (the layer is
   meant to be thin).
8. **Kuku Sabzi:** check the set time (4–5 min on the stove plus 20–25 min at 350°F) for 8 eggs and about 6 cups of
   herbs in a 10-inch skillet.
9. **Chiles Rellenos:** check that the batter (4 eggs, whites beaten stiff, 1 tbsp flour) clings after the flour dredge.
10. **Feijoada:** quick-soaked beans should be creamy after about 2 hours. Older beans can take longer, and the step
    says to simmer until creamy.
