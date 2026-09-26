import { AccountError, ACCOUNT_ERROR_TEXT, maskPhone, normalizeEmail, SIGN_IN_METHOD_LABEL, VOICE, type OtpTarget } from '@brainscroll/core';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppleSignInButton } from '@/auth/AppleSignInButton';
import { Body, Button, Caption, Display, DrScroll, Eyebrow, Field, GoogleMark, H1, Icon } from '@/components/ui';
import { DEV_CODE } from '@/progress/localBackend';
import { useProgress } from '@/progress/ProgressProvider';
import { color, layout, space } from '@/theme/tokens';

/** Seconds before "Send a new code" can be tapped again. */
const RESEND_COOLDOWN_S = 30;

type Step = { kind: 'choose' } | { kind: 'enter'; channel: OtpTarget['channel'] } | { kind: 'code'; target: OtpTarget };

const message = (e: unknown) => (e instanceof AccountError ? e.message : ACCOUNT_ERROR_TEXT.UNKNOWN);

/**
 * The front door, and the only screen before an account exists. One tap with
 * Apple or Google, or a code by text or email: open the app → sign in →
 * onboarding → Level 1. Signing in creates the account on first use, so there
 * is no separate sign-up and no guest mode. Progress then follows the account
 * across reinstalls and devices. See docs/accounts.md.
 */
export default function SignInScreen() {
  const p = useProgress();
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // Which action is in flight, so its button can say so ("Sending…").
  const [pending, setPending] = useState<'send' | 'verify' | null>(null);
  // Seconds until "Send a new code" is allowed again.
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  const [error, setError] = useState<string | null>(null);
  const methods = p.signInMethods;

  const run = async (fn: () => Promise<void>, what: 'send' | 'verify' | null = null) => {
    setBusy(true);
    setPending(what);
    setError(null);
    try {
      await fn();
    } catch (e) {
      // Closing the Apple/Google sheet is a choice, not a failure.
      if (!(e instanceof AccountError && e.code === 'CANCELLED')) setError(message(e));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };
  const back = () => {
    setStep({ kind: 'choose' });
    setCode('');
    setError(null);
  };
  const target = (channel: OtpTarget['channel']): OtpTarget => (channel === 'phone' ? { channel, phone } : { channel, email });
  const sendTo = (t: OtpTarget) => (t.channel === 'phone' ? maskPhone(t.phone) : normalizeEmail(t.email));

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {step.kind === 'choose' && (
            <>
              <View style={styles.hero}>
                <DrScroll spot="sign-in" size="lg" />
                <Eyebrow tone="brand">BrainScroll</Eyebrow>
                <Display center>{VOICE.tagline}</Display>
                <Body muted center>
                  Short, finished lessons in real subjects. Level up skills from 1 to 100 like an RPG character, except the stats are things you actually know.
                </Body>
              </View>
              <View style={styles.methods}>
                {methods.includes('apple') && <AppleSignInButton disabled={busy} onPress={() => void run(() => p.signInWithProvider('apple'))} />}
                {methods.includes('google') && (
                  <Button variant="secondary" icon={<GoogleMark size={20} />} label={SIGN_IN_METHOD_LABEL.google} disabled={busy} onPress={() => void run(() => p.signInWithProvider('google'))} />
                )}
                {methods.includes('phone') && (
                  <Button variant="secondary" icon={<Icon name="phone" tint={color.text} size={20} />} label={SIGN_IN_METHOD_LABEL.phone} disabled={busy} onPress={() => setStep({ kind: 'enter', channel: 'phone' })} />
                )}
                {methods.includes('email') && (
                  <Button variant="secondary" icon={<Icon name="mail" tint={color.text} size={20} />} label={SIGN_IN_METHOD_LABEL.email} disabled={busy} onPress={() => setStep({ kind: 'enter', channel: 'email' })} />
                )}
                {p.ready && methods.length === 0 && <Body tone="danger">No sign-in method is set up for this build yet.</Body>}
              </View>
            </>
          )}

          {step.kind === 'enter' && (
            <>
              <Eyebrow tone="brand">{step.channel === 'phone' ? 'Phone number' : 'Email'}</Eyebrow>
              <H1>{step.channel === 'phone' ? 'What’s your number?' : 'What’s your email?'}</H1>
              <Body muted>We’ll send you a 6-digit code. New here? This creates your account.</Body>
              {step.channel === 'phone' ? (
                <Field
                  label="Phone number"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 555 123 4567"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  autoFocus
                />
              ) : (
                <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" autoFocus />
              )}
              <Button
                label={pending === 'send' ? 'Sending…' : 'Send code'}
                disabled={busy || !(step.channel === 'phone' ? phone : email)}
                onPress={() =>
                  void run(async () => {
                    const t = target(step.channel);
                    await p.sendCode(t);
                    setStep({ kind: 'code', target: t });
                    setCooldown(RESEND_COOLDOWN_S);
                  }, 'send')
                }
              />
              <Button variant="ghost" label="Use another way" disabled={busy} onPress={back} />
            </>
          )}

          {step.kind === 'code' && (
            <>
              <Eyebrow tone="brand">Check your {step.target.channel === 'phone' ? 'messages' : 'email'}</Eyebrow>
              <H1>Enter your code</H1>
              <Body muted>We sent it to {sendTo(step.target)}.</Body>
              <Field label="Code" value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={10} autoFocus />
              <Button label={pending === 'verify' ? 'Verifying…' : 'Continue'} disabled={busy || !code} onPress={() => void run(() => p.verifyCode(step.target, code), 'verify')} />
              <Button
                variant="secondary"
                label={pending === 'send' ? 'Sending…' : cooldown > 0 ? `Send a new code in ${cooldown}` : 'Send a new code'}
                disabled={busy || cooldown > 0}
                onPress={() =>
                  void run(async () => {
                    await p.sendCode(step.target);
                    setCooldown(RESEND_COOLDOWN_S);
                  }, 'send')
                }
              />
              {/* Straight back to the field, with what was typed kept, to fix a typo. */}
              <Button
                variant="ghost"
                label={step.target.channel === 'phone' ? 'Change number' : 'Change email'}
                disabled={busy}
                onPress={() => {
                  setCode('');
                  setError(null);
                  setStep({ kind: 'enter', channel: step.target.channel });
                }}
              />
              <Button variant="ghost" label="Use another way" disabled={busy} onPress={back} />
            </>
          )}

          {(error ?? p.error) && <Body tone="danger">{error ?? p.error}</Body>}
          <View style={styles.fine}>
            <Caption tone="faint" center>
              Your progress is saved to your account, so it follows you to any device. We never post anything or share it.
            </Caption>
            {p.backend === 'local' && (
              <Caption tone="faint" center>
                Development build: accounts are simulated on this device. Every code is {DEV_CODE}.
              </Caption>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    paddingVertical: space.xxl,
    gap: space.lg,
    width: '100%',
    maxWidth: layout.readingWidth + 2 * layout.gutter,
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', gap: space.md, marginBottom: space.lg },
  methods: { gap: space.md },
  fine: { gap: space.xs, marginTop: space.md },
});
