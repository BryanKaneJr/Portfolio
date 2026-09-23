import { router } from 'expo-router';
import { useCallback } from 'react';
import { useProgress } from './ProgressProvider';

/** The single "learn a level" intent. At 5/5 it routes to Daily Complete, never to an error. */
export function useStartLevel() {
  const p = useProgress();
  return useCallback(
    (levelId: string) => {
      const reason = p.checkStart(levelId);
      if (reason === 'DAILY_COMPLETE') router.push('/daily-complete');
      else if (reason === 'NEW' || reason === 'REPLAY') router.push({ pathname: '/level/[id]', params: { id: levelId } });
    },
    [p],
  );
}
