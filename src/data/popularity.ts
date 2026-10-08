/**
 * Ingredients ranked by how often they appear in real-world recipes — drives the
 * "Most common" suggestions on the home and pantry screens.
 *
 * Sources (blended, then mapped onto this app's catalog) — links in docs/ingredient-popularity.md:
 *  - Epicurious sample of 20,000+ recipes (2019) — top-30 ingredient ranking:
 *    olive oil, flour, butter, chicken, sugar, salt, egg, rice, vegetable oil, pork,
 *    beef, cheese, garlic, … turkey, onion, corn, milk, … bacon, mushrooms, … apple, shrimp.
 * *  - Yummly "What's Cooking" dataset (~40k recipes): salt dominates (> 2× the next
 *    ingredient); onions, garlic, eggs, soy sauce, green onions, tomatoes and carrots
 *    are the most common non-pantry items.
 * *
 * Mapping notes: "pork" → sausage/bacon, "beef" → ground beef, "cheese" → cheddar,
 * "chiles" → jalapeño. Items with no catalog entry yet (orange, corn, almonds, lamb…)
 * are skipped. Salt, pepper and water are left out entirely — picking them as a
 * "Use" ingredient narrows nothing. Assumed kitchen staples are filtered out at
 * display time, so butter/olive oil/flour/sugar only appear when staples are off.
 *
 * Order within close ranks is a judgement call favouring everyday US home cooking.
 */
export const INGREDIENTS_BY_POPULARITY: string[] = [
  // ── Top tier ─────────────────────────────────────────────
  'olive_oil',
  'flour',
  'butter',
  'chicken',
  'sugar',
  'eggs',
  'onion',
  'garlic',
  'rice',
  'vegetable_oil',
  'ground_beef',
  'cheddar',
  'tomato',
  'milk',
  'pasta',
  'potato',
  'carrot',
  // ── Second tier ──────────────────────────────────────────
  'bacon',
  'green_onion',
  'soy_sauce',
  'mushroom',
  'ground_turkey',
  'shrimp',
  'lemon',
  'bell_pepper',
  'sausage',
  'parmesan',
  'black_beans',
  'spinach',
  'mozzarella',
  'jalapeno',
  'sour_cream',
  'broccoli',
  'celery',
  'chicken_broth',
  'canned_tomatoes',
  'heavy_cream',
  'apple',
  'berries',
  'lime',
  'salmon',
  // ── Third tier ───────────────────────────────────────────
  'bread',
  'tortillas',
  'cream_cheese',
  'honey',
  'brown_sugar',
  'cilantro',
  'parsley',
  'basil',
  'ginger',
  'zucchini',
  'avocado',
  'cucumber',
  'banana',
  'coconut_milk',
  'chickpeas',
  'kidney_beans',
  'canned_tuna',
  'feta',
  'greek_yogurt',
  'oats',
  'peas',
  'green_beans',
  'sweet_potato',
  'tofu',
  'egg_noodles',
  'tomato_paste',
  'vegetable_broth',
  'peanut_butter',
  'chocolate_chips',
];

/** How many suggestions show at first, and how many each "More suggestions" tap adds. */
export const SUGGESTION_PAGE = 12;
