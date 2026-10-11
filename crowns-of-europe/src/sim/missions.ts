/** Mission trees: concrete goals per nation with rewards. The player claims rewards; the AI does it automatically. */
import { MISSIONS } from './content';
import { log } from './log';
import { applyEffects, evalCondition } from './events';
import type { GameState, MissionDef, NationId } from './types';

export type MissionState = 'done' | 'ready' | 'active' | 'locked';

export function missionsFor(n: NationId): MissionDef[] {
  const own = MISSIONS.filter(m => m.nation === n);
  return own.length ? own : MISSIONS.filter(m => m.nation === 'generic');
}

export function missionState(s: GameState, n: NationId, m: MissionDef): MissionState {
  const nat = s.nations[n];
  if (nat.missionsDone.includes(m.id)) return 'done';
  if (!m.requires.every(r => nat.missionsDone.includes(r))) return 'locked';
  return evalCondition(s, n, m.goal) ? 'ready' : 'active';
}

export function completeMission(s: GameState, n: NationId, id: string): boolean {
  const m = missionsFor(n).find(x => x.id === id);
  if (!m || missionState(s, n, m) !== 'ready') return false;
  s.nations[n].missionsDone.push(m.id);
  applyEffects(s, n, m.reward);
  if (n === s.player) log(s, 'mission', `Mission complete: ${m.title}.`, { important: true });
  return true;
}

export function monthlyMissions(s: GameState): void {
  for (const nat of Object.values(s.nations)) {
    if (!nat.alive) continue;
    for (const m of missionsFor(nat.id)) {
      if (nat.missionsDone.includes(m.id)) continue;
      const st = missionState(s, nat.id, m);
      if (st !== 'ready') continue;
      if (nat.id === s.player) {
        if (!nat.flags[`_mready_${m.id}`]) {
          nat.flags[`_mready_${m.id}`] = s.day;
          log(s, 'mission', `Mission ready to complete: ${m.title}. Open Missions in the Realm menu to claim the reward.`, { important: true });
        }
      } else completeMission(s, nat.id, m.id);
    }
  }
}

export const readyMissionCount = (s: GameState, n: NationId) => missionsFor(n).filter(m => missionState(s, n, m) === 'ready').length;
