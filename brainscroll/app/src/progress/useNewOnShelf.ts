import type { Trophy } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { useProgress } from './ProgressProvider';
import { load, save, TROPHIES_VIEWED_KEY } from './storage';

/** With nothing saved yet (a new device or an update), trophies from the last day count as new. */
const FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * Which trophies on the shelf are NEW: earned since the learner last opened
 * the Trophies screen. Opening it marks them all as looked at, so the tags
 * show this visit and are gone next time. Device-side, per account.
 */
export function useNewOnShelf(trophies: Trophy[] | undefined): ReadonlySet<string> {
  const p = useProgress();
  const userId = p.account?.status === 'signed_in' ? p.account.userId : undefined;
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const ids = trophies?.map((t) => t.trophyId).join(',');
  useEffect(() => {
    if (!trophies || !userId) return;
    let cancelled = false;
    const key = `${TROPHIES_VIEWED_KEY}:${userId}`;
    void load<string[]>(key).then(async (viewed) => {
      const now = Date.now();
      const isNew = (t: Trophy) => (viewed ? !viewed.includes(t.trophyId) : now - Date.parse(t.earnedAt) < FRESH_MS);
      const next = new Set(trophies.filter(isNew).map((t) => t.trophyId));
      await save(key, trophies.map((t) => t.trophyId));
      // Keep tags shown this visit even after a reload of the shelf marks them viewed.
      if (!cancelled) setFresh((prev) => new Set([...prev, ...next]));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, userId]);
  return fresh;
}
