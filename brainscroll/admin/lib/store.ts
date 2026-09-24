import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContentStatus, LEARNING_STRUCTURE, Level, QUESTION_PURPOSES, TEXT_BUDGET, validateContent, type ContentIssue } from '@brainscroll/core';
import { loadContent } from '../../scripts/lib/load-content';

/**
 * File-backed access to content/ for the admin tool. Every read goes to disk,
 * so edits made by hand, by scripts or by another admin tab are always seen.
 * Levels are the only thing the admin writes; concepts, sources and the
 * verification ledger are read-only here (use the verify:* scripts for claims).
 */
export interface StoreOptions {
  /** The content/ directory. */
  contentRoot: string;
  /** The committed app bundle, used as the revision baseline (optional). */
  bundlePath?: string;
}

export type SaveResult =
  | { ok: true; issues: ContentIssue[] }
  | { ok: false; status: number; error: string; issues?: ContentIssue[] };

const SKILL_DIR = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const LEVEL_FILE = /^\d{3}$/;

export function createStore({ contentRoot, bundlePath }: StoreOptions) {
  const baseline = () =>
    bundlePath && existsSync(bundlePath) ? (JSON.parse(readFileSync(bundlePath, 'utf8')) as { levels: unknown[] }).levels : undefined;

  const levelPath = (skillDir: string, num: string) => {
    if (!SKILL_DIR.test(skillDir) || !LEVEL_FILE.test(num)) return null;
    const dir = join(contentRoot, 'skills', skillDir, 'levels');
    return existsSync(dir) ? join(dir, `${num}.json`) : null;
  };

  function snapshot() {
    const raw = loadContent(contentRoot);
    const skillDirs = readdirSync(join(contentRoot, 'skills'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    return {
      subjects: raw.subjects,
      skills: raw.skills,
      skillDirs,
      syllabi: (raw.syllabi ?? []).map((s) => s.data),
      concepts: raw.concepts.map((c) => c.data),
      sources: raw.sources,
      assets: raw.assets,
      verification: raw.verification ?? [],
      levels: raw.levels.map((l) => ({ file: l.where, data: l.data })),
      // Limits the editor shows, straight from core so they never drift.
      meta: { textBudget: TEXT_BUDGET, structure: LEARNING_STRUCTURE, purposes: QUESTION_PURPOSES, statuses: ContentStatus.options },
    };
  }

  function validate(override?: { where: string; data: unknown }) {
    const raw = loadContent(contentRoot);
    if (override) {
      const i = raw.levels.findIndex((l) => l.where === override.where);
      if (i >= 0) raw.levels[i] = override;
      else raw.levels.push(override);
    }
    return validateContent({ ...raw, baselineLevels: baseline() }).issues;
  }

  /**
   * Saves one level. Schema errors always block the write. Drafts may be saved
   * with validation errors (so work in progress isn't lost), but a level whose
   * status is `in_review` or `published` must be free of errors of its own:
   * publishing is refused while any claim or source is unverified, the revision
   * wasn't bumped, and so on — the same rules as `npm run validate:content`.
   */
  function saveLevel(skillDir: string, num: string, data: unknown): SaveResult {
    const path = levelPath(skillDir, num);
    if (!path) return { ok: false, status: 404, error: `no such level file ${skillDir}/${num}` };
    const parsed = Level.safeParse(data);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
      return { ok: false, status: 400, error: `schema: ${msg}` };
    }
    if (parsed.data.number !== Number(num)) return { ok: false, status: 400, error: `level number ${parsed.data.number} does not match file ${num}.json` };

    const where = `skills/${skillDir}/levels/${num}.json`;
    const issues = validate({ where, data });
    const own = issuesForLevel(issues, parsed.data.id, where);
    if (parsed.data.status !== 'draft' && own.some((i) => i.severity === 'error')) {
      return { ok: false, status: 409, error: `a ${parsed.data.status} level must have no validation errors`, issues: own };
    }
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
    renameSync(tmp, path);
    return { ok: true, issues: own };
  }

  return { snapshot, validate: () => validate(), saveLevel };
}

/** Issues that belong to one level: the level itself, its file, and its cards and questions. */
export function issuesForLevel(issues: ContentIssue[], levelId: string, file: string): ContentIssue[] {
  const m = /^level\.[a-z0-9_]+\.([a-z0-9_]+)\.(\d{3})$/.exec(levelId);
  const scope = m ? `${m[1]}.${m[2]}` : null;
  return issues.filter(
    (i) =>
      i.where === levelId ||
      i.where === file ||
      i.where.startsWith(`${file}:`) ||
      (scope !== null && (i.where.startsWith(`card.${scope}.`) || i.where.startsWith(`question.${scope}.`))),
  );
}
