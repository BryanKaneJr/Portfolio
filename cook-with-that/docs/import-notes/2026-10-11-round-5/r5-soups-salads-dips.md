# r5-soups-salads-dips: notes for the integrator

Theme file: `src/data/originals/soupsSaladsDips.ts` (`SOUPS_SALADS_DIPS_RECIPES`), 20 originals, all
`source: ORIGINAL_DRAFT`. `npm run check` passes in my worktree (568 recipes, 387 ingredients, 759 tests).

## Recipes added (and the gap each fills)

Salads (library had 29)
1. **Chef Salad** (`chef-salad`): diner classic with ham, turkey, Swiss, cheddar, egg and a quick Thousand Island.
2. **Niçoise Salad** (`nicoise-salad`): tuna + potatoes + green beans + eggs main-dish salad; library had none.
3. **Wedge Salad with Blue Cheese Dressing** (`wedge-salad-with-blue-cheese-dressing`): appetizer/side salad with a
   from-scratch blue cheese dressing.
4. **Asian Chicken Salad with Sesame Dressing** (`asian-chicken-salad-with-sesame-dressing`): napa + red cabbage
   chicken salad; first salad using napa cabbage.
5. **Broccoli Cheddar Ranch Pasta Salad** (`broccoli-cheddar-ranch-pasta-salad`): the cold **pasta + cheddar +
   broccoli** triple (all required). Renamed from "Broccoli Pasta Salad with Cheddar" so it can't be mistaken for the
   library's Broccoli Salad with Bacon and Cheddar (raw broccoli, mayo-vinegar, bacon); this one is pasta in a
   buttermilk ranch dressing, no bacon.
6. **Panzanella (Tuscan Bread and Tomato Salad)** (`panzanella`): bread + tomato side salad.

Soups
7. **Tom Kha Gai (Thai Coconut Chicken Soup)** (`tom-kha-gai`)
8. **Hot and Sour Soup** (`hot-and-sour-soup`): pork, tofu, shiitake, bamboo shoots, egg ribbons.
9. **Chicken Mulligatawny Soup** (`chicken-mulligatawny-soup`): curry, red lentils, apple, rice, coconut milk.
10. **Spinach and Potato Soup** (`spinach-and-potato-soup`): the **potato + spinach + butter** triple (all required).
    Renamed from "Creamy Potato and Spinach Soup" so it isn't confused with the library's "Creamy Broccoli and Potato
    Soup". Blended green soup, vegetable broth (vegetarian).

Dips and salsas (library had 9; these add 7)
11. **Queso Dip with Green Chiles** (`queso-dip-with-green-chiles`): stovetop, real cheese + evaporated milk +
    cornstarch, no processed cheese.
12. **Caramelized French Onion Dip** (`caramelized-french-onion-dip`)
13. **Buffalo Chicken Dip** (`buffalo-chicken-dip`): baked (`dip`, `bake`).
14. **White Bean and Rosemary Dip** (`white-bean-and-rosemary-dip`)
15. **Roasted Tomatillo Salsa Verde** (`roasted-tomatillo-salsa-verde`): tagged `dip` + `grilled` because the
    broiler is the only cooking method (same call as the library's Baba Ganoush). Drop `grilled` if you'd rather the
    Grilled filter not show a salsa.
16. **Muhammara (Red Pepper and Walnut Dip)** (`muhammara`)
17. **Chipotle Black Bean Dip** (`chipotle-black-bean-dip`): kept from my list but made clearly different from the
    library's Refried Black Beans (a warm mashed skillet side fried with onion): this is a blended chipotle-lime dip,
    served cool or warmed.

Bowls (library had 33)
18. **Mediterranean Chickpea Buddha Bowls** (`mediterranean-chickpea-buddha-bowls`): quinoa, crisp roasted chickpeas,
    sweet potato, lemon tahini. Vegetarian.
19. **Greek Chicken Bowls with Lemon Rice** (`greek-chicken-bowls-with-lemon-rice`): lemon-oregano thighs, lemon-dill
    rice, tzatziki. Different from the library's Chicken Shawarma Bowls (spice-roasted, tahini) and Greek Lemon
    Chicken and Rice Bake (a one-pan bake).
20. **Black Bean, Broccoli and Rice Bowls with Lime Crema** (`black-bean-broccoli-and-rice-bowls-with-lime-crema`):
    the **rice + black beans + broccoli** triple (all required). Vegetarian.

## Skips and swaps
- **Caprese Salad**: skipped; the library already has it (`caprese-salad`, "Tomato Mozzarella Salad").
- **Black Bean, Corn and Quinoa Salad**: skipped as a near-duplicate of the library's Black Bean and Corn Salad (same
  black beans, charred corn, red pepper, tomato, jalapeño and cumin-lime build; quinoa alone doesn't make it a
  different dish).
