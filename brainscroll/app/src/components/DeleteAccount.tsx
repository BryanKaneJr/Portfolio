import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Caption, Card, Eyebrow } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import { accountLabel } from './AccountCard';

/**
 * In-app account deletion (App Store / Google Play requirement). Easy to find,
 * one clear confirmation, honest about what goes and what doesn't (store
 * subscriptions are cancelled in the store, not here). Afterwards the app is
 * back at the sign-in screen.
 */
export function DeleteAccount() {
  const p = useProgress();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = p.account;
  if (a?.status !== 'signed_in') return null;

  if (!confirming) return <Button variant="ghost" label="Delete account" onPress={() => setConfirming(true)} />;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await p.deleteAccount();
      router.replace('/sign-in');
    } catch {
      setError('Couldn’t delete your account. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <Card variant="quiet">
      <Eyebrow tone="danger">Delete account</Eyebrow>
      <Body>This permanently deletes your account and everything in it: every level, XP, review history and report. It can’t be undone.</Body>
      <Caption>You’ll also be signed out of {accountLabel(a)}.</Caption>
      <Caption>If you subscribe to Unlimited, cancel it in the App Store or Google Play. Deleting your account doesn’t cancel it.</Caption>
      {error && <Body tone="danger">{error}</Body>}
      <Button variant="danger" label={busy ? 'Deleting…' : 'Delete permanently'} disabled={busy} onPress={() => void run()} />
      <Button variant="secondary" label="Keep my account" disabled={busy} onPress={() => setConfirming(false)} />
    </Card>
  );
}
