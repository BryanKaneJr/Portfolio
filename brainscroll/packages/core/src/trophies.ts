import type { ProgressState, XpEvent } from './completion';

/**
 * Milestone trophies: what you've learned, how far, how deeply and how
 * consistently (docs/social-expansion.md, the reward test). They're DERIVED
 * from progress that already exists (first clears, first-clear scores,
 * first-try reviews, quest trophies), never stored, each dated by the moment
 * it was reached. Quest trophies are the stored kind (they depend on
 * finishing inside a week). Mirrors SQL milestone_trophies(); keep
 * trophies.test.ts in step with trophies.test.sql.
 *
 * Besides this fixed list there's one mastery trophy per skill
 * (`trophy.mastery_<skill>`: its Level 100) and one per subject
 * (`trophy.subject_<subject>`: every skill in it mastered).
 */
export const MILESTONE_TROPHIES = [
  { id: 'trophy.first_level', name: 'First Level', description: 'Your first level.' },
  { id: 'trophy.warming_up', name: 'Warming Up', description: '25 levels.' },
  { id: 'trophy.century', name: 'Century', description: '100 levels.' },
  { id: 'trophy.five_hundred', name: 'Five Hundred', description: '500 levels.' },
  { id: 'trophy.thousand', name: 'A Thousand Levels', description: '1,000 levels.' },
  { id: 'trophy.chapter_one', name: 'Chapter One', description: 'A whole chapter: a Level 10 checkpoint.' },
  { id: 'trophy.ten_chapters', name: 'Ten Chapters', description: '10 chapter checkpoints cleared.' },
  { id: 'trophy.fifty_chapters', name: 'Fifty Chapters', description: '50 chapter checkpoints cleared.' },
  { id: 'trophy.halfway', name: 'Halfway There', description: 'Level 50 in a skill.' },
  { id: 'trophy.mastered', name: 'First Mastery', description: 'Your first skill to Level 100.' },
  { id: 'trophy.sharp', name: 'Sharp', description: '10 perfect lessons: every question right first try.' },
  { id: 'trophy.sharper', name: 'Sharper', description: '25 perfect lessons.' },
  { id: 'trophy.precise', name: 'Precise', description: '50 perfect lessons.' },
  { id: 'trophy.exacting', name: 'Exacting', description: '75 perfect lessons.' },
  { id: 'trophy.flawless', name: 'Flawless', description: '100 perfect lessons.' },
  { id: 'trophy.long_memory', name: 'Long Memory', description: '100 reviews right on the first try.' },
  { id: 'trophy.steel_trap', name: 'Steel Trap', description: '500 reviews right on the first try.' },
  { id: 'trophy.curious', name: 'Curious', description: 'A level in 10 different skills.' },
  { id: 'trophy.explorer', name: 'Explorer', description: 'A level in every skill.' },
  { id: 'trophy.well_rounded', name: 'Well Rounded', description: 'Level 10 in five different skills.' },
  { id: 'trophy.polymath', name: 'Polymath', description: 'A level in every subject.' },
  { id: 'trophy.quest_regular', name: 'Quest Regular', description: 'Three weekly quests finished in their week.' },
  { id: 'trophy.quest_veteran', name: 'Quest Veteran', description: 'Ten weekly quests finished in their week.' },
] as const;

export type MilestoneTrophyId = (typeof MILESTONE_TROPHIES)[number]['id'];

/** What the per-skill and per-subject trophies are built from: the shipped skills and subjects. */
export interface TrophyCatalog {
  skills: readonly { id: string; subjectId: string; name: string }[];
  subjects: readonly { id: string; name: string }[];
}

/** `skill.science.astronomy` → `trophy.mastery_astronomy`. */
export const masteryTrophyId = (skillId: string) => `trophy.mastery_${skillId.split('.').at(-1)}`;
/** `subject.history` → `trophy.subject_history`. */
export const subjectTrophyId = (subjectId: string) => `trophy.subject_${subjectId.split('.').at(-1)}`;

export type TrophyKind = 'milestone' | 'mastery' | 'subject';

/** Name, description and kind of any derived trophy id. */
export function trophyInfo(id: string, catalog: TrophyCatalog): { name: string; description: string; kind: TrophyKind; skillId?: string; subjectId?: string } | undefined {
  const fixed = MILESTONE_TROPHIES.find((t) => t.id === id);
  if (fixed) return { name: fixed.name, description: fixed.description, kind: 'milestone' };
  const skill = catalog.skills.find((s) => masteryTrophyId(s.id) === id);
  if (skill) return { name: `Mastered: ${skill.name}`, description: `Level 100 in ${skill.name}.`, kind: 'mastery', skillId: skill.id };
  const subject = catalog.subjects.find((s) => subjectTrophyId(s.id) === id);
  if (subject) return { name: `Master of ${subject.name}`, description: `Every ${subject.name} skill to Level 100.`, kind: 'subject', subjectId: subject.id };
  return undefined;
}

