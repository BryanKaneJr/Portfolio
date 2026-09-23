import { QUESTION_PURPOSES } from './constants';
import { Asset, Concept, Level, Skill, Source, Subject } from './content-schema';
import { levelId, levelScope, parseLevelId } from './ids';
import { levelTypeFor } from './progression';
import { cardRole, learningCards, learningWordCount, structureFor } from './structure';

export interface ContentIssue {
  severity: 'error' | 'warning';
  /** File or object the issue belongs to. */
  where: string;
  message: string;
}

export interface RawContentBundle {
  subjects: unknown[];
  skills: unknown[];
  sources: unknown[];
  assets: unknown[];
  /** Concepts keyed by the file they came from (for error locations). */
  concepts: { where: string; data: unknown }[];
  levels: { where: string; data: unknown }[];
}

export interface ValidatedContent {
  subjects: Subject[];
  skills: Skill[];
  sources: Source[];
  assets: Asset[];
  concepts: Concept[];
  levels: Level[];
}

/**
 * Validates every content file against the schema, then checks cross-references
 * that a per-file schema cannot: IDs line up, questions have exactly one correct
 * answer, prerequisites come earlier, recall cards test earlier concepts, and
 * published content never cites unverified or unlicensed material.
 *
 * Errors block import/publish. Warnings are for editors.
 */
