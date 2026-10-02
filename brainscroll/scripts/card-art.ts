/**
 * The illustration above each learning card (owner, 2026-10-01: the picture
 * should match what the card is about; Level 4's Jupiter card showed Saturn,
 * the level's one image). Cards without one show Dr. Scroll instead.
 *
 * The picks are reviewed by hand, in content/card-art.json (card id → image
 * id). This script helps make them and turns them into the app's map:
 *
 *   npm run card-art                       # write app/src/content/cardArt.ts from the picks
 *   npm run card-art -- --check            # fail if it's stale or a pick is invalid (in `npm run check`)
 *   npm run card-art -- --suggest <dir>    # write review sheets: up to 3 candidate images per card
 *   npm run card-art -- --report           # how many cards have a picture, per skill
 *
 * Suggestions are a weighted keyword overlap between a card and the images
 * its skill uses (plus the rest of its home family, astronomy.* for
 * Astronomy): an image's words come from its ID (weighted 3) and its "Draw"
 * description in docs/image*.md (weighted 1); a card's from its headline
 * (counted double) and body. Rarer words count more. A candidate must share a
 * word with the image's name. Matching words alone picks wrong pictures about
 * a quarter of the time ("war" in a card about a treaty), which is why the
 * picks are reviewed rather than generated.
 *
 * Presentation only: the map lives in the app, not in the published lessons,
 * so changing a pick never touches a level revision.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(repo, 'app', 'src', 'content', 'cardArt.ts');
const picksFile = join(repo, 'content', 'card-art.json');
const args = process.argv.slice(2);

/** A candidate's score must reach this to be worth a reviewer's look. */
const THRESHOLD = 6;
/** Image-name words too general to tie a card to a picture on their own. */
const VAGUE = new Set(['need', 'mastery', 'people', 'person', 'step', 'test', 'life', 'keep', 'help', 'first', 'way', 'job', 'list', 'page', 'title', 'down', 'kit', 'sign', 'line']);

const STOP = new Set(
  `the a an and or of to in on at by for with from into onto over under about above below between through during before after
   is are was were be been being it its this that these those there their they them then than as so such some any each every
   one two three four five many most more much very just also only not no but if when where what which who whom whose why how
   can could would should will shall may might must do does did done have has had having make makes made like same other another
   you your we our us he she his her him i me my small large big little tiny round soft glossy clay object image simple single
   shape top side front view light dark bright warm cool color colour colored coloured white black grey gray blue red green yellow
   orange purple pink brown gold golden silver tan cream beige teal violet navy few lots stack pair set group row`.split(/\s+/),
);

