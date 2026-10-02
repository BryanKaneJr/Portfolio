import { SOCIAL_ERROR_TEXT, SocialError, type SocialCard } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { DrScrollLoading, StateBlock } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';

/**
 * Opening someone's invite link (https://<invite domain>/invite/CODE, or
 * brainscroll://invite/CODE): you're friends at once, since sharing the link
 * was their yes. Opened while signed out, it waits until you've signed in.
 * Next goes Home, which sends a brand-new learner through onboarding first.
 */
export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const p = useProgress();
  const [friend, setFriend] = useState<SocialCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ready = p.ready && p.account?.status === 'signed_in';
  const { social } = p;
  useEffect(() => {
    if (!ready || !code) return;
    social.acceptInvite(code).then(setFriend, (e: unknown) => setError(e instanceof SocialError ? SOCIAL_ERROR_TEXT[e.code] : 'That invite didn’t work. Try again.'));
  }, [ready, code, social]);
  const toSocial = { label: 'Continue', onPress: () => router.replace('/') };
  if (error) return <StateBlock layout="screen" spot="not-found" title="That invite didn’t work." body={error} action={toSocial} />;
  if (!friend) return <DrScrollLoading label="Opening the invite" delay={0} />;
  return <StateBlock layout="screen" spot="quest.complete" eyebrow="Invite" eyebrowTone="success" title={`You and @${friend.username} are friends!`} body="See how you compare, and who learns more this week." action={toSocial} />;
}
