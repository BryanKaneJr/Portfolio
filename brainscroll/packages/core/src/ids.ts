/**
 * Stable machine IDs. Never use display names as keys.
 *
 *   subject.science
 *   skill.science.astronomy
 *   level.science.astronomy.001          (3+ digits; prestige continues to 101, 200, ...)
 *   level.science.astronomy.001@r3      (published revision 3)
 *   concept.astronomy.light_year
 *   card.astronomy.001.c2
 *   question.astronomy.001.q2
 *   source.nasa_sun_facts
 *   asset.milky_way_diagram
 */

const SLUG = '[a-z0-9]+(?:_[a-z0-9]+)*';
const NUM = '\\d{3,}';

export const ID_PATTERNS = {
  subject: new RegExp(`^subject\\.(${SLUG})$`),
  skill: new RegExp(`^skill\\.(${SLUG})\\.(${SLUG})$`),
  level: new RegExp(`^level\\.(${SLUG})\\.(${SLUG})\\.(${NUM})$`),
  revision: new RegExp(`^(level\\.${SLUG}\\.${SLUG}\\.${NUM})@r([1-9]\\d*)$`),
  concept: new RegExp(`^concept\\.(${SLUG})\\.(${SLUG})$`),
  card: new RegExp(`^card\\.(${SLUG})\\.(${NUM})\\.c([1-9]\\d*)$`),
  question: new RegExp(`^question\\.(${SLUG})\\.(${NUM})\\.q([1-9]\\d*)$`),
  source: new RegExp(`^source\\.(${SLUG})$`),
  asset: new RegExp(`^asset\\.(${SLUG})$`),
} as const;

export type IdKind = keyof typeof ID_PATTERNS;

export function isId(kind: IdKind, value: string): boolean {
  return ID_PATTERNS[kind].test(value);
}

export function padLevelNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid level number: ${n}`);
  return String(n).padStart(3, '0');
}

export function subjectId(subject: string): string {
  return `subject.${subject}`;
}

export function skillId(subject: string, skill: string): string {
  return `skill.${subject}.${skill}`;
}

/** level.<subject>.<skill>.<NNN> for skill id skill.<subject>.<skill>. */
export function levelId(skill: string, n: number): string {
  const m = ID_PATTERNS.skill.exec(skill);
  if (!m) throw new Error(`Invalid skill id: ${skill}`);
  return `level.${m[1]}.${m[2]}.${padLevelNumber(n)}`;
}

export function revisionId(level: string, revision: number): string {
  if (!isId('level', level)) throw new Error(`Invalid level id: ${level}`);
  if (!Number.isInteger(revision) || revision < 1) throw new Error(`Invalid revision: ${revision}`);
  return `${level}@r${revision}`;
}

export interface ParsedLevelId {
  subject: string;
  skill: string;
  skillId: string;
  number: number;
}

export function parseLevelId(id: string): ParsedLevelId {
  const m = ID_PATTERNS.level.exec(id);
  if (!m) throw new Error(`Invalid level id: ${id}`);
  const [, subject, skill, num] = m as unknown as [string, string, string, string];
  return { subject, skill, skillId: `skill.${subject}.${skill}`, number: Number(num) };
}

/** The <skill-slug>.<NNN> scope that card and question IDs inside a level must share. */
export function levelScope(level: string): string {
  const { skill, number } = parseLevelId(level);
  return `${skill}.${padLevelNumber(number)}`;
}
