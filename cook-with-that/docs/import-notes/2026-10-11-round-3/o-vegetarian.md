# o-vegetarian handoff

Theme file: `src/data/originals/vegetarian.ts` (`VEGETARIAN_RECIPES`), 25 original recipes. All use `source: ORIGINAL_DRAFT`,
written from general cooking knowledge (no published recipe opened or paraphrased). `npm run check` passes in my worktree:
220 recipes, 262 ingredients, 387 tests. Coverage report with my 25 added: common pairs 80% → 88% exact, triples 30% → 41%.

## Worktree base
My worktree started at `c061183a` (master, 124 recipes). Before changing anything I copied the main checkout's uncommitted
round-3 files into it. I then checked it against `claude/cook-with-that-recipe-sources` (`git archive` + `diff -r`): it is
identical apart from my three files, `src/data/originals/vegetarian.ts`, `scripts/import/ingredient-map.ts` and
`src/data/ingredients.ts`.

## Recipes added (in file order), with the gap pairs each fills (both ingredients required)
1. Huevos Rancheros: black beans + eggs, black beans + tomato
2. Black Bean Burgers: black beans + eggs, black beans + bell pepper
3. Black Bean and Sweet Potato Enchiladas: black beans + spinach (homemade red sauce, Monterey Jack)
4. Black Bean Chili with Bell Peppers: black beans + bell pepper (list title was "Vegetarian Black Bean Chili with
   Bell Peppers"; shortened, and the tagline says meatless)
5. Vegetable Lasagna with Spinach and Ricotta: spinach + bell pepper
6. Eggplant Parmesan: breaded and oven-baked, not fried
7. Falafel with Tahini Sauce: dried chickpeas soaked 12–24 h (see notes)
8. Red Lentil Dal with Spinach
9. Pasta Primavera: broccoli + bell pepper, broccoli + tomato
10. Broccoli and Cheddar Stuffed Baked Potatoes: broccoli + potato
11. Spinach and Mushroom Quesadillas
12. Cauliflower Cheese: the British classic, a gap for UK cooks
13. Spinach, Rice and Feta Stuffed Peppers: rice + spinach, spinach + bell pepper
14. Ratatouille
15. Vegetable Lo Mein: broccoli + bell pepper
16. Sweet Potato and Black Bean Hash with Eggs: black beans + eggs, black beans + bell pepper
17. Gnocchi with Spinach and Tomato Cream
18. Penne alla Vodka
19. Broccoli Pesto Pasta: broccoli + spinach (spinach blended into the sauce with basil and walnuts)
20. Bibimbap with Spinach and Fried Egg: rice + spinach
21. Black Bean and Rice Burritos: black beans + spinach, black beans + bell pepper, rice + spinach, spinach + bell pepper
22. Lentil Shepherd's Pie
23. White Bean, Tomato and Spinach Pasta
24. Zucchini Fritters (with a Greek yogurt, lemon and garlic sauce)
25. Mushroom and Black Bean Tacos: black beans + tomato (fresh pico de gallo)

Gap pairs now covered that had no recipe before: black beans + eggs / tomato / spinach / bell pepper; rice + spinach;
broccoli + potato / tomato / spinach / bell pepper; spinach + bell pepper. Not covered by me: anything with meat, and
black beans + broccoli / potato / pasta (none of my dishes uses them naturally).

## Skipped (3 of 28 on my list; no replacements needed, the list had 28 for 25 slots)
- **Spinach and Ricotta Stuffed Shells**: the same spinach-ricotta filling as my Vegetable Lasagna, and close to o-beef's
  Beef and Spinach Stuffed Pasta Shells.
- **Egg and Vegetable Fried Noodles**: overlaps my Vegetable Lo Mein (stir-fried noodles with vegetables).
- **Fresh Tomato and Basil Pasta**: my list already had 6 pastas, and the library has plenty of simple tomato pastas
  (Arrabbiata, alla Norma, Aglio e Olio, Navy-Style). It fills no gap pair.

## Catalog additions (via `npm run import:catalog`, never by hand)
New reviewed keys (also in `W/new-ingredients.txt`): `gnocchi` (grain), `vodka` (pantry), `monterey jack` (dairy, name
"Monterey Jack"), `gochujang` (pantry), `lo mein noodles` (grain).
Pre-reviewed keys I brought into the catalog: `cauliflower`, `bean sprouts`, `sesame seeds` (o-chicken also uses
`sesame seeds`; o-pork-seafood withdrew `bean sprouts`, so Bibimbap is now what needs it).
Map entry to an existing ID: `'lasagna noodles': 'pasta'` (a pasta shape, like the shells and ziti `pasta` already covers).
I noted it in the registry for o-beef's Classic Beef Lasagna, so nobody adds a separate lasagna noodle item.

For the integrator:
- At first I also added `'chinese egg noodles': '=lo mein noodles'`. It made searching "egg" return Lo mein noodles,
  which breaks `tests/searchAudit.test.ts` (`top('egg')` must be eggs, egg noodles, eggplant). I removed the variant
  and regenerated the catalog line with `import:catalog`, so `lo_mein_noodles` has no aliases.
- `sesame_seeds` gets the alias `sesame` from the pre-reviewed `sesame: '=sesame seeds'` map entry. "sesame oil" is a
  longer term and still matches first in steps.
- The coverage report lists Sesame seeds as "no recipe requires it yet" because Bibimbap uses it only as an optional
  garnish. That's expected.

## Notes for the culinary reviewer
- **Falafel** uses dried chickpeas soaked 12–24 hours; canned ones make falafel that falls apart. `prepMinutes` is 780
  (12 h soak + 30 min chill + 30 min work), so it sorts as a long recipe. It is indexed as `chickpeas`, so pantry mode
  will offer it to someone who only has canned; the ingredient line says "dried chickpeas (not canned)". It needs a
  food processor, with a sturdy blender in two batches as the fallback. That goes slightly past the "blender at most"
  guideline, but the dish isn't practical without one.
- **Black Bean Burgers** hold raw egg, so the step says 160°F / 71°C in the center.
- **Huevos Rancheros**: the tortillas are shallow-fried in 4 tbsp oil. The eggs are then fried in what's left
  (pour off or add the last 1 tbsp).
- **Enchiladas**: the sauce is a roux-based red chile sauce from chili powder, tomato paste and vegetable broth
  (about 2 3/4 cups for 12 corn tortillas). Chili powder is listed as "4 tbsp plus 1 tsp" so metric shows spoons,
  not ml.
- **Bibimbap**: vegetarian (no beef); mushrooms seasoned with soy. Gochujang is the one specialty item.
- **Lo mein** uses hoisin instead of oyster sauce to stay vegetarian.
- **Lentil Shepherd's Pie** uses soy sauce rather than Worcestershire, which contains anchovies.
- **Gnocchi** are pan-fried straight from the package (shelf-stable or refrigerated) rather than boiled; 2 lb serves 4.
- Times include salting, resting and chilling (Eggplant Parmesan 30 min salting, lasagna 15 min rest).
- Metric output was checked line by line. Cups of cheese, nuts and vegetables show grams. The falafel's frying
  temperature shows plain °C, without fan or gas marks.
