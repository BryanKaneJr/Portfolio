import { useProgress, useProgressView } from './ProgressProvider';

/**
 * The skill to continue (owner, 2026-10-01: "Up next should always suggest
 * the last tree used, or at the very least a chapter left unfinished"):
 *
 *   1. the last tree played (activeSkillId: set when a level starts), while it has a level to play;
 *   2. a tree with a level in progress;
 *   3. a tree with a chapter left unfinished, furthest along first;
 *   4. the furthest along, else the first skill that has levels to play.
 *
 * Browsing a skill's map doesn't change it. Home's "Up next" and the World
 * Map's "You are here" follow it.
 */
export function useCurrentSkill() {
  const p = useProgress();
  const v = useProgressView();
  const playable = v.skills.filter((s) => p.nextLevelId(s.id));
  const byLevel = [...playable].sort((a, b) => b.view.level - a.view.level);
  return (
    playable.find((s) => s.id === p.activeSkillId) ??
    playable.find((s) => Object.keys(v.sessions).some((id) => id.startsWith(s.id.replace(/^skill\./, 'level.') + '.'))) ??
    byLevel.find((s) => s.view.level % 10 !== 0) ??
    byLevel[0] ??
    v.skills.find((s) => s.id === p.activeSkillId) ??
    v.skills[0]
  );
}
