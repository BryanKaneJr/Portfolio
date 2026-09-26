/**
 * Choose For Me: when a learner doesn't know what to learn, pick a skill and
 * drop them into its next level. Deliberately not a recommender: smart
 * randomness over the skills that have a level to play.
 *
 * - Never the skill they're already on (that's what Continue is for), and
 *   never one already offered this round ("Pick again" moves on).
 * - A different subject from the current skill and the last offer, so the
 *   pick feels like a change of scene.
 * - Usually a skill they haven't started (new to them); sometimes one they
 *   left partway, to pick back up.
 *
 * Each rule relaxes when it would leave nothing to pick, so there is always
 * an answer while any skill has a level left.
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

/** How often a new skill wins when both new and started ones are on offer. */
export const CHOOSE_NEW_SHARE = 0.7;

export function chooseForMe(
  candidates: ChoiceCandidate[],
  opts: { currentSkillId?: string; offered?: string[]; random?: () => number } = {},
): Choice | undefined {
  const random = opts.random ?? Math.random;
  const offered = opts.offered ?? [];
  const bySkill = new Map(candidates.map((c) => [c.id, c]));
  const avoidSubjects = new Set(
    [opts.currentSkillId, offered[offered.length - 1]].flatMap((id) => (id && bySkill.get(id) ? [bySkill.get(id)!.subjectId] : [])),
  );

  // Narrow step by step, keeping the last non-empty set.
  let pool = candidates.filter((c) => c.hasNext);
  const narrow = (keep: (c: ChoiceCandidate) => boolean) => {
    const next = pool.filter(keep);
    if (next.length > 0) pool = next;
  };
  narrow((c) => c.id !== opts.currentSkillId);
  narrow((c) => !offered.includes(c.id));
  narrow((c) => !avoidSubjects.has(c.subjectId));
  if (pool.length === 0) return undefined;

  const fresh = pool.filter((c) => c.level === 0);
  const started = pool.filter((c) => c.level > 0);
  const from = fresh.length && started.length ? (random() < CHOOSE_NEW_SHARE ? fresh : started) : pool;
  const pick = from[Math.min(from.length - 1, Math.floor(random() * from.length))]!;
  return { skillId: pick.id, kind: pick.level === 0 ? 'new' : 'resume' };
}