export function validateContent(raw: RawContentBundle): { issues: ContentIssue[]; content: ValidatedContent } {
  const issues: ContentIssue[] = [];
  const err = (where: string, message: string) => issues.push({ severity: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ severity: 'warning', where, message });

  function parseAll<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }, items: { where: string; data: unknown }[]): T[] {
    const out: T[] = [];
    for (const { where, data } of items) {
      const r = schema.safeParse(data);
      if (r.success) out.push(r.data);
      else for (const i of r.error.issues) err(where, `${i.path.map(String).join('.') || '(root)'}: ${i.message}`);
    }
    return out;
  }
  const tag = (where: string, items: unknown[]) =>
    items.map((data, i) => ({ where: `${where}[${i}]`, data }));

  const subjects = parseAll(Subject, tag('subjects.json', raw.subjects));
  const skills = parseAll(Skill, tag('skills', raw.skills));
  const sources = parseAll(Source, tag('sources.json', raw.sources));
  const assets = parseAll(Asset, tag('assets.json', raw.assets));
  const concepts = parseAll(Concept, raw.concepts);
  const levels = parseAll(Level, raw.levels);

  const dupes = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const x of ids) {
      if (seen.has(x)) err(kind, `duplicate id ${x}`);
      seen.add(x);
    }
    return seen;
  };
  const subjectIds = dupes('subjects', subjects.map((s) => s.id));
  const skillIds = dupes('skills', skills.map((s) => s.id));
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  dupes('sources', sources.map((s) => s.id));
  const assetById = new Map(assets.map((a) => [a.id, a]));
  dupes('assets', assets.map((a) => a.id));
  const conceptIds = dupes('concepts', concepts.map((c) => c.id));
  dupes('levels', levels.map((l) => l.id));
  dupes('cards', levels.flatMap((l) => l.cards.map((c) => c.id)));
  dupes('questions', levels.flatMap((l) => l.questions.map((q) => q.id)));

  for (const s of skills) if (!subjectIds.has(s.subjectId)) err(s.id, `unknown subject ${s.subjectId}`);
  for (const a of assets) if (!sourceById.has(a.sourceId)) err(a.id, `unknown source ${a.sourceId}`);
  for (const c of concepts)
    for (const f of c.facts)
      for (const sid of f.sourceIds) if (!sourceById.has(sid)) err(c.id, `fact cites unknown source ${sid}`);

  // Level number → which concepts were taught at or before it, per skill.
  const levelsBySkill = new Map<string, Level[]>();
  for (const l of levels) {
    const list = levelsBySkill.get(l.skillId) ?? [];
    list.push(l);
    levelsBySkill.set(l.skillId, list);
  }

  const cardOwner = new Map(levels.flatMap((level) => level.cards.map((card) => [card.id, { level, card }] as const)));

  for (const [skill, list] of levelsBySkill) {
    list.sort((a, b) => a.number - b.number);
    list.forEach((l, i) => {
      if (l.number !== i + 1) err(skill, `levels must be contiguous from 1; found ${l.number} at position ${i + 1}`);
    });
  }

  for (const level of levels) {
    const where = level.id;
    const parsed = safe(() => parseLevelId(level.id));
    if (!parsed) continue;
    if (parsed.skillId !== level.skillId) err(where, `id belongs to ${parsed.skillId} but skillId is ${level.skillId}`);
    if (parsed.number !== level.number) err(where, `id number ${parsed.number} != number ${level.number}`);
    if (!skillIds.has(level.skillId)) err(where, `unknown skill ${level.skillId}`);

    const scope = levelScope(level.id);
    const inScope = (x: string, kind: 'card' | 'question') => x.startsWith(`${kind}.${scope}.`);

    // Structure is set by level type: regular levels are mostly learning with
    // 3 light questions; checkpoints, milestones and mastery test more.
    const expectedType = levelTypeFor(level.number);
    if (level.type !== expectedType) err(where, `level ${level.number} must be type "${expectedType}", not "${level.type}"`);
    const shape = structureFor(level);
    const qn = level.questions.length;
    if (qn < shape.questions.min || qn > shape.questions.max)
      err(where, `${shape.label} has ${qn} questions; allowed ${shape.questions.min}–${shape.questions.max}`);
    else if (shape.questions.standard !== null && qn !== shape.questions.standard) {
      // Drafts may be mid-edit; published content must match the canonical count.
      const msg = `${shape.label} has ${qn} questions; the standard is ${shape.questions.standard}`;
      if (level.status === 'published') err(where, msg);
      else warn(where, msg);
    }
    const learning = learningCards(level).length;
    if (learning < shape.learningCards.min || learning > shape.learningCards.max)
      warn(where, `has ${learning} learning cards; ${shape.label.toLowerCase()} norm is ${shape.learningCards.min}–${shape.learningCards.max}`);
    const words = learningWordCount(level);
    if (words < shape.learningWords.min || words > shape.learningWords.max)
      warn(where, `has ${words} words of learning content; ${shape.label.toLowerCase()} norm is ${shape.learningWords.min}–${shape.learningWords.max}`);
    if (shape.coverPurposes) {
      const purposes = new Set(level.questions.map((q) => q.purpose));
      const missing = QUESTION_PURPOSES.filter((p) => !purposes.has(p));
      if (missing.length) warn(where, `questions should cover recall, understanding and connection; missing ${missing.join(', ')}`);
    }
    // Learn first, then check: questions come after the reading content.
    const roles = level.cards.map(cardRole);
    const lastLearning = roles.lastIndexOf('learning');
    const firstQuestion = roles.indexOf('question');
    if (firstQuestion >= 0 && firstQuestion < lastLearning) warn(where, 'put the learning cards before the questions');

    for (const c of level.cards) if (!inScope(c.id, 'card')) err(where, `card ${c.id} must be scoped card.${scope}.cN`);
    for (const q of level.questions) if (!inScope(q.id, 'question')) err(where, `question ${q.id} must be scoped question.${scope}.qN`);

    // Earlier levels in the same skill.
    const earlier = (levelsBySkill.get(level.skillId) ?? []).filter((l) => l.number < level.number);
    const taughtEarlier = new Set(earlier.flatMap((l) => l.concepts.filter((c) => c.role === 'teach').map((c) => c.conceptId)));

    for (const p of level.prerequisites) {
      const pp = safe(() => parseLevelId(p));
      if (!pp) continue;
      if (pp.skillId === level.skillId && pp.number >= level.number) err(where, `prerequisite ${p} is not earlier`);
      if (pp.skillId === level.skillId && !earlier.some((l) => l.id === p)) err(where, `prerequisite ${p} does not exist`);
    }
    if (level.number > 1) {
      const prev = levelId(level.skillId, level.number - 1);
      if (!level.prerequisites.includes(prev)) warn(where, `does not list the previous level ${prev} as a prerequisite`);
    }

    const levelConcepts = new Set(level.concepts.map((c) => c.conceptId));
    for (const lc of level.concepts) {
      if (!conceptIds.has(lc.conceptId)) err(where, `unknown concept ${lc.conceptId}`);
      if (lc.role === 'recall' && !taughtEarlier.has(lc.conceptId))
        err(where, `recalls ${lc.conceptId}, which no earlier level teaches`);
    }
    if (!level.concepts.some((c) => c.role === 'teach')) err(where, 'teaches no concept');

    for (const sid of level.sourceIds) {
      const s = sourceById.get(sid);
      if (!s) err(where, `unknown source ${sid}`);
      else if (level.status === 'published') {
        if (!s.verified) err(where, `published level cites unverified source ${sid}`);
        if (s.license === 'unknown') err(where, `published level cites source ${sid} with unknown license`);
      } else if (!s.verified) warn(where, `cites unverified source ${sid} — verify before publish`);
    }

    const questionById = new Map(level.questions.map((q) => [q.id, q]));
    const usedQuestions = new Set<string>();

    for (const q of level.questions) {
      // Every question must point at the canonical content that teaches it.
      for (const cid of q.sourceCardIds) {
        const owner = cardOwner.get(cid);
        if (!owner) err(q.id, `source card ${cid} does not exist`);
        else if (owner.level.skillId !== level.skillId || owner.level.number > level.number)
          err(q.id, `source card ${cid} must be in this level or an earlier level of the same skill`);
        else if (cardRole(owner.card) === 'question' || cardRole(owner.card) === 'recap')
          err(q.id, `source card ${cid} must be a learning or hook card, not a ${owner.card.type} card`);
      }
      const correct = q.options.filter((o) => o.correct).length;
      if (correct !== 1) err(q.id, `must have exactly one correct option; has ${correct}`);
      const optionIds = q.options.map((o) => o.id);
      if (new Set(optionIds).size !== optionIds.length) err(q.id, 'duplicate option ids');
      const labels = q.options.map((o) => o.label.toLowerCase());
      if (new Set(labels).size !== labels.length) err(q.id, 'duplicate option labels');
      for (const cid of q.conceptIds) {
        if (!conceptIds.has(cid)) err(q.id, `unknown concept ${cid}`);
        else if (!levelConcepts.has(cid)) err(q.id, `tests ${cid}, which is not listed in the level's concepts`);
      }
    }

    for (const card of level.cards) {
      if (card.type === 'mcq' || card.type === 'recall') {
        const q = questionById.get(card.questionId);
        if (!q) {
          err(card.id, `references missing question ${card.questionId}`);
          continue;
        }
        if (usedQuestions.has(q.id)) err(card.id, `question ${q.id} used by more than one card`);
        usedQuestions.add(q.id);
        if (card.type === 'recall' && !q.conceptIds.some((c) => taughtEarlier.has(c)))
          err(card.id, 'recall card must test a concept taught in an earlier level');
      }
      if (card.type === 'image') {
        const a = assetById.get(card.assetId);
        if (!a) err(card.id, `unknown asset ${card.assetId}`);
        else if (level.status === 'published' && a.license === 'unknown') err(card.id, `asset ${a.id} has unknown license`);
      }
    }
    for (const q of level.questions) if (!usedQuestions.has(q.id)) err(q.id, 'is never shown by any card');

    const last = level.cards.at(-1);
    if (last && last.type !== 'checkpoint') warn(where, 'should end with a checkpoint card');
    const first = level.cards[0];
    if (first && !(first.type === 'text' && first.role === 'hook')) warn(where, 'should open with a hook card');
  }

  // Predictable answers undermine learning: warn when one slot dominates a skill.
  for (const [skill, list] of levelsBySkill) {
    const positions = list.flatMap((l) => l.questions.map((q) => q.options.findIndex((o) => o.correct)));
    if (positions.length < ANSWER_POSITION_MIN_SAMPLE) continue;
    const counts = new Map<number, number>();
    for (const p of positions) counts.set(p, (counts.get(p) ?? 0) + 1);
    for (const [p, n] of counts) {
      if (p >= 0 && n / positions.length > ANSWER_POSITION_MAX_SHARE)
        warn(skill, `${n}/${positions.length} correct answers are option ${'abcd'[p]} — vary answer positions`);
    }
  }

  return { issues, content: { subjects, skills, sources, assets, concepts, levels } };
}

const ANSWER_POSITION_MIN_SAMPLE = 8;
const ANSWER_POSITION_MAX_SHARE = 0.45;

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
