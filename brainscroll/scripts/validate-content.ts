/**
 * Validates everything under content/. Exits non-zero on any error so CI and
 * the importer refuse malformed levels before they reach the database.
 *
 *   npm run validate:content
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '@brainscroll/core';
import { loadContent } from './lib/load-content';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const { issues, content } = validateContent(loadContent(root));

for (const i of issues) {
  const tag = i.severity === 'error' ? '✖ error  ' : '⚠ warning';
  console.log(`${tag} ${i.where}: ${i.message}`);
}

const errors = issues.filter((i) => i.severity === 'error').length;
const warnings = issues.length - errors;
console.log(
  `\n${content.subjects.length} subjects · ${content.skills.length} skills · ${content.concepts.length} concepts · ` +
    `${content.levels.length} levels · ${content.sources.length} sources — ${errors} errors, ${warnings} warnings`,
);
process.exit(errors > 0 ? 1 : 0);
