/*
 * Run: npm run images                          (or: npm run images -- --source "ai: Midjourney")
 *
 * Recipe pictures (docs/recipe-images.md). Put new art in content/images/incoming/, each file named by recipe ID
 * or title ("garlic-chicken-spinach-skillet.png" or "Garlic Chicken & Spinach Skillet.png"). This script:
 *  1. turns each into a 4:3 WebP of at most 160 KB in assets/recipes/ (1200×900, or 1080×810 for busy art), cropped
 *     from the center, and moves the original to content/images/originals/ (both folders stay out of git);
 *  2. records where each picture came from in docs/recipe-images/credits.json (--source fills it in for this batch;
 *     without it new entries say TODO and the tests fail until someone fills them in);
 *  3. rewrites src/data/recipeImages.ts (the map the app bundles) and docs/recipe-images/prompts.md (a prompt for
 *     every recipe still without a picture).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import sharp from 'sharp';

import { RECIPES } from '../../src/data/recipes';

const ROOT = join(__dirname, '..', '..');
const INCOMING = join(ROOT, 'content/images/incoming');
const ORIGINALS = join(ROOT, 'content/images/originals');
const ASSETS = join(ROOT, 'assets/recipes');
const CREDITS = join(ROOT, 'docs/recipe-images/credits.json');
const PROMPTS = join(ROOT, 'docs/recipe-images/prompts.md');
const MAP = join(ROOT, 'src/data/recipeImages.ts');

const WIDTH = 1200;
const HEIGHT = 900;
const MAX_BYTES = 160 * 1024;
const INPUT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.heic', '.avif', '.tif', '.tiff']);

/** Same look in every prompt, so the pictures read as one set. Keep in step with docs/recipe-images.md. */
const STYLE =
  'Mid-century illustration in the style of a 1950s American cookbook: gouache and screen-print look, visible ' +
  'paper grain, soft halftone shading, warm daylight. Limited palette of tomato red, mustard yellow, mint green, ' +
  'cream and charcoal. The food is the hero: centered, filling the middle of the frame, seen from a three-quarter ' +
  'angle, served simply on vintage 1950s dishware, on a laminate counter or table. Behind it, a cheerful 1950s ' +
  'kitchen, simple and softly out of focus: checkered floor, a rounded pastel refrigerator, chrome trim, a ' +
  'starburst clock. No people, no hands, no text, no lettering, no labels, no logos. Landscape, 4:3.';

type Credit = { source: string; license?: string; url?: string; note?: string };

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** 1200×900 at the best quality that fits; busy art (fine grain, photos) steps down to 1080×810, still sharp on a phone. */
const ATTEMPTS: [number, number, number][] = [
  ...[82, 76, 70, 64, 58].map((q): [number, number, number] => [WIDTH, HEIGHT, q]),
  ...[60, 52, 44].map((q): [number, number, number] => [1080, 810, q]),
];

async function toWebp(file: string): Promise<{ buf: Buffer; label: string; small: boolean }> {
  const meta = await sharp(file).metadata();
  const small = (meta.width ?? 0) < WIDTH || (meta.height ?? 0) < HEIGHT;
  let out = { buf: Buffer.alloc(0), label: '', small };
  for (const [width, height, quality] of ATTEMPTS) {
    const buf = await sharp(file)
      .rotate()
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .webp({ quality, effort: 6 })
      .toBuffer();
    out = { buf, label: `${width}×${height}, quality ${quality}`, small };
    if (buf.length <= MAX_BYTES) break;
  }
  return out;
}

