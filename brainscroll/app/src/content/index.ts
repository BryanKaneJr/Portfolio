import type { Card, Level, LevelType, Skill, Subject } from '@brainscroll/core';
import raw from './built/index.json';
import { SKILL_LEVELS } from './built/levels';

/**
 * Offline content, compiled from /content by `npm run content:build` into
 * `built/` (never edit it by hand). Split so the app starts fast: the index
 * (subjects, skills, chapters, concept titles, and each level's title,
 * number and art) loads at launch; a skill's full lessons load the first time
 * one of its lessons, or one of its cards, is needed.
 */
interface Index {
  subjects: Subject[];
  skills: Skill[];
  concepts: { id: string; title: string }[];
  levels: LevelMeta[];
  chapters: Record<string, Chapter[]>;
}

/** What screens show about a level without opening it. */
export interface LevelMeta {
  id: string;
  skillId: string;
  number: number;
  type: LevelType;
  revision: number;
  title: string;
  art?: string;
}

/** A 10-level chapter from the skill's syllabus: `levels` is [first, last]. */
export interface Chapter {
  number: number;
  title: string;
  levels: [number, number];
  /** The recap lines of the chapter's last level: what clearing it means. */
  learned?: string[];
}

const index = raw as unknown as Index;

const metaById = new Map(index.levels.map((l) => [l.id, l]));
const metaBySkill = new Map<string, LevelMeta[]>();
for (const l of index.levels) metaBySkill.set(l.skillId, [...(metaBySkill.get(l.skillId) ?? []), l]);
const conceptById = new Map(index.concepts.map((c) => [c.id, c]));
/** Card and level ids name their skill by its last id segment (`card.astronomy.001.c1`). */
const skillBySlug = new Map(index.skills.map((s) => [s.id.split('.').at(-1)!, s.id]));

// ── Full lessons, loaded per skill on first use ──
const loaded = new Map<string, { levels: Map<string, Level>; cards: Map<string, Card> }>();
function lessons(skillId: string) {
  let entry = loaded.get(skillId);
  if (!entry) {
    const list = SKILL_LEVELS[skillId]?.() ?? [];
    entry = { levels: new Map(list.map((l) => [l.id, l])), cards: new Map(list.flatMap((l) => l.cards.map((c) => [c.id, c] as const))) };
    loaded.set(skillId, entry);
  }
  return entry;
}

export const subjects = index.subjects;
export const skills = index.skills;

/** A full level (cards and questions). Loads its skill's lessons the first time. */
export function getLevel(id: string): Level | undefined {
  const meta = metaById.get(id);
  return meta ? lessons(meta.skillId).levels.get(id) : undefined;
}

/** Title, number and art of a level, without loading its lessons. */
export function levelMeta(id: string): LevelMeta | undefined {
  return metaById.get(id);
}

export function levelByNumber(skillId: string, n: number): LevelMeta | undefined {
  return metaBySkill.get(skillId)?.find((l) => l.number === n);
}

export function levelCount(skillId: string): number {
  return metaBySkill.get(skillId)?.length ?? 0;
}

/**
 * Every full level in every skill. Loads everything: only for the local
 * development harness, whose review queue runs on-device.
 */
export function allLevels(): Level[] {
  return index.skills.flatMap((s) => [...lessons(s.id).levels.values()]);
}

export function getSkill(id: string): Skill | undefined {
  return index.skills.find((s) => s.id === id);
}

export function subjectName(id: string): string {
  return index.subjects.find((s) => s.id === id)?.name ?? id;
}

/** Any card, from any skill (evidence cards can come from earlier levels). */
export function getCard(id: string): Card | undefined {
  const skillId = skillBySlug.get(id.split('.')[1] ?? '');
  return skillId ? lessons(skillId).cards.get(id) : undefined;
}

export function getConcept(id: string) {
  return conceptById.get(id);
}

/** The chapter a level number falls in, when the skill's syllabus is shipped. */
export function chapterFor(skillId: string, levelNumber: number): Chapter | undefined {
  return index.chapters[skillId]?.find((c) => levelNumber >= c.levels[0] && levelNumber <= c.levels[1]);
}

/** Every chapter of a skill, in order (empty when its syllabus isn't shipped). */
export function chaptersFor(skillId: string): Chapter[] {
  return index.chapters[skillId] ?? [];
}
