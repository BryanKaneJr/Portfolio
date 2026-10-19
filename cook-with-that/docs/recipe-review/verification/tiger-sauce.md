# vfT review: tiger sauce recipes (src/data/originals/tigerSauce.ts)

Few published recipes use Try Me Tiger Sauce itself (Reily, Blue Plate, Cooking Louisiana, Cape Gazette, Food.com). So I checked each dish's numbers against published versions built on a similar bottled sweet-hot or hot sauce (Frank's, sweet chili, Cholula/honey, chili sauce) and used the tiger-sauce recipes to check how much of the sauce to use.

## Counts
- Confident: 3 (wings, pork chops, roast beef sandwiches)
- Fixed: 2 (shrimp rice bowls, party meatballs)
- Cut: 0

All five score 5.

## Fixes
- **tiger-sauce-shrimp-rice-bowls**: tiger sauce 1/3 cup → 2/3 cup for 1 1/2 lb shrimp. It was 0.22 cup per lb; skillet shrimp in bottled sweet-hot sauce typically uses 1/3–1/2 cup per lb. The simmer is now "1–2 minutes" for the larger amount. Rice (1:1.5, rinsed, covered simmer then a 10-min rest) was already in line with ATK.
- **tiger-sauce-party-meatballs**: glaze tiger sauce 2/3 → 1 cup and honey 1/4 → 1/3 cup for 1 1/2 lb beef. The glaze was 0.6 cup per lb against 0.8–1.0 cup in published skillet or simmered versions; it is now 0.9 cup per lb with the same balance. Crumbs, milk, egg, ball size, 400°F for 15–18 min and 160°F were already typical.

## Confident
- **Wings**: 1 tbsp baking powder for 3 lb on a rack, 425°F for 45–50 min, 165–175°F. The glaze is about 4 tbsp per lb, the same as ATK and Dinner at the Zoo.
- **Pork chops**: 1-inch boneless, 8–11 min to 145°F with a rest. The glaze is about 1.6 tbsp per chop, matching published glazed chops.
- **Roast beef sandwiches**: tiger mayo at 2.7:1 (Blue Plate 3:1). Horseradish is inside the 1:2–1:6 range. 1 lb beef for 4 rolls and the broil times match.

## Provenance flags
None. The wing glaze (1/2 cup hot sauce, 1 tbsp honey, butter for 3 lb) is close to Dinner at the Zoo's. But the sauce, butter amount, oven temperature and seasoning all differ, so it is not a match across the board.

## Check
`npm run check`: passed (673 recipes and 400 ingredients validated; 12 suites, 881 tests passed).
