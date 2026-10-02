import { parseLevelId } from '@brainscroll/core';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { useProgress } from './ProgressProvider';

/**
 * The single "learn a level" intent. At 5/5 a new level routes to Daily
 * Complete, never to an error. The level screen re-checks with the backend.
 */
export function useStartLevel() {
  const p = useProgress();
  return useCallback(
    (levelId: string) => {
      // Home's Continue card follows whatever the learner is studying.
      p.setActiveSkill(parseLevelId(levelId).skillId);
      if (!p.isCompleted(levelId) && p.snapshot.daily.dailyComplete) router.push('/daily-complete');
      else router.push({ pathname: '/level/[id]', params: { id: levelId } });
    },
    [p],
  );
}
