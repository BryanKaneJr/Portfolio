# r5-comfort notes

Theme file: `src/data/originals/comfort.ts` (`COMFORT_RECIPES`), 20 original recipes, all `source: ORIGINAL_DRAFT`.
`npm run check` passes in my worktree: 568 recipes, 380 ingredients, 759 tests.

## Recipes added, in list order, with the gap each fills

All ten target triples from ROLES.md had 0 exact matches before. Each now has at least one, with those
ingredients required. I checked this with `runSearch` against the full library.

| # | Title | id | Gap / why |
|---|---|---|---|
| 1 | Stovetop Broccoli Cheddar Mac and Cheese | `stovetop-broccoli-cheddar-mac-and-cheese` | pasta + cheddar + broccoli (stovetop, unlike the two baked mac recipes) |
| 2 | Cheeseburger Macaroni Skillet | `cheeseburger-macaroni-skillet` | pasta + cheddar + ground beef (one pan, elbows cooked in broth) |
| 3 | Southern Baked Macaroni and Tomatoes | `southern-baked-macaroni-and-tomatoes` | pasta + tomato + cheddar (fresh tomatoes, so the `tomato` ID counts) |
| 4 | One-Pot Chili Mac with Cheddar | `one-pot-chili-mac-with-cheddar` | classic the library lacked; also pasta + cheddar + ground beef |
| 5 | Twice-Baked Potatoes with Spinach and Cheddar | `twice-baked-potatoes-with-spinach-and-cheddar` | potato + spinach + cheddar |
| 6 | Sheet-Pan Ranch Chicken, Potatoes and Broccoli | `sheet-pan-ranch-chicken-potatoes-and-broccoli` | chicken + potato + broccoli |
| 7 | Roast Chicken Thighs over Buttered Sliced Potatoes | `roast-chicken-thighs-over-buttered-potatoes` | chicken + potato + butter |
| 8 | Chicken and Cherry Tomato Penne | `chicken-and-cherry-tomato-penne` | chicken + pasta + tomato (fresh cherry tomatoes; the existing Chicken Pasta Casserole uses canned) |
| 9 | Hamburger Vegetable Soup | `hamburger-vegetable-soup` | potato + tomato + ground beef (fresh tomatoes plus tomato paste) |
| 10 | Cheesy Beef and Spinach Pasta Bake | `cheesy-beef-and-spinach-pasta-bake` | spinach + cheddar + ground beef |
| 11 | Spinach and Cheddar Stuffed Chicken Breasts | `spinach-and-cheddar-stuffed-chicken-breasts` | chicken + spinach + cheddar |
| 12 | Chicken Divan with Broccoli and Parmesan Sauce | `chicken-divan-with-parmesan-sauce` | classic; Parmesan cream, no rice in the dish (unlike Chicken, Broccoli and Rice Casserole) |
| 13 | Tuna Noodle Casserole with Mushrooms and Peas | `tuna-noodle-casserole-with-mushrooms-and-peas` | classic; egg noodles, mushroom sauce, cracker top (unlike the British Tuna Pasta Bake) |
| 14 | Swiss Steak with Tomatoes and Peppers | `swiss-steak-with-tomatoes-and-peppers` | classic braise the library lacked |
| 15 | Beef Tips and Gravy over Rice | `beef-tips-and-gravy-over-rice` | Southern classic, no "beef tips" in the library |
| 16 | Chicken Tetrazzini | `chicken-tetrazzini` | classic; mushrooms, wine and Parmesan (unlike the cheddar-and-chiles Chicken Spaghetti) |
| 17 | Porcupine Meatballs in Tomato Sauce | `porcupine-meatballs-in-tomato-sauce` | classic; raw rice cooks inside the meatballs |
| 18 | Skillet Pork Chops with Potatoes and Green Beans | `skillet-pork-chops-with-potatoes-and-green-beans` | one-skillet pork chop dinner (the library's chops are all sauce or oven dishes) |
| 19 | Patty Melts on Rye with Caramelized Onions | `patty-melts-on-rye` | diner classic; sandwich dish type |
| 20 | Baked Potato Bar with Beef Chili and Cheddar | `baked-potato-bar-with-chili-and-cheddar` | family-style build-your-own dinner |

## Skips and swaps

The list had 22 dishes, so I skipped two near-duplicates and needed no swaps:
- **Stuffed Shells with Spinach and Ricotta**: skipped. It's the library's `beef-and-spinach-stuffed-pasta-shells`
  (ricotta, spinach, marinara, mozzarella) minus the beef. Spinach + ricotta + pasta without meat is already covered
  by Vegetable Lasagna with Spinach and Ricotta and Spinach and Ricotta Pie.
- **Ground Beef and Potato Skillet**: skipped. It would be a near-duplicate of `cheesy-ground-beef-potato-and-broccoli-skillet`
  (diced potatoes, ground beef and cheddar in one skillet), which already covers potato + ground beef.

## Catalog additions

None. Every ingredient was already in the base catalog, so there were no `ingredient-map.ts` changes, no `import:catalog`
run and no `catalog-keys.txt`. Choices I made to stay in the catalog, all with the real food named (none are aliases or
substitutions in the map):
- Swiss steak and beef tips use `chuck_roast` (the display names say "chuck roast or chuck steaks"). Chuck is a
  traditional cut for both; I didn't add round steak.
- Divan and Tetrazzini use dry white wine (`white_wine`), not sherry.
- The tuna casserole is topped with buttered saltines (`saltine_crackers`), not potato chips.
- Patty melts use `bread` ("rye bread"), as the library's Reuben does.

## Cook-test these first

1. **Porcupine Meatballs**: raw rice has to cook through inside the meatballs in 50–60 minutes of covered, gentle simmering.
   Check that the rice is tender and the sauce (2 cans tomato sauce + 1 1/2 cups water) neither scorches nor ends up thin.
2. **Cheeseburger Macaroni Skillet** and **One-Pot Chili Mac**: macaroni cooks in the liquid. Check the liquid ratio
   (8 oz elbows in 2 1/2 cups broth; 8 oz in 2 cups broth plus the canned tomatoes and sauce) and that it doesn't stick.
3. **Skillet Pork Chops**: the chops finish on top of the potatoes and green beans under the lid. Check that 1-inch
   boneless chops reach 145°F in 6–8 minutes while the beans stay crisp-tender.
4. **Roast Chicken Thighs over Buttered Sliced Potatoes**: check that 1/8-inch potato slices under the thighs are tender
   after 20 minutes covered plus 40–45 uncovered at 425°F, and that a 9-by-13 dish isn't swimming in fat.
5. **Southern Baked Macaroni and Tomatoes**: how full the 2-quart dish gets with 2 lb of fresh tomatoes (juiciness
   varies). The step already has a sheet pan under it.
6. **Chicken Divan**: check that about 2 1/2 cups of sauce covers the broccoli and chicken well enough in a 9-by-13 dish.

## For the integrator

- `npm run audit:recipes` flags `beef-tips-and-gravy-over-rice` as a possible near-duplicate of
  `classic-pot-roast-with-carrots-and-potatoes` (64% of key ingredients shared: chuck, onion, broth, Worcestershire,
  thyme…). It's a different dish: cubed chuck braised in onion gravy over rice, with no whole roast and no carrots or potatoes.
  The audit's only other flag (saltines measured in cups showing as ml) is fixed: they're now "20 (about 2 oz)".
- I restored `docs/recipe-audit.md` after running the audit, so the only tracked change is `src/data/originals/comfort.ts`.
- Three recipes use fresh `tomato` on purpose, to fill the triple gaps (the coverage report's COMMON list uses `tomato`,
  not `canned_tomatoes`). Swiss steak, chili mac, the beef-spinach bake and the potato-bar chili use canned tomatoes.
  Their steps say "diced tomatoes" or "crushed tomatoes" so the step checker reads them as canned.
- Equipment: nothing beyond the baseline. The sheet-pan chicken uses two rimmed sheet pans; Swiss steak suggests a
  meat mallet or the bottom of a heavy pan; the stuffed chicken uses toothpicks.
- Formatted with prettier (repo `.prettierrc`).