/** `level.science.astronomy.050` → 50. */
const levelNumber = (levelId: string) => Number(levelId.split('.').at(-1));

/** Every milestone and mastery reached, with when. */
export function milestoneTrophies(state: ProgressState, catalog: TrophyCatalog): { trophyId: string; earnedAt: string }[] {
  type Clear = Extract<XpEvent, { type: 'LEVEL_COMPLETE' | 'DELAYED_RECALL' }>;
  const byTime = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at);
  const clears = state.xpEvents.filter((e): e is Clear => e.type === 'LEVEL_COMPLETE').sort(byTime);
  const recalls = state.xpEvents.filter((e) => e.type === 'DELAYED_RECALL').sort(byTime);
  const perfect = Object.values(state.levels)
    .filter((l) => l.total > 0 && l.firstAttemptCorrect === l.total)
    .map((l) => l.completedAt)
    .sort();
  const quests = (state.trophies ?? []).filter((t) => t.kind === 'quest').map((t) => t.earnedAt).sort();
  const firstAt = (n: number) => clears.find((e) => levelNumber(e.levelId) === n)?.at;
  const checkpoints = clears.filter((e) => levelNumber(e.levelId) % 10 === 0).map((e) => e.at);
  const firstPer = (key: (e: Clear) => string, only?: (e: Clear) => boolean) => {
    const m = new Map<string, string>();
    for (const e of clears) if ((!only || only(e)) && !m.has(key(e))) m.set(key(e), e.at);
    return m;
  };
  const skillFirsts = firstPer((e) => e.skillId);
  const tens = [...firstPer((e) => e.skillId, (e) => levelNumber(e.levelId) === 10).values()].sort();
  const hundreds = firstPer((e) => e.skillId, (e) => levelNumber(e.levelId) === 100);
  const subjectOf = new Map(catalog.skills.map((s) => [s.id, s.subjectId]));
  const subjectFirsts = new Map<string, string>();
  for (const e of clears) {
    const sub = subjectOf.get(e.skillId);
    if (sub && !subjectFirsts.has(sub)) subjectFirsts.set(sub, e.at);
  }
  const subjectsWithSkills = new Set(catalog.skills.map((s) => s.subjectId));
  const lastOf = (xs: (string | undefined)[]) => (xs.every(Boolean) && xs.length ? [...(xs as string[])].sort().at(-1) : undefined);

  const earned: Record<string, string | undefined> = {
    'trophy.first_level': clears[0]?.at,
    'trophy.warming_up': clears[24]?.at,
    'trophy.century': clears[99]?.at,
    'trophy.five_hundred': clears[499]?.at,
    'trophy.thousand': clears[999]?.at,
    'trophy.chapter_one': firstAt(10),
    'trophy.ten_chapters': checkpoints[9],
    'trophy.fifty_chapters': checkpoints[49],
    'trophy.halfway': firstAt(50),
    'trophy.mastered': firstAt(100),
    'trophy.sharp': perfect[9],
    'trophy.sharper': perfect[24],
    'trophy.precise': perfect[49],
    'trophy.exacting': perfect[74],
    'trophy.flawless': perfect[99],
    'trophy.long_memory': recalls[99]?.at,
    'trophy.steel_trap': recalls[499]?.at,
    'trophy.curious': [...skillFirsts.values()].sort()[9],
    'trophy.explorer': catalog.skills.length ? lastOf(catalog.skills.map((s) => skillFirsts.get(s.id))) : undefined,
    'trophy.well_rounded': tens[4],
    'trophy.polymath': subjectsWithSkills.size ? lastOf([...subjectsWithSkills].map((s) => subjectFirsts.get(s))) : undefined,
    'trophy.quest_regular': quests[2],
    'trophy.quest_veteran': quests[9],
  };
  for (const s of catalog.skills) earned[masteryTrophyId(s.id)] = hundreds.get(s.id);
  for (const sub of subjectsWithSkills) earned[subjectTrophyId(sub)] = lastOf(catalog.skills.filter((s) => s.subjectId === sub).map((s) => hundreds.get(s.id)));

  return Object.entries(earned)
    .flatMap(([trophyId, at]) => (at ? [{ trophyId, earnedAt: at }] : []))
    .sort((a, b) => a.earnedAt.localeCompare(b.earnedAt) || a.trophyId.localeCompare(b.trophyId));
}
