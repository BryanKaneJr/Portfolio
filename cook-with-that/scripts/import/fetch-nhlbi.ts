/*
 * Snapshot NHLBI's recipe pages into content/import/nhlbi/recipes.json (committed).
 *
 *   npm run import:fetch-nhlbi
 *
 * Reads every page of the recipe listing, then each recipe page, politely (one request at a
 * time, with a pause). Network is fine in scripts; only the app (src/) must stay offline.
 * Behind a proxy that Node's fetch ignores, run with NODE_USE_ENV_PROXY=1 (Node 22.21+).
 * Review the diff before committing: new pages need the provenance check in
 * content/import/nhlbi/README.md, and the import pipeline reads only the committed file.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { listRecipeSlugs, parseNhlbiPage, type NhlbiEntry } from './sources/nhlbi';

const BASE = 'https://www.nhlbi.nih.gov';
const LISTING = '/health/heart-healthy-living/healthy-foods/healthy-eating-recipes';
const OUT = join(__dirname, '..', '..', 'content', 'import', 'nhlbi', 'recipes.json');
/** Generic on purpose: never a person's name or email in a request. */
const USER_AGENT = 'Cook With That content review';
const PAUSE_MS = 750;

/** Recipe Source lines naming NHLBI's own publications; anything else gets flagged for review. */
const NHLBI_PUBLICATIONS = [
  /^Deliciously Healthy (Dinners|Family Meals)$/i,
  /^Stay Young At Heart$/i,
  /^Heart Healthy Home Cooking African American Style$/i,
  /^Delicious Heart Healthy Latino Recipes$/i,
  /^Honoring the Gift of Heart Health/i,
  /^Healthy Heart, Healthy Family/i,
  /^Your Health Is Golden!/i,
];
/** Wording that suggests a page isn't NHLBI's own to release. */
const PROVENANCE_FLAGS = /\b(adapted|reprinted|courtesy of|copyright|used with permission)\b|©/i;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function get(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${BASE}${path}`);
  const text = await res.text();
  await sleep(PAUSE_MS);
  return text;
}

async function main() {
  const fetchedAt = new Date().toISOString().slice(0, 10);
  const slugs: string[] = [];
  for (let page = 0; page < 50; page++) {
    const found = listRecipeSlugs(await get(`${LISTING}?page=${page}`)).filter(s => !slugs.includes(s));
    if (!found.length) break;
    slugs.push(...found);
  }
  if (!slugs.length) throw new Error('the listing linked no recipes: has the site moved?');
  console.log(`Found ${slugs.length} recipe pages.`);

  const entries: NhlbiEntry[] = [];
  for (const slug of slugs.sort()) {
    const path = `${LISTING}/${slug}`;
    const entry = parseNhlbiPage(slug, `${BASE}${path}`, await get(path), fetchedAt);
    const text = [entry.description, ...entry.ingredientLines, ...entry.steps, ...entry.tips].join(' ');
    if (!NHLBI_PUBLICATIONS.some(re => re.test(entry.recipeSource)))
      console.warn(`  ⚠ ${slug}: Recipe Source "${entry.recipeSource}" isn't a known NHLBI publication: check it`);
    if (PROVENANCE_FLAGS.test(text)) console.warn(`  ⚠ ${slug}: mentions adaptation or copyright: check it`);
    entries.push(entry);
  }

  mkdirSync(join(OUT, '..'), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(entries, null, 2)}\n`);
  console.log(`✓ Wrote ${entries.length} recipes to content/import/nhlbi/recipes.json (fetched ${fetchedAt}).`);
}

main().catch(err => {
  console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
