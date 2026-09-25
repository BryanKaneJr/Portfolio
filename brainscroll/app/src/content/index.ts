import type { Card, Level, Skill, Subject } from '@brainscroll/core';
import raw from './bundle.json';

/**
 * Offline seed content, compiled from /content by `npm run content:build`.
 * Never edit bundle.json by hand.
 */
interface Bundle {
  subjects: Subject[];
  skills: Skill[];
  concepts: { id: string; title: string; description: string }[];
  levels: Level[];
  chapters: Record<string, Chapter[]>;
}

/** A 10-level chapter from the skill's syllabus: `levels` is [first, last]. */
export interface Chapter {
  number: number;
  title: string;
  levels: [number, number];
}

const bundle = raw as unknown as Bundle;

const levelById = new Map(bundle.levels.map((l) => [l.id, l]));
const conceptById = new Map(bundle.concepts.map((c) => [c.id, c]));
const cardById = new Map(bundle.levels.flatMap((l) => l.cards.map((c) => [c.id, c] as const)));

export const subjects = bundle.subjects;
export const allLevels = bundle.levels;
export const skills = bundle.skills;

export function getLevel(id: string): Level | undefined {
  return levelById.get(id);
}

export function levelsForSkill(skillId: string): Level[] {
  return bundle.levels.filter((l) => l.skillId === skillId);
}

export function levelByNumber(skillId: string, n: number): Level | undefined {
  return bundle.levels.find((l) => l.skillId === skillId && l.number === n);
}

export function getSkill(id: string): Skill | undefined {
  return bundle.skills.find((s) => s.id === id);
}

export function subjectName(id: string): string {
  return bundle.subjects.find((s) => s.id === id)?.name ?? id;
}

/** Any card in the offline bundle (used for evidence cards from earlier levels). */
export function getCard(id: string): Card | undefined {
  return cardById.get(id);
}

export function getConcept(id: string) {
  return conceptById.get(id);
}

/** The chapter a level number falls in, when the skill's syllabus is shipped. */
export function chapterFor(skillId: string, levelNumber: number): Chapter | undefined {
  return bundle.chapters[skillId]?.find((c) => levelNumber >= c.levels[0] && levelNumber <= c.levels[1]);
}

/** Every chapter of a skill, in order (empty when its syllabus isn't shipped). */
export function chaptersFor(skillId: string): Chapter[] {
  return bundle.chapters[skillId] ?? [];
}
