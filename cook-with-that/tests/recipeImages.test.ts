import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { RECIPES } from '../src/data/recipes';

/** Recipe pictures: assets/recipes/<id>.webp, made by `npm run images` (docs/recipe-images.md). */
const ROOT = join(__dirname, '..');
const DIR = join(ROOT, 'assets/recipes');
const files = existsSync(DIR) ? readdirSync(DIR).filter(f => !f.startsWith('.')) : [];
const pictured = files.map(f => f.replace(/\.webp$/, '')).sort();
const credits: Record<string, { source?: string; license?: string }> = JSON.parse(
  readFileSync(join(ROOT, 'docs/recipe-images/credits.json'), 'utf8'),
);
const mapSource = readFileSync(join(ROOT, 'src/data/recipeImages.ts'), 'utf8');

describe('recipe pictures', () => {
  test('each is a WebP named after a shipped recipe', () => {
    const ids = new Set(RECIPES.map(r => r.id));
    expect(files.filter(f => !f.endsWith('.webp'))).toEqual([]);
    expect(pictured.filter(id => !ids.has(id))).toEqual([]);
  });

  test('each stays small enough to bundle (at most 200 KB)', () => {
    expect(files.filter(f => statSync(join(DIR, f)).size > 200 * 1024)).toEqual([]);
  });

  test('the bundled map lists exactly the pictures on disk (run npm run images)', () => {
    const mapped = [...mapSource.matchAll(/'([a-z0-9-]+)': require\('\.\.\/\.\.\/assets\/recipes\/\1\.webp'\)/g)]
      .map(m => m[1])
      .sort();
    expect(mapped).toEqual(pictured);
  });

  test('each says where it came from; a stock picture also names its license', () => {
    expect(Object.keys(credits).sort()).toEqual(pictured);
    for (const [id, c] of Object.entries(credits)) {
      expect([id, c.source && c.source !== 'TODO']).toEqual([id, true]);
      if (/^stock\b/i.test(c.source ?? '')) expect([id, !!c.license]).toEqual([id, true]);
    }
  });
});
