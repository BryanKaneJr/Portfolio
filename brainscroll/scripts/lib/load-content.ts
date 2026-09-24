import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { RawContentBundle } from '@brainscroll/core';

/**
 * Reads the content/ tree:
 *
 *   content/subjects.json, sources.json, assets.json, verification.json
 *   content/skills/<subject>.<skill>/skill.json
 *   content/skills/<subject>.<skill>/concepts.json
 *   content/skills/<subject>.<skill>/levels/NNN.json
 */
export function loadContent(root: string): RawContentBundle {
  const rel = (p: string) => relative(root, p);
  const json = (p: string): unknown => {
    try {
      return JSON.parse(readFileSync(p, 'utf8'));
    } catch (e) {
      throw new Error(`${rel(p)}: ${(e as Error).message}`);
    }
  };
  const array = (p: string): unknown[] => {
    const v = json(p);
    if (!Array.isArray(v)) throw new Error(`${rel(p)}: expected a JSON array`);
    return v;
  };

  const bundle: RawContentBundle = {
    subjects: array(join(root, 'subjects.json')),
    sources: array(join(root, 'sources.json')),
    assets: array(join(root, 'assets.json')),
    skills: [],
    concepts: [],
    levels: [],
    syllabi: [],
    verification: existsSync(join(root, 'verification.json')) ? array(join(root, 'verification.json')) : [],
  };

  const skillsDir = join(root, 'skills');
  for (const dir of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const base = join(skillsDir, dir.name);
    bundle.skills.push(json(join(base, 'skill.json')));
    const conceptsFile = join(base, 'concepts.json');
    if (existsSync(conceptsFile)) {
      array(conceptsFile).forEach((data, i) => bundle.concepts.push({ where: `${rel(conceptsFile)}[${i}]`, data }));
    }
    const syllabusFile = join(base, 'syllabus.json');
    if (existsSync(syllabusFile)) bundle.syllabi!.push({ where: rel(syllabusFile), data: json(syllabusFile) });
    const levelsDir = join(base, 'levels');
    if (existsSync(levelsDir)) {
      for (const f of readdirSync(levelsDir).filter((f) => f.endsWith('.json')).sort()) {
        const p = join(levelsDir, f);
        bundle.levels.push({ where: rel(p), data: json(p) });
      }
    }
  }
  return bundle;
}
