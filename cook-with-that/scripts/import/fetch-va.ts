/*
 * Snapshot VA Nutrition and Food Services' recipe PDFs into content/import/va/recipes.json (committed).
 *
 *   npm run import:fetch-va                      # PDFs go to a temp directory, deleted afterwards
 *   npm run import:fetch-va -- --pdf-dir <dir>   # keep the PDFs there, and reuse any already there
 *
 * Walks the recipe listing pages (Recipes.asp and every category page it links), then downloads
 * each linked recipe PDF politely (one request at a time, with a pause) and reads it with
 * `pdftotext -layout` (poppler-utils). Network is fine in scripts; only the app (src/) must stay
 * offline. Behind a proxy that Node's fetch ignores, run with NODE_USE_ENV_PROXY=1 (Node 22.21+).
 * The PDFs are never committed. Review the diff before committing: new recipes need the credit
 * check in content/import/va/README.md, and the import pipeline reads only the committed file.
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { OUTSIDE_CREDIT, parseVaListing, parseVaText, vaKey, type VaEntry, type VaText } from './sources/va';

const BASE = 'https://www.nutrition.va.gov';
const START = '/NUTRITION/Recipes.asp';
const OUT = join(__dirname, '..', '..', 'content', 'import', 'va', 'recipes.json');
/** Generic on purpose: never a person's name or email in a request. */
const USER_AGENT = 'Cook With That content review';
const PAUSE_MS = 500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function get(path: string): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${BASE}${path}`);
  await sleep(PAUSE_MS);
  return res;
}

/** Every recipe PDF the listing pages link, with the headings of the pages that link it. */
async function crawl(): Promise<Map<string, string[]>> {
  const pdfs = new Map<string, string[]>();
  const queue = [START];
  const seen = new Set(queue);
  while (queue.length) {
    const page = queue.shift()!;
    const listing = parseVaListing(await (await get(page)).text());
    for (const p of listing.pages) if (!seen.has(p)) (seen.add(p), queue.push(p));
    for (const pdf of listing.pdfs) {
      const headings = pdfs.get(pdf) ?? [];
      if (listing.heading && !headings.includes(listing.heading)) headings.push(listing.heading);
      pdfs.set(pdf, headings);
    }
  }
  console.log(`Read ${seen.size} listing pages.`);
  return pdfs;
}

/** PDF metadata date (ISO), so the newest of two copies of a recipe wins. */
function modified(file: string): string {
  const info = execFileSync('pdfinfo', ['-isodates', file], { stdio: 'pipe' }).toString();
  return /^ModDate:\s*(\S+)/m.exec(info)?.[1] ?? /^CreationDate:\s*(\S+)/m.exec(info)?.[1] ?? '';
}

type Parsed = VaText & { url: string; modified: string; categories: string[] };

async function main() {
  const args = process.argv.slice(2);
  const dirAt = args.indexOf('--pdf-dir');
  const keep = dirAt >= 0 ? args[dirAt + 1] : undefined;
  if (dirAt >= 0 && !keep) throw new Error('--pdf-dir needs a directory');
  const dir = keep ?? mkdtempSync(join(tmpdir(), 'va-pdfs-'));
  mkdirSync(dir, { recursive: true });
  const fetchedAt = new Date().toISOString().slice(0, 10);

  try {
    const pdfs = await crawl();
    if (pdfs.size < 100) throw new Error(`the listing pages linked only ${pdfs.size} recipe PDFs: has the site moved?`);
    console.log(`Found ${pdfs.size} recipe PDF links.`);

    const parsed: Parsed[] = [];
    const unreadable: string[] = [];
    for (const [path, categories] of [...pdfs].sort(([a], [b]) => a.localeCompare(b))) {
      const file = join(dir, path.replace(/^\/NUTRITION\//, '').replace(/\//g, '_'));
      if (!existsSync(file)) writeFileSync(file, Buffer.from(await (await get(path)).arrayBuffer()));
      try {
        const text = execFileSync('pdftotext', ['-layout', file, '-'], { stdio: 'pipe' }).toString();
        parsed.push({ ...parseVaText(text), url: `${BASE}${path}`, modified: modified(file), categories });
      } catch (err) {
        unreadable.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // The site links many recipes from several pages, sometimes as different uploads of one recipe.
    // Keep the newest upload of each title, and record where the others live and what they credit.
    const byKey = new Map<string, Parsed[]>();
    for (const p of parsed) byKey.set(vaKey(p.title), [...(byKey.get(vaKey(p.title)) ?? []), p]);
    const entries: VaEntry[] = [];
    for (const [key, versions] of [...byKey].sort(([a], [b]) => a.localeCompare(b))) {
      versions.sort((a, b) => b.modified.localeCompare(a.modified) || a.url.localeCompare(b.url));
      const [{ url, modified: _m, categories: _c, ...text }, ...others] = versions;
      const categories = [...new Set(versions.flatMap(v => v.categories))];
      const otherCredits = [...new Set(others.map(o => o.credit))].filter(c => c && c !== text.credit);
      entries.push({
        key,
        url,
        ...text,
        ...(otherCredits.length ? { otherCredits } : {}),
        categories,
        ...(others.length ? { alsoAt: others.map(o => o.url).sort() } : {}),
        fetchedAt,
      });
    }

    for (const e of entries) {
      const outside = [e.credit, ...(e.otherCredits ?? [])].filter(c => OUTSIDE_CREDIT.test(c));
      if (outside.length) console.warn(`  ⚠ ${e.key}: credits an outside original ("${outside[0]}"): exclude it`);
    }
    for (const u of unreadable) console.warn(`  ✗ couldn't read ${u}`);

    mkdirSync(join(OUT, '..'), { recursive: true });
    writeFileSync(OUT, `${JSON.stringify(entries, null, 2)}\n`);
    console.log(
      `✓ Wrote ${entries.length} recipes (from ${parsed.length} PDFs; ${unreadable.length} unreadable) to content/import/va/recipes.json (fetched ${fetchedAt}).`,
    );
  } finally {
    if (!keep) rmSync(dir, { recursive: true, force: true });
    else console.log(`PDFs kept in ${basename(dir)}/.`);
  }
}

main().catch(err => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
