# nhlbi2: NHLBI round 2

15 recipes appended to `src/data/imported/nhlbi.ts`, 12 new catalog entries, 35 new map entries.
`npm run check` passes in the worktree: 139 recipes, 214 ingredients, 303 tests.
Coverage report with these 15 added: exact matches for common 2-ingredient pairs went from 69% to 71%, and for triples from 21% to 23%.

## Imported (source key → id: title, gap filled)

| Source key | id: title | Gap |
|---|---|---|
| 20-minute-chicken-creole | chicken-creole-over-rice: Chicken Creole over Rice | 1. Rice (chicken+rice, rice+bell pepper); bowl |
| asian-style-steamed-salmon | ginger-salmon-rice-bowls: Ginger Salmon Rice Bowls | 1. Rice; bowl |
| grilled-tuna-chickpea-and-spinach | grilled-tuna-with-chickpea-and-spinach-salad: Grilled Tuna with Chickpea and Spinach Salad | 2. Beans+spinach, beans+tomato; 3. spinach main; salad |
| minestrone-soup | minestrone-soup: Minestrone Soup | 2. Beans+tomato; soup |
| vegetable-stew | summer-vegetable-stew: Summer Vegetable Stew | 3. Potato+tomato; soup |
| turkey-and-beef-meatballs-whole | turkey-and-beef-meatballs-with-spaghetti: Turkey and Beef Meatballs with Spaghetti | Ground beef pasta main (last round's suggested pick) |
| braised-cod-leeks | braised-cod-with-leeks: Braised Cod with Leeks | Fish+potato one-pot main |
| baked-tilapia-tomatoes | baked-tilapia-with-tomatoes: Baked Tilapia with Tomatoes | Fish+tomato bake |
| spicy-southern-barbecued-chicken | spicy-southern-barbecued-chicken: Spicy Southern Barbecued Chicken | Chicken bake |
| hawaiian-huli-huli-chicken | huli-huli-chicken-skewers: Huli Huli Chicken Skewers | Main or appetizer (appetizers gap) |
| marinated-chicken-adobong-manok | chicken-adobo: Chicken Adobo (Adobong Manok) | Classic Filipino main; optional rice |
| baby-spinach-golden-raisins-and | spinach-with-raisins-and-pine-nuts: Spinach with Golden Raisins and Pine Nuts | 3. Spinach; side |
| couscous-carrots-walnuts-and | couscous-with-carrots-walnuts-and-raisins: Couscous with Carrots, Walnuts and Raisins | Side |
| apple-coffee-cake | apple-coffee-cake: Apple Coffee Cake | Dessert; baked goods |
| strawberry-banana-yogurt-parfait | strawberry-banana-yogurt-parfaits: Strawberry Banana Yogurt Parfaits | Dessert or breakfast |

**Black beans:** none of the 40 pool recipes uses black beans. **Rice:** the pool's only rice dish is Wiki (Fast) Rice, which nearly duplicates Vegetable Fried Rice. So I made rice a required ingredient in the two recipes whose NHLBI pages suggest serving them with rice. The Creole tip says "Delicious served over rice", and the salmon tip says "Try serving with a side of rice". Both now include a step to cook the rice. If you'd rather keep rice as a serve-with, change those two lines to `opt(...)`. The adobo lists rice only as an optional serve-with, because its page doesn't mention rice.

## Provenance

Each of the 40 pool pages names an NHLBI publication as its Recipe Source: Deliciously Healthy Dinners (12), Stay Young At Heart (7), Heart Healthy Home Cooking African American Style (5), Delicious Heart Healthy Latino Recipes (5), Deliciously Healthy Family Meals (4), Honoring the Gift of Heart Health (4), Healthy Heart, Healthy Family (2) and Your Health Is Golden! (1). I scanned each page's text (headnote, ingredients, steps and tips) for adapted, copyright, ©, courtesy, reprint, permission, inspired, original, restaurant, chef, magazine, cookbook and http. The only hits were phrases like "from the heat" and "by about 1 inch". **No exclusions**, so `excludes.txt` is empty on purpose.

NHLBI's terms are respected: no logos, no "Keep the Beat", no photos, no endorsement wording. Every tagline is new, and none uses "heart-healthy". The low-sodium choices are kept (low-sodium broth and beans, reduced-sodium soy sauce, no-salt-added tomato products, the source's small salt amounts).

## Catalog and map: things to know

