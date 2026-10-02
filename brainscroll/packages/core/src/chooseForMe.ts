/**
 * Choose For Me: when a learner doesn't know what to learn, pick a skill and
 * drop them into its next level. Plain randomness (owner, 2026-10-02: "pick
 * completely at random now... just the next level of a random tree"): every
 * skill with a level left is equally likely, whatever its subject or progress.
 * The only rule: "Pick again" never shows the same skill twice in a row, so
 * the button always changes something while two or more skills are left.
 */
export interface ChoiceCandidate {
  id: string;
  subjectId: string;
  /** Highest level cleared (0 = not started). */
  level: number;
  /** The skill has a next level to play. */
  hasNext: boolean;
}

export interface Choice {
  skillId: string;
  kind: 'new' | 'resume';
}

export function chooseForMe(
  candidates: ChoiceCandidate[],
  opts: { offered?: string[]; random?: () => number } = {},
): Choice | undefined {
  const random = opts.random ?? Math.random;
  const last = opts.offered?.[opts.offered.length - 1];
  const open = candidates.filter((c) => c.hasNext);
  const pool = open.length > 1 ? open.filter((c) => c.id !== last) : open;
  if (pool.length === 0) return undefined;
  const pick = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]!;
  return { skillId: pick.id, kind: pick.level === 0 ? 'new' : 'resume' };
}
