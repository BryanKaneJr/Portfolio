# r5-grill-fry notes

Theme file: `src/data/originals/grillFry.ts` (`GRILL_FRY_RECIPES`), 20 recipes, all `source: ORIGINAL_DRAFT`.
Written from general cooking knowledge; no published recipe was searched for or opened.
`npm run check` passes in my worktree: 568 recipes, 385 ingredients, 759 tests (base was 548 / 380 / 739).

## Recipes added (gap each fills)

The library had 17 grilled and 10 fried dishes. These add 12 fried and 8 grilled.

Fried (deep-fried in a heavy pot with a deep-fry thermometer, oil temperatures in the steps):
1. **Southern Buttermilk Fried Chicken**: the classic bone-in fried chicken. The library had only air-fryer tenders,
   katsu and sticky-sauce chicken.
2. **Chicken-Fried Steak with Cream Gravy**: shallow-fried in 1/3 inch of oil, with milk gravy made in the same pan.
   First cube steak recipe.
3. **Beer-Battered Onion Rings**: the first onion rings (the library's beer batter was only on fish and chips).
4. **Buttermilk Hush Puppies**: the first cornmeal fritter. Pairs with the catfish.
5. **Tostones (Twice-Fried Green Plantains)**: the first plantain recipe. The garlic-lime dip is optional (serve-with).
6. **Vegetable Tempura with Soy-Ginger Dipping Sauce**: a vegetarian fried main or appetizer.
7. **Korean Fried Chicken Wings with Gochujang Glaze**: double-fried wings. The library's only wings are baked Buffalo.
8. **Fried Green Tomatoes**: shallow-fried in 1/4 inch of oil (tagged skillet and fried).
9. **Vegetable Pakoras**: onion, potato and spinach fritters. A vegetarian Indian snack.
10. **Coconut Shrimp with Sweet Chili-Lime Sauce**: the sauce is optional (serve-with).
11. **Fried Shrimp Po' Boys with Remoulade**: a fried sandwich (sandwich + fried).
12. **Crispy Cornmeal-Fried Catfish**: first catfish. Different from the library's beer-battered fish and chips.

Grilled (each also gives a broiler or grill-pan method in its steps):
13. **Grilled Carne Asada with Orange-Lime Marinade**: grilled flank steak in an orange, lime, jalapeño and cilantro
    marinade, served sliced with grilled green onions (tortillas optional). It's clearly different from the library's
    "Steak Tacos with Pico de Gallo" (skillet-seared, lime-cumin, built as tacos).
14. **Garlic-Lemon Grilled Shrimp Skewers**
15. **Classic Grilled Cheeseburgers**: cheddar, buttered buns and a pickle burger sauce. The library's "Hamburger
    Patties" are plain skillet patties.
16. **Grilled Salmon with Lemon-Herb Butter**: the first grilled salmon (the library's salmon is baked or pan-seared).
17. **Grilled Vegetable Platter with Balsamic and Basil**: a vegetarian grilled side.
18. **Grilled Pork Chops with Peach Salsa**: the first grilled pork chops. Steps call it "the peach mixture" because
    "salsa" is the jarred-salsa catalog item and the step checker would read it as that.
19. **Chicken Shish Tawook with Garlic Sauce**: yogurt, tomato paste and allspice marinade, with a mayo-yogurt garlic
    sauce. Kept clearly apart from the library's Chicken Souvlaki (lemon and oregano, with tzatziki).
20. **Grilled BBQ Chicken Drumsticks**: two-zone grilling with a homemade sauce. The library's barbecued chicken
    (NHLBI) is skinless, broiled, then baked.

Title changes from the list, to keep titles from being confused with library recipes: Southern Fried Chicken →
Southern Buttermilk Fried Chicken; Hush Puppies → Buttermilk Hush Puppies; Vegetable Tempura → … with Soy-Ginger
Dipping Sauce; Korean Fried Chicken → Korean Fried Chicken Wings with Gochujang Glaze; Coconut Shrimp → … with Sweet
Chili-Lime Sauce; Shrimp Po' Boys → Fried Shrimp Po' Boys with Remoulade; Carne Asada → Grilled Carne Asada with
Orange-Lime Marinade; Grilled Salmon with Herb Butter → … with Lemon-Herb Butter; Grilled Vegetable Platter with
Balsamic → … and Basil; Chicken Shish Tawook → … with Garlic Sauce; Crispy Fried Catfish → Crispy Cornmeal-Fried Catfish.

## Skips and swaps

The list had 22 dishes, so two skips left exactly 20 and no swaps were needed.
- **Lemon-Herb Grilled Chicken Thighs**: skipped. It's too close to the library's "Lemon Herb Chicken Thighs with
  Roasted Potatoes" (same lemon, garlic and herb thighs; the titles would be easy to confuse). The list was also
  heavy on chicken.
- **Bratwurst with Peppers and Onions**: skipped. It nearly duplicates "Sausage, Peppers & Onions" (seed) and "Aussie
  Sausage Sizzle" (grilled sausages and onions in bread).

## Catalog additions (`catalog-keys.txt`, `map-entries.ts.txt`)

Added with `npm run import:catalog` after reviewing them into `ingredient-map.ts`, and registered in
`new-ingredients.txt`:
- `plantain` (produce; alias plantains): Tostones.
- `catfish` (protein; alias catfish fillets): Crispy Cornmeal-Fried Catfish.
- `cube_steak` (protein; alias cubed steak): Chicken-Fried Steak.
- `chickpea_flour` (grain; aliases besan, gram flour, garbanzo bean flour): Vegetable Pakoras.
- `iceberg_lettuce` (produce; alias iceberg): Po' Boys and Cheeseburgers. **The soups/salads writer probably needs
  it for the Wedge Salad.** It's in the shared registry under the same key, so the two should merge cleanly.

None of these names appears in any existing recipe's steps (I grepped `src/` first), so they shouldn't trip the step
check elsewhere.

One map entry to an existing ID, **for the integrator to confirm**: `'green tomatoes': 'tomato'`. Fried Green
Tomatoes uses `tomato` with the display name "firm green (unripe) tomatoes". My reasoning: an unripe tomato is the same
fruit, like the red/yellow/white onion rule ("same vegetable; recipe names the color"), and anyone avoiding tomato
should have this dish hidden. If you'd rather treat green tomatoes as their own shopping item, make it
`{ add: 'produce' }` and change that one recipe line.

## Cook-test first

- **Korean Fried Chicken Wings**: dry cornstarch coating rested 10 minutes, then fried 10–12 minutes at 325°F and
  2–3 minutes at 375°F. Check the crust holds up under the glaze and the first fry reaches 165°F.
- **Vegetable Tempura**: batter ratio (1 cup flour + 2 tbsp cornstarch to 1 egg + 3/4 cup ice water) and the
  timings for 1/4-inch sweet potato.
- **Vegetable Pakoras**: how much of the 1/3–1/2 cup water is really needed once the salted vegetables release
  their liquid.
- **Buttermilk Hush Puppies**: batter thickness after the 10-minute rest, and whether the centers cook through at
  350°F in 3–4 minutes.
- **Southern Buttermilk Fried Chicken**: holding the oil at 300–325°F with 5 pieces in a 5- to 7-quart pot, and the
  oven finish (300°F) for pieces that brown before reaching 165°F.
- **Chicken-Fried Steak**: gravy thickness (1/4 cup fat + 1/4 cup flour to 2 1/2 cups milk).
- **Tostones**: first-fry time (2–3 min per side at 325°F) before smashing.

## Things the integrator should know

- **Cube steak doneness:** I wrote 160°F (71°C) for chicken-fried steak and explain that cube steak is tenderized all
  the way through, so it's cooked like a burger. That's more cautious than the USDA's 145°F + 3-minute rest for
  mechanically tenderized steaks. It's always served well done anyway, and the thin steaks pass 160°F by the time the
  crust is golden. Change it to the 145°F wording if you prefer.
- **Metric weights:** `GRAMS_PER_CUP` has no entry for cornmeal, cornstarch, shredded coconut, chickpea flour,
  iceberg lettuce or pickles, so those cups show in ml. I added the author's metric where it matters for a batter
  or coating: cornmeal "1 cup (about 145 g)" / "3/4 cup (about 110 g)", cornstarch "1/4 cup (30 g)" / "2/3 cup
  (85 g)". Coconut, chickpea flour, lettuce and pickles still show in ml, which is fine for those uses. If you add
  table entries, my approximate figures: cornmeal ~145 g/cup, cornstarch ~128 g/cup, sweetened shredded coconut
  ~85 g/cup, chickpea flour ~100 g/cup (it varies a lot with how it's spooned). Please check them before using them.
- **Step wording:** to keep the step checker honest, Chicken-Fried Steak's steps never say "chicken-fried" or "cream"
  (they'd read as chicken and heavy cream), and steps that use corn tortillas always say "corn tortillas" (plain
  "tortillas" is the flour-tortilla ID). Frying temperatures sit right after the word "oil" so metric mode shows
  plain °C rather than oven fan/gas marks.
- **Equipment:** deep frying needs a large heavy pot (Dutch oven) and a clip-on deep-fry thermometer. Grilled dishes
  need an instant-read thermometer and (for two of them) skewers. Nothing needs a stand mixer or food processor.
- **Optional parts:** the tostones dip (garlic, lime, olive oil), the coconut shrimp dip (sweet chili sauce, lime),
  carne asada's tortillas and avocado, and tempura's rice are `opt` serve-withs. Each dish works without them.
- **Prep times include marinating or brining:** fried chicken (4-hour minimum brine), 265 min; shish tawook
  (2-hour minimum), 150 min; carne asada (1-hour minimum), 75 min.
- Prettier: I ran `prettier --write` on `grillFry.ts`. `src/data/ingredients.ts` was already not prettier-clean at
  base, and I left it as `import:catalog` wrote it (the `chickpea_flour` line is long).