const stem = (w: string) =>
  w
    .replace(/'s$/, '')
    .replace(/(?<=[a-z]{2})ies$/, 'y')
    .replace(/(?<=(s|x|z|ch|sh))es$/, '')
    .replace(/(?<=[a-z]{3}[^su])s$/, '');
const words = (t: string) =>
  (t.toLowerCase().match(/[a-z][a-z'-]+/g) ?? [])
    .flatMap((w) => w.split('-'))
    .map(stem)
    .filter((w) => w.length >= 3 && !STOP.has(w));

// ---- Images: what exists, and how each is described ----
const artDir = join(repo, 'app', 'assets', 'images', 'art');
const have = new Set(readdirSync(artDir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)));
const draw = new Map<string, string>();
for (const f of readdirSync(join(repo, 'docs')).filter((f) => /^image.*\.md$/.test(f)).sort())
  for (const line of readFileSync(join(repo, 'docs', f), 'utf8').split('\n')) {
    const m = line.match(/^\|\s*`([a-z0-9_.-]+)`\s*\|\s*([^|]+)\|/);
    // Some tables map a planned image to a stand-in (`a.b` | `c.d`): that's not a description.
    if (m && m[1]!.includes('.') && !m[2]!.trim().startsWith('`') && !draw.has(m[1]!)) draw.set(m[1]!, m[2]!.trim());
  }

/** An image's keywords and their weights: its ID's words count most. */
function imageWords(id: string): Map<string, number> {
  const w = new Map<string, number>();
  for (const k of words(id.split('.').slice(1).join(' '))) w.set(k, 3);
  for (const k of words(draw.get(id) ?? '')) if (!w.has(k)) w.set(k, 1);
  return w;
}

// ---- Content ----
type Card = { id: string; type: string; headline?: string; body?: string; fact?: string; context?: string; callout?: string; caption?: string; events?: { when: string; label: string }[]; items?: { label: string; points: string[] }[]; learned?: string[] };
type Level = { id: string; skillId: string; number: number; art?: string; cards: Card[] };
const skillsDir = join(repo, 'content', 'skills');
const levelsBySkill = new Map<string, Level[]>();
for (const dir of readdirSync(skillsDir).sort()) {
  const ld = join(skillsDir, dir, 'levels');
  let files: string[] = [];
  try {
    files = readdirSync(ld).filter((f) => f.endsWith('.json')).sort();
  } catch {
    continue;
  }
  for (const f of files) {
    const l = JSON.parse(readFileSync(join(ld, f), 'utf8')) as Level;
    (levelsBySkill.get(l.skillId) ?? levelsBySkill.set(l.skillId, []).get(l.skillId)!).push(l);
  }
}

const headlineOf = (c: Card) => [c.headline, c.fact].filter(Boolean).join(' ');
const bodyOf = (c: Card) =>
  [c.body, c.context, c.callout, c.caption, ...(c.events ?? []).map((e) => e.label), ...(c.items ?? []).flatMap((i) => [i.label, ...i.points]), ...(c.learned ?? [])].filter(Boolean).join(' ');

/** Cards that can carry a picture: learning cards after the hook (which shows the level's own image). */
const learning = (card: Card, index: number) => index > 0 && card.type !== 'mcq' && card.type !== 'recall' && card.type !== 'checkpoint';

type Candidate = { id: string; score: number; why: string };
function suggest(levels: Level[]): Map<string, Candidate[]> {
  // The pool: every image this skill's levels use, plus the rest of its home family (the one most of
  // its levels draw from). Shared families (object.*, geo.*) only come in image by image: as a whole
  // they pull in unrelated pictures (a price tag for "the chief builder"). Mastery art is for trophies.
  const familyCount = new Map<string, number>();
  for (const l of levels) if (l.art) familyCount.set(l.art.split('.')[0]!, (familyCount.get(l.art.split('.')[0]!) ?? 0) + 1);
  const home = [...familyCount].sort((a, b) => b[1] - a[1])[0]?.[0];
  const pool = [...have].filter((id) => !id.endsWith('mastery') && (id.split('.')[0] === home || levels.some((l) => l.art === id)));
  const iw = new Map(pool.map((id) => [id, imageWords(id)]));
  // Rarer words say more: weight by how few of the pool's images share them.
  const df = new Map<string, number>();
  for (const w of iw.values()) for (const k of w.keys()) df.set(k, (df.get(k) ?? 0) + 1);
  const idf = (k: string) => Math.log(1 + pool.length / (df.get(k) ?? 1));

  const out = new Map<string, Candidate[]>();
  for (const level of levels)
    level.cards.forEach((card, index) => {
      if (!learning(card, index)) return;
      const head = new Set(words(headlineOf(card)));
      const body = new Set(words(bodyOf(card)));
      const found: Candidate[] = [];
      for (const [id, w] of iw) {
        let score = 0;
        let named = false;
        const why: string[] = [];
        for (const [k, weight] of w) {
          const hit = head.has(k) ? 2 : body.has(k) ? 1 : 0;
          score += weight * idf(k) * hit;
          if (hit) why.push(weight === 3 ? k.toUpperCase() : k);
          if (hit && weight === 3 && !VAGUE.has(k)) named = true;
        }
        // A description alone is too loose: the card must mention something the image is named for.
        if (!named) continue;
        if (id === level.art) score *= 1.25;
        if (score >= THRESHOLD) found.push({ id, score, why: why.join(' ') });
      }
      out.set(card.id, found.sort((a, b) => b.score - a.score).slice(0, 3));
    });
  return out;
}

const args2 = new Set(args);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

// ---- Review sheets ----
const suggestDir = flag('--suggest');
if (suggestDir) {
  mkdirSync(suggestDir, { recursive: true });
  const picks = readPicks();
  for (const [skillId, levels] of [...levelsBySkill].sort()) {
    const cands = suggest(levels);
    const lines: string[] = [`# ${skillId}`, ''];
    for (const level of levels)
      level.cards.forEach((card, index) => {
        if (!learning(card, index)) return;
        const c = cands.get(card.id) ?? [];
        if (!c.length) return;
        lines.push(`## ${card.id} (Level ${level.number}, level image ${level.art ?? 'none'})${picks[card.id] ? ` current pick: ${picks[card.id]}` : ''}`);
        lines.push(`"${headlineOf(card)}" ${bodyOf(card).replace(/\s+/g, ' ').slice(0, 420)}`);
        for (const x of c) lines.push(`- ${x.id}: ${draw.get(x.id) ?? '(no description)'} [matched: ${x.why}]`);
        lines.push('');
      });
    writeFileSync(join(suggestDir, `${skillId.replace(/^skill\./, '')}.md`), lines.join('\n'));
  }
  console.log(`wrote review sheets to ${suggestDir}`);
  process.exit(0);
}

// ---- The app's map, from the reviewed picks ----
function readPicks(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(picksFile, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}
const picks = readPicks();
const cardsById = new Map<string, { card: Card; index: number; skillId: string }>();
for (const [skillId, levels] of levelsBySkill) for (const l of levels) l.cards.forEach((card, index) => cardsById.set(card.id, { card, index, skillId }));
const problems: string[] = [];
for (const [cardId, imageId] of Object.entries(picks)) {
  const c = cardsById.get(cardId);
  if (!c) problems.push(`${cardId}: no such card`);
  else if (!learning(c.card, c.index)) problems.push(`${cardId}: a hook or question card can't carry a picture`);
  if (!have.has(imageId)) problems.push(`${cardId}: no image ${imageId} in app/assets/images/art`);
}
if (problems.length) {
  console.error(`content/card-art.json has ${problems.length} invalid pick(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

if (args2.has('--report')) {
  for (const [skillId, levels] of [...levelsBySkill].sort()) {
    let cards = 0;
    let pictured = 0;
    for (const l of levels)
      l.cards.forEach((card, index) => {
        if (!learning(card, index)) return;
        cards++;
        if (picks[card.id]) pictured++;
      });
    console.log(`${skillId}: ${pictured}/${cards} learning cards have a picture (${Math.round((100 * pictured) / Math.max(cards, 1))}%)`);
  }
  process.exit(0);
}

const body = `// Generated by scripts/card-art.ts (npm run card-art) from content/card-art.json. Do not edit by hand.
// Each learning card's illustration (card id → image id in content/art.ts).
// Cards not listed show Dr. Scroll instead.
export const CARD_ART: Readonly<Record<string, string>> = ${JSON.stringify(Object.fromEntries(Object.entries(picks).sort()), null, 2)};
`;

if (args2.has('--check')) {
  let current = '';
  try {
    current = readFileSync(out, 'utf8');
  } catch {
    /* missing */
  }
  if (current !== body) {
    console.error('app/src/content/cardArt.ts is stale: run `npm run card-art`');
    process.exit(1);
  }
  console.log(`card art is up to date (${Object.keys(picks).length} cards)`);
} else {
  writeFileSync(out, body);
  console.log(`wrote ${out}: ${Object.keys(picks).length} cards`);
}
