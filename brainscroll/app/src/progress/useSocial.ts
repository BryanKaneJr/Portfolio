import type { FeedItem, LeagueView, SocialView } from '@brainscroll/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useProgress } from './ProgressProvider';

/**
 * The Social tab's data: you and your friends, this week's league and the
 * feed. Reloaded whenever the screen comes into focus and after progress
 * changes (a cleared level moves your league XP).
 */
export function useSocial() {
  const p = useProgress();
  const [view, setView] = useState<SocialView | null>(null);
  const [league, setLeague] = useState<LeagueView | null>(null);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const signedIn = p.account?.status === 'signed_in' && !p.offline;
  const { social, snapshot } = p;
  const reload = useCallback(async () => {
    try {
      // The league first: joining gives you a username, and paying last week changes the feed.
      const l = await social.league();
      const [v, f] = await Promise.all([social.view(), social.feed()]);
      setLeague(l);
      setView(v);
      setFeed(f);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [social]);
  useFocusEffect(
    useCallback(() => {
      if (signedIn) void reload();
    }, [signedIn, reload, snapshot]), // eslint-disable-line react-hooks/exhaustive-deps
  );
  return { view, league, feed, failed, reload, setFeed };
}
