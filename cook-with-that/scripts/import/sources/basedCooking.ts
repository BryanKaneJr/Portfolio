import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { RawRecipe } from '../types';

/**
 * based.cooking: Hugo site, one Markdown file per recipe in content/, Unlicense
 * (public domain dedication). See docs/recipe-sources.md.
 *
 * File shape: YAML front matter (title, tags, author slug), an optional intro with
 * "⏲️ Prep time / 🍳 Cook time / 🍽️ Servings" bullets, then "## Ingredients"
 * (bullets, sometimes nested under a "Sauce:" label or a ### sub-heading) and
 * "## Directions" (numbered list, items may wrap onto indented lines).
 */
export function readBasedCooking(checkout: string): RawRecipe[] {
  const contentDir = join(checkout, 'content');
  const authors = loadAuthors(join(checkout, 'data', 'authors'));
  return readdirSync(contentDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'))
    .sort()
    .map(f => parseBasedCooking(f.replace(/\.md$/, ''), readFileSync(join(contentDir, f), 'utf8'), authors));
}

function loadAuthors(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    try {
      const data = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { name?: unknown };
      if (typeof data.name === 'string' && data.name.trim()) out.set(f.replace(/\.json$/, ''), data.name.trim());
    } catch {
      // A malformed author file only costs us the display name.
    }
  }
  return out;
}

const unquote = (s: string) =>
  s
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .trim();

export function parseBasedCooking(key: string, text: string, authors = new Map<string, string>()): RawRecipe {
  const src = text.replace(/\r\n/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(src);
  const meta = new Map<string, string>();
  for (const line of (fm?.[1] ?? '').split('\n')) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (m) meta.set(m[1].toLowerCase(), m[2]);
  }
  const body = fm ? src.slice(fm[0].length) : src;
  const tags = (meta.get('tags') ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(unquote)
    .filter(Boolean)
    .map(t => t.toLowerCase());
  const authorSlug = unquote(meta.get('author') ?? '');
  const author = authors.get(authorSlug) ?? (authorSlug || undefined);

  const sections = splitSections(body);
  const intro = sections.get('') ?? [];
  const ingredientLines = listItems(findSection(sections, /^ingredients?$/i), 'bullet');
  const steps = listItems(findSection(sections, /^(directions?|instructions?|method|steps|preparation)$/i), 'any');

  const raw: RawRecipe = {
    key,
    title: unquote(meta.get('title') ?? key),
    ...(author ? { author } : {}),
    location: `based.cooking/${key}`,
    ingredientLines,
    steps,
    tags,
  };
  const description = intro
    .join('\n')
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .find(p => p && !/^[-*+!#]/.test(p) && !/time\s*:|servings?\s*:/i.test(p));
  if (description) raw.description = stripMarkdown(description);
  for (const line of intro) {
    const m = /(prep|cook|total)\s*time\s*:\s*(.+)$/i.exec(line);
    if (m) {
      const minutes = parseMinutes(m[2]);
      if (minutes !== undefined && m[1].toLowerCase() === 'prep') raw.prepMinutes = minutes;
      if (minutes !== undefined && m[1].toLowerCase() === 'cook') raw.cookMinutes = minutes;
    }
    const s = /servings?\s*:\s*~?\s*(\d+)/i.exec(line);
    if (s) raw.servings = Number(s[1]);
  }
  return raw;
}

function splitSections(body: string): Map<string, string[]> {
  const out = new Map<string, string[]>([['', []]]);
  let current = '';
  for (const line of body.split('\n')) {
    const h = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (h && !line.startsWith('###')) {
      current = h[1].trim();
      if (!out.has(current)) out.set(current, []);
      continue;
    }
    out.get(current)!.push(line);
  }
  return out;
}

function findSection(sections: Map<string, string[]>, name: RegExp): string[] {
  for (const [title, lines] of sections) if (name.test(title.replace(/[:.]$/, ''))) return lines;
  return [];
}

/** Flatten a Markdown list. Group labels ("Spices:", "### Sauce") and images are dropped; wrapped lines are joined. */
function listItems(lines: string[], kind: 'bullet' | 'any'): string[] {
  const items: string[] = [];
  const marker = kind === 'bullet' ? /^\s*[-*+]\s+(.*)$/ : /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
  let open = false;
  for (const line of lines) {
    if (!line.trim()) {
      open = false;
      continue;
    }
    if (/^\s*#/.test(line) || /^\s*!\[/.test(line)) {
      open = false;
      continue;
    }
    const m = marker.exec(line);
    if (m) {
      const item = m[1].replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
      if (!item || /:$/.test(item)) {
        open = false;
        continue;
      }
      items.push(item);
      open = true;
    } else if (open && /^\s+\S/.test(line)) {
      items[items.length - 1] += ` ${line.trim()}`;
    }
  }
  return items.map(i => stripMarkdown(i.replace(/\s+/g, ' ').trim())).filter(Boolean);
}

/** Plain text from inline Markdown: links keep their text, emphasis and code marks go. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "10 min", "1 hour", "1h 30m", "~45 minutes", "1.5 hours". Ranges take the upper bound. */
export function parseMinutes(text: string): number | undefined {
  const t = text.toLowerCase().replace(/~|about|approx\.?|around/g, '');
  let total = 0;
  let found = false;
  const re = /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(h(?:ours?|rs?)?|m(?:in(?:ute)?s?)?)\b/g;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const n = Number(m[2] ?? m[1]);
    total += m[3].startsWith('h') ? n * 60 : n;
    found = true;
  }
  return found ? Math.round(total) : undefined;
}
