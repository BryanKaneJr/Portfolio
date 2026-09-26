import { VOICE } from '@brainscroll/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { track } from '@/analytics/track';
import { Body, Button, Caption, Card, Chip, Display, Eyebrow, Icon, Row } from '@/components/ui';
import { useProgress } from '@/progress/ProgressProvider';
import type { Plan, PlanId } from '@/purchases';
import { haptic } from '@/theme/feedback';
import { color, fw, layout, radius, space, type } from '@/theme/tokens';

/** Public links shown under the plans (App Store rules). Terms default to Apple's standard licence. */
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || undefined;

const STAYS_FREE = ['Review, as much as you like', 'Every subject and every level', 'Mastery means the same for everyone'];

/**
 * Unlimited: shown only when the learner reaches the daily cap and asks for
 * more, or opens it from Profile. Never mid-lesson (product rules). It says
 * plainly what Unlimited changes (the daily limit on new levels) and what it
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

  useEffect(() => {
    track('paywall_viewed', { from: from === 'profile' ? 'profile' : 'daily_complete' });
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
    // Plans load once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (outcome === 'purchased') haptic.reward();
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
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={12} style={styles.close}>
          <Icon name="close" tint={color.textMuted} size={24} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: layout.gutter, paddingBottom: space.xl }}>
        <View style={{ width: '100%', maxWidth: layout.readingWidth, alignSelf: 'center', gap: space.xl }}>
          <View style={{ gap: space.sm }}>
            <Eyebrow tone="brand">Unlimited</Eyebrow>
            <Display>{active ? 'Unlimited is on.' : 'Keep leveling today.'}</Display>
            <Body muted>
              {active
                ? 'No daily limit on new levels.'
                : 'No daily limit on new levels. Nothing else changes.'}
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
                <Icon name="check" tint={color.success} size={20} />
                <Body style={{ flex: 1 }}>{planStatus(p.entitlement)}</Body>
              </Row>
            </Card>
          ) : (
            <>
              <View style={{ gap: space.sm }}>
                <Eyebrow>Always free</Eyebrow>
                {STAYS_FREE.map((line) => (
                  <Row key={line} gap={space.sm}>
                    <Icon name="check" tint={color.success} size={18} />
                    <Body style={{ flex: 1 }}>{line}</Body>
                  </Row>
                ))}
              </View>

              {p.purchases.kind === 'unavailable' ? (
                <Card variant="quiet">
                  <Body muted>{p.purchases.unavailableReason}</Body>
                </Card>
              ) : plans === null ? (
                <Caption>Loading plans…</Caption>
              ) : plans.length === 0 ? (
                <Card variant="quiet">
                  <Body muted>Plans couldn’t be loaded. Check your connection and try again.</Body>
                </Card>
              ) : (
                <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
                  {plans.map((plan) => (
                    <PlanOption key={plan.id} plan={plan} selected={plan.id === chosen} onPress={() => setChosen(plan.id)} />
                  ))}
                </View>
              )}
            </>
          )}

          {message && <Body tone={message.tone === 'danger' ? 'danger' : undefined} muted={message.tone === 'muted'}>{message.text}</Body>}

          <Caption>{VOICE.fairness}</Caption>
          {!active && canBuy && (
            <Caption tone="faint">
              Payment is charged to your {p.purchases.kind === 'store' ? 'App Store or Google Play' : 'store'} account. The subscription renews automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel it anytime in your store account settings.
            </Caption>
          )}
          <Row gap={space.lg}>
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
              <Button variant="ghost" label={busy === 'manage' ? 'Opening…' : p.purchases.kind === 'sandbox' ? 'End sandbox plan' : 'Manage subscription'} disabled={!!busy} onPress={() => void run('manage', p.manageSubscription)} />
            )}
          </>
        ) : (
          <>
            <Button label={busy === 'buy' ? 'Opening the store…' : 'Start Unlimited'} disabled={!canBuy || !!busy} onPress={() => void buy()} />
            {p.purchases.kind !== 'unavailable' && (
              <Button variant="ghost" label={busy === 'restore' ? 'Restoring…' : 'Restore purchases'} disabled={!!busy} onPress={() => void restore()} />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function PlanOption({ plan, selected, onPress }: { plan: Plan; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${plan.id === 'annual' ? 'Yearly' : 'Monthly'}, ${plan.price} ${plan.period}`}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={[styles.plan, selected && styles.planSelected]}>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
      <View style={{ flex: 1, gap: space.xxs }}>
        <Text style={styles.planName}>{plan.id === 'annual' ? 'Yearly' : 'Monthly'}</Text>
        {plan.note && <Caption>{plan.note}</Caption>}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={styles.planPrice}>{plan.price}</Text>
        <Caption>{plan.period}</Caption>
      </View>
    </Pressable>
  );
}

function planStatus(e: { expiresAt: string | null; willRenew: boolean | null; store: string | null }): string {
  if (!e.expiresAt) return 'Unlimited is active.';
  const date = new Date(e.expiresAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  return e.willRenew === false ? `Unlimited stays on until ${date}, then won’t renew.` : `Renews on ${date}.`;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: layout.gutter, paddingVertical: space.sm },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.md, gap: space.sm, width: '100%', maxWidth: layout.readingWidth + 2 * layout.gutter, alignSelf: 'center', borderTopWidth: 1, borderTopColor: color.border },
  plan: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 2, borderColor: color.border, backgroundColor: color.surface },
  planSelected: { borderColor: color.brand, backgroundColor: color.brandSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: color.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.brand },
  planName: { ...type.title, color: color.text },
  planPrice: { color: color.text, fontSize: 20, ...fw('800') },
  link: { ...type.caption, color: color.brandText, textDecorationLine: 'underline' },
});
