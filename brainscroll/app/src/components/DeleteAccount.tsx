import { router } from 'expo-router';
import { useState } from 'react';
import { Body, Button, Caption, Card, Eyebrow } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';

/**
 * In-app account deletion (App Store / Google Play requirement). Easy to find,
 * one clear confirmation, honest about what goes and what doesn't (store
 * subscriptions are cancelled in the store, not here). Offline builds erase
 * the progress saved on this device.
 */
export function DeleteAccount() {
  const p = useProgress();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = p.account;
  if (!a) return null;
  const local = a.status === 'device_only';
  const label = local ? 'Erase my progress' : 'Delete account';

  if (!confirming) return <Button variant="ghost" label={label} onPress={() => setConfirming(true)} />;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await p.deleteAccount();
      router.replace('/welcome');
    } catch {
      setError('Couldn’t delete your account. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <Card variant="quiet">
      <Eyebrow tone="danger">{label}</Eyebrow>
      <Body>
        {local
          ? 'This erases all progress saved on this device: every level, XP and review. It can’t be undone.'
          : 'This permanently deletes your account and everything in it: every level, XP, review history and report. It can’t be undone.'}
      </Body>
      {a.status === 'saved' && <Caption>You’ll also be signed out of {a.email}.</Caption>}
      {!local && <Caption>If you subscribe to Unlimited, cancel it in the App Store or Google Play. Deleting your account doesn’t cancel it.</Caption>}
      {error && <Body tone="danger">{error}</Body>}
      <Button variant="danger" label={busy ? 'Deleting…' : local ? 'Erase permanently' : 'Delete permanently'} disabled={busy} onPress={() => void run()} />
      <Button variant="secondary" label={local ? 'Keep my progress' : 'Keep my account'} disabled={busy} onPress={() => setConfirming(false)} />
    </Card>
  );
}
