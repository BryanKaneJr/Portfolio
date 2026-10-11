/*
 * Snapshot NHLBI's recipe books (PDFs) into content/import/nhlbi-books/recipes.json (committed).
 *
 *   npm run import:fetch-nhlbi-books
 *
 * Downloads each book in NHLBI_BOOKS (scripts/import/sources/nhlbiBooks.ts) to a temporary
 * directory, one at a time with a pause, turns it into text with `pdftotext -layout` (poppler;
 * set PDFTOTEXT to use another binary) and parses the recipes out of it. The PDFs themselves are
 * never kept or committed. Behind a proxy that Node's fetch ignores, run with
 * NODE_USE_ENV_PROXY=1 (Node 22.21+). Review the diff before committing: new recipes need the
 * provenance check in content/import/nhlbi-books/README.md, and the pipeline reads only the
 * committed file.
 */
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { NHLBI_BOOKS, parseNhlbiBook, type NhlbiBookEntry } from './sources/nhlbiBooks';

const OUT = join(__dirname, '..', '..', 'content', 'import', 'nhlbi-books', 'recipes.json');
/** Generic on purpose: never a person's name or email in a request. */
const USER_AGENT = 'Cook With That content review';
const PAUSE_MS = 1500;
const PDFTOTEXT = process.env.PDFTOTEXT ?? 'pdftotext';
/** Wording that suggests a recipe isn't NHLBI's own to release. */
const PROVENANCE_FLAGS = /\b(adapted|reprinted|courtesy of|copyright|used with permission|contributed by)\b|©/i;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function download(url: string, file: string) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const type = res.headers.get('content-type') ?? '';
  if (!/pdf/i.test(type)) throw new Error(`${url} is ${type || 'untyped'}, not a PDF: has the book moved?`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  await sleep(PAUSE_MS);
}

async function main() {
  const fetchedAt = new Date().toISOString().slice(0, 10);
  const dir = mkdtempSync(join(tmpdir(), 'nhlbi-books-'));
  const entries: NhlbiBookEntry[] = [];
  try {
    for (const book of NHLBI_BOOKS) {
      const pdf = join(dir, `${book.id}.pdf`);
      const txt = join(dir, `${book.id}.txt`);
      console.log(`Fetching ${book.title}…`);
      await download(book.pdf, pdf);
      execFileSync(PDFTOTEXT, ['-layout', '-enc', 'UTF-8', pdf, txt], { stdio: ['ignore', 'ignore', 'ignore'] });
      const { entries: found, skipped } = parseNhlbiBook(readFileSync(txt, 'utf8'), book, fetchedAt);
      if (!found.length) throw new Error(`${book.title}: no recipes parsed; has the layout changed?`);
      console.log(`  ${found.length} recipes`);
      for (const s of skipped) console.warn(`  ⚠ skipped "${s.title}" (page ${s.page}): ${s.reason}`);
      for (const e of found) {
        const text = [e.description, ...e.ingredientLines, ...e.steps, ...e.tips].join(' ');
        if (PROVENANCE_FLAGS.test(text)) console.warn(`  ⚠ ${e.key}: mentions adaptation or copyright: check it`);
        if (entries.some(x => x.key === e.key)) throw new Error(`${e.key} appears twice`);
      }
      entries.push(...found);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  mkdirSync(join(OUT, '..'), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`✓ Wrote ${entries.length} recipes to content/import/nhlbi-books/recipes.json (fetched ${fetchedAt}).`);
}

main().catch(err => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
