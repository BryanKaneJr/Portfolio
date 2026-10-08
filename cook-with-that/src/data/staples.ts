/**
 * Kitchen staples — things most home cooks have and wouldn't think to list.
 *
 * When "Assume kitchen staples" is on (the default), these:
 *  - don't appear under "You'll also need" on result cards, and don't hurt ranking;
 *  - count as on hand in My Pantry mode.
 * They are ALWAYS still listed with quantities on the recipe page (badged "Staple"),
 * and Avoid always wins — avoiding butter still hides every recipe with butter.
 * The user can edit this list or turn the assumption off.
 *
 * Deliberately NOT staples: eggs, milk, cheese, onions, garlic, broth, honey, soy
 * sauce, vinegars — common, but people run out of them and they define a dish.
 */
export const DEFAULT_STAPLE_IDS: string[] = [
  // basics
  'salt',
  'black_pepper',
  'water',
  'vegetable_oil',
  'olive_oil',
  'butter',
  // baking
  'flour',
  'sugar',
  'brown_sugar',
  'baking_soda',
  'baking_powder',
  'vanilla',
  // spice rack
  'garlic_powder',
  'cinnamon',
  'paprika',
  'oregano',
  'thyme',
  'cumin',
  'chili_powder',
  'red_pepper_flakes',
];
