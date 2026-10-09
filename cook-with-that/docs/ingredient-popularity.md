# Ingredient popularity ranking

`src/data/popularity.ts` orders the "Most common" suggestions. It blends two published analyses:

1. **Epicurious, 20,000+ recipes (2019)**: a ranked top-30 list. In order: olive oil, all-purpose flour, butter, chicken,
   sugar, salt, egg, rice, vegetable oil, pork, beef, cheese, garlic, orange, turkey, onion, corn, whole milk,
   mayonnaise, chiles, almonds, bacon, mushrooms, coconut, beets, strawberries, fennel, lamb, apple, shrimp.
   Source: https://www.soupersage.com/blog/?p=751
2. **Yummly "What's Cooking" dataset (~40k recipes)**: salt is used more than twice as often as the next ingredient.
   Onions, garlic, eggs, soy sauce, green onions, tomatoes and carrots are among the most common non-pantry items.
   Source: https://mcauleylab.ucsd.edu/public_datasets/cse158/projects/fa15/005.pdf

## How it was mapped
- pork → sausage / bacon; beef → ground beef; cheese → cheddar; chiles → jalapeño; turkey → ground turkey.
- Ingredients not in the catalog yet (almonds, mayonnaise, lamb, beets, fennel) are skipped. Add them to
  the catalog and ranking when recipes use them. Corn and orange joined with imported recipes (2026-10-09); they sit
  at the top of the second tier and next to lemon, below the 11 inline suggestions, so the home screen is unchanged.
- Other ingredients added for imported recipes (nutmeg, bay leaf, yeast…) aren't ranked: they're reachable through
  search and More options, grouped by category, which is where pantry and spice items belong.
- Salt, pepper and water are never suggested, because choosing them as a "Use" ingredient narrows nothing.
- Assumed kitchen staples (butter, olive oil, flour, sugar…) are filtered out at display time. They only appear when
  the user turns staples off.
- Below the top ~17, the order is a judgement call favoring everyday US home cooking. Once there are real users,
  consider re-ranking by what people actually pick (computed on-device only; the app has no analytics).
