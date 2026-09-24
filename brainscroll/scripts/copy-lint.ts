/**
 * Editorial lint for everything that isn't curriculum JSON (the content
 * validator covers that): app strings, docs, admin, scripts, SQL, tests.
 *
 *   npm run lint:copy
 *
 * HARD RULE: no em dashes (U+2014) in BrainScroll-authored text. Rewrite the
 * sentence instead (docs/content-guide.md "Editorial rules"). A line that
 * reproduces an exact external quotation may carry the marker
 * `copy-lint: verbatim` to be skipped. Binary snapshots in docs/source/ are
 * archives of the original documents and aren't scanned.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EM_DASH } from '@brainscroll/core';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'packages', 'admin', 'scripts', 'backend', 'e2e', 'docs', 'content'];
const TOP_FILES = ['README.md', 'CLAUDE.md', 'CHANGELOG.md', 'package.json', '.gitignore'];
const TEXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.sql', '.sh', '.css', '.html', '.csv', '.toml', '.txt']);
const SKIP_DIRS = new Set(['node_modules', '.expo', 'dist', 'web-build', '.data', 'source', 'ios', 'android', '.temp', '.branches']);

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(join(dir, e.name));
    } else if (TEXT.has(extname(e.name))) yield join(dir, e.name);
  }
}

const files = [...ROOTS.flatMap((r) => [...walk(join(repo, r))]), ...TOP_FILES.map((f) => join(repo, f)).filter((f) => statSync(f, { throwIfNoEntry: false }))];
const hits: string[] = [];
for (const f of files) {
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (line.includes(EM_DASH) && !line.includes('copy-lint: verbatim')) hits.push(`${relative(repo, f)}:${i + 1}: ${line.trim().slice(0, 140)}`);
    });
}
if (hits.length) {
  console.error(`✖ ${hits.length} em dash${hits.length === 1 ? '' : 'es'} in BrainScroll-authored text. Rewrite each sentence (comma, colon, semicolon, parentheses, period or conjunction); don't swap in a hyphen.\n`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`copy-lint: ${files.length} files, no em dashes`);
