import type { Card } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { useProgress } from './ProgressProvider';

/**
 * Cards by id (a question's evidence), from any level. Server builds ship no
 * lessons, so they come from the server (cached there for the session); the
 * development harness reads its bundle. Best-effort: while loading, or if the
 * server can't be reached, the missing ones are simply left out, and they're
 * asked for again the next time the ids change.
 */
export function useCards(ids: readonly string[]): Card[] {
  const p = useProgress();
  const [found, setFound] = useState<ReadonlyMap<string, Card>>(new Map());
  const key = ids.join('|');
  useEffect(() => {
    const missing = ids.filter((id) => !found.has(id));
    if (!missing.length) return;
    let cancelled = false;
    p.cards(missing).then(
      (cards) => !cancelled && setFound((prev) => new Map([...prev, ...cards.map((c) => [c.id, c] as const)])),
      () => {},
    );
    return () => {
      cancelled = true;
    };
    // Once per set of ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return ids.flatMap((id) => found.get(id) ?? []);
}