- My list had 22 dishes, so dropping those two left exactly 20. No swaps were needed.

## Catalog additions (7)
All reviewed in `scripts/import/ingredient-map.ts` (new section above "Not ingredients"), added with
`npm run import:catalog`, and registered in `W/new-ingredients.txt`:

| key | category | used by | note |
|---|---|---|---|
| iceberg lettuce | produce | Chef Salad, Wedge Salad | **r5-grill-fry registered the same key and category.** Keep one map entry when merging, or tsc fails on the duplicate key. |
| galangal | produce | Tom Kha Gai | not ginger; never a substitution |
| makrut lime leaves | produce | Tom Kha Gai | variant key `kaffir lime leaves` (the older name, still on many packages) becomes an alias. Drop that line if the owner would rather not carry the old name. |
| tomatillo | produce | Roasted Tomatillo Salsa Verde | variant key `tomatillos` |
| pomegranate molasses | pantry | Muhammara | not molasses; the longer catalog name means "pomegranate molasses" in steps never reads as molasses |
| potato chips | pantry | Caramelized French Onion Dip (optional serve-with only) | variant key `potato crisps` (British). I chose pantry (a shelf-stable snack); `tortilla_chips` sits in grain, so move it there if you want the two chips together. The results page will say "No recipe needs Potato chips yet" because it's only optional. |
| red cabbage | produce | Asian Chicken Salad | key was already reviewed in the map; `import:catalog` only |

I grepped every existing recipe for the new names (potato chips, iceberg lettuce, galangal, tomatillo, red cabbage,
pomegranate molasses, lime leaves): no step collisions.

No catalog entry was needed for deli turkey: the Chef Salad uses `turkey_breast` with the display name "sliced
roast turkey breast (deli or leftover)", following the map's `'cooked chicken breast': 'chicken'` precedent (same
food, cooked). If you'd rather treat deli turkey like `roast_beef` (its own item), that would be a new key.

## Shopping notes (international aisle)
- **Tom Kha Gai** needs galangal and makrut lime leaves: Asian markets or well-stocked supermarkets, often frozen
  (both freeze well). Lemongrass and fish sauce were already in the catalog.
- **Muhammara** needs pomegranate molasses (Middle Eastern aisle). It uses red pepper flakes plus paprika rather than
  Aleppo pepper, which the catalog lacks; that's the recipe's own formula, not a stated substitution.
- **Hot and Sour Soup** is written with unseasoned rice vinegar (supermarket-friendly) rather than Chinese black
  vinegar; the amount (1/3 cup plus more to taste) is set for the milder vinegar.
- Tomatillos are common in US supermarkets but may be hard to find in the UK.

## Equipment
- The dips (white bean, muhammara, chipotle black bean) say "food processor or blender": both work; a blender needs a
  spoonful or two more liquid and more scraping. No recipe needs equipment beyond the baseline.
- The Buddha Bowls use two sheet pans so the chickpeas crisp instead of steaming.

## Cook-test first
1. **Hot and Sour Soup**: the sourness and heat balance with rice vinegar (1/3 cup) and white pepper (1 tsp) in 6 cups
   broth, and the body from 3 tbsp cornstarch.
2. **Queso Dip with Green Chiles**: texture of 12 oz block-shredded cheese in a 12 oz can of evaporated milk with 1 tbsp
   cornstarch; check it stays smooth when rewarmed.
3. **Niçoise Salad**: one-pot timing (eggs in when the potato water boils, beans added for the last 3–4 minutes).
4. **Chicken Mulligatawny Soup**: thickness once the red lentils and 1/2 cup rice have soaked up liquid in 6 cups broth
   plus coconut milk; the last step says to thin with water if needed.
5. **Spinach and Potato Soup**: blending Yukon Golds briefly (about 30 seconds per batch) to avoid a gluey texture.
6. **Tom Kha Gai**: galangal strength (2-inch piece) and fish sauce/lime balance with 2 cans of coconut milk.
7. **Muhammara**: stiffness with a 16 oz jar of peppers to 1 cup walnuts and 1/2 cup bread crumbs (jar sizes vary,
   which is why the step says to add crumbs if loose).

## For the integrator
- Only my theme file, `scripts/import/ingredient-map.ts` and (via `import:catalog`) `src/data/ingredients.ts` changed.
- Salt: dishes seasoned by ham, cheese, bacon, soy or fish sauce (Chef, Wedge, Queso, Buffalo dip, Tom Kha, Hot and
  Sour) carry no added salt; the Asian Chicken Salad salts only the chicken. Pasta salad salts the pasta water and the
  dressing.
- Meals: Wedge Salad is appetizer/side; dips are appetizer/snack; soups, bowls and main salads are lunch/dinner;
  Panzanella and the pasta salad are side/lunch.
