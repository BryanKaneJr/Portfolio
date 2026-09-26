import { AccountError, ACCOUNT_ERROR_TEXT, maskPhone, type AccountState } from '@brainscroll/core';
import { useState } from 'react';
import { Body, Button, Card, Eyebrow as Label } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';

const METHOD_NAME = { apple: 'Apple', google: 'Google', phone: 'your phone number', email: 'email' } as const;

/** What the learner signed in with, shown the way they'd recognise it. */
export function accountLabel(a: Extract<AccountState, { status: 'signed_in' }>): string {
  if (a.method === 'phone' && a.phone) return maskPhone(a.phone.startsWith('+') ? a.phone : `+${a.phone}`);
  return a.email ?? a.phone ?? 'your account';
}

/**
 * Every learner has an account, so this only says which one and offers sign
 * out. Progress stays with the account and comes back on the next sign-in,
 * on this device or any other. See docs/accounts.md.
 */
export function AccountCard() {
  const p = useProgress();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = p.account;
  if (a?.status !== 'signed_in') return null;

  const signOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await p.signOut();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : ACCOUNT_ERROR_TEXT.UNKNOWN);
      setBusy(false);
    }
  };

  return (
    <Card>
      <Label>Account</Label>
      <Body>
        Signed in with {METHOD_NAME[a.method]}
        {a.method === 'apple' || a.method === 'google' ? ` as ${accountLabel(a)}` : `: ${accountLabel(a)}`}
      </Body>
      <Button variant="secondary" label="Sign out" disabled={busy} onPress={() => void signOut()} />
      {error && <Body muted>{error}</Body>}
    </Card>
  );
}