- **No `hot_sauce` in the catalog.** It was a pre-reviewed `{ add }` key, but adding it breaks `import.test.ts`. The chicken-paprikash step "whisk a ladle of the hot sauce into the sour cream" would then count as hot sauce missing from that recipe's list. Workers append only, so I dropped the "dash of hot sauce" from the minestrone. If another worker's recipe adds `hot_sauce`, reword that paprikash step first (e.g. "a ladle of the hot liquid").
- **`'orange juice': 'orange'`**, the same pattern as lemon juice → lemon. A separate "Orange juice" catalog item would break the same test for Chicken Stir-Fry with Orange Sauce, whose step says "orange juice" and whose list has `orange`.
- **New catalog entries** (`catalog-keys.txt`): chili sauce (spice: the bottled, ketchup-style kind; the recipe's display name says so, because British "chili sauce" means hot sauce), shiitake mushrooms, tuna steak, cod, tilapia, black olives, molasses, pine nuts, couscous, pecans, graham crackers, vanilla yogurt. Cod and pecans were already reviewed keys. Aliases the tools generated: shiitake, shiitake mushroom caps, cod fillets, tilapia fillets, pitted black olives, graham cracker crumbs. `searchAudit.test.ts` passes with all of them.
- `import:catalog` writes the shiitake entry as a line longer than Prettier allows, so `prettier --check src/data/ingredients.ts` warns. `npm run check` doesn't run Prettier. Run `npm run format` after merging if you want the file clean. (`nhlbi.ts` is Prettier-clean.)
- **`GRAMS_PER_CUP` suggestions.** Metric mode currently shows these in ml: `shiitake_mushrooms: 70` (sliced, same as mushroom), `black_olives: 135`, `graham_crackers: 100` (crumbs), `vanilla_yogurt: 245` (same as yogurt). Optional, for later recipes: `couscous: 175` (dry), `pecans: 110` (chopped), `pine_nuts: 135`. My couscous and pecan lines already carry an "(about N oz)" note, so they show grams.
- The map also documents source wordings as `null` (editor picks): 'olive or canola oil', 'summer squash', 'pumpkin pie spice or cinnamon', and 'hot pepper' → '=chili pepper'. Two wordings are `false` (not ingredients): 'wooden skewers' and '6 inch wooden skewers'.

## Source fixes and editing calls (for the culinary reviewer)

- **Chicken Adobo:** the page simmers 1 lb of boneless breast for 45–60 minutes in only 2 tbsp soy sauce and 1/4 cup vinegar, which would scorch and dry out the chicken. I added 1/2 cup water and gave 20–25 minutes for breasts (30–40 for thighs). The page's "2 Tbsp ground black pepper" reads as a slip for whole peppercorns, the traditional adobo seasoning, so the recipe uses 1 tbsp whole black peppercorns. Vinegar is white (or cane).
- **Barbecued chicken:** the sauce is 5 tbsp tomato paste plus teaspoons of liquid, and the page says to simmer it 15 minutes. I added 1/3 cup water so it doesn't scorch. I also specified bone-in, skinless pieces, which the 50-minute broil-then-bake needs, and dropped the "seal in juices" claim.
- **Minestrone:** the page's 4-quart pot can't hold 11 cups of water plus about 15 cups of vegetables, so the recipe says an 8-quart pot. Broken spaghetti needs 8–10 minutes, not "2–3 minutes only". I used today's 14.5-oz can of tomatoes, not the page's 1-lb can, and dropped the hot sauce (see above). Serves 8 bowls of about 2 cups, not 16 of 1 cup.
- **Meatballs:** the page makes separate turkey and beef meatballs. I combined them into one mix with the same total amounts. Turkey is in the mix, so the doneness is 165°F.
- **Parfaits:** the page's per-glass layers (1 tbsp yogurt, 1 tbsp of each fruit) don't add up to its totals (4 cups yogurt for 8). It also names "4 8-oz glasses" for 8 servings. I rewrote the layers to use the totals across 8 glasses, and dropped the optional fat-free whipped topping.
- **Vegetable stew:** water plus a low-sodium bouillon cube became 3 cups low-sodium vegetable broth. "Summer squash" became zucchini or yellow squash, indexed as zucchini. "½ small hot pepper" became half a jalapeño. "1 C diced tomatoes" is read as fresh in a summer stew, which also fills the potato+tomato gap. Serves 6, not 8, as a main.
- **Huli huli:** added soaking the wooden skewers. The page's food-safety split of the sauce (one bowl for basting raw chicken, one kept clean) is kept.
- **Spinach:** the steps avoid the word "toast", which would read as bread.

Dish types left empty because none honestly fits: Huli Huli Chicken Skewers, Couscous with Carrots, Walnuts and Raisins, and Strawberry Banana Yogurt Parfaits.

## Cross-worker overlap to watch

The Based Cooking slices include `spaghetti-and-meatballs` (close to my turkey-and-beef meatballs with spaghetti), `shrimp-creole` (different protein from my chicken Creole), `scandinavian-coffee-cake` (a different cake) and `lebanese-lentil-soup` (I skipped NHLBI's lentil soup).

## Promising ones skipped, and why

- Near-duplicates of library recipes:
  - wiki-fast-rice (Vegetable Fried Rice)
  - new-orleans-red-beans (Red Beans and Rice)
  - pinto-beans (Drunken Beans: pinto beans, tomato and onion; the page also needs 3 cups of dried beans and seasons only with pepper)
  - tuscan-beans-tomatoes-and-oregano (Greek Chickpea Salad; it also calls for a vague "salt-free seasoning blend")
  - garden-potato-salad (Savory Potato Salad)
  - flavorful-green-beans (Garlic Green Beans)
  - lentil-soup (flagged in last round's README; another worker's slice also has a lentil soup)
- **Good next picks:**
  - asparagus-lemon-sauce (needs `asparagus`)
  - roasted-beets-orange-sauce (needs `beets`)
  - baked-fish (cornflake crust; needs a reviewed "fish fillets" wording plus cornflakes and buttermilk)
- **Skipped for fit:**
  - chicken-chile-stew (7 roasted, peeled green chiles; 3 lb chicken for "10 half-cup servings")
  - creamy-squash-soup-shredded-apples (frozen puréed squash)
  - autumn-salad (bottled raspberry vinaigrette; 3 new catalog items)
  - rainbow-fruit-salad (5 new fruits)
  - tropical-fruit-compote
  - zucchini-medley (microwave only)
  - alaska-salmon-salad (thin)
  - grapesicles (too thin)
  - mango-shake and summer-breeze-smoothie (drinks)
  - fresh-lumpia and vietnamese-fresh-spring-rolls (wrappers)
  - oven-fried-yucca
  - caribbean-pink-beans (plantains, dried pink beans)
  - homemade-turkey-soup (needs a turkey carcass)
