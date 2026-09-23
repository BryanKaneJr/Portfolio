/**
 * Compiles content/ into the app's offline seed bundle (app/src/content/bundle.json).
 * Refuses to build if validation has errors.
 *
 *   npm run content:build           # write the bundle
 *   npm run content:build -- --check  # fail if the committed bundle is stale (CI)
 *
 * Once the Supabase importer exists, published revisions come from the server
 * and this bundle becomes the first-run/offline fallback.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '@brainscroll/core';
import { loadContent } from './lib/load-content';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'app', 'src', 'content', 'bundle.json');

const { issues, content } = validateContent(loadContent(join(root, 'content')));
const errors = issues.filter((i) => i.severity === 'error');
if (errors.length) {
  for (const e of errors) console.error(`✖ ${e.where}: ${e.message}`);
  console.error(`\nContent has ${errors.length} errors — run npm run validate:content`);
  process.exit(1);
}

const bundle = {
  subjects: [...content.subjects].sort((a, b) => a.order - b.order),
  skills: [...content.skills].sort((a, b) => a.order - b.order),
  concepts: [...content.concepts].sort((a, b) => a.id.localeCompare(b.id)).map(({ id, title, description }) => ({ id, title, description })),
  assets: content.assets,
  sources: content.sources.map(({ id, title, url, publisher, license }) => ({ id, title, url, publisher, license })),
  levels: [...content.levels].sort((a, b) => a.skillId.localeCompare(b.skillId) || a.number - b.number),
};
const json = JSON.stringify(bundle, null, 2) + '\n';

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(out, 'utf8');
  } catch {}
  if (current !== json) {
    console.error('app/src/content/bundle.json is out of date — run npm run content:build');
    process.exit(1);
  }
  console.log('content bundle is up to date');
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
  console.log(`wrote ${bundle.levels.length} levels → app/src/content/bundle.json`);
}
