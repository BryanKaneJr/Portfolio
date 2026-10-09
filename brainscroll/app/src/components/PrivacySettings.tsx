import { useEffect, useState } from 'react';
import { Card, Eyebrow, Notice } from '@/components/ui';
import { Toggle } from '@/components/FeedbackSettings';
import { useProgress } from '@/progress/ProgressProvider';
import { space } from '@/theme/tokens';

const DETAIL = 'Only friends and people in your league see your levels, XP and trophies on your profile. Everyone sees your username and avatar, and your total XP on the world leaderboard.';

/**
 * Settings: Private profile (owner, 2026-10-03). Profiles are public by
 * default; turned on, only friends and league mates see the numbers
 * (core profileAccess, SQL get_social_profile).
 */
export function PrivacySettings() {
  const p = useProgress();
  const { social } = p;
  const ready = p.ready && p.account?.status === 'signed_in' && !p.offline;
  const [on, setOn] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!ready) return;
    social.view().then((v) => setOn(v.me.privateProfile), () => {});
  }, [ready, social]);
  if (on === null) return null;
  const set = async (next: boolean) => {
    setFailed(false);
    setOn(next);
    await social.setPrivateProfile(next).catch(() => {
      setOn(!next);
      setFailed(true);
    });
  };
  return (
    <Card style={{ gap: space.md }}>
      <Eyebrow>Privacy</Eyebrow>
      <Toggle label="Private profile" detail={DETAIL} value={on} onChange={(v) => void set(v)} />
      {failed && <Notice tone="muted">That didn’t save. Try again.</Notice>}
    </Card>
  );
}