async function main() {
  const source = argValue('--source');
  const byId = new Map(RECIPES.map(r => [r.id, r]));
  const byTitle = new Map(RECIPES.map(r => [slug(r.title), r]));
  const credits: Record<string, Credit> = existsSync(CREDITS) ? JSON.parse(readFileSync(CREDITS, 'utf8')) : {};
  for (const dir of [INCOMING, ORIGINALS, ASSETS]) mkdirSync(dir, { recursive: true });

  const problems: string[] = [];
  let converted = 0;
  for (const name of readdirSync(INCOMING).sort()) {
    if (name.startsWith('.')) continue;
    const ext = extname(name).toLowerCase();
    if (!INPUT.has(ext)) {
      problems.push(`${name}: not a picture this script reads (${[...INPUT].join(' ')})`);
      continue;
    }
    const key = slug(name.slice(0, -ext.length));
    const recipe = byId.get(key) ?? byTitle.get(key);
    if (!recipe) {
      problems.push(`${name}: no shipped recipe has this ID or title; rename it`);
      continue;
    }
    const { buf, label, small } = await toWebp(join(INCOMING, name));
    writeFileSync(join(ASSETS, `${recipe.id}.webp`), buf);
    renameSync(join(INCOMING, name), join(ORIGINALS, `${recipe.id}${ext}`));
    if (source) credits[recipe.id] = { source };
    else credits[recipe.id] ??= { source: 'TODO' };
    converted++;
    const kb = Math.round(buf.length / 1024);
    console.log(`  ${recipe.id}.webp  ${kb} KB (${label})${small ? '  ⚠ source is smaller than 1200×900' : ''}`);
    if (buf.length > MAX_BYTES) problems.push(`${recipe.id}: still ${kb} KB at the lowest quality`);
  }

  const pictured = readdirSync(ASSETS)
    .filter(f => f.endsWith('.webp'))
    .map(f => f.slice(0, -'.webp'.length))
    .sort();
  for (const id of pictured)
    if (!byId.has(id)) problems.push(`assets/recipes/${id}.webp: no shipped recipe has this ID`);
  for (const id of Object.keys(credits)) if (!pictured.includes(id)) delete credits[id];
  const sortedCredits = Object.fromEntries(Object.entries(credits).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(join(ROOT, 'docs/recipe-images'), { recursive: true });
  writeFileSync(CREDITS, JSON.stringify(sortedCredits, null, 2) + '\n');

  writeFileSync(
    MAP,
    [
      '// Generated by `npm run images` (scripts/images/recipe-images.ts). Do not edit by hand.',
      '',
      '/** Bundled recipe pictures by recipe ID (docs/recipe-images.md). A recipe without one shows its dish icon. */',
      ...(pictured.length
        ? [
            'export const RECIPE_IMAGES: Record<string, number> = {',
            ...pictured.map(id => `  '${id}': require('../../assets/recipes/${id}.webp'),`),
            '};',
          ]
        : ['export const RECIPE_IMAGES: Record<string, number> = {};']),
      '',
    ].join('\n'),
  );

  const missing = RECIPES.filter(r => !pictured.includes(r.id)).sort((a, b) => a.title.localeCompare(b.title));
  writeFileSync(
    PROMPTS,
    [
      '# Picture prompts',
      '',
      'Generated by `npm run images`. Do not edit by hand. How to use them: `../recipe-images.md`.',
      '',
      `${pictured.length} of ${RECIPES.length} recipes have a picture; ${missing.length} to go. Save each picture as` +
        ' the file name shown, in `content/images/incoming/`.',
      '',
      ...missing.flatMap(r => [
        `### ${r.title}`,
        '',
        `File name: \`${r.id}.png\``,
        '',
        '```',
        `${r.title}. ${r.description} ${STYLE}`,
        '```',
        '',
      ]),
    ].join('\n'),
  );

  console.log(
    `${converted} converted · ${pictured.length} of ${RECIPES.length} recipes have a picture · ` +
      `prompts for the other ${missing.length} in docs/recipe-images/prompts.md`,
  );
  const todo = Object.entries(sortedCredits).filter(([, c]) => !c.source || c.source === 'TODO');
  if (todo.length) problems.push(`${todo.length} picture(s) need a source in docs/recipe-images/credits.json`);
  if (problems.length) {
    console.error(problems.map(p => `  ✗ ${p}`).join('\n'));
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
