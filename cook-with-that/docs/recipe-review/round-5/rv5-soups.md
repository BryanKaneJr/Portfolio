# rv5-soups: paper review of `src/data/originals/soupsSaladsDips.ts` (round 5)

## Summary
- **20 recipes reviewed**, all in `SOUPS_SALADS_DIPS_RECIPES`: 6 salads, 4 soups, 7 dips and salsas, 3 bowls.
- **3 fixed.** All three are small: two steps in the wrong order and one missing reheat temperature.
- **0 recipes I'd drop.** There are 2 notes for the owner below. Neither one blocks release.
- No catalog changes, so there is no `map-entries.ts.txt` or `catalog-keys.txt`.
- `npm run check` passes: 668 recipes and 399 ingredients, 11 test suites, 874 tests.

**What I checked in every recipe**
- **Amounts in the steps match the list.** Every "divided" or "remaining" amount adds back up to the list. For example, the Greek bowls split 5 tbsp oil, 6 tbsp lemon juice, 2 tsp salt, 3 garlic cloves and 3 tbsp dill across four uses.
- **Liquid for the grains:**
  - quinoa: 1 cup to 1 3/4 cups water
  - rice: 1 1/2 cups to 2 1/4 cups liquid, with 17–18 minutes covered and a 5-minute rest
  - mulligatawny: 1/2 cup rice and 1/2 cup red lentils in 6 cups broth plus coconut milk, with a step to thin it if needed
- **Thickening:** 3 tbsp cornstarch in about 7 1/2 cups of hot and sour soup, and 1 tbsp in the queso.
- **Ingredient IDs:** every ID is the same food as its display name.
- **Safety:** chicken is cooked to 165°F and pork to 145°F. The Greek chicken's raw marinade is thrown away. The hot soup is blended with the blender no more than half full.
- **Salt (decision 14):**
  - Dishes seasoned by ham, cheese, bacon, soy, fish sauce or hot sauce get no added salt.
  - Every other dish gets measured salt.
- **Taglines:** each one matches what the recipe makes.
- **Tags:** meals and dish types fit.
- **No near-duplicates** of anything in the library or in the other round-5 files.

## Fixed
- **`chef-salad`:** the step that begins "While the eggs cook, make the dressing" came after the step where the eggs are already in ice water and peeled.
  - Change: I swapped those two steps. The dressing is now made during the 11 minutes the eggs stand, which is what the step says.
- **`buffalo-chicken-dip`:** the dip bakes already-cooked chicken, but the bake step only said "hot in the center".
  - Change: the step now ends "(165°F / 74°C)".
  - Why: this is the USDA reheat target. The last review added the same note to `bowtie-pasta-with-chicken-broccoli-and-feta` (rv08).
- **`chipotle-black-bean-dip`:** the warm option came after the step that spreads the dip in a bowl and tops it. A cook following the steps in order would have to scrape the dip back into a pan.
  - Change: warming is now the step before serving: "To serve it warm, heat the dip … for 4–5 minutes. For a cool dip, skip this step."
  - Then: "Spread the dip in a shallow bowl and top with …"

## For the owner
1. **`roasted-tomatillo-salsa-verde` keeps the `grilled` tag (the writer asked about this).**
   - The broiler is the only cooking method, and decision 11 defines Grilled as "grill or broiler is the main method". Baba Ganoush has the same tag.
   - **Recommendation: keep it.**
   - The audit's "near-duplicate of pico-de-gallo" flag is a false match. This salsa is cooked and blended from tomatillos, while pico is raw chopped tomato.
2. **`queso-dip-with-green-chiles`: the texture is the main unknown (the writer also put it first to cook-test).**
   - The recipe uses 12 oz of cheese to a 12 oz can of evaporated milk, plus the liquid from the chile can. Served warm, that will be on the loose side of scoopable. It thickens as it cools.
   - The step only covers a dip that is too thick ("stir in a spoonful of water"). That seems right for this ratio, and I don't think it can split.
   - **Recommendation: no change.** If a cook ever reports it runny, the fix is 16 oz of cheese, not more cornstarch.

**Smaller points I left alone**
- **`chef-salad`, audit flag "turkey_breast with no internal temperature":** the turkey is already cooked (deli or leftover roast), so it needs no doneness temperature. Using the ID `turkey_breast` for cooked turkey follows the "cooked chicken → `chicken`" rule.
- **`spinach-and-potato-soup`:** `cookMinutes` 35 is a little short. It works out closer to 40–45 once you count bringing 5 cups of broth and 2 lb of potatoes to a boil and blending in batches. **Recommendation: leave it unless the owner wants the times tightened across the library.**

## Checked, no change
nicoise-salad, wedge-salad-with-blue-cheese-dressing, asian-chicken-salad-with-sesame-dressing,
broccoli-cheddar-ranch-pasta-salad, panzanella, tom-kha-gai, hot-and-sour-soup, chicken-mulligatawny-soup,
spinach-and-potato-soup, queso-dip-with-green-chiles, caramelized-french-onion-dip, white-bean-and-rosemary-dip,
roasted-tomatillo-salsa-verde, muhammara, mediterranean-chickpea-buddha-bowls, greek-chicken-bowls-with-lemon-rice,
black-bean-broccoli-and-rice-bowls-with-lime-crema.
