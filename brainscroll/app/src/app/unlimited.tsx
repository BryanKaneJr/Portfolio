import { VOICE } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { Body, Button, Caption, Card, Chip, Display, Eyebrow, Icon, IconButton, LoadError, Loading, Notice, Row, Skeleton } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import type { Plan, PlanId } from '@/purchases';
import { feedback } from '@/theme/feedback';
import { color, depth, fw, iconSize, layout, radius, space, type } from '@/theme/tokens';

/** Public links shown under the plans (App Store rules). Terms default to Apple's standard licence. */
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || undefined;

const STAYS_FREE = ['Review, as much as you like', 'Every subject and every level', 'Mastery means the same for everyone'];

/**
 * Unlimited: shown only when the learner runs out of Brainpower and asks for
 * more, or opens it from Settings. Never mid-lesson (product rules). It says
 * plainly what Unlimited changes (∞ Brainpower for new levels) and what it
 * doesn't (everything else). Pay for freedom, not knowledge.
 */
export default function UnlimitedScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const p = useProgress();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [chosen, setChosen] = useState<PlanId>('annual');
  const [busy, setBusy] = useState<'buy' | 'restore' | 'manage' | null>(null);
  const [message, setMessage] = useState<{ tone: 'danger' | 'muted'; text: string } | null>(null);
  const active = p.entitlement.active;
  // Bumped by "Try again" when the plans couldn't be loaded.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    track('paywall_viewed', { from: from === 'profile' ? 'profile' : 'daily_complete' });
  }, [from]);

  useEffect(() => {
    let alive = true;
    p.purchases
      .plans()
      .then((list) => {
        if (!alive) return;
        setPlans(list);
        if (list.length && !list.some((pl) => pl.id === 'annual')) setChosen(list[0]!.id);
      })
      .catch(() => alive && setPlans([]));
    return () => {
      alive = false;
    };
    // Plans load once per visit (and again on "Try again").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const run = async (kind: 'buy' | 'restore' | 'manage', action: () => Promise<void>) => {
    setBusy(kind);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error && e.message ? e.message : 'Something went wrong. Nothing was charged. Please try again.' });
    }
    setBusy(null);
  };

  const buy = () =>
    run('buy', async () => {
      const outcome = await p.buyUnlimited(chosen);
      if (outcome === 'purchased') feedback('purchase');
      if (outcome === 'pending') setMessage({ tone: 'muted', text: 'Your purchase is waiting for approval. Unlimited turns on as soon as it goes through.' });
    });
  const restore = () =>
    run('restore', async () => {
      const found = await p.restorePurchases();
      if (!found) setMessage({ tone: 'muted', text: 'No Unlimited purchase was found for this store account.' });
    });

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const canBuy = p.purchases.kind !== 'unavailable' && !!plans?.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bgDeep }} edges={['top']}>
      <View style={styles.top}>
        <IconButton label="Close" icon="close" onPress={close} />
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: layout.gutter, paddingBottom: space.xl }}>
        <View style={{ width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', gap: space.xl }}>
          <View style={{ gap: space.sm }}>
            <Eyebrow tone="brand">Unlimited</Eyebrow>
            <Display>{active ? 'Unlimited is on.' : 'Keep leveling today.'}</Display>
            <Body muted>
              {active
                ? '∞ Brainpower: as many new levels as you like.'
                : '∞ Brainpower: as many new levels as you like. Nothing else changes.'}
            </Body>
            {p.purchases.kind === 'sandbox' && (
              <Chip icon="shield">
                <Caption>Sandbox: no money changes hands</Caption>
              </Chip>
            )}
          </View>

          {active ? (
            <Card style={{ gap: space.sm }}>
              <Row gap={space.sm}>
                <Icon name="check" tint={color.success} size={iconSize.md} />
                <Body style={{ flex: 1 }}>{planStatus(p.entitlement)}</Body>
              </Row>
            </Card>
          ) : (
            <>
              <View style={{ gap: space.sm }}>
                <Eyebrow>Always free</Eyebrow>
                {STAYS_FREE.map((line) => (
                  <Row key={line} gap={space.sm}>
                    <Icon name="check" tint={color.success} size={iconSize.md} />
                    <Body style={{ flex: 1 }}>{line}</Body>
                  </Row>
                ))}
              </View>

              {p.purchases.kind === 'unavailable' ? (
                <Card variant="quiet">
                  <Body muted>{p.purchases.unavailableReason}</Body>
                </Card>
              ) : plans === null ? (
                <Loading label="Loading plans" style={{ gap: space.sm }}>
                  <Skeleton height={PLAN_HEIGHT} r={radius.lg} />
                  <Skeleton height={PLAN_HEIGHT} r={radius.lg} />
                </Loading>
              ) : plans.length === 0 ? (
                <LoadError
                  layout="inline"
                  onRetry={() => {
                    setPlans(null);
                    setAttempt((a) => a + 1);
                  }}
                />
              ) : (
                <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
                  {plans.map((plan) => (
                    <PlanOption key={plan.id} plan={plan} selected={plan.id === chosen} onPress={() => setChosen(plan.id)} />
                  ))}
                </View>
              )}
            </>
          )}

          {message && <Notice key={message.text} tone={message.tone}>{message.text}</Notice>}

          <Caption>{VOICE.fairness}</Caption>
          {!active && canBuy && (
            <Caption tone="faint">
              Payment is charged to your {p.purchases.kind === 'store' ? 'App Store or Google Play' : 'store'} account. The subscription renews automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel it anytime in your store account settings.
            </Caption>
          )}
          <Row gap={space.xl}>
            <Text accessibilityRole="link" style={styles.link} onPress={() => void Linking.openURL(TERMS_URL)}>
              Terms of Use
            </Text>
            {PRIVACY_URL && (
              <Text accessibilityRole="link" style={styles.link} onPress={() => void Linking.openURL(PRIVACY_URL)}>
                Privacy Policy
              </Text>
            )}
          </Row>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        {active ? (
          <>
            <Button label="Keep learning" onPress={() => (from === 'daily_complete' ? router.dismissTo('/') : close())} />
            {p.purchases.kind !== 'unavailable' && (
              <Button variant="ghost" label={busy === 'manage' ? 'Opening' : p.purchases.kind === 'sandbox' ? 'End sandbox plan' : 'Manage subscription'} loading={busy === 'manage'} disabled={!!busy} onPress={() => void run('manage', p.manageSubscription)} />
            )}
          </>
        ) : (
          <>
            <Button label={busy === 'buy' ? 'Opening the store' : 'Start Unlimited'} loading={busy === 'buy'} disabled={!canBuy || !!busy} onPress={() => void buy()} />
            {p.purchases.kind !== 'unavailable' && (
              <Button variant="ghost" label={busy === 'restore' ? 'Restoring' : 'Restore purchases'} loading={busy === 'restore'} disabled={!!busy} onPress={() => void restore()} />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

/** A plan option's height, so its loading placeholder matches. */
const PLAN_HEIGHT = 76;

function PlanOption({ plan, selected, onPress }: { plan: Plan; selected: boolean; onPress: () => void }) {
  return (
    <Card
      role="radio"
      state={selected ? 'selected' : undefined}
      accessibilityLabel={`${plan.id === 'annual' ? 'Yearly' : 'Monthly'}, ${plan.price} ${plan.period}`}
      onPress={() => {
        feedback('select');
        onPress();
      }}
      style={styles.plan}>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text style={styles.planName}>{plan.id === 'annual' ? 'Yearly' : 'Monthly'}</Text>
        {plan.note && <Caption>{plan.note}</Caption>}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.planPrice}>{plan.price}</Text>
        <Caption>{plan.period}</Caption>
      </View>
    </Card>
  );
}

function planStatus(e: { expiresAt: string | null; willRenew: boolean | null; store: string | null }): string {
  if (!e.expiresAt) return 'Unlimited is active.';
  const date = new Date(e.expiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  return e.willRenew === false ? `Unlimited stays on until ${date}, then won’t renew.` : `Renews on ${date}.`;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: layout.gutter, paddingVertical: space.sm },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.md, gap: space.sm, width: '100%', maxWidth: layout.readingWidth + 2 * layout.gutter, alignSelf: 'center', borderTopWidth: depth.line, borderTopColor: color.border },
  plan: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: PLAN_HEIGHT },
  // A fixed-size radio mark: the ring and its dot stay round at any text size.
  radio: { width: 22, height: 22, borderRadius: radius.pill, borderWidth: depth.border, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: color.brand },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: color.brand },
  planName: { ...type.title, color: color.text },
  planPrice: { ...type.title, ...fw('800'), color: color.text },
  // Caption-sized links, padded to a 44 pt touch target (20 + 2 × 12).
  link: { ...type.caption, color: color.brandText, textDecorationLine: 'underline', paddingVertical: space.md },
});
