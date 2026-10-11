# o-beef handoff: 25 original beef mains

Theme file: `src/data/originals/beef.ts` (`BEEF_RECIPES`), copied here as `beef.ts`. All recipes use
`source: ORIGINAL_DRAFT`. They were written from general cooking knowledge; no published recipes were searched for or opened.

`npm run check` in my worktree: typecheck clean, **220 recipes and 257 ingredients passed validation, 387/387 tests pass**.
Coverage report: 2-ingredient pairs **80% → 87%**, triples **30% → 44%**. Corn tortillas are now required by
3 recipes. Before this, no recipe required them.

## Worktree base
My worktree was created at `c061183a` (master). Before writing anything, I copied the main checkout's uncommitted round-3
files into the worktree; the coordinator confirmed this is fine. I checked that the tracked files are identical to
`claude/cook-with-that-recipe-sources` apart from my 5 added lines, and that the untracked originals files match the branch.
My only changes on top of that base are:
- `src/data/originals/beef.ts` (the 25 recipes)
- `scripts/import/ingredient-map.ts` (+2 lines, see map-entries.ts.txt)
- `src/data/ingredients.ts` (+3 catalog entries added by `import:catalog`)

## Recipes added (in file order), with the gap each fills
1. Spaghetti Bolognese: beef ragù (the library only had turkey Bolognese and sausage ragù).
2. Classic Beef Lasagna: first lasagna.
3. Beef and Black Bean Enchiladas: **black beans + ground beef**, **black beans + bell pepper**. Made with corn tortillas and a homemade red sauce, so it needs no new ingredient.
4. Sloppy Joes
5. Korean Ground Beef Rice Bowls: **ground beef + spinach**, **rice + spinach**. Spinach is required (sesame spinach).
6. Ground Beef and Broccoli Stir-Fry: **ground beef + broccoli**, **broccoli + bell pepper**.
7. Ground Beef, Spinach and Rice Skillet: **ground beef + spinach**, **rice + spinach**, **spinach + bell pepper**. Also has fresh tomato.
8. Classic Pot Roast with Carrots and Potatoes
9. Steak with Garlic Butter and Pan Potatoes
10. Swedish Meatballs (beef and pork)
11. Salisbury Steak with Mushroom Gravy
12. Ground Beef Burrito Bowls with Black Beans: **black beans + ground beef**, **black beans + tomato**. Also has rice and cheddar.
13. Mongolian Beef
14. Beef Kofta with Yogurt Sauce: served in pita, so its dish type is `sandwich`.
15. Hungarian Beef Goulash
16. Corned Beef and Cabbage (new catalog item: corned beef)
17. Beef Empanadas: homemade dough
18. Cheesy Ground Beef, Potato and Broccoli Skillet: **ground beef + broccoli**, **broccoli + potato**. Listed as "Ground Beef and Potato Skillet with Cheddar"; I added broccoli as a required ingredient and renamed it to match.
19. Baked Ziti with Beef
20. Moussaka: beef, with eggplant, potato and béchamel. It's a different dish from the library's Pastitsio.
21. Cheesy Beef and Bean Tostadas: uses pinto beans for variety, since #3 and #12 already cover black beans + ground beef.
22. Beef and Spinach Stuffed Pasta Shells: **ground beef + spinach**.
23. Pepper Steak with Rice: sirloin.
24. Steak Tacos with Pico de Gallo: flank steak.
25. Beef and Mushroom Pie: chuck and mushrooms in red wine, topped with puff pastry.

## Skipped from the list (28 dishes → 25)
- **Beef and Bell Pepper Stir-Fry**: near-duplicate of Pepper Steak with Rice (same dish). I kept Pepper Steak.
- **Beef Pot Pie**: near-duplicate of Beef and Mushroom Pie, and close to o-chicken's Classic Chicken Pot Pie (same
  crust and vegetables). I kept Beef and Mushroom Pie, which is more distinct.
- **Beef Kebabs with Peppers and Onions**: fills the fewest gaps. Pepper Steak covers sirloin with peppers and onion, and Kofta covers broiled beef.
No replacement dishes were needed.

## New catalog entries (catalog-keys.txt)
- `flank steak` (protein): already reviewed in the map. Used by Mongolian Beef and Steak Tacos.
- `puff pastry` (grain): already reviewed in the map. Used by Beef and Mushroom Pie.
- `corned beef` (protein): **new map entry**, with `'corned beef brisket'` as a spelling variant. It means raw salt-cured brisket, not
  canned corned beef or hash.
All three are registered in `new-ingredients.txt`.

## For the integrator
- Lasagna noodles and jumbo shells use the existing `pasta` ID (the shape is named in `displayName`), as the
  ingredient-mappings doc describes for pasta shapes. No aliases were added.
- Steps always say "corn tortillas", never bare "tortillas", because "tortillas" is an alias of the flour `tortillas` ID.
- I used straight apostrophes (double-quoted strings), as the rest of the library does. Prettier is clean on all three changed files.

## For the culinary reviewer
- **Steak doneness** (Steak with Garlic Butter, Steak Tacos): the steps give 130°F (54°C) for medium-rare, or 145°F (63°C)
  for medium, and name 145°F as the USDA's recommended minimum. Please confirm you're happy offering medium-rare.
- Stir-fried strips (Mongolian Beef, Pepper Steak) are cooked until browned, with no internal temperature, as in the
  library's Teriyaki Beef and Broccoli.
- All ground beef is cooked to 160°F / 71°C. Swedish Meatballs, Salisbury Steak and Kofta give the temperature at the point where the meat finishes cooking.
- Corned beef: simmer gently for 2 1/2 to 3 1/2 hours (about 50 minutes per pound) until fork-tender. The recipe adds no salt,
  because the brine and spice packet season it.
- Moussaka whisks 2 egg yolks into a béchamel that has cooled for 5 minutes. Check that the yolks don't scramble.
- Empanadas: 1 lb beef fills 12 rounds of 5 inches with a heaping 1/4 cup each, so expect a little filling left over.
- Enchiladas: about 3 cups of homemade sauce for 12 corn tortillas, with 3 tbsp chili powder. That is a standard home ratio, but check the heat.
