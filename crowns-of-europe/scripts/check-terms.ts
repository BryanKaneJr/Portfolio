/**
 * Keeps player-facing text in our own words: flags words borrowed from other strategy games in UI strings,
 * log messages and content prose. The game's internal names (state fields, DSL keys) may keep the old words;
 * only text a player reads is checked. See the glossary in docs/content-guide.md.
 * Run: npx tsx scripts/check-terms.ts   (part of npm run validate)
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

/** Borrowed word → what we say instead. */
export const BANNED: [RegExp, string][] = [
  [/\bdevelop(ment|ed|ing|s)?\b/i, 'prosperity / invest'],
  [/\bmanpower\b/i, 'levies'],
  [/\bstability\b/i, 'order'],
  [/\bprestige\b/i, 'renown'],
  [/\bwar ?score\b/i, 'leverage'],
  [/\bforce limit\b/i, 'army limit'],
  [/\b(cores?|cored|coring)\b/i, 'integrated / integrate'],
  [/\btrade goods?\b/i, 'exports'],
  [/\bstack ?wipes?\b/i, 'rout / annihilated'],
  [/\bcasus belli\b/i, 'reason for war'],
  [/\baggressive expansion\b/i, 'Threat'],
  [/\bmonarch points?\b|\bmana\b/i, '(we have no point currencies)'],
  [/\bdiplomatic reputation\b/i, 'diplomatic skill'],
  [/\bmaneuvers?\b|\b(fire|shock)( phase| skill|\s+\d)|\bpips?\b/i, 'a general\'s stars; volleys / charges'],
];

const problems: string[] = [];
const check = (where: string, text: string) => {
  for (const [re, instead] of BANNED) if (re.test(text)) problems.push(`${where}: "${text.slice(0, 90)}" → use "${instead}"`);
};

// Code: string literals with a space in them (keys and ids have none), and JSX text.
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => (d.isDirectory() ? walk(path.join(dir, d.name)) : /\.(ts|tsx)$/.test(d.name) ? [path.join(dir, d.name)] : []));
}
for (const file of [...walk(path.join(ROOT, 'src/sim')), ...walk(path.join(ROOT, 'src/ui')), ...walk(path.join(ROOT, 'src/app')), ...walk(path.join(ROOT, 'src/state'))]) {
  const rel = path.relative(ROOT, file);
  if (rel.endsWith('Icon.tsx') || rel.endsWith('gameIcons.ts')) continue; // SVG path data
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments are for developers
      const code = line.replace(/\/\/.*$/, '');
      const literals = [...code.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map(m => m[1] ?? m[2] ?? m[3]);
      // Text has a space or starts with a capital (ids and keys are lowercase single words).
      for (const raw of literals) {
        const lit = raw.replace(/\$\{[^}]*\}/g, '…'); // code inside a template is not text
        if (/\s/.test(lit) || /^[A-Z]/.test(lit)) check(`${rel}:${i + 1}`, lit);
      }
      if (file.endsWith('.tsx')) {
        // JSX text, with {expressions} blanked out (their strings were checked above).
        let jsx = code;
        for (let k = 0; k < 4; k++) jsx = jsx.replace(/\{[^{}<>]*\}/g, '…');
        for (const m of jsx.matchAll(/>([^<>]*[A-Za-z][^<>]*)</g)) check(`${rel}:${i + 1}`, m[1].trim());
        // Text on its own line between tags (not an object property or a line of code).
        const t = jsx.trim().replace(/^(…[\s·,:\-–]*)+/, ''); // a line that opens with an {expression}
        if (/^[A-Za-z][^<>=;]*$/.test(t) && /\s/.test(t) && !/[({,]$/.test(t) && !/^\w+:\s*['"`…]/.test(t)) check(`${rel}:${i + 1}`, t);
      }
    });
}

// Content: every field a player reads.
const PROSE = new Set(['title', 'text', 'desc', 'name', 'news', 'label', 'blurb', 'bonus']);
function prose(o: unknown, where: string): void {
  if (Array.isArray(o)) o.forEach((v, i) => prose(v, `${where}[${i}]`));
  else if (o && typeof o === 'object')
    for (const [k, v] of Object.entries(o)) {
      if (PROSE.has(k) && typeof v === 'string') check(`${where}.${k}`, v);
      else prose(v, `${where}.${k}`);
    }
}
for (const f of [
  'events-historical',
  'events-generic',
  'events-newworld',
  'events-history-west',
  'events-history-iberia-italy',
  'events-history-empire-north',
  'events-history-east-balkans',
  'events-history-levant-africa-americas',
  'formables',
  'missions',
  'achievements',
  'policies',
  'traits',
  'nations',
  'units',
  'aims',
  'advances',
  'landmarks',
]) {
  prose(JSON.parse(fs.readFileSync(path.join(ROOT, `src/content/${f}.json`), 'utf8')), f);
}

if (problems.length) {
  for (const p of problems) console.error(p);
  console.error(`${problems.length} borrowed term(s) in player-facing text.`);
  process.exit(1);
}
console.log('terms ok');
