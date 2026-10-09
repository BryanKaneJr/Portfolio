/**
 * Outside collections that recipes are imported from (see docs/recipe-sources.md for the
 * license review behind each one). `home` has no URL scheme: src/ stays URL-free.
 */
export type RecipeCollection = {
  name: string;
  /** Exact license, as recorded in each recipe's `source.license`. */
  license: string;
  home: string;
  /** Credit line for an acknowledgements screen. */
  credit: string;
};

export const RECIPE_COLLECTIONS: Record<string, RecipeCollection> = {
  'based-cooking': {
    name: 'Based Cooking',
    license: 'Unlicense (public domain)',
    home: 'based.cooking',
    credit:
      'Some recipes are adapted from Based Cooking (based.cooking), whose authors released them into the public domain.',
  },
};
