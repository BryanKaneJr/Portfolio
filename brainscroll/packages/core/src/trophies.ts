import type { ProgressState, XpEvent } from './completion';

/**
 * Milestone trophies: what you've learned, how far and how consistently
 * (docs/social-expansion.md, the reward test). They're DERIVED from progress
 * that already exists (first clears and first-try reviews in the ledger),
 * never stored, each with the moment it was reached. Quest trophies are the
 * stored kind (they depend on finishing inside a week). Mirrors SQL
 * milestone_trophies(); keep trophies.test.ts in step with trophies.test.sql.
 */
export const MILESTONE_TROPHIES = [
  { id: 'trophy.first_level', name: 'First Level', description: 'Your first level.' },
  { id: 'trophy.chapter_one', name: 'Chapter One', description: 'A whole chapter: a Level 10 checkpoint.' },
  { id: 'trophy.halfway', name: 'Halfway There', description: 'Level 50 in a skill.' },
  { id: 'trophy.mastered', name: 'Mastered', description: 'Level 100 in a skill.' },
  { id: 'trophy.well_rounded', name: 'Well Rounded', description: 'Level 10 in five different skills.' },
  { id: 'trophy.polymath', name: 'Polymath', description: 'A level in every subject.' },
  { id: 'trophy.century', name: 'Century', description: '100 levels.' },
  { id: 'trophy.five_hundred', name: 'Five Hundred', description: '500 levels.' },
  { id: 'trophy.long_memory', name: 'Long Memory', description: '100 reviews right on the first try.' },
] as const;

export type MilestoneTrophyId = (typeof MILESTONE_TROPHIES)[number]['id'];

/** `level.science.astronomy.050` → 50. */
const levelNumber = (levelId: string) => Number(levelId.split('.').at(-1));
/** `skill.science.astronomy` → `subject.science`. */
const subjectOf = (skillId: string) => `subject.${skillId.split('.')[1]}`;

/** Every milestone reached, with when: `subjectCount` is how many subjects have skills (for Polymath). */
export function milestoneTrophies(state: ProgressState, subjectCount: number): { trophyId: MilestoneTrophyId; earnedAt: string }[] {
  type Clear = Extract<XpEvent, { type: 'LEVEL_COMPLETE' | 'DELAYED_RECALL' }>;
  const byTime = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at);
  const clears = state.xpEvents.filter((e): e is Clear => e.type === 'LEVEL_COMPLETE').sort(byTime);
  const recalls = state.xpEvents.filter((e) => e.type === 'DELAYED_RECALL').sort(byTime);
  const firstAt = (n: number) => clears.find((e) => levelNumber(e.levelId) === n)?.at;
  const tens = [...new Map(clears.filter((e) => levelNumber(e.levelId) === 10).map((e) => [e.skillId, e.at] as const)).values()].sort();
  const subjects = new Map<string, string>();
  for (const e of clears) if (!subjects.has(subjectOf(e.skillId))) subjects.set(subjectOf(e.skillId), e.at);
  const earned: Record<MilestoneTrophyId, string | undefined> = {
    'trophy.first_level': clears[0]?.at,
    'trophy.chapter_one': firstAt(10),
    'trophy.halfway': firstAt(50),
    'trophy.mastered': firstAt(100),
    'trophy.well_rounded': tens[4],
    'trophy.polymath': subjectCount > 0 && subjects.size >= subjectCount ? [...subjects.values()].sort().at(-1) : undefined,
    'trophy.century': clears[99]?.at,
    'trophy.five_hundred': clears[499]?.at,
    'trophy.long_memory': recalls[99]?.at,
  };
  return MILESTONE_TROPHIES.flatMap((t) => (earned[t.id] ? [{ trophyId: t.id, earnedAt: earned[t.id]! }] : [])).sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
}
