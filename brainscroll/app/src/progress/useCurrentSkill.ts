import { useProgress, useProgressView } from './ProgressProvider';

/**
 * The skill to continue: the active one, else one with a level in progress,
 * else the furthest along, else the first skill that has levels to play.
 * The World Map's quest card and "You are here" flag follow it.
 */
export function useCurrentSkill() {
  const p = useProgress();
  const v = useProgressView();
  const playable = v.skills.filter((s) => p.nextLevelId(s.id) || s.view.level > 0);
  return (
    v.skills.find((s) => s.id === p.activeSkillId) ??
    playable.find((s) => Object.keys(v.sessions).some((id) => id.startsWith(s.id.replace(/^skill\./, 'level.') + '.'))) ??
    [...playable].sort((a, b) => b.view.level - a.view.level)[0] ??
    v.skills[0]
  );
}
