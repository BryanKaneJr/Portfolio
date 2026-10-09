import type { RawRecipe } from '../types';
import { readBasedCooking } from './basedCooking';

export type SourceDef = {
  /** Key in RECIPE_COLLECTIONS (src/data/collections.ts). */
  collection: string;
  /** Exported array name and file in src/data/imported/. */
  exportName: string;
  file: string;
  /**
   * 'reuse': the license lets us keep the source's wording (public domain, CC0, Unlicense).
   * 'rewrite': ideas and ingredient lists only; drafts get placeholder steps to write fresh.
   */
  textPolicy: 'reuse' | 'rewrite';
  /** Entries we won't import, with the reason (e.g. the page credits a third-party original). */
  exclude: Record<string, string>;
  /** Pinned snapshot, so a report or draft can always be reproduced. */
  repo: { url: string; commit: string };
  read(checkout: string): RawRecipe[];
};

export const SOURCES: Record<string, SourceDef> = {
  'based-cooking': {
    collection: 'based-cooking',
    exportName: 'BASED_COOKING_RECIPES',
    file: 'basedCooking.ts',
    textPolicy: 'reuse',
    // These pages credit an outside original, so the public-domain waiver may not be the contributor's to give.
    exclude: {
      couscous: 'credits an original recipe on 196flavors.com',
      'kettle-chips': 'links an original recipe on ethanchlebowski.com',
      'yorkshire-puddings': 'says "originally published on Good Food" (BBC)',
      'tuscan-style-pork-roast': 'adapted from Binging With Babish',
      'beef-tips': 'derived from a YouTube video',
      'gumbo-shrimp-and-sausage': 'derived from a YouTube video',
      'shrimp-and-grits': 'derived from a YouTube video',
    },
    repo: {
      url: 'https://github.com/LukeSmithxyz/based.cooking.git',
      commit: '9d4a31a040eedd61e4fb608cb0c114ff9a7c4dd2',
    },
    read: readBasedCooking,
  },
};
