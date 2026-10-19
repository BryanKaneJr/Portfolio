import { DISH_TYPES } from '../src/data/types';
import { GLYPHS } from '../src/theme/iconGlyphs';
import { DISH_ICON_FALLBACK, DISH_ICONS, ICONS } from '../src/theme/icons';

// The icon fonts are subsets: a name missing from GLYPHS would draw nothing on Android and web.
// Fix by running `python3 scripts/icons/build-icon-fonts.py` after editing src/theme/icons.ts.
describe('icon fonts cover every icon the app draws', () => {
  test('UI icons', () => {
    expect(
      Object.values(ICONS)
        .filter(i => !GLYPHS[i.md])
        .map(i => i.md),
    ).toEqual([]);
  });
  test('a dish picture for every dish type', () => {
    for (const d of DISH_TYPES) expect(GLYPHS[DISH_ICONS[d]]).toBeTruthy();
    expect(GLYPHS[DISH_ICON_FALLBACK]).toBeTruthy();
  });
});
