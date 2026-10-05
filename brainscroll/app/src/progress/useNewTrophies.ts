import { trophyInfo, type DailyAllowance, type Trophy } from '@brainscroll/core';
import { trophyCatalog } from '@/content';
import { useEffect, useState } from 'react';
import { useProgress } from './ProgressProvider';
import { load, save, TROPHIES_SEEN_KEY } from './storage';
/** With nothing saved yet (a new device or an update), only trophies this recent count as new. */
const FRESH_MS = 10 * 60 * 1000;

/**
 * Trophies earned since the learner last saw the shelf, for a "Trophy earned"
 * moment. Reads the server's shelf (`get_quests`) once per `trigger` (a
 * completion), compares it with what this account has been shown, and marks
 * everything as shown. `exclude` leaves out a trophy the screen already
 * celebrates (a quest's own). If the shelf can't be read (offline right after
 * a level), the trophies the completion itself awarded (`daily`'s `trophy:`
 * Brainpower lines) are shown instead, so the trophy and its +1 aren't lost.
 */
export function useNewTrophies(trigger: string | undefined, exclude?: string, daily?: DailyAllowance): Trophy[] {
  const p = useProgress();
  const userId = p.account?.status === 'signed_in' ? p.account.userId : undefined;
  const [fresh, setFresh] = useState<Trophy[]>([]);
  useEffect(() => {
    if (!trigger || !userId || p.offline) return;
    let cancelled = false;
    const key = `${TROPHIES_SEEN_KEY}:${userId}`;
    Promise.all([p.quests(), load<string[]>(key)])
      .then(async ([view, seen]) => {
        const now = Date.now();
        const isNew = (t: Trophy) => (seen ? !seen.includes(t.trophyId) : now - Date.parse(t.earnedAt) < FRESH_MS);
        const earned = view.trophies.filter((t) => isNew(t) && t.trophyId !== exclude);
        await save(key, view.trophies.map((t) => t.trophyId));
        if (!cancelled) setFresh(earned);
      })
      .catch(() => {
        if (cancelled) return;
        const at = new Date().toISOString();
        setFresh(
          (daily?.brainpowerEarned ?? []).flatMap((e) => {
            const id = e.kind === 'trophy' ? e.key.slice('trophy:'.length) : '';
            const info = id && id !== exclude ? trophyInfo(id, trophyCatalog) : undefined;
            return info ? [{ trophyId: id, name: info.name, kind: info.kind, earnedAt: at } as Trophy] : [];
          }),
        );
      });
    return () => {
      cancelled = true;
    };
    // Once per completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, userId]);
  return fresh;
}
