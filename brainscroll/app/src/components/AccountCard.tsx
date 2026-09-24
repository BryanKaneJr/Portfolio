import { AccountError, ACCOUNT_ERROR_TEXT } from '@brainscroll/core';
import { useState } from 'react';
import { Body, Button, Card, Field, Label } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';

type Mode = { kind: 'idle' } | { kind: 'link-email' } | { kind: 'link-code'; email: string } | { kind: 'signin-email' } | { kind: 'signin-code'; email: string };

const message = (e: unknown) => (e instanceof AccountError ? e.message : ACCOUNT_ERROR_TEXT.UNKNOWN);

/**
 * Keeps progress safe: a guest adds an email (same account, nothing moves), or
 * signs in to an existing account on this device. Email one-time codes only,
 * so no deep links. See docs/accounts.md.
 */
export function AccountCard() {
  const p = useProgress();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const a = p.account;
  const levelsCleared = p.snapshot.completedLevels.length;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
      if (e instanceof AccountError && e.code === 'EMAIL_IN_USE') setMode({ kind: 'signin-email' });
    } finally {
      setBusy(false);
    }
  };
  const reset = () => {
    setMode({ kind: 'idle' });
    setCode('');
    setError(null);
    setConfirmReplace(false);
  };

  if (!a) return null;
  if (a.status === 'device_only')
    return (
      <Card>
        <Label>Account</Label>
        <Body muted>Your progress is saved on this device.</Body>
      </Card>
    );

  // A code is already on its way (e.g. the app was closed mid-link).
  const pending = a.status === 'linking' && mode.kind === 'idle' ? a.pendingEmail : null;

  return (
    <Card accent={a.status !== 'saved'}>
      <Label tone={a.status === 'saved' ? 'success' : 'brand'}>Account</Label>
      {a.status === 'saved' && mode.kind === 'idle' && (
        <>
          <Body>Progress saved to {a.email}.</Body>
          <Body muted>Sign in with this email on any device to pick up where you left off.</Body>
          <Button variant="secondary" label="Sign out" disabled={busy} onPress={() => void run(() => p.signOut())} />
        </>
      )}

      {a.status !== 'saved' && mode.kind === 'idle' && (
        <>
          <Body>You’re playing as a guest.</Body>
          <Body muted>Add your email to keep your progress safe and continue on other devices. Nothing is lost: it’s the same account.</Body>
          {pending ? (
            <Button label={`Enter the code sent to ${pending}`} onPress={() => setMode({ kind: 'link-code', email: pending })} />
          ) : (
            <Button label="Save my progress" onPress={() => setMode({ kind: 'link-email' })} />
          )}
          <Button variant="secondary" label="I already have an account" onPress={() => setMode({ kind: 'signin-email' })} />
        </>
      )}

      {mode.kind === 'link-email' && (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" autoFocus />
          <Button label="Send code" disabled={busy || !email} onPress={() => void run(async () => { await p.startEmailLink(email); setMode({ kind: 'link-code', email }); })} />
          <Button variant="secondary" label="Cancel" onPress={reset} />
        </>
      )}

      {mode.kind === 'link-code' && (
        <>
          <Body muted>We sent a code to {mode.email}. Enter it to save your progress.</Body>
          <Field label="Code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" textContentType="oneTimeCode" maxLength={10} autoFocus />
          <Button label="Confirm" disabled={busy || !code} onPress={() => void run(async () => { await p.confirmEmailLink(mode.email, code); reset(); })} />
          <Button variant="secondary" label="Send a new code" disabled={busy} onPress={() => void run(() => p.startEmailLink(mode.email))} />
          <Button variant="secondary" label="Cancel" onPress={reset} />
        </>
      )}

      {mode.kind === 'signin-email' && (
        <>
          <Body muted>Sign in to an account you already have. We’ll email you a code.</Body>
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
          <Button label="Send code" disabled={busy || !email} onPress={() => void run(async () => { await p.startSignIn(email); setMode({ kind: 'signin-code', email }); })} />
          <Button variant="secondary" label="Cancel" onPress={reset} />
        </>
      )}

      {mode.kind === 'signin-code' && (
        <>
          {a.status !== 'saved' && levelsCleared > 0 && !confirmReplace ? (
            <>
              <Body>
                This device’s guest progress ({levelsCleared} {levelsCleared === 1 ? 'level' : 'levels'}) won’t be added to that account.
              </Body>
              <Body muted>Signing in switches this device to the account’s own progress.</Body>
              <Button label="Continue to sign in" onPress={() => setConfirmReplace(true)} />
              <Button variant="secondary" label="Cancel" onPress={reset} />
            </>
          ) : (
            <>
              <Body muted>Enter the code sent to {mode.email}.</Body>
              <Field label="Code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" textContentType="oneTimeCode" maxLength={10} autoFocus />
              <Button label="Sign in" disabled={busy || !code} onPress={() => void run(async () => { await p.confirmSignIn(mode.email, code); reset(); })} />
              <Button variant="secondary" label="Cancel" onPress={reset} />
            </>
          )}
        </>
      )}

      {error && <Body muted>{error}</Body>}
    </Card>
  );
}
