/*
 * Import recipes from an open collection (docs/recipe-import.md).
 *
 *   npm run import:stage -- based-cooking           fetch the pinned snapshot, parse, map, write the report
 *   npm run import:draft -- based-cooking --next 10  append the next 10 ready recipes as drafts
 *   npm run import:draft -- based-cooking chili tacos  append these source keys as drafts
 *   npm run import:catalog -- "ground ginger"        add a reviewed ingredient to the catalog by hand
 *
 * A source's snapshot is either a pinned git commit (fetched into .import-cache/) or a file
 * committed under content/import/ by that source's fetch script (npm run import:fetch-nhlbi).
 *
 * Drafts land in src/data/imported/<file> with source metadata filled in and TODO markers
 * where an editor must decide (times, descriptions, quantities). `npm run validate` fails
 * until every TODO is resolved, so nothing half-edited can ship.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { INGREDIENTS, RECIPES } from '../src/data/catalog';
import { buildIngredientIndex } from '../src/logic/normalizeIngredient';
import { addToCatalogSource, draftOrder, draftRecipeCode, recipeId } from './import/draft';
import { catalogAddition } from './import/mapIngredient';
import { describeSnapshot, openSnapshot } from './import/snapshot';
import { SOURCES, type SourceDef } from './import/sources';
import { stageRecipe, stageReport } from './import/stage';
import type { Candidate } from './import/types';

const ROOT = join(__dirname, '..');
const CACHE = join(ROOT, '.import-cache');

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** The pinned snapshot's location: a checkout of the commit (shallow-fetched on first use) or the committed file. */
function snapshot(name: string, source: SourceDef): string {
  try {
    return openSnapshot(source.snapshot, { root: ROOT, cacheDir: join(CACHE, name) });
  } catch (err) {
    return fail(`${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function stage(name: string, source: SourceDef): Candidate[] {
  const index = buildIngredientIndex(INGREDIENTS);
  const raws = source.read(snapshot(name, source));
  for (const key of Object.keys(source.exclude))
    if (!raws.some(r => r.key === key)) console.warn(`  ⚠ exclude list names "${key}", which isn't in the snapshot`);
  const excludeReason = (raw: (typeof raws)[number]) =>
    source.exclude[raw.key] ??
    (raw.author && source.excludeAuthors?.[raw.author]
      ? `${raw.author}: ${source.excludeAuthors[raw.author]}`
      : undefined);
  return raws.map(raw => stageRecipe(index, raw, { exclude: excludeReason(raw), library: RECIPES }));
}

const importedKeys = (collection: string) =>
  new Set(RECIPES.filter(r => r.source.origin?.collection === collection).map(r => r.source.origin!.key));

function runStage(name: string, source: SourceDef) {
  const candidates = stage(name, source);
  const reportDir = join(ROOT, 'docs', 'import-reports');
  mkdirSync(reportDir, { recursive: true });
  const header = `Source: ${describeSnapshot(source.snapshot)}.\n`;
  const report = stageReport(name, candidates, importedKeys(source.collection)).replace(
    'Do not edit by hand.\n',
    `Do not edit by hand.\n\n${header}`,
  );
  writeFileSync(join(reportDir, `${name}.md`), report);
  const done = importedKeys(source.collection);
  const ready = candidates.filter(c => !c.blocked.length && !done.has(c.key)).length;
  console.log(
    `✓ ${candidates.length} recipes read, ${done.size} imported, ${ready} more ready to draft. Report: docs/import-reports/${name}.md`,
  );
}

function runDraft(name: string, source: SourceDef, args: string[]) {
  const nextAt = args.indexOf('--next');
  const allowBlocked = args.includes('--allow-blocked');
  const keys = args.filter((a, i) => !a.startsWith('--') && (nextAt < 0 || i !== nextAt + 1));
  const candidates = stage(name, source);
  const done = importedKeys(source.collection);

  let picked: Candidate[];
  if (nextAt >= 0) {
    const n = Number(args[nextAt + 1]);
    if (!Number.isInteger(n) || n < 1) fail('--next needs a positive whole number');
    picked = draftOrder(candidates.filter(c => !c.blocked.length && !done.has(c.key))).slice(0, n);
  } else {
    if (!keys.length) fail('name source keys to draft, or use --next N');
    picked = keys.map(k => candidates.find(c => c.key === k) ?? fail(`no recipe "${k}" in ${name}`));
    for (const c of picked) {
      if (done.has(c.key)) fail(`${c.key} is already imported`);
      if (c.blocked.length && !allowBlocked)
        fail(
          `${c.key} is blocked (${c.blocked.map(b => ('key' in b ? b.key : b.kind)).join(', ')}). Fix the mapping or pass --allow-blocked`,
        );
      const excluded = c.blocked.find(b => b.kind === 'excluded');
      if (excluded) fail(`${c.key} is excluded: ${'reason' in excluded ? excluded.reason : ''}`);
    }
  }
  if (!picked.length) fail('nothing left to draft: review more ingredient names (see the report) or name keys');

  const index = buildIngredientIndex(INGREDIENTS);
  const ids = new Set(RECIPES.map(r => r.id));
  const blocks = picked.map(c => {
    let id = recipeId(c.title);
    if (ids.has(id)) id = `${id}-${recipeId(c.key)}`;
    if (ids.has(id)) fail(`recipe id "${id}" is taken; draft ${c.key} by hand`);
    ids.add(id);
    return draftRecipeCode(index, c, source, id);
  });

  const file = join(ROOT, 'src', 'data', 'imported', source.file);
  const text = readFileSync(file, 'utf8');
  const marker = `export const ${source.exportName}: Recipe[] = [\n`;
  const start = text.indexOf(marker);
  const end = text.lastIndexOf('];');
  if (start < 0 || end < start) fail(`can't find "${marker.trim()}" … "];" in ${source.file}`);
  writeFileSync(file, `${text.slice(0, end)}${blocks.join('\n')}\n${text.slice(end)}`);

  // Owner rule: a recipe we import brings any reviewed ingredient the catalog lacks.
  const catalogFile = join(ROOT, 'src', 'data', 'ingredients.ts');
  const catalog = addToCatalogSource(
    readFileSync(catalogFile, 'utf8'),
    picked.flatMap(c => c.adds),
  );
  if (catalog.added.length) writeFileSync(catalogFile, catalog.text);

  console.log(`✓ Drafted ${picked.length} recipe(s) into src/data/imported/${source.file}:`);
  for (const c of picked) console.log(`  - ${c.key}${c.todo.length ? `  (to do: ${c.todo.join(', ')})` : ''}`);
  if (catalog.added.length) {
    console.log(`✓ Added ${catalog.added.length} ingredient(s) to src/data/ingredients.ts (check name and category):`);
    for (const a of catalog.added) console.log(`  - ${a.id} (${a.category}): ${a.name}`);
  }
  console.log('Edit them, then run `npm run check`.');
}

/** Editor fix-ups: add reviewed `{ add }` ingredients to the catalog by key ("ground ginger"). */
function runCatalog(keys: string[]) {
  if (!keys.length) fail('name reviewed ingredient keys from scripts/import/ingredient-map.ts');
  const additions = keys.map(
    k => catalogAddition(k) ?? fail(`"${k}" isn't a reviewed { add } entry in ingredient-map.ts`),
  );
  const catalogFile = join(ROOT, 'src', 'data', 'ingredients.ts');
  const catalog = addToCatalogSource(readFileSync(catalogFile, 'utf8'), additions);
  writeFileSync(catalogFile, catalog.text);
  console.log(`✓ Added ${catalog.added.length} ingredient(s) to src/data/ingredients.ts`);
  for (const a of catalog.added) console.log(`  - ${a.id} (${a.category}): ${a.name}`);
}

const [command, name, ...rest] = process.argv.slice(2);
if (command === 'catalog') {
  runCatalog([name, ...rest].filter((k): k is string => !!k));
  process.exit(0);
}
const source = SOURCES[name ?? ''];
if (!source) fail(`usage: import-recipes <stage|draft> <${Object.keys(SOURCES).join('|')}> […]`);
if (command === 'stage') runStage(name, source);
else if (command === 'draft') runDraft(name, source, rest);
else fail(`unknown command "${command}" (stage or draft)`);
