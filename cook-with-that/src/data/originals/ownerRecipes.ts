import { ORIGINAL_DRAFT, r } from '../recipeBuilders';
import type { Recipe } from '../types';

/**
 * The owner's own recipes, kept exactly as given: reviews and the published-recipe check (decision 18) never move
 * their amounts.
 */
export const OWNER_RECIPES: Recipe[] = [
  {
    // Owner, 2026-10-12: "it's my personal and it's literally the best ever."
    id: 'greatest-spicy-mayo',
    title: 'Greatest Spicy Mayo',
    description:
      'Kewpie mayo with sriracha, a little gochujang and tsuyu, sweetened just enough to round off the heat.',
    meals: ['snack', 'appetizer'],
    dishTypes: ['dip'],
    prepMinutes: 35,
    cookMinutes: 0,
    servings: 14,
    ingredients: [
      r('mayonnaise', 'Kewpie (Japanese) mayonnaise', '1 1/2 cups'),
      r('sriracha', 'sriracha', '2 tbsp'),
      r('sugar', 'sugar', '1 1/2 tbsp'),
      r('tsuyu', 'tsuyu (Japanese noodle soup base)', '1 tsp'),
      r('gochujang', 'gochujang', '1 tsp'),
      r('onion_powder', 'onion powder', '1/2 tsp'),
    ],
    steps: [
      'In a medium bowl, whisk the Kewpie mayonnaise, sriracha, sugar, tsuyu, gochujang and onion powder for about 1 minute, until smooth and evenly colored, with no streaks of gochujang.',
      'Cover and refrigerate for at least 30 minutes, so the sugar dissolves completely and the flavors blend. Stir before serving.',
      'Keep it in a sealed jar or squeeze bottle in the refrigerator for up to 1 week. Makes about 1 3/4 cups.',
    ],
    source: ORIGINAL_DRAFT,
  },
];
