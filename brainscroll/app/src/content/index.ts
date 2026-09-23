import type { Level, Skill, Subject } from '@brainscroll/core';
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
}

const bundle = raw as unknown as Bundle;

const levelById = new Map(bundle.levels.map((l) => [l.id, l]));
const conceptById = new Map(bundle.concepts.map((c) => [c.id, c]));

export const subjects = bundle.subjects;
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

export function getConcept(id: string) {
  return conceptById.get(id);
}
