/**
 * Validates everything under content/. Exits non-zero on any error so CI and
 * the importer refuse malformed levels before they reach the database.
 *
 *   npm run validate:content
 *   npm run validate:content -- --json   # machine-readable issues (admin tool, CI)
 *   npm run validate:content -- --dir <path>  # validate a copy of content/ (e.g. a draft in progress)
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '@brainscroll/core';
import { readBuiltLevels } from './lib/built-levels';
import { loadContent } from './lib/load-content';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirArg = process.argv.indexOf('--dir');
const root = dirArg > 0 && process.argv[dirArg + 1] ? process.argv[dirArg + 1]! : join(repo, 'content');
const asJson = process.argv.includes('--json');
// The committed app content is the last built snapshot: published levels in it
// must not change without a revision bump, and stable IDs must not vanish.
const baselineLevels = readBuiltLevels(join(repo, 'app', 'src', 'content', 'built'));
const { issues, content } = validateContent({ ...loadContent(root), baselineLevels });

if (asJson) {
  process.stdout.write(JSON.stringify({ issues }, null, 2) + '\n');
  process.exit(issues.some((i) => i.severity === 'error') ? 1 : 0);
}

for (const i of issues) {
  const tag = i.severity === 'error' ? '✖ error  ' : '⚠ warning';
  console.log(`${tag} ${i.where}: ${i.message}`);
}

const errors = issues.filter((i) => i.severity === 'error').length;
const warnings = issues.length - errors;
console.log(
  `\n${content.subjects.length} subjects · ${content.skills.length} skills · ${content.concepts.length} concepts · ` +
    `${content.levels.length} levels · ${content.sources.length} sources · ${errors} errors, ${warnings} warnings`,
);
process.exit(errors > 0 ? 1 : 0);
